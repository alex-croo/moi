import {
  PDFDocument,
  StandardFonts,
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
) {
  if (!recipes.length) throw new Error("empty_selection");
  const pdf = await PDFDocument.create();
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const green = rgb(0.16, 0.34, 0.26),
    ink = rgb(0.14, 0.21, 0.17),
    muted = rgb(0.4, 0.45, 0.41),
    pale = rgb(0.93, 0.96, 0.92);
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
  const wrap = (
    value: string,
    width: number,
    size: number,
    font: PDFFont = sans,
  ) => {
    const lines: string[] = [];
    for (const paragraph of clean(value).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > width) {
          lines.push(line);
          line = "";
        }
        // Hard-break a very long token so future recipe content cannot escape the column.
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > width && line) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
        line += " ";
      }
      lines.push(line.trimEnd());
    }
    return lines;
  };
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
  for (const [recipeIndex, recipe] of recipes.entries()) {
    const pages: PDFPage[] = [];
    const title = locale === "fr" ? recipe.title : recipe.titleEn;
    const newPage = () => {
      const page = pdf.addPage([612, 792]);
      pages.push(page);
      text(page, "i am able.", 30, 760, 14, serif, green);
      const label = t(
        `CUISINER À LA MAISON / ${recipe.servings} PORTIONS`,
        `COOK AT HOME / ${recipe.servings} SERVINGS`,
      );
      text(
        page,
        label,
        582 - bold.widthOfTextAtSize(clean(label), 8),
        762,
        8,
        bold,
        muted,
      );
      page.drawLine({
        start: { x: 30, y: 747 },
        end: { x: 582, y: 747 },
        thickness: 0.5,
        color: pale,
      });
      return page;
    };
    const page = newPage();
    const titleLines = wrap(title, 552, 23, serif);
    titleLines.forEach((line, i) =>
      text(page, line, 30, 722 - i * 26, 23, serif),
    );
    let y = 722 - titleLines.length * 26;
    const subtitle = wrap(
      locale === "fr" ? recipe.subtitle : recipe.subtitleEn,
      552,
      10,
    );
    subtitle.forEach((line, i) =>
      text(page, line, 30, y - i * 13, 10, sans, muted),
    );
    y -= subtitle.length * 13 + 12;
    await photo(page, recipe.image, 30, y - 162, 552, 162);
    const strip = y - 202;
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
      9,
      bold,
      green,
    );
    text(page, `${recipe.minutes} MIN`, 235, strip + 10, 9, bold, green);
    const temp = recipe.note?.match(/\{\{temp:([\d.]+)\}\}/);
    if (temp)
      text(
        page,
        measure("temp", Number(temp[1]), units, locale),
        420,
        strip + 10,
        9,
        bold,
        green,
      );
    const macros = recipeNutrition(recipe, ingredients);
    const mix = recipe.ingredients.filter((line) =>
      line.note?.startsWith("Mélange maison"),
    );
    const regular = recipe.ingredients.filter((line) => !mix.includes(line));
    type Line = { value: string; bold?: boolean; gap?: number };
    const ingredientLines = (lines: typeof regular): Line[] =>
      lines.flatMap((line) => {
        const ingredient = ingredients.find((i) => i.id === line.ingredientId);
        if (!ingredient) throw new Error("missing_ingredient");
        const name = locale === "fr" ? ingredient.name : ingredient.nameEn;
        const label = `${name} (${quantityLabel(line.quantity, units, locale)})${line.optional ? t(" - facultatif", " - optional") : ""}`;
        return wrap(label, 255, 9).map((value, i, all) => ({
          value,
          gap: i === all.length - 1 ? 5 : 0,
        }));
      });
    const left: Line[] = [
      {
        value: t("INGRÉDIENTS POUR LE REPAS", "INGREDIENTS FOR THE MEAL"),
        bold: true,
        gap: 10,
      },
      ...ingredientLines(regular),
    ];
    const right: Line[] = [];
    if (mix.length)
      right.push(
        {
          value: t("MÉLANGE D’ÉPICES MAISON", "HOMEMADE SEASONING"),
          bold: true,
          gap: 10,
        },
        ...ingredientLines(mix),
        ...wrap(
          t(
            "Dose pour ce repas : mélanger toutes les épices indiquées, sans diviser.",
            "For this recipe: combine all the listed spices without dividing.",
          ),
          255,
          9,
        ).map((value) => ({ value })),
        { value: "", gap: 10 },
      );
    const linesHeight = (lines: Line[]) =>
      lines.reduce((height, line) => height + 12 + (line.gap || 0), 0);
    const spiceHeight = linesHeight(right);
    right.push({
      value: t("PAR PORTION · ESTIMATION", "PER SERVING · ESTIMATE"),
      bold: true,
      gap: 9,
    });
    if (macros)
      right.push(
        { value: `~ ${Math.round(macros.kcal)} kcal`, bold: true, gap: 4 },
        ...wrap(
          `${t("Protéines", "Protein")} ${Math.round(macros.protein)} g · ${t("Glucides", "Carbs")} ${Math.round(macros.carbs)} g · ${t("Lipides", "Fat")} ${Math.round(macros.fat)} g`,
          255,
          9,
        ).map((value) => ({ value })),
        { value: "", gap: 6 },
      );
    else
      right.push({
        value: t("Valeurs à compléter.", "Values to be completed."),
        gap: 10,
      });
    if (recipe.note)
      (linesHeight(left) < linesHeight(right) ? left : right).push(
        { value: "", gap: 4 },
        { value: t("À SAVOIR", "GOOD TO KNOW"), bold: true, gap: 8 },
        ...wrap(
          instructionText(
            locale === "fr" ? recipe.note : recipe.noteEn || recipe.note,
            units,
            locale,
          ),
          255,
          9,
        ).map((value) => ({ value })),
      );
    const queues = [left, right];
    let ingredientPage = page,
      top = strip - 29;
    if (spiceHeight && top - spiceHeight >= 75)
      page.drawRectangle({
        x: 305,
        y: top - spiceHeight + 8,
        width: 277,
        height: spiceHeight + 10,
        color: pale,
      });
    while (queues.some((q) => q.length)) {
      for (let col = 0; col < 2; col++) {
        let lineY = top;
        const x = col === 0 ? 30 : 315;
        while (queues[col].length && lineY >= 75) {
          const line = queues[col].shift()!;
          text(
            ingredientPage,
            line.value,
            x,
            lineY,
            9,
            line.bold ? bold : sans,
            line.bold ? green : ink,
          );
          lineY -= 12 + (line.gap || 0);
        }
      }
      if (queues.some((q) => q.length)) {
        ingredientPage = newPage();
        text(
          ingredientPage,
          t("Les ingrédients · suite", "Ingredients · continued"),
          30,
          718,
          23,
          serif,
        );
        top = 680;
      }
    }
    // Steps use the reference card's two-column, three-row layout. Long steps get
    // taller rows and extra pages rather than being clipped or reduced to tiny type.
    let step = 0;
    while (step < recipe.steps.length) {
      const p = newPage();
      text(p, t("À vous de cuisiner", "Let’s get cooking"), 30, 718, 25, serif);
      const intro = wrap(
        instructionText(
          (
            (locale === "fr" ? recipe.note : recipe.noteEn || recipe.note) || ""
          ).split("\n")[0],
          units,
          locale,
        ),
        552,
        9,
      );
      intro.forEach((line, i) =>
        text(p, line, 30, 699 - i * 12, 9, sans, muted),
      );
      let top = 699 - intro.length * 12 - 20;
      while (step < recipe.steps.length) {
        const pair = recipe.steps.slice(step, step + 2).map((s) => ({
          step: s,
          title: wrap(locale === "fr" ? s.title : s.titleEn, 238, 10, bold),
          body: wrap(
            instructionText(locale === "fr" ? s.text : s.textEn, units, locale),
            267,
            9.2,
          ),
        }));
        const height = Math.max(
          170,
          ...pair.map(
            (s) => 68 + s.title.length * 13 + s.body.length * 12 + 20,
          ),
        );
        if (top - height < 100) break;
        for (const [col, entry] of pair.entries()) {
          const x = col === 0 ? 30 : 315;
          await photo(p, entry.step.image, x, top - 58, 267, 58);
          p.drawCircle({ x: x + 9, y: top - 73, size: 9, color: green });
          text(
            p,
            String(step + col + 1),
            x + 6,
            top - 76,
            9,
            bold,
            rgb(1, 1, 1),
          );
          entry.title.forEach((line, i) =>
            text(p, line, x + 26, top - 76 - i * 13, 10, bold),
          );
          entry.body.forEach((line, i) =>
            text(p, line, x, top - 80 - entry.title.length * 13 - i * 12, 9.2),
          );
        }
        top -= height;
        step += pair.length;
      }
      if (top === 699 - intro.length * 12 - 20)
        throw new Error("step_too_long");
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
        t("i am able. · Mon livre de recettes", "i am able. · My recipe book"),
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
  pdf.setCreator("I am able");
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
  a.download = `iamable-${recipes.length === 1 ? recipes[0].id : "recettes"}-${locale}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
