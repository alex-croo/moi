"use client";
import { useId, useState, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, Minus, Snowflake } from "lucide-react";
import type { MealAvailability as Availability } from "@/lib/shopping";
import type { Ingredient, UnitPreferences } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { quantityLabel } from "@/lib/units";
export function MealAvailability({ availability, ingredients, units, locale }: { availability: Availability; ingredients: Ingredient[]; units: UnitPreferences; locale: Locale }) {
  const [open, setOpen] = useState(false), id = useId();
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const button = useRef<HTMLButtonElement>(null), tooltip = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = button.current?.getBoundingClientRect(); if (!rect) return;
      const width = Math.min(280, window.innerWidth - 24), height = tooltip.current?.getBoundingClientRect().height || 160;
      setPosition({ left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - height - 12)) });
    };
    place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  const ready = availability.complete;
  const title = ready ? t("Tous les ingrédients sont prévus", "All ingredients are covered") : t("Il manque des ingrédients", "Ingredients are missing");
  return <span className="meal-availability" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button ref={button} type="button" className={`availability-dot ${ready ? "is-ready" : "is-missing"}`} aria-label={title} aria-expanded={open} aria-controls={id} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}>
      {ready ? <Check size={13} strokeWidth={3}/> : <Minus size={13} strokeWidth={3}/>}
    </button>
    {open && createPortal(<span ref={tooltip} className="availability-tooltip" style={position} id={id} role="tooltip"><strong>{title}</strong>
      {ready && <span>{availability.sources.length ? t("Vos réserves et les commandes suivantes couvrent ce repas :", "Your pantry and these orders cover this meal:") : t("Tout est dans vos réserves.", "Everything is in your pantry.")}</span>}
      {availability.sources.map(source => <span key={source.id}>{source.grocer || t("Mon épicier", "My grocer")} · {new Date(`${source.date}T12:00:00Z`).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { day: "numeric", month: "short", timeZone: "UTC" })}</span>)}
      {availability.missing.map((item, i) => <span key={i}>{ingredients.find(x => x.id === item.ingredientId)?.[locale === "fr" ? "name" : "nameEn"] || item.ingredientId} · {quantityLabel(item.quantity, units, locale)}{item.check && ` · ${t("quantité à vérifier", "quantity to check")}`}</span>)}
      {!!availability.frozen.length && <span><Snowflake size={12}/> {t("Des aliments sont congelés : prévoir la décongélation.", "Some foods are frozen: plan time to thaw.")}</span>}
    </span>, document.body)}
  </span>;
}
