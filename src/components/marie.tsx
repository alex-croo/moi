/** A visual identity, not a separate chat: Marie's suggestions stay in the journal. */
export function Marie({ caption = "Votre complice IA", compact = false }: { caption?: string; compact?: boolean }) {
  return <div className={`marie-identity${compact ? " compact" : ""}`}>
    <img src="/brand/marie/avatar.webp" alt="" width={64} height={64}/>
    <span><strong>Marie <i>IA</i></strong><small>{caption}</small></span>
  </div>;
}
