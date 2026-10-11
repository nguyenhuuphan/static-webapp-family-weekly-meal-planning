import { en, type Messages } from "./locales/en";
import { vi } from "./locales/vi";
import viRecipes from "./locales/vi.recipes.json";

export const LANGUAGE_STORAGE_KEY = "weekday-table:language";
export const DEFAULT_LANGUAGE = "en";

// Register a language here; components never branch on a language code.
export const languages = {
  en: { name: "English", locale: "en-GB", messages: en, recipes: {} },
  vi: { name: "Tiếng Việt", locale: "vi-VN", messages: vi, recipes: viRecipes },
} satisfies Record<
  string,
  {
    name: string;
    locale: string;
    messages: Messages;
    recipes: Record<string, string>;
  }
>;

export type Language = keyof typeof languages;
export const supportedLanguages = Object.keys(languages) as Language[];

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && Object.hasOwn(languages, value);
}

export function resolveLanguage(preferences: readonly string[]): Language {
  for (const value of preferences) {
    const base = value.toLowerCase().split(/[-_]/)[0];
    if (isLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}
