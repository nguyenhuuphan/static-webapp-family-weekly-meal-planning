import type { Ingredient, Meal, Step } from "src/types";
export type PreparationCategory =
  "Produce" | "Protein" | "Pantry" | "Other" | "Cooking";
export type PreparationPart = {
  category: PreparationCategory;
  text: string;
  vi?: string;
};
export const preparationText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const includes = (text: string, phrase: string) =>
  !!phrase && ` ${text} `.includes(` ${phrase} `);
export function isRiceIngredient(ingredient: Ingredient) {
  const name = preparationText(ingredient.name);
  return (
    /\b(rice|gao|com)\b/.test(name) &&
    !/\b(paper|vinegar|noodles?|flour|wine|banh|bun|pho|bot|giam)\b/.test(name)
  );
}
export function preparationCategory(
  ingredient: Ingredient,
): PreparationCategory {
  const category = preparationText(ingredient.category);
  const name = preparationText(ingredient.name);
  if (isRiceIngredient(ingredient)) return "Cooking";
  if (
    /\b(sauce|oil|salt|sugar|pepper|nuoc mam|nuoc tuong|dau an|muoi|duong|tieu)\b/.test(
      name,
    ) &&
    !/\bbell pepper\b/.test(name)
  )
    return "Pantry";
  if (
    /^(produce|vegetables?|vegetables herbs|fruits?|rau cu|rau cu qua|rau cu rau thom|rau|herbs)$/.test(
      category,
    )
  )
    return "Produce";
  if (
    /\b(protein|meat|seafood|fish|poultry|eggs?|thit|ca hai san|hai san|trung)\b/.test(
      category,
    )
  )
    return "Protein";
  if (/\b(pantry|seasonings?|spices?|gia vi|nuoc xot)\b/.test(category))
    return "Pantry";
  return "Other";
}
const aliases = [
  ["chicken", "chicken thigh", "thit ga", "ga"],
  ["pork", "thit heo", "thit lon"],
  ["beef", "thit bo"],
  ["salmon", "ca hoi"],
  ["basa", "ca basa"],
  ["tilapia", "ca ro phi"],
  ["shrimp", "prawn", "tom"],
  ["squid", "muc"],
  ["broccoli", "bong cai xanh", "sup lo xanh"],
  ["cabbage", "bap cai", "cai bap"],
  ["ginger", "gung"],
  ["spring onion", "scallion", "hanh la"],
  ["onion", "hanh tay"],
  ["garlic", "toi"],
  ["tomato", "ca chua"],
  ["green beans", "green bean", "dau que", "dau co ve"],
  ["chayote", "su su"],
  ["pumpkin", "bi do"],
  ["water spinach", "rau muong"],
  ["lemongrass", "sa"],
  ["carrot", "ca rot"],
  ["mushroom", "nam"],
];
function ingredientMatches(
  text: string,
  ingredient: Ingredient,
  vi: Record<string, string>,
) {
  const names = [ingredient.name, vi[ingredient.name] || ""]
    .map(preparationText)
    .filter(Boolean);
  const candidates = new Set(names);
  const head = preparationText(ingredient.name.split(",")[0]);
  candidates.add(head);
  if (isRiceIngredient(ingredient))
    ["rice", "gao", "com"].forEach((alias) => candidates.add(alias));
  for (const family of aliases)
    if (names.some((name) => family.some((alias) => includes(name, alias))))
      family.forEach((alias) => candidates.add(alias));
  let source = preparationText(text);
  if (preparationCategory(ingredient) === "Protein")
    source = source
      .replace(/\b(fish sauce|nuoc mam|chicken stock|beef stock)\b/g, "")
      .replace(
        /\b(?:for|cho) (?:the |thit )?(?:beef|chicken|pork|fish|shrimp|meat|bo|ga|heo|ca|tom)\b/g,
        "",
      );
  return [...candidates].some(
    (alias) => includes(source, alias) || includes(source, alias + "s"),
  );
}
// Split only explicit independent actions. Keep marinades and inseparable mixed actions intact.
function clauses(text: string) {
  return text
    .split(
      /(?<=[.!?])\s+|,\s+(?=(?:and\s+|và\s+)?(?:slice|trim|peel|dice|mince|chop|cut|wash|rinse|pat|season|label|thái|cắt|băm|gọt|rửa|ướp|chia|tước|ghi)\b)|;\s*/iu,
    )
    .map((s) => s.trim())
    .filter(Boolean);
}
function categorizedClauses(
  meal: Meal,
  text: string,
  vi: Record<string, string>,
) {
  const parts: { category: PreparationCategory; text: string }[] = [];
  for (const clause of clauses(text)) {
    const found = new Set(
      meal.ingredients
        .filter((i) => ingredientMatches(clause, i, vi))
        .map(preparationCategory),
    );
    const plain = preparationText(clause);
    let category: PreparationCategory;
    if (
      /^(mix with|season with|rub with|uop voi|tron voi)\b/.test(plain) &&
      parts.at(-1)?.category === "Protein"
    )
      category = "Protein";
    else if (
      found.has("Cooking") &&
      !found.has("Produce") &&
      !found.has("Protein")
    )
      category = "Cooking";
    else if (
      found.has("Protein") &&
      (!found.has("Produce") ||
        /^(mix|marinate|season|rub|coat|uop|tron|tam)\b/.test(plain))
    )
      category = "Protein";
    else if (found.has("Produce") && !found.has("Protein"))
      category = "Produce";
    else if (found.has("Produce") && found.has("Protein")) category = "Other";
    else if (found.has("Pantry") || !found.size)
      category =
        parts.at(-1)?.category || (found.has("Pantry") ? "Pantry" : "Other");
    else category = "Other";
    // Labels and storage directions follow their preceding action, not a meal-wide label's ingredient name.
    if (/^(label|ghi nhan|dan nhan)\b/.test(plain)) {
      if (
        found.has("Protein") ||
        /\bfish\b/i.test(clause) ||
        /(?:^|[^\p{L}])cá(?:$|[^\p{L}])/iu.test(clause)
      )
        category = "Protein";
      else if (found.size === 1) category = [...found][0];
      else if (parts.length) category = parts.at(-1)!.category;
    } else if (
      /^(refrigerate|store|bao quan|de vao)\b/.test(plain) &&
      parts.length
    )
      category = parts.at(-1)!.category;
    parts.push({ category, text: clause });
  }
  return parts;
}
export function preparationParts(
  meal: Meal,
  task: Step,
  vi: Record<string, string> = {},
): PreparationPart[] {
  const english = categorizedClauses(meal, task.text, vi);
  const vietnamese = vi[task.text]
    ? categorizedClauses(meal, vi[task.text], vi)
    : [];
  // Explicit links are authoritative only when prose cannot identify a category.
  if (
    english.every((p) => p.category === "Other") &&
    task.ingredients?.length
  ) {
    const categories = new Set(
      task.ingredients
        .map((ref) => meal.ingredients.find((i) => i.id === ref.ingredientId))
        .filter((i): i is Ingredient => !!i)
        .map(preparationCategory),
    );
    if (categories.size === 1)
      english.forEach((p) => (p.category = [...categories][0]));
  }
  const categories = [...new Set(english.map((p) => p.category))];
  return categories.map((category) => {
    const text = english
      .filter((p) => p.category === category)
      .map(
        (p) =>
          p.text.replace(/^./u, (c) => c.toUpperCase()) +
          (/[.!?]$/.test(p.text) ? "" : "."),
      )
      .join(" ");
    const translated = vietnamese
      .filter((p) => p.category === category)
      .map(
        (p) =>
          p.text.replace(/^./u, (c) => c.toUpperCase()) +
          (/[.!?]$/.test(p.text) ? "" : "."),
      )
      .join(" ");
    return { category, text, ...(translated ? { vi: translated } : {}) };
  });
}
export const preparationPartKey = (
  key: string,
  category: PreparationCategory,
) => `${key}::${category}`;
export function sourcePreparationKey(key: string) {
  return key.replace(/::(?:Produce|Protein|Pantry|Other|Cooking)$/, "");
}
export function advancePreparationParts(
  meal: Meal,
  index: number,
  vi: Record<string, string> = {},
) {
  return preparationParts(meal, meal.prep[index], vi).filter(
    (p) => p.category !== "Cooking",
  );
}

export function preparationPartIngredients(
  meal: Meal,
  category: PreparationCategory,
  text: string,
  vi: Record<string, string> = {},
) {
  return meal.ingredients
    .filter(
      (ingredient) =>
        preparationCategory(ingredient) === category &&
        ingredientMatches(text, ingredient, vi),
    )
    .map((ingredient) => ingredient.name);
}

/** Inline only category-specific sentences; full meal guidance remains in meal details. */
export function categoryStorageText(
  meal: Meal,
  category: string,
  text: string,
  vi: Record<string, string> = {},
) {
  if (!["Produce", "Protein", "Pantry"].includes(category)) return "";
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => {
      const found = new Set(
        meal.ingredients
          .filter((i) => ingredientMatches(sentence, i, vi))
          .map(preparationCategory),
      );
      const normalized = preparationText(sentence);
      if (/\b(vegetables?|greens|herbs|rau|cu)\b/.test(normalized))
        found.add("Produce");
      if (
        /\b(meat|seafood|proteins?|chicken|pork|beef|fish|salmon|shrimp|thit|ga|heo|tom)\b/.test(
          normalized,
        ) ||
        /(?:^|[^\p{L}])cá(?:$|[^\p{L}])/iu.test(sentence)
      )
        found.add("Protein");
      const foodCategories = [...found].filter(
        (c) => c === "Produce" || c === "Protein",
      );
      return (
        found.has(category as PreparationCategory) &&
        (category === "Pantry"
          ? !foodCategories.length
          : foodCategories.every((c) => c === category))
      );
    })
    .join(" ");
}
