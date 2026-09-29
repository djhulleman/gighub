"use client";
import { useMemo, useState } from "react";
import { addPreference, removePreference } from "@/app/actions";
import type { GenreSuggestion } from "@/lib/genre-catalog";

export function GenrePicker({ suggestions, selected, blocked = [], kind = "genre", title = "Genres", description = "Kies uit genres die in je actuele eventdata voorkomen. De catalogus vult aan waar Spotify geen genres levert." }: { suggestions: GenreSuggestion[]; selected: { id: string; name: string }[]; blocked?: string[]; kind?: "genre" | "excludedGenre"; title?: string; description?: string }) {
  const [query, setQuery] = useState("");
  const available = useMemo(() => {
    const selectedNames = new Set([...selected.map((item) => item.name), ...blocked].map((name) => name.toLocaleLowerCase("nl")));
    return suggestions.filter((item) => !selectedNames.has(item.name.toLocaleLowerCase("nl")) && item.name.toLocaleLowerCase("nl").includes(query.trim().toLocaleLowerCase("nl"))).slice(0, query ? 50 : 18);
  }, [blocked, query, suggestions, selected]);
  return <section className="panel"><h2>{title}</h2><p className="meta">{description}</p>
    {selected.length > 0 && <><h3>Gekozen</h3><div className="chips">{selected.map((item) => <span className="chip selected-chip" key={item.id}>{item.name}<form action={removePreference}><input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={item.id}/><button aria-label={`${item.name} verwijderen`}>×</button></form></span>)}</div></>}
    <label className="genre-search"><span>Vind een genre</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bijvoorbeeld techno, jazz of punk"/></label>
    <div className="genre-options">{available.map((item) => <form action={addPreference} key={item.name}><input type="hidden" name="kind" value={kind}/><input type="hidden" name="name" value={item.name}/><button className="genre-option" title={item.source === "eventdata" ? `${item.eventCount} komende evenementen` : `Uit ${item.source}`}><span>+</span> {item.name}{item.eventCount > 0 && <small>{item.eventCount}</small>}</button></form>)}</div>
    {!available.length && <p className="meta">Geen beschikbaar genre gevonden voor deze zoekterm.</p>}
  </section>;
}
