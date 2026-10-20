"use client";
import { useState } from "react";
import { ArrowUpRight, BookOpen, FileText, PenLine, Search } from "lucide-react";
import type { Locale } from "@/lib/locale";
import { filterJournalPages, journalPageTitle, type journalPages } from "@/lib/journal-library";
import { localToday } from "@/lib/units";

export function JournalLibrary({ pages, locale, onOpen }: {
  pages: ReturnType<typeof journalPages>;
  locale: Locale;
  onOpen: (date: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [draftsOnly, setDraftsOnly] = useState(false);
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const filtered = filterJournalPages(pages, query, draftsOnly);
  const groups = [...new Set(filtered.map(page => page.date.slice(0, 7)))];
  const format = (date: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00Z`).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { ...options, timeZone: "UTC" });
  const draftCount = pages.filter(page => page.dirty).length;
  return <div className="journal-library">
    <header className="journal-cover">
      <div className="journal-cover-copy">
        <span className="eyebrow">{t("UN ESPACE POUR VOS PENSÉES", "A SPACE FOR YOUR THOUGHTS")}</span>
        <h1>{t("Mon journal.", "My journal.")}<br/><span>{t("Une page à la fois.", "One page at a time.")}</span></h1>
        <p>{t("Les petits moments, les idées qui restent. Retrouvez vos mots et faites de la place aux prochains.", "Small moments, lasting thoughts. Revisit your words and make room for what comes next.")}</p>
        <button className="primary" onClick={() => onOpen(localToday())}><PenLine size={15}/>{t("Écrire aujourd’hui", "Write today")}</button>
      </div>
      <img src="/brand/journal.webp" alt="" width="960" height="640"/>
    </header>
    <div className="journal-library-toolbar">
      <div className="journal-view-filters" aria-label={t("Afficher les pages", "Show pages")}>
        <button aria-pressed={!draftsOnly} onClick={() => setDraftsOnly(false)}><BookOpen size={15}/>{t("Toutes mes pages", "All my pages")}<span>{pages.length}</span></button>
        <button aria-pressed={draftsOnly} onClick={() => setDraftsOnly(true)}>{t("Brouillons", "Drafts")}<span>{draftCount}</span></button>
      </div>
      <label className="journal-search"><Search size={16}/><input type="search" aria-label={t("Rechercher dans mon journal", "Search my journal")} placeholder={t("Retrouver une pensée…", "Find a thought…")} value={query} onChange={event => setQuery(event.target.value)}/></label>
    </div>
    {draftCount > 0 && <p className="journal-draft-notice">{t("Vos brouillons restent ouverts ici. Enregistrez-les avant de quitter pour les retrouver plus tard.", "Your drafts stay open here. Save them before leaving to keep them for later.")}</p>}
    {!filtered.length ? <div className="journal-library-empty">
      <FileText size={27}/><h2>{pages.length ? t("Aucune page pour le moment.", "No pages to show.") : t("Votre première page vous attend.", "Your first page is waiting.")}</h2>
      <p>{pages.length ? t("Essayez un autre mot ou affichez toutes vos pages.", "Try another word or show all your pages.") : t("Pas besoin de trouver les mots parfaits. Quelques lignes suffisent pour commencer.", "No need to find perfect words. A few lines are enough to start.")}</p>
      {pages.length ? <button className="text-button" onClick={() => { setQuery(""); setDraftsOnly(false); }}>{t("Voir toutes mes pages", "Show all my pages")}</button> : <button className="text-button" onClick={() => onOpen(localToday())}>{t("Commencer à écrire", "Start writing")}<ArrowUpRight size={16}/></button>}
    </div> : groups.map(month => <section key={month} className="journal-month">
      <h2>{format(`${month}-01`, { month: "long", year: "numeric" })}</h2>
      <div className="journal-page-list">{filtered.filter(page => page.date.startsWith(month)).map(page => <button className="journal-page-row" key={page.date} onClick={() => onOpen(page.date)}>
        <span className="journal-date-tile"><strong>{page.date.slice(-2)}</strong><small>{format(page.date, { weekday: "short" })}</small></span>
        <span className="journal-row-copy"><strong>{journalPageTitle(page, t("Sans titre", "Untitled"))}</strong><span>{page.text.trim().replace(/\s+/g, " ").slice(0, 180) || t("Votre page est prête à accueillir vos mots.", "Your page is ready for your words.")}</span></span>
        <span className={`journal-row-status ${page.dirty ? "is-draft" : ""}`}>{page.dirty ? t("Brouillon", "Draft") : t("Enregistrée", "Saved")}</span>
        <ArrowUpRight className="journal-row-arrow" size={18}/>
      </button>)}</div>
    </section>)}
  </div>;
}
