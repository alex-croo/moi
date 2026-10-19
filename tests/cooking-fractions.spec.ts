import { test, expect } from "@playwright/test";
import {
  defaultUnits,
  instructionText,
  measure,
  quantityLabel,
} from "../src/lib/units";

test("cooking spoons show reduced fractions and mixed numbers in both languages", () => {
  for (const [ml, fr, en] of [
    [1.25, "1/4 c. à thé", "1/4 tsp"],
    [2.5, "1/2 c. à thé", "1/2 tsp"],
    [3.75, "3/4 c. à thé", "3/4 tsp"],
    [0.3125, "1/16 c. à thé", "1/16 tsp"],
    [0.9375, "3/16 c. à thé", "3/16 tsp"],
    [5.625, "1 1/8 c. à thé", "1 1/8 tsp"],
    [22.5, "1 1/2 c. à soupe", "1 1/2 tbsp"],
    [30, "2 c. à soupe", "2 tbsp"],
  ] as const) {
    expect(measure("spoon", ml, defaultUnits, "fr")).toBe(fr);
    expect(measure("spoon", ml, defaultUnits, "en")).toBe(en);
  }
});

test("ingredient lines and preparation steps share fractions after portion scaling", () => {
  const quantity = { kind: "spoon" as const, value: 2.5 };
  expect(quantityLabel(quantity, defaultUnits, "fr", 0.5)).toBe("1/4 c. à thé");
  expect(
    instructionText(
      "Ajouter {{spoon:2.5}} de sel à {{temp:180}}.",
      defaultUnits,
      "fr",
      0.5,
    ),
  ).toBe("Ajouter 1/4 c. à thé de sel à 180 °C.");
  expect(quantityLabel(quantity, defaultUnits, "fr", 2 / 3)).toBe(
    "1/3 c. à thé",
  );
  expect(
    quantityLabel(
      { kind: "count", value: 1, label: "oignon" },
      defaultUnits,
      "fr",
      0.5,
    ),
  ).toBe("1/2 oignon");
  expect(quantity).toEqual({ kind: "spoon", value: 2.5 });
});

test("cup and imperial measures use exact fractions and label converted cup estimates", () => {
  const units = {
    ...defaultUnits,
    volume: "cup" as const,
    ingredientMass: "oz" as const,
  };
  expect(measure("volume", 236.5882365 * 1.5, units, "fr")).toBe(
    "1 1/2 tasse US",
  );
  expect(measure("volume", 236.5882365 / 3, units, "en")).toBe("1/3 US cup");
  expect(measure("volume", 60, units, "fr")).toBe("≈ 1/4 tasse US");
  expect(measure("volume", 120, units, "en")).toBe("≈ 1/2 US cup");
  expect(measure("volume", 115, units, "en")).toBe("0.49 US cup");
  expect(measure("mass", 28.349523125 * 2.5, units, "fr")).toBe("2 1/2 oz");
  expect(measure("mass", 550, units, "en")).toBe("19.4 oz");
});

test("metric preferences and nonstandard tiny quantities preserve useful precision", () => {
  const units = { ...defaultUnits, spoons: "ml" as const };
  expect(measure("spoon", 1.25, units, "fr")).toBe("1,25 ml");
  expect(measure("volume", 125, units, "fr")).toBe("125 ml");
  expect(measure("mass", 1.5, units, "fr")).toBe("1,5 g");
  expect(measure("spoon", 0, defaultUnits, "fr")).toBe("0 c. à thé");
  expect(measure("spoon", 0.005, defaultUnits, "fr")).toBe("0,001 c. à thé");
  expect(measure("spoon", 0.5, defaultUnits, "fr")).toBe("0,1 c. à thé");
});
