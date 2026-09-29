export type EventTypeValue = "CONCERT" | "CLUB_NIGHT" | "FESTIVAL" | "UNKNOWN";
export type TicketStatusValue = "AVAILABLE" | "SOLD_OUT" | "UNKNOWN" | "NOT_CHECKED";

export interface NormalizedArtist { name: string; normalizedName: string; externalId?: string }
export interface NormalizedVenue {
  name: string; normalizedName: string; city: string; address?: string; latitude?: number; longitude?: number; providerIds?: Record<string,string>;
}
export interface NormalizedEvent {
  provider: string;
  externalId: string;
  title: string;
  normalizedTitle: string;
  artists: NormalizedArtist[];
  type: EventTypeValue;
  startAt: Date;
  endAt?: Date;
  timeZone: string;
  localDate: string;
  venue: NormalizedVenue;
  city: string;
  latitude?: number;
  longitude?: number;
  genres: string[];
  classifications: string[];
  officialUrl: string;
  ticketStatus: TicketStatusValue;
  rawTicketStatus?: string;
  imageUrl?: string;
  lastCheckedAt: Date;
  lastSyncedAt: Date;
}

export interface EventSearchInput {
  startDateTime: Date;
  endDateTime: Date;
  city?: string;
  radiusKm?: number;
  keywords?: string[];
}

export interface EventProvider {
  id: string;
  isConfigured(): boolean;
  searchEvents(input: EventSearchInput): Promise<NormalizedEvent[]>;
  getEvent?(externalId: string): Promise<NormalizedEvent | null>;
}

export interface CalendarProvider { id: string; exportEvent(eventId: string): Promise<string> }
export interface NotificationProvider { id: string; requestPermission(): Promise<boolean>; notify(title: string, body: string): Promise<void> }
