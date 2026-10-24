import { automaticContent } from "./automatic";
import { languages, type Language } from "./catalog";
import { en, type MessageKey } from "./locales/en";
import { translationEngine } from "./engine";

export type Values = Record<string, string | number>;
export type Translator = (key: MessageKey, values?: Values) => string;
const sourceKeys = new Map<string, MessageKey>(
  Object.entries(en).map(([key, value]) => [value, key as MessageKey]),
);

export function createTranslator(language: Language, automatic = false) {
  const config = languages[language];
  const engine = translationEngine(language);
  const recipes: Record<string, string> = config.recipes;
  const numbers = new Intl.NumberFormat(config.locale, {
    maximumFractionDigits: 2,
  });
  const number = (value: number) => numbers.format(value);

  const t: Translator = (key, values = {}) =>
    engine.t(key, { ...values, defaultValue: en[key] });

  // Exact-source matching prevents an edited/imported instruction from receiving
  // an out-of-date translation. Unknown user content is displayed verbatim.
  const content = (value: string): string => {
    if (Object.hasOwn(recipes, value)) return recipes[value];
    const key = sourceKeys.get(value);
    return key ? t(key) : automatic ? automaticContent(value, language) : value;
  };

  const unit = (value: string) => {
    const keys: Record<string, MessageKey> = {
      each: "unitEach",
      tsp: "unitTsp",
      tbsp: "unitTbsp",
    };
    return keys[value] ? t(keys[value]) : value;
  };

  const instruction = (value: string, factor: number) =>
    content(value).replace(
      /\[([\d.]+) (g|ml|each|tsp|tbsp)\]/g,
      (_, quantity: string, measure: string) =>
        `${number(Number(quantity) * factor)} ${unit(measure)}`,
    );

  const date = (
    start: string,
    day = "Monday",
    options?: Intl.DateTimeFormatOptions,
  ) => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const value = new Date(`${start}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + Math.max(0, days.indexOf(day)));
    return new Intl.DateTimeFormat(config.locale, {
      day: "numeric",
      month: "short",
      ...options,
      timeZone: "UTC",
    }).format(value);
  };

  const error = (message: string): string =>
    message
      .split("\n")
      .map((line) => {
        const direct = content(line);
        if (direct !== line) return direct;
        let match = /^(.*): (main|side|storage|thaw) is required\.$/.exec(line);
        if (match) {
          const fields = {
            main: "mainField",
            side: "sideField",
            storage: "storageField",
            thaw: "thawField",
          } as const;
          return t("requiredFieldError", {
            id: match[1],
            field: t(fields[match[2] as keyof typeof fields]),
          });
        }
        for (const [pattern, key] of [
          [
            /^(.*): cooking estimate must be 1–240 minutes\.$/,
            "cookingTimeError",
          ],
          [/^(.*): provide 1–100 ingredients\.$/, "ingredientsError"],
          [/^(.*): invalid ingredient\.$/, "ingredientError"],
        ] as const) {
          match = pattern.exec(line);
          if (match) return t(key, { id: match[1] });
        }
        match =
          /^(.*): (prep|steps) needs 1–100 steps with text and valid minutes\.$/.exec(
            line,
          );
        return match
          ? t("stepsError", {
              id: match[1],
              kind: t(match[2] === "prep" ? "stepKindPrep" : "stepKindCook"),
            })
          : line;
      })
      .join("\n");

  const source = (key: MessageKey) => en[key];
  return {
    t,
    source,
    content,
    number,
    date,
    unit,
    instruction,
    error,
    locale: config.locale,
  };
}
