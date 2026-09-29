import { addMonths } from "date-fns";
import { db, LOCAL_USER_ID, ensureLocalUser } from "@/lib/db";
import { deduplicateEvents } from "@/lib/dedupe";
import { getEnv } from "@/lib/env";
import { canonicalVenueKey, venueCatalog } from "@/lib/normalize";
import type { NormalizedEvent } from "@/lib/types";
import { ProviderError, ticketmasterProvider } from "@/providers/ticketmaster";

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
  const existing = source?.eventId ? await db.event.findUnique({ where: { id: source.eventId } }) : await db.event.findUnique({ where: { canonicalKey } });
  const saved = existing ? await db.event.update({ where: { id: existing.id }, data }) : await db.event.create({ data });
  await db.eventSource.upsert({ where: { provider_externalId: { provider: event.provider, externalId: event.externalId } }, update: { eventId: saved.id, url: event.officialUrl, rawStatus: event.rawTicketStatus, lastSeenAt: new Date() }, create: { eventId: saved.id, provider: event.provider, externalId: event.externalId, url: event.officialUrl, rawStatus: event.rawTicketStatus, lastSeenAt: new Date() } });
  await db.eventArtist.deleteMany({ where: { eventId: saved.id } });
  if (event.artists.length) await db.eventArtist.createMany({ data: event.artists.map((a) => ({ eventId: saved.id, name: a.name, normalizedName: a.normalizedName, externalId: a.externalId })) });
  return Boolean(existing);
}

export async function syncEvents() {
  await ensureLocalUser();
  const recent = await db.syncRun.findFirst({ where: { userId: LOCAL_USER_ID, kind: "EVENTS", status: { in: ["SUCCESS", "PARTIAL"] }, completedAt: { gte: new Date(Date.now() - 5 * 60_000) } }, orderBy: { completedAt: "desc" } });
  if (recent) return { status: "CACHED", found: recent.found, added: 0, updated: 0, skipped: recent.skipped, failed: recent.failed, errorMessage: "Recente lokale cache gebruikt (maximaal vijf minuten oud)" };
  const run = await db.syncRun.create({ data: { userId: LOCAL_USER_ID, kind: "EVENTS", provider: "ticketmaster" } });
  if (!ticketmasterProvider.isConfigured()) {
    await db.syncRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), errorMessage: "TICKETMASTER_API_KEY ontbreekt" } });
    throw new Error("TICKETMASTER_API_KEY ontbreekt. Open Configuratie voor installatie-instructies.");
  }
  const input = { startDateTime: new Date(), endDateTime: addMonths(new Date(), 6), city: "Amsterdam", radiusKm: getEnv().EVENT_SEARCH_RADIUS_KM };
  const topArtists = await db.spotifyTopArtistPeriod.findMany({ where: { userId: LOCAL_USER_ID, enabled: true }, include: { artist: true }, orderBy: { rank: "asc" }, take: 5 });
  const tasks: (() => Promise<NormalizedEvent[]>)[] = [
    () => ticketmasterProvider.searchEvents(input), () => ticketmasterProvider.searchByGeo(input),
    ...venueCatalog.map((v) => () => ticketmasterProvider.searchByKeyword(input, v.name)),
    ...topArtists.filter((x, i, all) => all.findIndex((y) => y.artistId === x.artistId) === i).map((x) => () => ticketmasterProvider.searchByKeyword(input, x.artist.name)),
  ];
  const results: PromiseSettledResult<NormalizedEvent[]>[] = [];
  for (let index = 0; index < tasks.length; index += 4) {
    results.push(...await Promise.allSettled(tasks.slice(index, index + 4).map((task) => task())));
    if (index + 4 < tasks.length) await new Promise((resolve) => setTimeout(resolve, 1_050));
  }
  const valid = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
  const deduped = deduplicateEvents(valid);
  let added = 0; let updated = 0; let failed = 0;
  for (const event of deduped) {
    try { if (await persistEvent(event)) updated++; else added++; } catch { failed++; }
  }
  const requestFailures = results.filter((r) => r.status === "rejected").length;
  const status = requestFailures || failed ? (deduped.length ? "PARTIAL" : "FAILED") : "SUCCESS";
  const firstError = results.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason;
  const errorMessage = firstError instanceof ProviderError || firstError instanceof Error ? firstError.message : requestFailures ? "Een deel van de zoekopdrachten mislukte" : undefined;
  await db.syncRun.update({ where: { id: run.id }, data: { status, completedAt: new Date(), found: valid.length, added, updated, skipped: valid.length - deduped.length, failed: failed + requestFailures, errorMessage } });
  return { status, found: valid.length, added, updated, skipped: valid.length - deduped.length, failed: failed + requestFailures, errorMessage };
}
