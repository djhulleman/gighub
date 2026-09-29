import { addDays, endOfDay, startOfDay } from "date-fns";
import { db, LOCAL_USER_ID, ensureLocalUser } from "@/lib/db";
import { scoreEvent, type TasteProfile } from "@/lib/scoring";
import type { NormalizedEvent } from "@/lib/types";

export async function getTasteProfile(): Promise<TasteProfile> {
  await ensureLocalUser();
  const [top, manualArtists, genres, excludedArtists, excludedGenres, dismissed, impressions] = await Promise.all([
    db.spotifyTopArtistPeriod.findMany({ where: { userId: LOCAL_USER_ID, enabled: true }, include: { artist: true } }),
    db.artistPreference.findMany({ where: { userId: LOCAL_USER_ID } }), db.genrePreference.findMany({ where: { userId: LOCAL_USER_ID } }),
    db.excludedArtist.findMany({ where: { userId: LOCAL_USER_ID } }), db.excludedGenre.findMany({ where: { userId: LOCAL_USER_ID } }),
    db.dismissedEvent.findMany({ where: { userId: LOCAL_USER_ID }, select: { eventId: true } }),
    db.eventImpression.findMany({ where: { userId: LOCAL_USER_ID }, include: { event: { include: { artists: true } } } }),
  ]);
  return {
    spotifyArtists: top.map((x) => ({ name: x.artist.name, rank: x.rank, period: x.period })),
    manualArtists: manualArtists.map((x) => ({ name: x.name, weight: x.weight as "FAVORITE" | "INTERESTING" | "NEUTRAL" })),
    genres: genres.map((x) => x.name), excludedArtists: excludedArtists.map((x) => x.name), excludedGenres: excludedGenres.map((x) => x.name),
    dismissedEventIds: dismissed.map((x) => x.eventId), seenArtistNames: impressions.flatMap((x) => x.event.artists.map((a) => a.name)),
  };
}

export type DbEvent = Awaited<ReturnType<typeof db.event.findFirst>>;

export function toNormalized(event: NonNullable<Awaited<ReturnType<typeof db.event.findFirst<{ include: { venue: true; artists: true; sources: true } }>>>>): NormalizedEvent & { id: string } {
  return {
    id: event.id, provider: event.sources[0]?.provider ?? "onbekend", externalId: event.sources[0]?.externalId ?? event.id,
    title: event.title, normalizedTitle: event.normalizedTitle, artists: event.artists.map((a) => ({ name: a.name, normalizedName: a.normalizedName, externalId: a.externalId ?? undefined })),
    type: event.type as NormalizedEvent["type"], startAt: event.startAt, endAt: event.endAt ?? undefined, timeZone: event.timeZone, localDate: event.localDate,
    venue: { name: event.venue?.name ?? "Locatie onbekend", normalizedName: event.venue?.normalizedName ?? "", city: event.venue?.city ?? event.city, address: event.venue?.address ?? undefined, latitude: event.venue?.latitude ?? undefined, longitude: event.venue?.longitude ?? undefined, providerIds: event.venue ? JSON.parse(event.venue.providerIdsJson) as Record<string,string> : undefined },
    city: event.city, latitude: event.latitude ?? undefined, longitude: event.longitude ?? undefined,
    genres: JSON.parse(event.genresJson) as string[], classifications: JSON.parse(event.classificationsJson) as string[], officialUrl: event.officialUrl,
    ticketStatus: event.ticketStatus as NormalizedEvent["ticketStatus"], rawTicketStatus: event.rawTicketStatus ?? undefined, imageUrl: event.imageUrl ?? undefined,
    lastCheckedAt: event.lastCheckedAt, lastSyncedAt: event.lastSyncedAt,
  };
}

export async function listScoredEvents(options?: { from?: Date; to?: Date }) {
  const from = options?.from ?? startOfDay(new Date()); const to = options?.to ?? endOfDay(addDays(from, 7));
  const [events, profile] = await Promise.all([db.event.findMany({ where: { startAt: { gte: from, lte: to } }, include: { venue: true, artists: true, sources: true, savedBy: { where: { userId: LOCAL_USER_ID } } }, orderBy: { startAt: "asc" } }), getTasteProfile()]);
  return events.map((event) => { const normalized = toNormalized(event); return { event, normalized, match: scoreEvent(normalized, profile), saved: event.savedBy.length > 0 }; }).filter((x) => !x.match.excluded);
}

export async function getScoredEvent(id: string) {
  const [event, profile] = await Promise.all([db.event.findUnique({ where: { id }, include: { venue: true, artists: true, sources: true, savedBy: { where: { userId: LOCAL_USER_ID } }, dismissedBy: { where: { userId: LOCAL_USER_ID } } } }), getTasteProfile()]);
  if (!event) return null;
  const normalized = toNormalized(event); return { event, normalized, match: scoreEvent(normalized, profile), saved: event.savedBy.length > 0, dismissed: event.dismissedBy.length > 0 };
}
