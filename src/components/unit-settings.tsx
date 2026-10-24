"use client";
import { useText } from "./locale-provider";

import { tr as regionalTr, intlLocale } from "@/lib/locale";
import { AppSelect } from "./app-select";
import { useState } from "react";
import type { Locale } from "@/lib/locale";
import type { UnitPreferences } from "@/lib/types";
export function UnitSettings({
  units,
  locale,
  onSave,
}: {
  units: UnitPreferences;
  locale: Locale;
  onSave: (units: UnitPreferences) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = useText(locale);
  const fields: {
    id: keyof UnitPreferences;
    name: string;
    options: [string, string][];
  }[] = [
    {
      id: "bodyMass",
      name: t("Poids corporel", "Body weight"),
      options: [
        ["lb", t("Livres (lb)", "Pounds (lb)")],
        ["kg", "Kilogrammes (kg)"],
      ],
    },
    {
      id: "ingredientMass",
      name: t("Poids des ingrédients", "Ingredient weight"),
      options: [
        ["g", t("Grammes (g)", "Grams (g)")],
        ["oz", t("Onces (oz)", "Ounces (oz)")],
        ["kg", "kg"], ["lb", t("Livres (lb)", "Pounds (lb)")],
      ],
    },
    {
      id: "volume",
      name: t("Volumes et liquides", "Volumes and liquids"),
      options: [
        ["ml", t("Millilitres (ml)", "Millilitres (ml)")],
        ["l", "L"], ["cup_metric", t("Tasses de 250 ml", "250 ml cups")],
        ["cup", t("Tasses US (236,6 ml)", "US cups (236.6 ml)")],
        [
          "fl_oz",
          t("Onces liquides US (29,57 ml)", "US fluid ounces (29.57 ml)"),
        ],
      ],
    },
    {
      id: "spoons",
      name: t("Petites quantités et cuillères", "Small quantities and spoons"),
      options: [
        [
          "spoon",
          t(
            "Cuillères à thé / à soupe (5 / 15 ml)",
            "Teaspoons / tablespoons (5 / 15 ml)",
          ),
        ],
        ["ml", "Millilitres (ml)"],
      ],
    },
    {
      id: "temperature",
      name: t("Température de cuisson", "Cooking temperature"),
      options: [
        ["C", "Celsius (°C)"],
        ["F", "Fahrenheit (°F)"],
      ],
    },
    {
      id: "length",
      name: t("Dimensions et épaisseurs", "Dimensions and thickness"),
      options: [
        ["cm", t("Centimètres (cm)", "Centimetres (cm)")],
        ["in", t("Pouces (po)", "Inches (in)")],
      ],
    },
  ];
  return (
    <section className="units-settings">
      <h2>{t("Vos unités, à votre façon", "Your units, your way")}</h2>
      <p>
        {t(
          "Chaque choix est indépendant et s’applique aux recettes, aux étapes et au suivi. Les données d’origine sont conservées. Les macronutriments restent en grammes, comme sur les étiquettes nutritionnelles.",
          "Each choice is independent and applies to recipes, steps and tracking. Original measurements are preserved. Macronutrients remain in grams, as on nutrition labels.",
        )}
      </p>
      <div className="unit-fields">
        {fields.map((field) => (
          <label key={field.id}>
            <span>{field.name}</span>
            <AppSelect
              aria-label={field.name}
              value={units[field.id]}
              disabled={busy}
              onChange={async (e) => {
                const next = { ...units, [field.id]: e.target.value };
                setBusy(true);
                setError("");
                try {
                  await onSave(next);
                } catch {
                  setError(
                    t(
                      "Le choix n’a pas pu être enregistré. Réessayez.",
                      "The preference could not be saved. Please retry.",
                    ),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {field.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </AppSelect>
          </label>
        ))}
      </div>
      {busy && <p role="status">{t("Enregistrement…", "Saving…")}</p>}
      {error && <p role="alert">{t(error)}</p>}
    </section>
  );
}
