import { addMonths } from "date-fns";
import { db, LOCAL_USER_ID, ensureLocalUser } from "@/lib/db";
import { deduplicateEvents } from "@/lib/dedupe";
import { getEnv } from "@/lib/env";
import { canonicalVenueKey, normalizeText, venueCatalog } from "@/lib/normalize";
import type { NormalizedEvent } from "@/lib/types";
import { ProviderError, ticketmasterProvider } from "@/providers/ticketmaster";

async function mergeEventRecords(fromId: string, intoId: string) {
  if (fromId === intoId) return;
  const [saved, dismissed, impressions, notifications] = await Promise.all([
    db.savedEvent.findMany({ where: { eventId: fromId } }), db.dismissedEvent.findMany({ where: { eventId: fromId } }),
    db.eventImpression.findMany({ where: { eventId: fromId } }), db.notificationLog.findMany({ where: { eventId: fromId } }),
  ]);
  for (const row of saved) await db.savedEvent.upsert({ where: { userId_eventId: { userId: row.userId, eventId: intoId } }, update: {}, create: { userId: row.userId, eventId: intoId, createdAt: row.createdAt } });
  for (const row of dismissed) await db.dismissedEvent.upsert({ where: { userId_eventId: { userId: row.userId, eventId: intoId } }, update: {}, create: { userId: row.userId, eventId: intoId, createdAt: row.createdAt } });
  for (const row of impressions) await db.eventImpression.upsert({ where: { userId_eventId: { userId: row.userId, eventId: intoId } }, update: { lastShownAt: row.lastShownAt, count: { increment: row.count } }, create: { userId: row.userId, eventId: intoId, firstShownAt: row.firstShownAt, lastShownAt: row.lastShownAt, count: row.count } });
  for (const row of notifications) await db.notificationLog.upsert({ where: { userId_eventId_provider: { userId: row.userId, eventId: intoId, provider: row.provider } }, update: { sentAt: row.sentAt }, create: { userId: row.userId, eventId: intoId, provider: row.provider, sentAt: row.sentAt } });
  await db.$transaction([
    db.savedEvent.deleteMany({ where: { eventId: fromId } }), db.dismissedEvent.deleteMany({ where: { eventId: fromId } }),
    db.eventImpression.deleteMany({ where: { eventId: fromId } }), db.notificationLog.deleteMany({ where: { eventId: fromId } }),
    db.eventSource.updateMany({ where: { eventId: fromId }, data: { eventId: intoId } }), db.event.delete({ where: { id: fromId } }),
  ]);
}

async function persistEvent(event: NormalizedEvent) {
  const source = await db.eventSource.findUnique({ where: { provider_externalId: { provider: event.provider, externalId: event.externalId } }, select: { eventId: true } });
  const venue = await db.venue.upsert({
    where: { normalizedName: canonicalVenueKey(event.venue.name) },
    update: { name: event.venue.name, city: event.venue.city, address: event.venue.address, latitude: event.venue.latitude, longitude: event.venue.longitude, providerIdsJson: JSON.stringify(event.venue.providerIds ?? {}) },
    create: { name: event.venue.name, normalizedName: canonicalVenueKey(event.venue.name), city: event.venue.city, address: event.venue.address, latitude: event.venue.latitude, longitude: event.venue.longitude, providerIdsJson: JSON.stringify(event.venue.providerIds ?? {}) },
  });
  const canonicalKey = `${event.normalizedTitle}|${event.localDate}|${venue.normalizedName}`;
  const data = {
    canonicalKey, title: event.title, normalizedTitle: event.normalizedTitle, type: event.type, startAt: event.startAt, endAt: event.endAt,
    timeZone: event.timeZone, localDate: event.localDate, city: event.city, latitude: event.latitude, longitude: event.longitude,
    genresJson: JSON.stringify(event.genres), classificationsJson: JSON.stringify(event.classifications), ticketStatus: event.ticketStatus,
    rawTicketStatus: event.rawTicketStatus, officialUrl: event.officialUrl, imageUrl: event.imageUrl, lastCheckedAt: event.lastCheckedAt, lastSyncedAt: event.lastSyncedAt, venueId: venue.id,
  };
  const [sourceEvent, canonicalEvent] = await Promise.all([
    source?.eventId ? db.event.findUnique({ where: { id: source.eventId } }) : null,
    db.event.findUnique({ where: { canonicalKey } }),
  ]);
  if (sourceEvent && canonicalEvent && sourceEvent.id !== canonicalEvent.id) await mergeEventRecords(sourceEvent.id, canonicalEvent.id);
  const existing = canonicalEvent ?? sourceEvent;
  const saved = existing ? await db.event.update({ where: { id: existing.id }, data }) : await db.event.create({ data });
  await db.eventSource.upsert({ where: { provider_externalId: { provider: event.provider, externalId: event.externalId } }, update: { eventId: saved.id, url: event.officialUrl, rawStatus: event.rawTicketStatus, lastSeenAt: new Date() }, create: { eventId: saved.id, provider: event.provider, externalId: event.externalId, url: event.officialUrl, rawStatus: event.rawTicketStatus, lastSeenAt: new Date() } });
  await db.eventArtist.deleteMany({ where: { eventId: saved.id } });
  const artists = event.artists.filter((artist, index, all) => all.findIndex((candidate) => candidate.normalizedName === artist.normalizedName) === index);
  if (artists.length) await db.eventArtist.createMany({ data: artists.map((a) => ({ eventId: saved.id, name: a.name, normalizedName: a.normalizedName, externalId: a.externalId })) });
  return Boolean(existing);
}

export async function syncEvents(options: { force?: boolean } = {}) {
  await ensureLocalUser();
  const recent = await db.syncRun.findFirst({ where: { userId: LOCAL_USER_ID, kind: "EVENTS", status: { in: ["SUCCESS", "PARTIAL"] }, completedAt: { gte: new Date(Date.now() - 5 * 60_000) } }, orderBy: { completedAt: "desc" } });
  if (recent && !options.force) return { status: "CACHED", found: recent.found, added: 0, updated: 0, skipped: recent.skipped, failed: recent.failed, errorMessage: "Recente lokale cache gebruikt (maximaal vijf minuten oud)" };
  const run = await db.syncRun.create({ data: { userId: LOCAL_USER_ID, kind: "EVENTS", provider: "ticketmaster" } });
  if (!ticketmasterProvider.isConfigured()) {
    await db.syncRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), errorMessage: "TICKETMASTER_API_KEY ontbreekt" } });
    throw new Error("TICKETMASTER_API_KEY ontbreekt. Open Configuratie voor installatie-instructies.");
  }
  const input = { startDateTime: new Date(), endDateTime: addMonths(new Date(), 6), city: "Amsterdam", radiusKm: getEnv().EVENT_SEARCH_RADIUS_KM };
  const [topArtists, knownVenues] = await Promise.all([
    db.spotifyTopArtistPeriod.findMany({ where: { userId: LOCAL_USER_ID, enabled: true }, include: { artist: true }, orderBy: { rank: "asc" }, take: 12 }),
    db.venue.findMany({ select: { name: true, providerIdsJson: true } }),
  ]);
  const catalogKeys = new Set(venueCatalog.flatMap((venue) => [venue.name, ...venue.aliases]).map(normalizeText));
  const venueIds = [...new Set(knownVenues.filter((venue) => catalogKeys.has(normalizeText(venue.name))).flatMap((venue) => {
    try { const ids = JSON.parse(venue.providerIdsJson) as Record<string, string>; return ids.ticketmaster ? [ids.ticketmaster] : []; } catch { return []; }
  }))];
  const personalArtists = topArtists.filter((x, i, all) => all.findIndex((y) => y.artistId === x.artistId) === i).slice(0, 5);
  const tasks: (() => Promise<NormalizedEvent[]>)[] = [
    () => ticketmasterProvider.searchEvents(input), () => ticketmasterProvider.searchByGeo(input),
    ...(venueIds.length ? [() => ticketmasterProvider.searchByVenueIds(input, venueIds)] : []),
    ...personalArtists.map((x) => () => ticketmasterProvider.searchByKeyword(input, x.artist.name)),
  ];
  const results: PromiseSettledResult<NormalizedEvent[]>[] = [];
  for (const [index, task] of tasks.entries()) {
    try { results.push({ status: "fulfilled", value: await task() }); }
    catch (reason) { results.push({ status: "rejected", reason }); }
    if (index < tasks.length - 1) await new Promise((resolve) => setTimeout(resolve, 275));
  }
  const valid = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
  const deduped = deduplicateEvents(valid);
  let added = 0; let updated = 0; let failed = 0; let persistenceError: string | undefined;
  for (const event of deduped) {
    try { if (await persistEvent(event)) updated++; else added++; } catch (error) { failed++; persistenceError ??= error instanceof Error ? error.message : "Evenement kon niet worden opgeslagen"; }
  }
  const requestFailures = results.filter((r) => r.status === "rejected").length;
  const status = requestFailures || failed ? (deduped.length ? "PARTIAL" : "FAILED") : "SUCCESS";
  const firstError = results.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason;
  const errorMessage = firstError instanceof ProviderError || firstError instanceof Error ? firstError.message : requestFailures ? "Een deel van de zoekopdrachten mislukte" : persistenceError;
  await db.syncRun.update({ where: { id: run.id }, data: { status, completedAt: new Date(), found: valid.length, added, updated, skipped: valid.length - deduped.length, failed: failed + requestFailures, errorMessage } });
  return { status, found: valid.length, added, updated, skipped: valid.length - deduped.length, failed: failed + requestFailures, errorMessage };
}
