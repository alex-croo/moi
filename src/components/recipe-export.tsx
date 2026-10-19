"use client";
import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import type { Ingredient, Recipe, UnitPreferences } from "@/lib/types";
import type { Locale } from "@/lib/locale";

export function RecipeExport({
  recipes,
  ingredients,
  units,
  locale,
  label,
}: {
  recipes: Recipe[];
  ingredients: Ingredient[];
  units: UnitPreferences;
  locale: Locale;
  label?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  async function download() {
    setBusy(true);
    setError("");
    try {
      const { exportRecipes } = await import("@/lib/recipe-pdf");
      await exportRecipes(recipes, ingredients, units, locale);
    } catch {
      setError(
        t(
          "Le PDF n’a pas pu être préparé. Réessayez; toutes les photos doivent être disponibles.",
          "The PDF could not be prepared. Please retry; all photos must be available.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="recipe-export">
      <button
        className="secondary"
        disabled={busy || !recipes.length}
        onClick={() => void download()}
      >
        <ArrowDownToLine size={16} />
        {busy
          ? t("Préparation du PDF…", "Preparing PDF…")
          : label || t("Télécharger la fiche PDF", "Download recipe PDF")}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
