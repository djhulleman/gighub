import { db, LOCAL_USER_ID } from "./db";
import { normalizeText } from "./normalize";

export const MUSIC_GENRE_CATALOG = [
  "Alternative", "Ambient", "Blues", "Classical", "Country", "Dance/Electronic", "Disco", "Drum & Bass",
  "Folk", "Funk", "Hardcore", "Hip-Hop/Rap", "House", "Indie", "Jazz", "Latin", "Metal", "Pop", "Punk",
  "R&B", "Reggae", "Rock", "Singer-Songwriter", "Soul", "Techno", "Trance", "World", "Shoegaze",
] as const;

const GENERIC = new Set(["music", "other", "undefined", "event style", "miscellaneous", "family", "community civic"]);

export interface GenreSuggestion { name: string; source: "eventdata" | "spotify" | "catalogus"; eventCount: number }

export async function getGenreSuggestions(): Promise<GenreSuggestion[]> {
  const [events, topArtists] = await Promise.all([
    db.event.findMany({ where: { startAt: { gte: new Date() } }, select: { genresJson: true } }),
    db.spotifyTopArtistPeriod.findMany({ where: { userId: LOCAL_USER_ID, enabled: true }, include: { artist: true } }),
  ]);
  const eventCounts = new Map<string, { name: string; count: number }>();
  for (const event of events) {
    let genres: string[] = []; try { genres = JSON.parse(event.genresJson) as string[]; } catch { /* ongeldige oude rij overslaan */ }
    for (const name of genres) { const key = normalizeText(name); if (!key || GENERIC.has(key)) continue; const current = eventCounts.get(key); eventCounts.set(key, { name, count: (current?.count ?? 0) + 1 }); }
  }
  const spotifyGenres = new Map<string, string>();
  for (const row of topArtists) {
    let genres: string[] = []; try { genres = JSON.parse(row.artist.genresJson) as string[]; } catch { /* Spotify kan dit veld leeg laten */ }
    for (const name of genres) { const key = normalizeText(name); if (key && !GENERIC.has(key)) spotifyGenres.set(key, name); }
  }
  const all = new Map<string, GenreSuggestion>();
  for (const [key, value] of eventCounts) all.set(key, { name: value.name, source: "eventdata", eventCount: value.count });
  for (const [key, name] of spotifyGenres) if (!all.has(key)) all.set(key, { name, source: "spotify", eventCount: 0 });
  for (const name of MUSIC_GENRE_CATALOG) { const key = normalizeText(name); if (!all.has(key)) all.set(key, { name, source: "catalogus", eventCount: 0 }); }
  return [...all.values()].sort((a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name, "nl"));
}
