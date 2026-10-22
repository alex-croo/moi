"use client";
import { useState } from "react";
import type { Locale } from "@/lib/locale";
import { LearningPreferences } from "./learning-journal";
export function PrivacySettings({locale,enhanced,backup,migrate}:{locale:Locale;enhanced:boolean;backup:()=>void;migrate:()=>Promise<void>}){
 const [ack,setAck]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 return <section className="privacy-settings"><h2>{locale==="fr"?"Confidentialité":"Privacy"}</h2><p>Votre compte Google ouvre votre espace. Vos informations sont isolées des autres usagers. Les administrateurs ne peuvent pas consulter vos journaux depuis leur interface.</p>
 {enhanced&&<section className="learning-migration"><h3>Retrouver mon journal accompagné</h3><p>Votre ancien coffre est encore protégé. Pour utiliser le nouveau journal, transférez ses données déjà déverrouillées vers votre espace privé. Elles seront protégées en transit et dans l’hébergement, mais ne seront plus chiffrées de bout en bout. Les opérateurs techniques pourront y accéder. La personnalisation IA reste un choix séparé.</p><button className="secondary" onClick={backup}>Garder une sauvegarde du coffre</button><label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> Je comprends ce changement et souhaite transférer mes données existantes.</label><button className="primary" disabled={!ack||busy} onClick={async()=>{setBusy(true);setError("");try{await migrate();}catch{setError("Le transfert n’a pas été confirmé. Vos données et le coffre restent conservés; rechargez pour vérifier l’état.");}finally{setBusy(false);}}}>{busy?"Transfert et vérification…":"Transférer mon espace"}</button>{error&&<p role="alert">{error}</p>}</section>}
 <LearningPreferences/>
 </section>;
}
