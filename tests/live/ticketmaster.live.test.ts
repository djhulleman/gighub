import { expect,it } from "vitest";
import { TicketmasterProvider } from "@/providers/ticketmaster";
const live=process.env.TICKETMASTER_API_KEY?it:it.skip;
live("haalt live geldige muziekevenementen op zonder de standaardsuite te beïnvloeden",async()=>{const provider=new TicketmasterProvider();const events=await provider.searchEvents({startDateTime:new Date(),endDateTime:new Date(Date.now()+7*86400000),city:"Amsterdam"});expect(Array.isArray(events)).toBe(true)},20000);
