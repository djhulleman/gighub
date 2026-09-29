import { addDays,endOfDay,startOfDay } from "date-fns";
import { NextResponse } from "next/server";
import { db,LOCAL_USER_ID } from "@/lib/db";
import { listScoredEvents } from "@/services/events";
export async function GET(){const settings=await db.notificationSettings.findUnique({where:{userId:LOCAL_USER_ID}});if(!settings?.enabled)return NextResponse.json({events:[]});const [items,logs]=await Promise.all([listScoredEvents({from:startOfDay(new Date()),to:endOfDay(addDays(new Date(),7))}),db.notificationLog.findMany({where:{userId:LOCAL_USER_ID,provider:"browser"},select:{eventId:true}})]);const sent=new Set(logs.map(x=>x.eventId));return NextResponse.json({events:items.filter(x=>x.match.score>=settings.minimumScore&&!sent.has(x.event.id)).map(x=>({id:x.event.id,title:x.normalized.title,body:`${x.match.score}% match · ${x.normalized.venue.name} · ${x.match.reasons[0]}`}))})}
