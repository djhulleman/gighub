"use client";
import { useEffect } from "react";
export function ImpressionTracker({eventIds}:{eventIds:string[]}){useEffect(()=>{if(eventIds.length)void fetch("/api/impressions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventIds})})},[eventIds]);return null}
