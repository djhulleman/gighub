import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { canonicalVenueName, encodeGeohash, normalizeText } from "@/lib/normalize";
import { normalizeTicketStatus } from "@/lib/ticket-status";
import type { EventProvider, EventSearchInput, NormalizedEvent } from "@/lib/types";

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  images: z.array(z.object({ url: z.string().url(), width: z.number().optional() })).optional(),
  dates: z.object({
    start: z.object({ localDate: z.string(), localTime: z.string().optional(), dateTime: z.string().optional() }),
    end: z.object({ dateTime: z.string().optional() }).optional(),
    timezone: z.string().optional(),
    status: z.object({ code: z.string().optional() }).optional(),
  }),
  classifications: z.array(z.object({
    primary: z.boolean().optional(),
    segment: z.object({ name: z.string() }).optional(),
    genre: z.object({ name: z.string() }).optional(),
    subGenre: z.object({ name: z.string() }).optional(),
    type: z.object({ name: z.string() }).optional(),
  })).optional(),
  _embedded: z.object({
    venues: z.array(z.object({
      id: z.string().optional(), name: z.string(), city: z.object({ name: z.string() }).optional(),
      address: z.object({ line1: z.string().optional() }).optional(),
      location: z.object({ latitude: z.string(), longitude: z.string() }).optional(),
    })).optional(),
    attractions: z.array(z.object({ id: z.string().optional(), name: z.string() })).optional(),
  }).optional(),
});
const responseSchema = z.object({ _embedded: z.object({ events: z.array(z.unknown()) }).optional() });

function eventType(title: string, classifications: string[]) {
  const text = normalizeText(`${title} ${classifications.join(" ")}`);
  if (/festival|fest/.test(text)) return "FESTIVAL" as const;
  if (/club|dance|electronic|techno|house|dj/.test(text)) return "CLUB_NIGHT" as const;
  if (/music|rock|pop|jazz|concert|metal|hip hop|r b/.test(text)) return "CONCERT" as const;
  return "UNKNOWN" as const;
}

export function normalizeTicketmasterItem(raw: unknown): NormalizedEvent | null {
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return null;
  const item = parsed.data;
  const classification = item.classifications?.flatMap((c) => [c.segment?.name, c.genre?.name, c.subGenre?.name, c.type?.name].filter((x): x is string => Boolean(x))) ?? [];
  if (!classification.some((x) => normalizeText(x) === "music")) return null;
  const venue = item._embedded?.venues?.[0];
  const zone = item.dates.timezone ?? "Europe/Amsterdam";
  const startAt = item.dates.start.dateTime
    ? new Date(item.dates.start.dateTime)
    : fromZonedTime(`${item.dates.start.localDate}T${item.dates.start.localTime ?? "20:00:00"}`, zone);
  if (Number.isNaN(startAt.getTime())) return null;
  const genres = item.classifications?.flatMap((c) => [c.genre?.name, c.subGenre?.name].filter((x): x is string => Boolean(x) && x !== "Undefined")) ?? [];
  const artists = (item._embedded?.attractions ?? []).map((a) => ({ name: a.name, normalizedName: normalizeText(a.name), externalId: a.id })).filter((artist, index, all) => all.findIndex((candidate) => candidate.normalizedName === artist.normalizedName) === index);
  const now = new Date();
  const venueName = canonicalVenueName(venue?.name ?? "Locatie onbekend");
  return {
    provider: "ticketmaster", externalId: item.id, title: item.name, normalizedTitle: normalizeText(item.name),
    artists,
    type: eventType(item.name, classification), startAt,
    endAt: item.dates.end?.dateTime ? new Date(item.dates.end.dateTime) : undefined,
    timeZone: zone, localDate: formatInTimeZone(startAt, "Europe/Amsterdam", "yyyy-MM-dd"),
    venue: { name: venueName, normalizedName: normalizeText(venueName), city: venue?.city?.name ?? "Amsterdam", address: venue?.address?.line1, latitude: venue?.location ? Number(venue.location.latitude) : undefined, longitude: venue?.location ? Number(venue.location.longitude) : undefined, providerIds: venue?.id ? { ticketmaster: venue.id } : undefined },
    city: venue?.city?.name ?? "Amsterdam", latitude: venue?.location ? Number(venue.location.latitude) : undefined, longitude: venue?.location ? Number(venue.location.longitude) : undefined,
    genres: [...new Set(genres)], classifications: [...new Set(classification)], officialUrl: item.url,
    ticketStatus: normalizeTicketStatus(item.dates.status?.code), rawTicketStatus: item.dates.status?.code,
    imageUrl: item.images?.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url,
    lastCheckedAt: now, lastSyncedAt: now,
  };
}

export class ProviderError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryAfter?: number) { super(message); }
}

export class TicketmasterProvider implements EventProvider {
  id = "ticketmaster";
  private env = getEnv();
  isConfigured() { return Boolean(this.env.TICKETMASTER_API_KEY); }

  private async request(params: Record<string, string>): Promise<NormalizedEvent[]> {
    if (!this.env.TICKETMASTER_API_KEY) throw new ProviderError("TICKETMASTER_API_KEY ontbreekt");
    const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
    Object.entries({ apikey: this.env.TICKETMASTER_API_KEY, countryCode: "NL", classificationName: "music", size: "200", includeTest: "no", ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
    let response: Response;
    try { response = await fetch(url, { signal: AbortSignal.timeout(12_000), headers: { Accept: "application/json" } }); }
    catch { throw new ProviderError("Ticketmaster is niet bereikbaar (netwerkfout of time-out)"); }
    if (response.status === 429) throw new ProviderError("Ticketmaster-rate limit bereikt", 429, Number(response.headers.get("retry-after") ?? 0));
    if (!response.ok) throw new ProviderError(`Ticketmaster gaf status ${response.status}`, response.status);
    const envelope = responseSchema.safeParse(await response.json());
    if (!envelope.success) throw new ProviderError("Ticketmaster stuurde een onbekend antwoordformaat");
    return (envelope.data._embedded?.events ?? []).map(normalizeTicketmasterItem).filter((x): x is NormalizedEvent => x !== null);
  }

  async searchEvents(input: EventSearchInput): Promise<NormalizedEvent[]> {
    const dates = { startDateTime: input.startDateTime.toISOString().replace(/\.\d{3}Z$/, "Z"), endDateTime: input.endDateTime.toISOString().replace(/\.\d{3}Z$/, "Z"), sort: "date,asc" };
    return this.request({ ...dates, city: input.city ?? "Amsterdam" });
  }

  async searchByGeo(input: EventSearchInput) {
    const dates = { startDateTime: input.startDateTime.toISOString().replace(/\.\d{3}Z$/, "Z"), endDateTime: input.endDateTime.toISOString().replace(/\.\d{3}Z$/, "Z"), sort: "date,asc" };
    return this.request({ ...dates, geoPoint: encodeGeohash(52.3676, 4.9041), radius: String(input.radiusKm ?? this.env.EVENT_SEARCH_RADIUS_KM), unit: "km" });
  }

  async searchByKeyword(input: EventSearchInput, keyword: string) {
    return this.request({ startDateTime: input.startDateTime.toISOString().replace(/\.\d{3}Z$/, "Z"), endDateTime: input.endDateTime.toISOString().replace(/\.\d{3}Z$/, "Z"), keyword, geoPoint: encodeGeohash(52.3676, 4.9041), radius: String(input.radiusKm ?? this.env.EVENT_SEARCH_RADIUS_KM), unit: "km", sort: "date,asc", size: "50" });
  }

  async searchByVenueIds(input: EventSearchInput, venueIds: string[]) {
    if (!venueIds.length) return [];
    return this.request({ startDateTime: input.startDateTime.toISOString().replace(/\.\d{3}Z$/, "Z"), endDateTime: input.endDateTime.toISOString().replace(/\.\d{3}Z$/, "Z"), venueId: venueIds.join(","), sort: "date,asc" });
  }

  async getEvent(externalId: string) {
    if (!this.env.TICKETMASTER_API_KEY) return null;
    const url = new URL(`https://app.ticketmaster.com/discovery/v2/events/${encodeURIComponent(externalId)}.json`);
    url.searchParams.set("apikey", this.env.TICKETMASTER_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    return response.ok ? normalizeTicketmasterItem(await response.json()) : null;
  }
}

export const ticketmasterProvider = new TicketmasterProvider();
