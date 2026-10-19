"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, localToday, monday } from "@/lib/units";
import type { Locale } from "@/lib/locale";

export function WeekNavigation({
  week,
  locale,
  onChange,
}: {
  week: string;
  locale: Locale;
  onChange: (week: string) => void;
}) {
  const date = (value: string, year = false) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString(
      locale === "fr" ? "fr-CA" : "en-CA",
      {
        day: "numeric",
        month: "short",
        ...(year ? ({ year: "numeric" } as const) : {}),
        timeZone: "UTC",
      },
    );
  return (
    <div className="week-navigation">
      <button
        className="icon-button"
        aria-label={locale === "fr" ? "Semaine précédente" : "Previous week"}
        onClick={() => onChange(addDays(week, -7))}
      >
        <ChevronLeft size={18} />
      </button>
      <strong aria-live="polite">
        {date(week)} — {date(addDays(week, 6), true)}
      </strong>
      <button
        className="icon-button"
        aria-label={locale === "fr" ? "Semaine suivante" : "Next week"}
        onClick={() => onChange(addDays(week, 7))}
      >
        <ChevronRight size={18} />
      </button>
      <button
        className="text-button"
        onClick={() => onChange(monday(localToday()))}
      >
        {locale === "fr" ? "Aujourd’hui" : "Today"}
      </button>
    </div>
  );
}
