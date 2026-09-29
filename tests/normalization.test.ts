import { describe,expect,it } from "vitest";
import { areDuplicate,deduplicateEvents } from "@/lib/dedupe";
import { canonicalVenueName, encodeGeohash } from "@/lib/normalize";
import { normalizeTicketStatus } from "@/lib/ticket-status";
import type { NormalizedEvent } from "@/lib/types";
const base:NormalizedEvent={provider:"ticketmaster",externalId:"x",title:"Björk Live - World Tour Tickets",normalizedTitle:"bjork",artists:[{name:"Björk",normalizedName:"bjork"}],type:"CONCERT",startAt:new Date("2026-10-01T18:00Z"),timeZone:"Europe/Amsterdam",localDate:"2026-10-01",venue:{name:"AFAS Live",normalizedName:"afas live",city:"Amsterdam"},city:"Amsterdam",genres:["Alternative"],classifications:["Music"],officialUrl:"https://example.com",ticketStatus:"UNKNOWN",lastCheckedAt:new Date(),lastSyncedAt:new Date()};
describe("normalisatie en deduplicatie",()=>{
  it("herkent provider plus externe ID",()=>expect(areDuplicate(base,{...base})).toBe(true));
  it("herkent titel/artiest/datum met venue-alias",()=>expect(areDuplicate(base,{...base,provider:"future",externalId:"y",title:"Björk",venue:{...base.venue,name:"Heineken Music Hall"}})).toBe(true));
  it("voegt twijfelachtige events niet agressief samen",()=>expect(deduplicateEvents([base,{...base,externalId:"z",title:"Andere band",artists:[{name:"Andere band",normalizedName:"andere band"}]}])).toHaveLength(2));
  it("normaliseert venue-aliases",()=>expect(canonicalVenueName("Heineken Music Hall")).toBe("AFAS Live"));
  it("maakt een stabiele geoPoint voor de officiële locatiezoekfunctie",()=>{expect(encodeGeohash(52.3676,4.9041)).toHaveLength(7);expect(encodeGeohash(52.3676,4.9041)).toBe(encodeGeohash(52.3676,4.9041))});
  it.each([["onsale","AVAILABLE"],["soldout","SOLD_OUT"],["offsale","UNKNOWN"],["cancelled","UNKNOWN"],[undefined,"NOT_CHECKED"]])("normaliseert ticketstatus %s voorzichtig",(raw,expected)=>expect(normalizeTicketStatus(raw)).toBe(expected));
});
