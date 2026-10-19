import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { MenuPlan } from "./types";
import { tr, type Locale } from "./locale";

export async function exportMenu(
  plan: MenuPlan,
  locale: Locale,
  demo: boolean,
) {
  const pdf = await PDFDocument.create();
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const green = rgb(0.12, 0.26, 0.21);
  const muted = rgb(0.4, 0.46, 0.42);
  const clean = (s: string) =>
    s
      .normalize("NFC")
      .replace(
        /[^\x20-\x7E\u00A0-\u00FF\u0152\u0153\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g,
        "",
      );
  const wrap = (s: string, max: number) => {
    const lines = [""];
    for (const word of clean(s).split(/\s+/)) {
      const i = lines.length - 1;
      if (sans.widthOfTextAtSize(`${lines[i]} ${word}`, 12) > max && lines[i])
        lines.push(word);
      else lines[i] += `${lines[i] ? " " : ""}${word}`;
    }
    return lines;
  };
  for (let sheet = 0; sheet < 3; sheet++) {
    const page = pdf.addPage([612, 792]); // US Letter, matching the existing recipe sheets.
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 612,
      height: 792,
      color: rgb(0.98, 0.97, 0.94),
    });
    page.drawText("i am able.", {
      x: 44,
      y: 734,
      size: 28,
      font: serif,
      color: green,
    });
    page.drawText(tr(locale, "UN JOUR À LA FOIS", "ONE DAY AT A TIME"), {
      x: 392,
      y: 741,
      size: 9,
      font: sans,
      color: muted,
    });
    page.drawLine({
      start: { x: 44, y: 710 },
      end: { x: 568, y: 710 },
      color: green,
      thickness: 0.7,
    });
    const heading = clean(locale === "fr" ? plan.title : plan.titleEn);
    page.drawText(heading, {
      x: 44,
      y: 673,
      size: Math.min(
        23,
        490 / Math.max(1, serif.widthOfTextAtSize(heading, 1)),
      ),
      font: serif,
      color: green,
    });
    page.drawText(
      `${plan.startDate} · ${tr(locale, "Menu de six jours", "Six-day menu")}`,
      { x: 44, y: 649, size: 11, font: sans, color: muted },
    );
    plan.days.slice(sheet * 2, sheet * 2 + 2).forEach((day, index) => {
      const y = 592 - index * 226;
      const date = new Date(`${day.date}T12:00:00Z`).toLocaleDateString(
        locale === "fr" ? "fr-CA" : "en-CA",
        { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" },
      );
      page.drawText(clean(date), {
        x: 44,
        y,
        size: 19,
        font: serif,
        color: green,
      });
      [day.lunch, day.dinner].forEach((meal, n) => {
        const top = y - 35 - n * 78;
        page.drawText(
          n === 0
            ? tr(locale, "DÎNER", "LUNCH")
            : tr(locale, "SOUPER", "DINNER"),
          { x: 44, y: top, size: 9, font: sans, color: muted },
        );
        wrap(
          meal
            ? locale === "fr"
              ? meal.title
              : meal.titleEn
            : tr(locale, "À choisir", "To be chosen"),
          410,
        )
          .slice(0, 3)
          .forEach((line, j) =>
            page.drawText(line, {
              x: 145,
              y: top - j * 15,
              size: 12,
              font: sans,
              color: green,
            }),
          );
        if (meal)
          page.drawText(`${meal.portions} portions · ${meal.minutes} min`, {
            x: 145,
            y: top - 49,
            size: 10,
            font: sans,
            color: muted,
          });
      });
    });
    page.drawText(
      tr(
        locale,
        "Le septième jour est libre. Aucune répétition de repas imposée.",
        "The seventh day is open. No automatically repeated meals.",
      ),
      { x: 44, y: 89, size: 10, font: sans, color: muted },
    );
    page.drawText(
      demo
        ? tr(
            locale,
            "MAQUETTE · Données et durées illustratives",
            "DEMO · Illustrative data and timings",
          )
        : tr(locale, "Document personnel", "Personal document"),
      { x: 44, y: 58, size: 9, font: sans, color: muted },
    );
    page.drawText(`${sheet + 1} / 3`, {
      x: 540,
      y: 58,
      size: 10,
      font: sans,
      color: muted,
    });
  }
  const bytes = await pdf.save();
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `iamable-menu-${plan.startDate}-${locale}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
