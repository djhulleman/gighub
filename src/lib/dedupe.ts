import { canonicalVenueKey, normalizeText } from "./normalize";
import type { NormalizedEvent } from "./types";

function similarity(a: string, b: string) {
  const x = new Set(normalizeText(a).split(" ")); const y = new Set(normalizeText(b).split(" "));
  const overlap = [...x].filter((v) => y.has(v)).length;
  return overlap / Math.max(x.size, y.size, 1);
}

export function areDuplicate(a: NormalizedEvent, b: NormalizedEvent): boolean {
  if (a.provider === b.provider && a.externalId === b.externalId) return true;
  if (a.localDate !== b.localDate || canonicalVenueKey(a.venue.name) !== canonicalVenueKey(b.venue.name)) return false;
  const aa = a.artists.map((x) => x.normalizedName).sort().join("|"); const ba = b.artists.map((x) => x.normalizedName).sort().join("|");
  if (aa && aa === ba) return true;
  return similarity(a.title, b.title) >= 0.84;
}

export function deduplicateEvents(events: NormalizedEvent[]): NormalizedEvent[] {
  return events.reduce<NormalizedEvent[]>((result, event) => result.some((x) => areDuplicate(x, event)) ? result : [...result, event], []);
}
