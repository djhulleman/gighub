"use client";
import { useState } from "react";
import { updateNotifications } from "@/app/actions";
export function NotificationForm({enabled,minimumScore}:{enabled:boolean;minimumScore:number}) {
  const [allowed,setAllowed]=useState(typeof Notification!=="undefined"?Notification.permission:"default");
  async function permission(){if("Notification" in window)setAllowed(await Notification.requestPermission());}
  return <form action={updateNotifications} className="stack"><label><input type="checkbox" name="enabled" value="true" defaultChecked={enabled} style={{width:"auto",marginRight:8}}/> Meldingen inschakelen</label><label>Minimale matchscore <input type="number" min="0" max="100" name="minimumScore" defaultValue={minimumScore}/></label>{allowed!=="granted"&&<button type="button" className="secondary" onClick={permission}>Browsertoestemming vragen</button>}<button type="submit">Meldingsinstellingen opslaan</button><div className="meta">Browserstatus: {allowed}. Meldingen worden alleen na handmatig verversen gecontroleerd; zonder actieve browser of scheduler draait er niets op de achtergrond.</div></form>;
}
