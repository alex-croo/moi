export type Locale = "fr" | "en";
export function localeOf(value: string): Locale {
  return value === "en" ? "en" : "fr";
}
export function tr(locale: Locale, fr: string, en: string) {
  return locale === "fr" ? fr : en;
}
