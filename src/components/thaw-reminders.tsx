"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, Snowflake } from "lucide-react";
import type { ShoppingWorkspace } from "@/lib/shopping-types";
import type { ShoppingMutation } from "@/lib/shopping";
import type { Locale } from "@/lib/locale";
import { thawReminders } from "@/lib/thaw-reminders";
import { quantityLabel } from "@/lib/units";
import { mealLabel } from "@/lib/planner";
export function ThawReminders({ data, locale, all = false, widget = false, onSave }: { widget?: boolean; data: ShoppingWorkspace; locale: Locale; all?: boolean; onSave: (m: ShoppingMutation) => Promise<void> }) {
  const operations = useRef(new Map<string, string>());
  const [now, setNow] = useState(Date.now), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const upcoming = thawReminders(data, data, now), visible = all ? upcoming : upcoming.filter(r => r.dueAt <= now);
  if (!visible.length && !widget) return null;
  const date = (time: number) => new Date(time).toLocaleString(locale === "fr" ? "fr-CA" : "en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return <section className={`thaw-reminders${widget ? " journal-widget journal-reminders-widget" : ""}`} aria-label={widget ? t("Mes rappels", "My reminders") : t("Décongélation à prévoir", "Plan to thaw")}>
    <header><h2>{widget ? <Bell size={17}/> : <Snowflake size={17}/>} {widget ? t("Mes rappels", "My reminders") : t("À sortir du congélateur", "Time to take out of the freezer")}</h2></header>
    {widget && <p className="journal-widget-caption">{t("À prévoir aujourd’hui", "For today")}</p>}
    {!visible.length && <p className="journal-widget-empty">{t("Rien à sortir du congélateur pour le moment.", "Nothing to take out of the freezer right now.")}</p>}
    {visible.map(r => <div className="thaw-reminder" key={r.id}><div>{widget && <span className="journal-reminder-action"><Snowflake size={14}/>{t("À décongeler au réfrigérateur", "Thaw in the fridge")}</span>}<strong>{data.ingredients.find(i => i.id === r.ingredientId)?.[locale === "fr" ? "name" : "nameEn"] || r.ingredientId} · {quantityLabel(r.quantity, data.preferences, locale)}</strong><small>{widget ? t("Pour le repas du", "For the meal on") : t("À sortir le", "Take out on")} {date(widget ? r.mealAt : r.dueAt)} · {data.recipes.find(x => x.id === r.recipeId)?.[locale === "fr" ? "title" : "titleEn"]} · {mealLabel(r.meal.slot, locale)}</small></div><button className="secondary" disabled={busy} onClick={async () => {
      setBusy(true); setError("");
      try {
        const id = operations.current.get(r.id) || crypto.randomUUID(); operations.current.set(r.id, id);
        await onSave({ action: "thaw", id, itemId: r.itemId, amount: r.quantity.value }); operations.current.delete(r.id);
      }
      catch { setError(t("Vos réserves ont peut-être changé. Rechargez avant de réessayer.", "Your pantry may have changed. Reload before retrying.")); }
      finally { setBusy(false); }
    }}>{t("Mis au réfrigérateur", "Moved to the fridge")}</button></div>)}
    {!widget && <details><summary>{t("À propos des rappels", "About these reminders")}</summary><p>{t("Avis dans Tred’meal 24 h avant le repas. Il se met à jour lorsque vous déplacez l’aliment au réfrigérateur ou changez le menu. Repères : déjeuner 8 h, dîner 12 h, souper 18 h; collations 10 h, 15 h et 21 h (heure de Toronto). La durée réelle de décongélation dépend du format.", "Tred’meal shows a reminder 24 hours before a meal. It updates when you move the food to the fridge or change the menu. Meal landmarks: breakfast 8 am, lunch noon, dinner 6 pm; snacks 10 am, 3 pm and 9 pm (Toronto time). Actual thawing time depends on package size.")}</p></details>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </section>;
}
