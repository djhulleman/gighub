import { describe,expect,it } from "vitest";
import { scoreEvent,type TasteProfile } from "@/lib/scoring";
import type { NormalizedEvent } from "@/lib/types";

const event:NormalizedEvent={provider:"ticketmaster",externalId:"1",title:"Fred again..",normalizedTitle:"fred again",artists:[{name:"Fred again..",normalizedName:"fred again"}],type:"CONCERT",startAt:new Date("2026-10-03T18:00:00Z"),timeZone:"Europe/Amsterdam",localDate:"2026-10-03",venue:{name:"Ziggo Dome",normalizedName:"ziggo dome",city:"Amsterdam"},city:"Amsterdam",genres:["electronic","techno"],classifications:["Music"],officialUrl:"https://example.com",ticketStatus:"AVAILABLE",lastCheckedAt:new Date(),lastSyncedAt:new Date()};
const empty: TasteProfile={spotifyArtists:[],manualArtists:[],genres:[],excludedArtists:[],excludedGenres:[]};
describe("uitlegbare score",()=>{
  it("scoort een exacte Spotify-artiestmatch en gebruikt de rang",()=>{const top=scoreEvent(event,{...empty,spotifyArtists:[{name:"Fred again..",rank:1,period:"short_term"}]});const low=scoreEvent(event,{...empty,spotifyArtists:[{name:"Fred again..",rank:50,period:"short_term"}]});expect(top.score).toBeGreaterThan(low.score);expect(top.exactArtistMatch).toBe(true);expect(top.reasons[0]).toContain("Fred again")});
  it("respecteert handmatige voorkeurgewichten",()=>{const favorite=scoreEvent(event,{...empty,manualArtists:[{name:"Fred again..",weight:"FAVORITE"}]});const neutral=scoreEvent(event,{...empty,manualArtists:[{name:"Fred again..",weight:"NEUTRAL"}]});expect(favorite.score).toBeGreaterThan(neutral.score)});
  it("scoort genre-overlap",()=>{const result=scoreEvent(event,{...empty,genres:["techno"]});expect(result.score).toBeGreaterThan(0);expect(result.reasons).toContain("Past bij je voorkeur voor techno")});
  it("herkent een hoofdgenre binnen een providersubgenre",()=>{const result=scoreEvent({...event,genres:["Alternative Rock"]},{...empty,genres:["Rock"]});expect(result.reasons).toContain("Past bij je voorkeur voor Rock")});
  it("past artiestuitsluiting vóór boosts toe",()=>expect(scoreEvent(event,{...empty,spotifyArtists:[{name:"Fred again..",rank:1,period:"short_term"}],excludedArtists:["Fred again.."]}).score).toBe(0));
  it("past genreuitsluiting vóór boosts toe",()=>expect(scoreEvent(event,{...empty,genres:["techno"],excludedGenres:["techno"]}).excluded).toBe(true));
  it("geeft een discoveryboost aan een nieuwe relevante artiest",()=>{const result=scoreEvent(event,{...empty,genres:["techno"],seenArtistNames:[]});expect(result.components.find(x=>x.label==="Ontdekking")?.points).toBeGreaterThan(0)});
  it("begrensd scores tussen 0 en 100",()=>{const result=scoreEvent(event,{...empty,spotifyArtists:[{name:"Fred again..",rank:1,period:"short_term"}],manualArtists:[{name:"Fred again..",weight:"FAVORITE"}],genres:["techno"]});expect(result.score).toBe(100)});
});
