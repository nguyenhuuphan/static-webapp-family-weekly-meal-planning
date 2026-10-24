import { createInstance, type i18n } from "i18next";
import { languages, type Language } from "./catalog";

const engines = new Map<Language, i18n>();

// Bundled catalogues initialize synchronously; no runtime translation requests.
export function translationEngine(language: Language): i18n {
  const existing = engines.get(language);
  if (existing) return existing;
  const engine = createInstance();
  void engine.init({
    lng: language,
    fallbackLng: "en",
    supportedLngs: Object.keys(languages),
    initAsync: false,
    resources: Object.fromEntries(
      Object.entries(languages).map(([code, config]) => [
        code,
        {
          translation: Object.fromEntries(
            Object.entries(config.messages).flatMap(([key, value]) => [
              [key, value.replace(/\{(\w+)\}/g, "{$1, localized}")],
              // Existing catalogues use an unsuffixed singular message.
              ...(key.endsWith("_other")
                ? [
                    [
                      key.slice(0, -6) + "_one",
                      config.messages[
                        key.slice(0, -6) as keyof typeof config.messages
                      ].replace(/\{(\w+)\}/g, "{$1, localized}"),
                    ],
                  ]
                : []),
            ]),
          ),
        },
      ]),
    ),
    interpolation: {
      prefix: "{",
      suffix: "}",
      escapeValue: false, // React escapes text when rendering.
    },
  });
  engine.services.formatter?.add("localized", (value: unknown) =>
    typeof value === "number"
      ? new Intl.NumberFormat(languages[language].locale, {
          maximumFractionDigits: 2,
        }).format(value)
      : String(value),
  );
  engines.set(language, engine);
  return engine;
}
