import { formatInTimeZone } from "date-fns-tz";
import type { NormalizedEvent } from "./types";

export function escapeIcs(value: string) { return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
function utc(date: Date) { return formatInTimeZone(date, "UTC", "yyyyMMdd'T'HHmmss'Z'"); }
function fold(line: string) { const chunks: string[] = []; let rest = line; while (Buffer.byteLength(rest, "utf8") > 73) { let i = 65; while (Buffer.byteLength(rest.slice(0, i + 1), "utf8") <= 73 && i < rest.length) i++; chunks.push(rest.slice(0, i)); rest = rest.slice(i); } chunks.push(rest); return chunks.join("\r\n "); }

export function eventToIcs(event: NormalizedEvent & { id?: string }) {
  const lines = ["BEGIN:VEVENT", `UID:${escapeIcs(`${event.provider}-${event.externalId}@amsterdam-gig-scout.local`)}`, `DTSTAMP:${utc(new Date())}`, `DTSTART:${utc(event.startAt)}`];
  if (event.endAt) lines.push(`DTEND:${utc(event.endAt)}`);
  lines.push(`SUMMARY:${escapeIcs(event.title)}`, `LOCATION:${escapeIcs([event.venue.name, event.venue.address, event.city].filter(Boolean).join(", "))}`, `DESCRIPTION:${escapeIcs(`${event.artists.map((a) => a.name).join(", ")}\nAanbieder: ${event.provider}\n${event.officialUrl}`)}`, `URL:${escapeIcs(event.officialUrl)}`, "END:VEVENT");
  return lines.map(fold).join("\r\n");
}

export function calendarToIcs(events: (NormalizedEvent & { id?: string })[], name = "Amsterdam Gig Scout") {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Amsterdam Gig Scout//NL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escapeIcs(name)}`, "X-WR-TIMEZONE:Europe/Amsterdam", ...events.map(eventToIcs), "END:VCALENDAR", ""].join("\r\n");
}
