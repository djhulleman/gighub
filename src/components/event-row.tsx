import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ticketStatusLabel } from "@/lib/ticket-status";
import type { listScoredEvents } from "@/services/events";

type Item = Awaited<ReturnType<typeof listScoredEvents>>[number];
export function EventRow({ item }: { item: Item }) {
  const e=item.normalized;
  return <article className="event-row">
    <div className="date-block"><span>{formatInTimeZone(e.startAt,"Europe/Amsterdam","EEE")}</span><strong>{formatInTimeZone(e.startAt,"Europe/Amsterdam","dd")}</strong><span>{formatInTimeZone(e.startAt,"Europe/Amsterdam","MMM")}</span></div>
    <div><Link className="event-title" href={`/evenement/${e.id}`}>{e.title}</Link><div className="meta">{formatInTimeZone(e.startAt,"Europe/Amsterdam","HH:mm")} · {e.venue.name} · {e.type.toLowerCase().replace("_"," ")}</div><div className="reason">{item.match.reasons[0]}</div></div>
    <div><div className="score">{item.match.score}% match</div><div className="meta">bron: {e.provider}</div></div>
    <div className="event-side"><div className={`badge status-${e.ticketStatus}`}>{ticketStatusLabel(e.ticketStatus)}</div><div style={{marginTop:8}}><a className="button secondary" href={e.officialUrl} target="_blank" rel="noreferrer">Tickets ↗</a></div></div>
  </article>;
}
