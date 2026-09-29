import { NextResponse } from "next/server";
import { db,LOCAL_USER_ID } from "@/lib/db";
import { calendarToIcs } from "@/lib/ics";
import { toNormalized } from "@/services/events";
export async function GET(){const rows=await db.savedEvent.findMany({where:{userId:LOCAL_USER_ID},include:{event:{include:{venue:true,artists:true,sources:true}}},orderBy:{event:{startAt:"asc"}}});return new NextResponse(calendarToIcs(rows.map(x=>toNormalized(x.event)),"Opgeslagen gigs"),{headers:{"Content-Type":"text/calendar; charset=utf-8","Content-Disposition":"attachment; filename=amsterdam-gig-scout.ics"}})}
