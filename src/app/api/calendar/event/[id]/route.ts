import { NextResponse } from "next/server";
import { calendarToIcs } from "@/lib/ics";
import { getScoredEvent } from "@/services/events";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const item=await getScoredEvent(id);if(!item)return new NextResponse("Niet gevonden",{status:404});return new NextResponse(calendarToIcs([item.normalized],item.normalized.title),{headers:{"Content-Type":"text/calendar; charset=utf-8","Content-Disposition":`attachment; filename="gig-${id}.ics"`}})}
