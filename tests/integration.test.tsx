// @vitest-environment jsdom
import React from "react";
import { render,screen } from "@testing-library/react";
import { expect,it } from "vitest";
import { normalizeTicketmasterItem } from "@/providers/ticketmaster";
import { deduplicateEvents } from "@/lib/dedupe";
import { scoreEvent } from "@/lib/scoring";

it("doorloopt voorkeur → normalisatie → dedupe → score → artiesttab en reden",()=>{const raw={id:"tm-1",name:"Fred again..",url:"https://example.com/event",dates:{start:{localDate:"2026-10-03",dateTime:"2026-10-03T18:00:00Z"},timezone:"Europe/Amsterdam",status:{code:"onsale"}},classifications:[{segment:{name:"Music"},genre:{name:"Dance/Electronic"},subGenre:{name:"Techno"}}],_embedded:{venues:[{name:"Ziggo Dome",city:{name:"Amsterdam"}}],attractions:[{id:"artist-1",name:"Fred again.."}]}};const event=normalizeTicketmasterItem(raw);expect(event).not.toBeNull();const events=deduplicateEvents([event!,event!]);expect(events).toHaveLength(1);const match=scoreEvent(events[0],{spotifyArtists:[{name:"Fred again..",rank:1,period:"short_term"}],manualArtists:[],genres:["Techno"],excludedArtists:[],excludedGenres:[]});const tab=match.exactArtistMatch?"Jouw artiesten":"Ontdek voor jou";render(<div><span>{tab}</span><p>{match.reasons[0]}</p></div>);expect(screen.getByText("Jouw artiesten")).toBeInTheDocument();expect(screen.getByText(/Je luistert vaak naar Fred again/)).toBeInTheDocument()});
