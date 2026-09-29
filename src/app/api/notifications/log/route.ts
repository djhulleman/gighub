import { NextResponse } from "next/server";
import { z } from "zod";
import { db,LOCAL_USER_ID } from "@/lib/db";
export async function POST(request:Request){const parsed=z.object({eventId:z.string().min(1)}).safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Ongeldig verzoek"},{status:400});await db.notificationLog.upsert({where:{userId_eventId_provider:{userId:LOCAL_USER_ID,eventId:parsed.data.eventId,provider:"browser"}},update:{sentAt:new Date()},create:{userId:LOCAL_USER_ID,eventId:parsed.data.eventId,provider:"browser"}});return NextResponse.json({ok:true})}
