import { NextResponse } from "next/server";
import { z } from "zod";
import { db,LOCAL_USER_ID } from "@/lib/db";
export async function POST(request:Request){const parsed=z.object({eventIds:z.array(z.string()).max(200)}).safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Ongeldig verzoek"},{status:400});const now=new Date();await db.$transaction(parsed.data.eventIds.map(eventId=>db.eventImpression.upsert({where:{userId_eventId:{userId:LOCAL_USER_ID,eventId}},update:{lastShownAt:now,count:{increment:1}},create:{userId:LOCAL_USER_ID,eventId,firstShownAt:now,lastShownAt:now}})));return NextResponse.json({ok:true})}
