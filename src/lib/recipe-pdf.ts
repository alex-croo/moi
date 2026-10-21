import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { Ingredient, Recipe, UnitPreferences } from "./types";
import type { Locale } from "./locale";
import {
  instructionText,
  quantityLabel,
  recipeNutrition,
  measure,
} from "./units";

export type RecipeImageLoader = (path: string) => Promise<Uint8Array>;

// Shared by individual cards, library selections and the weekly recipe booklet.
export async function buildRecipePdf(
  recipes: Recipe[],
  ingredients: Ingredient[],
  units: UnitPreferences,
  locale: Locale,
  loadImage: RecipeImageLoader,
  loadFont: RecipeImageLoader = async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error("font_unavailable");
    return new Uint8Array(await response.arrayBuffer());
  },
) {
  if (!recipes.length) throw new Error("empty_selection");
  const pdf = await PDFDocument.create();
  // Embed the reference card's typefaces: relying on PDF viewer substitutions
  // changes both the visual weight and the line breaks between devices.
  pdf.registerFontkit(fontkit);
  const [sans, bold, serif] = await Promise.all(
    ["DejaVuSans", "DejaVuSans-Bold", "DejaVuSerif-Bold"].map(async (name) =>
      pdf.embedFont(await loadFont(`/fonts/${name}.ttf`), { subset: true }),
    ),
  );
  const green = rgb(0.18, 0.39, 0.3),
    ink = rgb(0.14, 0.21, 0.17),
    muted = rgb(0.4, 0.45, 0.41),
    pale = rgb(0.93, 0.96, 0.93);
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const clean = (value: string) =>
    value
      .normalize("NFC")
      .replace(/[\u202f\u00a0]/g, " ")
      .replace(/[\u2011\u2013]/g, "-")
      .replace(/≈/g, "~")
      .split("")
      .map((c) => {
        if (c === "\n") return c;
        try {
          sans.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
  type Run = { value: string; font: PDFFont };
  // Keep measured runs, including bold quantities, through wrapping and drawing.
  // Whitespace is emitted once, so measurement matches the actual PDF text.
  const wrapRuns = (runs: Run[], width: number, size: number): Run[][] => {
    const lines: Run[][] = [[]];
    let used = 0;
    let pendingSpace = false;
    const append = (value: string, font: PDFFont) => {
      const line = lines[lines.length - 1];
      const previous = line[line.length - 1];
      if (previous?.font === font) previous.value += value;
      else line.push({ value, font });
      used += font.widthOfTextAtSize(value, size);
    };
    const next = () => {
      lines.push([]);
      used = 0;
      pendingSpace = false;
    };
    for (const run of runs) {
      // A mixed quantity such as 1 1/2 must stay together on the same line.
      const value = clean(run.value).replace(/(\d) (?=\d+\/\d+\b)/g, "$1\u00a0");
      for (const token of value.split(/(\n|[^\S\n\u00a0]+)/)) {
        if (token === "\n") {
          next();
          continue;
        }
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          pendingSpace = used > 0;
          continue;
        }
        const space = pendingSpace ? " " : "";
        if (
          used &&
          used + run.font.widthOfTextAtSize(space + token, size) > width
        )
          next();
        if (pendingSpace) append(" ", run.font);
        pendingSpace = false;
        for (const character of token) {
          if (
            used &&
            used + run.font.widthOfTextAtSize(character, size) > width
          )
            next();
          append(character, run.font);
        }
      }
    }
    return lines;
  };
  const wrap = (
    value: string,
    width: number,
    size: number,
    font: PDFFont = sans,
  ) =>
    wrapRuns([{ value, font }], width, size).map((line) =>
      line.map((r) => r.value).join(""),
    );
  const text = (
    page: PDFPage,
    value: string,
    x: number,
    y: number,
    size = 9,
    font: PDFFont = sans,
    color = ink,
  ) => page.drawText(clean(value), { x, y, size, font, color });
  const cache = new Map<string, Awaited<ReturnType<typeof pdf.embedJpg>>>();
  async function photo(
    page: PDFPage,
    path: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    if (!path) {
      page.drawRectangle({ x, y, width, height, color: pale });
      text(
        page,
        t("À cuisiner chez soi", "Cook at home"),
        x + 12,
        y + height / 2,
        10,
        serif,
        green,
      );
      return;
    }
    let image = cache.get(path);
    if (!image) {
      const bytes = await loadImage(path);
      image =
        bytes[0] === 137
          ? await pdf.embedPng(bytes)
          : await pdf.embedJpg(bytes);
      cache.set(path, image);
    }
    const scale = Math.max(width / image.width, height / image.height);
    page.pushOperators(
      pushGraphicsState(),
      rectangle(x, y, width, height),
      clip(),
      endPath(),
    );
    page.drawImage(image, {
      x: x + (width - image.width * scale) / 2,
      y: y + (height - image.height * scale) / 2,
      width: image.width * scale,
      height: image.height * scale,
    });
    page.pushOperators(popGraphicsState());
  }
  const drawRuns = (
    page: PDFPage,
    runs: Run[],
    x: number,
    y: number,
    size: number,
  ) => {
    for (const run of runs) {
      text(page, run.value, x, y, size, run.font);
      x += run.font.widthOfTextAtSize(run.value, size);
    }
  };
  for (const [recipeIndex, recipe] of recipes.entries()) {
    const pages: PDFPage[] = [];
    const title = locale === "fr" ? recipe.title : recipe.titleEn;
    const note = instructionText(
      (locale === "fr" ? recipe.note : recipe.noteEn || recipe.note) || "",
      units,
      locale,
    );
    const [preparation = "", ...notes] = note.split("\n");
    const newPage = () => {
      const page = pdf.addPage([612, 792]);
      pages.push(page);
      text(page, "Tred’meal", 30, 756, 14, serif, green);
      const label = t(
        `CUISINER À LA MAISON / ${recipe.servings} PORTIONS`,
        `COOK AT HOME / ${recipe.servings} SERVINGS`,
      );
      text(
        page,
        label,
        582 - bold.widthOfTextAtSize(clean(label), 8.4),
        756,
        8.4,
        bold,
        muted,
      );
      page.drawLine({
        start: { x: 30, y: 746 },
        end: { x: 582, y: 746 },
        thickness: 0.5,
        color: pale,
      });
      return page;
    };
    const page = newPage();
    const titleLines = wrap(title, 552, 22.5, serif);
    titleLines.forEach((line, i) =>
      text(page, line, 30, 710 - i * 27, 22.5, serif),
    );
    let y = 710 - (titleLines.length - 1) * 27 - 23;
    const subtitle = wrap(
      locale === "fr" ? recipe.subtitle : recipe.subtitleEn,
      552,
      10.7,
    );
    subtitle.forEach((line, i) =>
      text(page, line, 30, y - i * 14, 10.7, sans, muted),
    );
    y -= (subtitle.length - 1) * 14 + 14;
    await photo(page, recipe.image, 30, y - 162, 552, 162);
    const strip = y - 213;
    page.drawRectangle({
      x: 30,
      y: strip,
      width: 552,
      height: 27,
      color: pale,
    });
    text(
      page,
      `${recipe.servings} ${t("PORTIONS", "SERVINGS")}`,
      42,
      strip + 10,
      9.2,
      bold,
      green,
    );
    text(page, `${recipe.minutes} MIN`, 224, strip + 10, 9.2, bold, green);
    const temp = recipe.note?.match(/\{\{temp:([\d.]+)\}\}/);
    if (temp)
      text(
        page,
        measure("temp", Number(temp[1]), units, locale),
        398,
        strip + 10,
        9.2,
        bold,
        green,
      );

    const macros = recipeNutrition(recipe, ingredients);
    const mix = recipe.ingredients.filter((line) =>
      line.note?.startsWith("Mélange maison"),
    );
    const regular = recipe.ingredients.filter((line) => !mix.includes(line));
    type Line = {
      runs: Run[];
      size: number;
      height: number;
      color?: typeof ink;
    };
    const heading = (value: string): Line => ({
      runs: [{ value, font: bold }],
      size: 10.6,
      height: 24,
      color: green,
    });
    const ingredientLines = (
      lines: typeof regular,
      width: number,
      size: number,
    ): Line[] =>
      lines.flatMap((line) => {
        const ingredient = ingredients.find((i) => i.id === line.ingredientId);
        if (!ingredient) throw new Error("missing_ingredient");
        return wrapRuns(
          [
            {
              value: `${locale === "fr" ? ingredient.name : ingredient.nameEn} `,
              font: sans,
            },
            {
              value: `(${quantityLabel(line.quantity, units, locale)})`,
              font: bold,
            },
            {
              value: line.optional ? t(" - facultatif", " - optional") : "",
              font: sans,
            },
          ],
          width,
          size,
        ).map((runs, i, all) => ({
          runs,
          size,
          height: i === all.length - 1 ? 16 : 12,
        }));
      });
    const paragraph = (value: string, width: number, size = 8.5): Line[] =>
      wrap(value, width, size).map((value) => ({
        runs: [{ value, font: sans }],
        size,
        height: 12,
        color: muted,
      }));
    const space = (height: number): Line => ({ runs: [], size: 0, height });
    const left: Line[] = [
      heading(t("INGRÉDIENTS POUR LE REPAS", "INGREDIENTS FOR THE MEAL")),
      ...ingredientLines(regular, 268, 9.7),
    ];
    const right: Line[] = [];
    const columnTop = strip - 28;
    const mixLines = ingredientLines(mix, 244, 9.1);
    const mixAdvice = paragraph(
      t(
        "Dose pour ce repas : mélanger toutes les épices indiquées, sans diviser.",
        "For this recipe: combine all the listed spices without dividing.",
      ),
      244,
    );
    // The panel owns its padding and the nutrition section starts below its
    // actual bottom. The old independent line queues let these two blocks touch.
    const mixHeight = mix.length
      ? 27 +
        17 +
        mixLines.reduce((n, l) => n + l.height, 0) +
        12 +
        mixAdvice.length * 12 +
        12
      : 0;
    if (mix.length) {
      right.push(space(mixHeight + 20));
    }
    const nutrition =
      left.reduce((n, l) => n + l.height, 0) < mixHeight ? left : right;
    if (nutrition === left) nutrition.push(space(24));
    nutrition.push(
      heading(t("PAR PORTION · ESTIMATION", "PER SERVING · ESTIMATE")),
    );
    if (macros) {
      nutrition.push({
        runs: [{ value: `~ ${Math.round(macros.kcal)} kcal`, font: serif }],
        size: 16,
        height: 23,
        color: green,
      });
      nutrition.push(
        ...paragraph(
          `${t("Protéines", "Protein")} ${Math.round(macros.protein)} g · ${t("Glucides", "Carbs")} ${Math.round(macros.carbs)} g · ${t("Lipides", "Fat")} ${Math.round(macros.fat)} g`,
          268,
          8.5,
        ),
      );
    } else
      nutrition.push(
        ...paragraph(t("Valeurs à compléter.", "Values to be completed."), 268),
      );
    // A long future ingredient list continues cleanly instead of shrinking text.
    const queues = [left, right];
    let ingredientPage = page,
      top = columnTop;
    if (mix.length) {
      if (columnTop + 10 - mixHeight < 75)
        throw new Error("seasoning_too_long");
      const panelTop = columnTop + 10;
      page.drawSvgPath(
        `M 6 0 H 262 Q 268 0 268 6 V ${mixHeight - 6} Q 268 ${mixHeight} 262 ${mixHeight} H 6 Q 0 ${mixHeight} 0 ${mixHeight - 6} V 6 Q 0 0 6 0 Z`,
        { x: 314, y: panelTop, color: pale },
      );
      page.drawSvgPath("M 6 0 H 262 Q 268 0 268 6 V 27 H 0 V 6 Q 0 0 6 0 Z", {
        x: 314,
        y: panelTop,
        color: green,
      });
      text(
        page,
        t("MÉLANGE D’ÉPICES MAISON", "HOMEMADE SEASONING"),
        326,
        panelTop - 17,
        9.2,
        bold,
        rgb(1, 1, 1),
      );
      let lineY = panelTop - 44;
      for (const line of mixLines) {
        drawRuns(page, line.runs, 326, lineY, line.size);
        lineY -= line.height;
      }
      page.drawLine({
        start: { x: 326, y: lineY + 2 },
        end: { x: 570, y: lineY + 2 },
        thickness: 0.5,
        color: rgb(0.82, 0.87, 0.82),
      });
      lineY -= 12;
      for (const line of mixAdvice) {
        text(page, line.runs[0].value, 326, lineY, line.size, sans, ink);
        lineY -= line.height;
      }
    }
    while (queues.some((q) => q.length)) {
      for (let col = 0; col < 2; col++) {
        let lineY = top;
        while (queues[col].length) {
          const line = queues[col][0];
          if (line.runs.length && lineY - line.size * 0.25 < 66) break;
          queues[col].shift();
          const x = col === 0 ? 30 : 314;
          if (line.color && line.runs.length === 1)
            text(
              ingredientPage,
              line.runs[0].value,
              x,
              lineY,
              line.size,
              line.runs[0].font,
              line.color,
            );
          else drawRuns(ingredientPage, line.runs, x, lineY, line.size);
          lineY -= line.height;
        }
      }
      if (queues.some((q) => q.length)) {
        ingredientPage = newPage();
        text(
          ingredientPage,
          t("Les ingrédients · suite", "Ingredients · continued"),
          30,
          710,
          22.5,
          serif,
        );
        top = 674;
      }
    }
    let step = 0;
    while (step < recipe.steps.length) {
      const p = newPage();
      text(p, t("À vous de cuisiner", "Let’s get cooking"), 30, 712, 21, serif);
      const intro = wrap(preparation, 552, 9.1);
      intro.forEach((line, i) =>
        text(p, line, 30, 695 - i * 12, 9.1, sans, muted),
      );
      const firstTop = 668 - Math.max(0, intro.length - 1) * 12;
      let top = firstTop;
      let lastBottom = top;
      while (step < recipe.steps.length) {
        const pair = recipe.steps.slice(step, step + 2).map((s) => ({
          step: s,
          title: wrap(locale === "fr" ? s.title : s.titleEn, 242, 10.5, bold),
          body: wrap(
            instructionText(locale === "fr" ? s.text : s.textEn, units, locale),
            268,
            9.1,
          ),
        }));
        const contentHeight = Math.max(
          ...pair.map(
            (s) =>
              94 + (s.title.length - 1) * 14 + (s.body.length - 1) * 12 + 3,
          ),
        );
        if (top - contentHeight < 70) break;
        for (const [col, entry] of pair.entries()) {
          const x = col === 0 ? 30 : 314;
          await photo(p, entry.step.image, x, top - 58, 268, 58);
          p.drawCircle({ x: x + 10, y: top - 72, size: 10, color: green });
          const number = String(step + col + 1);
          text(
            p,
            number,
            x + 10 - bold.widthOfTextAtSize(number, 9) / 2,
            top - 75,
            9,
            bold,
            rgb(1, 1, 1),
          );
          entry.title.forEach((line, i) =>
            text(p, line, x + 26, top - 75 - i * 14, 10.5, bold),
          );
          entry.body.forEach((line, i) =>
            text(
              p,
              line,
              x,
              top - 94 - (entry.title.length - 1) * 14 - i * 12,
              9.1,
            ),
          );
        }
        lastBottom = top - contentHeight;
        top -= Math.max(177, contentHeight + 24);
        step += pair.length;
      }
      if (top === firstTop) throw new Error("step_too_long");
      if (step === recipe.steps.length && notes.length) {
        const lines = wrap(notes.join("\n"), 552, 8.2);
        let notePage = p;
        let noteTop = Math.min(138, lastBottom - 24);
        if (noteTop - 22 - lines.length * 11.5 < 66) {
          notePage = newPage();
          noteTop = 710;
        }
        text(
          notePage,
          t("MES REPÈRES EN CUISINE", "MY COOKING NOTES"),
          30,
          noteTop,
          8.4,
          bold,
          green,
        );
        lines.forEach((line, i) =>
          text(notePage, line, 30, noteTop - 19 - i * 11.5, 8.2, sans, muted),
        );
      }
    }
    // Each recipe starts on the front of a sheet when the book is printed duplex.
    if (pages.length % 2) {
      const notes = newPage();
      text(
        notes,
        t("Mes petits repères", "My cooking notes"),
        30,
        718,
        23,
        serif,
      );
      for (let line = 670; line > 100; line -= 30)
        notes.drawLine({
          start: { x: 30, y: line },
          end: { x: 582, y: line },
          color: pale,
          thickness: 0.5,
        });
    }
    pages.forEach((p, i) => {
      p.drawLine({
        start: { x: 30, y: 43 },
        end: { x: 582, y: 43 },
        color: pale,
        thickness: 0.5,
      });
      text(
        p,
        t("Tred’meal · Mon livre de recettes", "Tred’meal · My recipe book"),
        30,
        29,
        7,
        sans,
        muted,
      );
      const numbering = `${String(recipeIndex + 1).padStart(2, "0")} / ${i + 1} ${t("sur", "of")} ${pages.length}`;
      text(
        p,
        numbering,
        582 - bold.widthOfTextAtSize(numbering, 7),
        29,
        7,
        bold,
        green,
      );
      text(
        p,
        t(
          "Lettre · Recto verso, bord long · Taille réelle / 100 %",
          "Letter · Two-sided, long edge · Actual size / 100%",
        ),
        30,
        16,
        7,
        sans,
        muted,
      );
    });
  }
  pdf.setTitle(
    recipes.length === 1
      ? locale === "fr"
        ? recipes[0].title
        : recipes[0].titleEn
      : t("Mon livre de recettes", "My recipe book"),
  );
  pdf.setCreator("Tred’meal");
  return pdf.save();
}

export async function exportRecipes(
  recipes: Recipe[],
  ingredients: Ingredient[],
  units: UnitPreferences,
  locale: Locale,
) {
  const bytes = await buildRecipePdf(
    recipes,
    ingredients,
    units,
    locale,
    async (path) => {
      if (!/^\/api\/recipe-images\/[a-z0-9-]{1,100}$/.test(path))
        throw new Error("invalid_image");
      const response = await fetch(path, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("image_unavailable");
      const blob = await response.blob();
      if (["image/jpeg", "image/png"].includes(blob.type))
        return new Uint8Array(await blob.arrayBuffer());
      if (blob.type !== "image/webp") throw new Error("invalid_image");
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("image_unavailable");
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const png = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("image_unavailable"))),
          "image/png",
        ),
      );
      return new Uint8Array(await png.arrayBuffer());
    },
  );
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `tredmeal-${recipes.length === 1 ? recipes[0].id : "recettes"}-${locale}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
