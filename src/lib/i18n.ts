import en from "@/i18n/en.json";
import hi from "@/i18n/hi.json";
import ta from "@/i18n/ta.json";
import te from "@/i18n/te.json";

type Translations = typeof en;

const translations: Record<string, Translations> = { en, hi, ta, te };

export const SUPPORTED_LOCALES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]["code"];

export function t(key: string, locale: string = "en"): string {
  const keys = key.split(".");
  let value: unknown = translations[locale] ?? translations.en;

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }

  return typeof value === "string" ? value : key;
}

export function getLocale(): string {
  return "en";
}
