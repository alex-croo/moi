"use client";
import { useText, useLocale } from "./locale-provider";
import { L } from "@/components/locale-provider";
/** A visual identity, not a separate chat: Marie's suggestions stay in the journal. */
export function Marie({ caption, compact = false }: { caption?: string; compact?: boolean }) {
 const t=useText(); const locale=useLocale();

  return <div className={`marie-identity${compact ? " compact" : ""}`}>
    <img src="/brand/marie/avatar.webp" alt="" width={64} height={64}/>
    <span><strong><L text={"Marie "} /><i><L text="IA" /></i></strong><small>{caption || t("Votre complice IA")}</small></span>
  </div>;
}
