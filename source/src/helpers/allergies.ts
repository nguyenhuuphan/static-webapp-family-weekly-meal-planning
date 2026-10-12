import type { Ingredient, State } from "src/types";
export const normalizeAvoidance = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const hints: Record<string, string[]> = {
  soy: ["soy", "soya", "tofu", "dau nanh", "dau hu"],
  wheat: ["wheat", "flour", "soy sauce", "lua mi", "bot mi", "nuoc tuong"],
  egg: ["egg", "trung"],
  milk: ["milk", "butter", "cheese", "sua", "bo sua", "pho mai"],
  peanut: ["peanut", "dau phong", "lac"],
  sesame: ["sesame", "me", "vung"],
  fish: ["fish", "salmon", "tuna", "catfish", "ca", "nuoc mam"],
  shellfish: ["shrimp", "prawn", "crab", "oyster", "tom", "cua", "hau"],
  nuts: ["almond", "cashew", "walnut", "hat cay", "hanh nhan", "hat dieu"],
};
const contains = (value: string, term: string) =>
  term.length > 0 && ` ${value} `.includes(` ${term} `);
export function ingredientWarnings(
  ingredients: Ingredient[],
  profiles: NonNullable<State["avoidanceProfiles"]>,
  translate: (s: string) => string = (s) => s,
) {
  return profiles.flatMap((person) =>
    ingredients.flatMap((ingredient) => {
      const names = [ingredient.name, translate(ingredient.name)].map(
        normalizeAvoidance,
      );
      const tags = (ingredient.allergenTags || []).map(normalizeAvoidance);
      const matched = person.avoid.filter((avoid) => {
        const term = normalizeAvoidance(avoid);
        const group = Object.entries(hints).find(
          ([key, aliases]) => term === key || aliases.includes(term),
        );
        return (
          names.some((name) => contains(name, term)) ||
          tags.includes(term) ||
          (!!group &&
            (tags.some((tag) => tag === group[0] || group[1].includes(tag)) ||
              names.some((name) =>
                group[1].some((alias) => contains(name, alias)),
              )))
        );
      });
      return matched.length
        ? [{ person: person.name, ingredient: ingredient.name, terms: matched }]
        : [];
    }),
  );
}
