import { addDays, endOfDay, startOfDay } from "date-fns";
import Link from "next/link";
import { db, LOCAL_USER_ID } from "@/lib/db";
import { configurationStatus } from "@/lib/env";
import { EventRow } from "@/components/event-row";
import { RefreshButton } from "@/components/refresh-button";
import { ImpressionTracker } from "@/components/impression-tracker";
import { listScoredEvents } from "@/services/events";
import { normalizeText } from "@/lib/normalize";

export const dynamic = "force-dynamic";
type Params = Record<string,string|string[]|undefined>;
const one=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
export default async function Home({searchParams}:{searchParams:Promise<Params>}) {
  const q=await searchParams; const days=Math.min(180,Math.max(1,Number(one(q.days)??7)));
  const [items,lastSync]=await Promise.all([listScoredEvents({from:startOfDay(new Date()),to:endOfDay(addDays(new Date(),days))}),db.syncRun.findFirst({where:{userId:LOCAL_USER_ID,kind:"EVENTS",status:{in:["SUCCESS","PARTIAL"]}},orderBy:{completedAt:"desc"}})]);
  const counts={artists:items.filter(x=>x.match.exactArtistMatch).length,discover:items.filter(x=>!x.match.exactArtistMatch&&x.match.score>0).length,all:items.length};
  const tab=one(q.tab)??(counts.discover>0?"discover":"all"); const search=normalizeText(one(q.query)??"");
  const filtered=items.filter(({normalized:e,match})=>{
    if(tab==="artists"&&!match.exactArtistMatch)return false;if(tab==="discover"&&(match.exactArtistMatch||match.score<=0))return false;
    const genre=one(q.genre);if(genre&&![...e.genres,...e.classifications].some(g=>g.toLowerCase()===genre.toLowerCase()))return false;
    if(one(q.type)&&e.type!==one(q.type))return false;if(one(q.venue)&&e.venue.name!==one(q.venue))return false;if(one(q.status)&&e.ticketStatus!==one(q.status))return false;
    if(search&&!normalizeText(`${e.title} ${e.artists.map(a=>a.name).join(" ")} ${e.venue.name}`).includes(search))return false;return true;
  });
  const genres=[...new Set(items.flatMap(x=>x.normalized.genres))].sort();const venues=[...new Set(items.map(x=>x.normalized.venue.name))].sort();const config=configurationStatus();
  return <>
    <section className="hero"><div><div className="eyebrow">Amsterdam · komende {days} dagen</div><h1>Vind de avond die bij je past.</h1><p className="lead">Concerten, clubnachten en festivals, gerangschikt op jouw artiesten en genres — met een uitlegbare score.</p></div><div className="hero-actions"><RefreshButton/><div className="meta" style={{marginTop:10}}>Laatste sync: {lastSync?.completedAt?lastSync.completedAt.toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam"}):"nog niet uitgevoerd"}</div></div></section>
    {config.ticketmasterMissing.length>0&&<div className="notice" style={{marginTop:20}}>Er worden geen voorbeelddata getoond. Voeg <code>TICKETMASTER_API_KEY</code> toe om echte evenementen op te halen. <Link href="/configuratie"><u>Bekijk configuratie</u></Link>.</div>}
    <nav className="tabs" aria-label="Evenementselectie"><Link className={`tab ${tab==="artists"?"active":""}`} href={`/?tab=artists&days=${days}`}>Jouw artiesten <b>{counts.artists}</b></Link><Link className={`tab ${tab==="discover"?"active":""}`} href={`/?tab=discover&days=${days}`}>Ontdek voor jou <b>{counts.discover}</b></Link><Link className={`tab ${tab==="all"?"active":""}`} href={`/?tab=all&days=${days}`}>Alles <b>{counts.all}</b></Link></nav>
    <form className="filters"><input type="search" name="query" defaultValue={one(q.query)??""} placeholder="Zoek artiest of show"/><select name="days" defaultValue={String(days)} aria-label="Datumbereik"><option value="7">7 dagen</option><option value="30">30 dagen</option><option value="90">3 maanden</option></select><select name="genre" defaultValue={one(q.genre)??""}><option value="">Alle genres</option>{genres.map(x=><option key={x}>{x}</option>)}</select><select name="type" defaultValue={one(q.type)??""}><option value="">Alle typen</option><option value="CONCERT">Concert</option><option value="CLUB_NIGHT">Clubnacht</option><option value="FESTIVAL">Festival</option><option value="UNKNOWN">Onbekend</option></select><select name="venue" defaultValue={one(q.venue)??""}><option value="">Alle venues</option>{venues.map(x=><option key={x}>{x}</option>)}</select><select name="status" defaultValue={one(q.status)??""}><option value="">Ticketstatus</option><option value="AVAILABLE">Beschikbaar</option><option value="SOLD_OUT">Uitverkocht</option><option value="UNKNOWN">Controleer bij aanbieder</option></select><input type="hidden" name="tab" value={tab}/><button type="submit">Toepassen</button>{(search||one(q.genre)||one(q.type)||one(q.venue)||one(q.status))&&<Link className="clear-filter" href={`/?tab=${tab}&days=${days}`}>Wis filters</Link>}</form>
    <ImpressionTracker eventIds={filtered.map(x=>x.event.id)}/><section><div className="result-heading"><h2>{tab==="artists"?"Jouw artiesten":tab==="discover"?"Ontdek voor jou":"Alle muziekevenementen"}</h2><span>{filtered.length} gevonden</span></div>{filtered.length?<div className="event-list">{filtered.map(item=><EventRow key={item.event.id} item={item}/>)}</div>:<div className="empty"><h3>Geen evenementen in deze selectie</h3><p className="muted">{tab==="artists"?"Er staan nu geen exacte matches met je Spotify- of handmatige artiesten in dit bereik. Bekijk ‘Ontdek voor jou’ of ‘Alles’.":"Pas filters aan, kies een ruimer datumbereik of ververs de bron. ‘Geen resultaat’ betekent niet ‘geen evenement’."}</p></div>}</section>
  </>;
}
