import { NextResponse } from "next/server";
import { syncEvents } from "@/services/event-sync";
let running: Promise<unknown>|null=null;
export async function POST(){if(running)return NextResponse.json({error:"Er draait al een synchronisatie"},{status:409});try{running=syncEvents();return NextResponse.json(await running);}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Synchronisatie mislukt"},{status:500});}finally{running=null}}
