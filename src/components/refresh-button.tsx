"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const [state, setState] = useState<"idle"|"loading"|"done"|"error">("idle"); const [message,setMessage]=useState(""); const router=useRouter();
  async function refresh() {
    setState("loading"); setMessage("");
    try {
      const response=await fetch("/api/sync/events",{method:"POST"}); const data=await response.json() as {error?:string;added?:number;updated?:number};
      if(!response.ok) throw new Error(data.error ?? "Verversen mislukt");
      setState("done"); setMessage(`${data.added ?? 0} nieuw, ${data.updated ?? 0} bijgewerkt`);
      if ("Notification" in window && Notification.permission === "granted") {
        const candidates=await fetch("/api/notifications/candidates").then((r)=>r.json()) as {events?:{id:string;title:string;body:string}[]};
        for(const event of candidates.events ?? []) { new Notification(event.title,{body:event.body}); await fetch("/api/notifications/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId:event.id})}); }
      }
      router.refresh();
    } catch(error) { setState("error"); setMessage(error instanceof Error?error.message:"Verversen mislukt"); }
  }
  return <div><button onClick={refresh} disabled={state==="loading"}>{state==="loading"?"Bezig met ophalen…":"Evenementen verversen"}</button>{message&&<div className={`meta ${state==="error"?"error":""}`} style={{marginTop:8}}>{message}</div>}</div>;
}
