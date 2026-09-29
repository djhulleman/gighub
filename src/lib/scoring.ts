import { normalizeText } from "./normalize";
import type { NormalizedEvent } from "./types";

export const SCORE_WEIGHTS = {
  spotifyExactBase: 34,
  spotifyRankMax: 26,
  manualArtist: { FAVORITE: 55, INTERESTING: 38, NEUTRAL: 20 },
  manualGenre: 16,
  providerGenre: 8,
  discovery: 8,
  dismissed: -100,
} as const;

export interface TasteProfile {
  spotifyArtists: { name: string; rank: number; period: string }[];
  manualArtists: { name: string; weight: "FAVORITE" | "INTERESTING" | "NEUTRAL" }[];
  genres: string[];
  excludedArtists: string[];
  excludedGenres: string[];
  dismissedEventIds?: string[];
  seenArtistNames?: string[];
}
export interface ScoreResult { score: number; components: { label: string; points: number }[]; reasons: string[]; exactArtistMatch: boolean; excluded: boolean }

function genreMatches(preference: string, candidate: string) {
  const preferred = normalizeText(preference); const available = normalizeText(candidate);
  return preferred === available || (` ${available} `).includes(` ${preferred} `) || (` ${preferred} `).includes(` ${available} `);
}

export function scoreEvent(event: NormalizedEvent & { id?: string }, profile: TasteProfile): ScoreResult {
  const artistNames = new Set(event.artists.map((a) => normalizeText(a.name)));
  const eventGenres = new Set([...event.genres, ...event.classifications].map(normalizeText));
  const excludedArtist = profile.excludedArtists.find((a) => artistNames.has(normalizeText(a)));
  const excludedGenre = profile.excludedGenres.find((g) => [...eventGenres].some((eventGenre) => genreMatches(g, eventGenre)));
  if (excludedArtist || excludedGenre) {
    return { score: 0, components: [{ label: `Uitgesloten ${excludedArtist ? "artiest" : "genre"}`, points: -100 }], reasons: [excludedArtist ? `${excludedArtist} staat op je uitsluitlijst` : `${excludedGenre} staat op je uitsluitlijst`], exactArtistMatch: false, excluded: true };
  }
  if (event.id && profile.dismissedEventIds?.includes(event.id)) return { score: 0, components: [{ label: "Niet interessant", points: -100 }], reasons: ["Je markeerde dit evenement als niet interessant"], exactArtistMatch: false, excluded: false };

  let total = 0;
  let exactArtistMatch = false;
  const components: ScoreResult["components"] = [];
  const reasons: string[] = [];
  const spotify = profile.spotifyArtists.filter((a) => artistNames.has(normalizeText(a.name))).sort((a, b) => a.rank - b.rank)[0];
  if (spotify) {
    const points = SCORE_WEIGHTS.spotifyExactBase + Math.round(SCORE_WEIGHTS.spotifyRankMax * (1 - Math.min(spotify.rank - 1, 49) / 49));
    total += points; exactArtistMatch = true; components.push({ label: `Spotify-topartiest (${spotify.period}, #${spotify.rank})`, points }); reasons.push(`Je luistert vaak naar ${spotify.name}`);
  }
  const manual = profile.manualArtists.find((a) => artistNames.has(normalizeText(a.name)));
  if (manual) {
    const points = SCORE_WEIGHTS.manualArtist[manual.weight]; total += points; exactArtistMatch = true; components.push({ label: `Handmatige artiest (${manual.weight.toLowerCase()})`, points });
    reasons.push(manual.weight === "FAVORITE" ? "Handmatig gemarkeerd als favoriet" : `${manual.name} staat in je artiestvoorkeuren`);
  }
  const matchingGenre = profile.genres.find((g) => [...eventGenres].some((eventGenre) => genreMatches(g, eventGenre)));
  if (matchingGenre) { total += SCORE_WEIGHTS.manualGenre; components.push({ label: `Genrevoorkeur: ${matchingGenre}`, points: SCORE_WEIGHTS.manualGenre }); reasons.push(`Past bij je voorkeur voor ${matchingGenre}`); }
  if (!exactArtistMatch && matchingGenre) {
    const unseen = event.artists.some((a) => !profile.seenArtistNames?.map(normalizeText).includes(normalizeText(a.name)));
    if (unseen) { total += SCORE_WEIGHTS.discovery; components.push({ label: "Ontdekking", points: SCORE_WEIGHTS.discovery }); reasons.push("Nieuwe artiest binnen je muziekprofiel"); }
  }
  return { score: Math.max(0, Math.min(100, total)), components, reasons: reasons.length ? reasons : ["Muziekevenement in de regio Amsterdam"], exactArtistMatch, excluded: false };
}
