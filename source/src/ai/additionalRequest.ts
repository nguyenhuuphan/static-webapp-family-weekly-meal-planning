import type { MenuInput } from "./contracts";
import {
  DAYS,
  MEAL_TYPES,
  type Day,
  type MealType,
  type Meal,
  type Plan,
} from "../types";
import { normalizeAvoidance, ingredientWarnings } from "../helpers/allergies";
export const CUISINE_CODES = [
  "Vietnamese",
  "European",
  "Asian",
  "Other",
] as const;
export type CuisineCode = (typeof CUISINE_CODES)[number];
const foods = {
  fish: {
    en: "fish",
    vi: "cá",
    aliases: [
      "fish",
      "salmon",
      "basa",
      "catfish",
      "tilapia",
      "mackerel",
      "tuna",
      "cod",
      "pompano",
      "cobia",
      "trout",
      "sardine",
      "ca hoi",
      "ca basa",
      "ca ro phi",
      "ca thu",
      "ca ngu",
      "ca chim",
      "ca bop",
      "ca",
    ],
  },
  broccoli: {
    en: "broccoli",
    vi: "bông cải xanh",
    aliases: [
      "broccoli",
      "brocolli",
      "brocoli",
      "bong cai xanh",
      "sup lo xanh",
    ],
  },
  chicken: {
    en: "chicken",
    vi: "thịt gà",
    aliases: ["chicken", "thit ga", "ga"],
  },
  beef: { en: "beef", vi: "thịt bò", aliases: ["beef", "thit bo"] },
  pork: {
    en: "pork",
    vi: "thịt heo",
    aliases: ["pork", "thit heo", "thit lon"],
  },
  shrimp: { en: "shrimp", vi: "tôm", aliases: ["shrimp", "prawn", "tom"] },
  squid: { en: "squid", vi: "mực", aliases: ["squid", "calamari", "muc"] },
  egg: { en: "eggs", vi: "trứng", aliases: ["egg", "eggs", "trung"] },
  tofu: { en: "tofu", vi: "đậu phụ", aliases: ["tofu", "dau phu", "dau hu"] },
  mushroom: {
    en: "mushrooms",
    vi: "nấm",
    aliases: ["mushroom", "mushrooms", "nam"],
  },
  cabbage: { en: "cabbage", vi: "bắp cải", aliases: ["cabbage", "bap cai"] },
  carrot: {
    en: "carrots",
    vi: "cà rốt",
    aliases: ["carrot", "carrots", "ca rot"],
  },
  peanut: {
    en: "peanuts",
    vi: "đậu phộng",
    aliases: ["peanut", "peanuts", "dau phong", "lac"],
  },
} satisfies Record<string, { en: string; vi: string; aliases: string[] }>;
export type FoodCode = keyof typeof foods;
export type RequestRule = {
  id: string;
  source: string;
  count: number;
  countMode: "exact" | "at_least";
  day?: Day;
  mealType?: MealType;
  cuisine?: CuisineCode;
  cookingMethod?: "fried" | "baked" | "grilled" | "steamed" | "stewed";
  ingredients: FoodCode[];
  excludedIngredients: FoodCode[];
  slots: string[];
};
export type RequestContract = {
  originalText: string;
  rules: RequestRule[];
  excludedIngredients: FoodCode[];
  conflicts: string[];
};
export const slotId = (day: Day, type: MealType) =>
  `${day.slice(0, 3).toLowerCase()}-${type.toLowerCase()}`;
const contains = (text: string, term: string) =>
  ` ${text} `.includes(` ${term} `);
const foodCodes = Object.keys(foods) as FoodCode[];
const foodMentions = (text: string) =>
  foodCodes.filter((food) =>
    foods[food].aliases.some((alias) => contains(text, alias)),
  );
const numberWords: Record<string, number> = {
  one: 1,
  single: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  nam: 5,
  sau: 6,
  bay: 7,
};
const dayAliases = [
  ["monday", "thu hai", "thu 2", "t2"],
  ["tuesday", "thu ba", "thu 3", "t3"],
  ["wednesday", "thu tu", "thu 4", "t4"],
  ["thursday", "thu nam", "thu 5", "t5"],
  ["friday", "thu sau", "thu 6", "t6"],
  ["saturday", "thu bay", "thu 7", "t7"],
  ["sunday", "chu nhat", "cn"],
];
export function cuisineCode(value: string): CuisineCode | undefined {
  const text = normalizeAvoidance(value);
  if (
    /\b(western|european|italian|french|mediterranean|phuong tay|au)\b/.test(
      text,
    )
  )
    return "European";
  if (/\b(vietnamese|vietnam|viet|mien trung)\b/.test(text))
    return "Vietnamese";
  if (/\b(asian|chinese|thai|japanese|korean|chau a)\b/.test(text))
    return "Asian";
  return undefined;
}
/** Compile explicit meal/count/slot requests; preserve all other prose for the AI. */
export function compileAdditionalRequest(input: MenuInput): RequestContract {
  const contract: RequestContract = {
    originalText: input.customPrompt.trim(),
    rules: [],
    excludedIngredients: [],
    conflicts: [],
  };
  const schedule = DAYS.filter((day) => input.days.includes(day)).flatMap(
    (day) =>
      MEAL_TYPES.filter((type) => input.mealTypes.includes(type)).map(
        (type) => ({ day, type, id: slotId(day, type) }),
      ),
  );
  for (const source of contract.originalText
    .split(/[;\n]+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const text = normalizeAvoidance(source);
    const negative = text.match(
      /\b(?:avoid|exclude|without|no|tranh|khong an|khong dung|khong su dung)\s+(.+?)(?=\b(?:but|nhung|include|need|want|muon|can)\b|$)/,
    );
    const excludedIngredients = negative ? foodMentions(negative[1]) : [];
    // Ambiguous negations/replacements stay verbatim; never guess a required food from them.
    if (
      /\b(instead of|replace|free|not fried|not steamed|not baked)\b/.test(text)
    )
      continue;
    const positive = negative ? text.replace(negative[0], " ") : text;
    const cuisine = cuisineCode(positive);
    const ingredients = foodMentions(positive);
    const cookingMethod: RequestRule["cookingMethod"] =
      /\b(fried|fry|frying|chien|ran)\b/.test(positive)
        ? "fried"
        : /\b(baked|bake|roasted|roast|nuong lo|dut lo)\b/.test(positive)
          ? "baked"
          : /\b(grilled|grill|barbecued|bbq|nuong)\b/.test(positive)
            ? "grilled"
            : /\b(steamed|steam|hap)\b/.test(positive)
              ? "steamed"
              : /\b(stewed|stew|braised|braise|kho)\b/.test(positive) ||
                  /hầm/u.test(source)
                ? "stewed"
                : undefined;
    if (
      dayAliases.filter((aliases) =>
        aliases.some((alias) => contains(text, alias)),
      ).length > 1
    )
      continue;
    const dayIndex = dayAliases.findIndex((aliases) =>
      aliases.some((alias) => contains(text, alias)),
    );
    const day = dayIndex >= 0 ? DAYS[dayIndex] : undefined;
    const mealType: MealType | undefined = /\b(breakfast|bua sang)\b/.test(
      positive,
    )
      ? "Breakfast"
      : /\b(lunch|bua trua)\b/.test(positive)
        ? "Lunch"
        : /\b(dinner|bua toi)\b/.test(positive)
          ? "Dinner"
          : undefined;
    const countMatch = positive.match(
      /(?<!thu )\b(\d+|one|single|two|three|four|five|six|seven|mot|hai|ba|bon|nam|sau|bay)\s+(?:(?:western|european|vietnamese|asian|au|viet)\s+)?(?:meal|meals|bua|mon)\b/,
    );
    if (
      (!countMatch && !day && !mealType) ||
      (!cuisine && !ingredients.length && !excludedIngredients.length)
    ) {
      contract.excludedIngredients.push(...excludedIngredients);
      continue;
    }
    const count = countMatch
      ? Number(countMatch[1]) || numberWords[countMatch[1]]
      : 1;
    if (!count || count > 21) {
      contract.conflicts.push("Requested meal count must be 1–21.");
      continue;
    }
    const countMode =
      countMatch && !/\b(at least|it nhat|toi thieu)\b/.test(positive)
        ? "exact"
        : "at_least";
    const occupied = new Set(contract.rules.flatMap((rule) => rule.slots));
    const candidates = schedule.filter(
      (slot) =>
        (!day || slot.day === day) && (!mealType || slot.type === mealType),
    );
    if (!day && !mealType)
      candidates.sort(
        (left, right) =>
          Number(occupied.has(left.id)) - Number(occupied.has(right.id)),
      );
    if (candidates.length < count)
      contract.conflicts.push(
        `The request needs ${count} ${day || "selected day"} ${mealType || "meal"} slot(s), but only ${candidates.length} are selected.`,
      );
    const rule: RequestRule = {
      id: `request-${contract.rules.length + 1}`,
      source,
      count,
      countMode,
      day,
      mealType,
      cuisine,
      cookingMethod,
      ingredients,
      excludedIngredients,
      slots: candidates.slice(0, count).map((s) => s.id),
    };
    for (const other of contract.rules)
      if (
        other.slots.some((slot) => rule.slots.includes(slot)) &&
        other.cuisine &&
        rule.cuisine &&
        other.cuisine !== rule.cuisine
      )
        contract.conflicts.push(
          "Two requests assign different cuisines to the same meal.",
        );
    contract.rules.push(rule);
  }
  contract.excludedIngredients = [...new Set(contract.excludedIngredients)];
  for (const rule of contract.rules) {
    if (
      rule.ingredients.some(
        (food) =>
          contract.excludedIngredients.includes(food) ||
          rule.excludedIngredients.includes(food),
      )
    )
      contract.conflicts.push(
        "A required ingredient is also excluded in the additional request.",
      );
    const diet = normalizeAvoidance(input.diet);
    if (
      /\b(vegan|vegetarian|an chay|thuan chay)\b/.test(diet) &&
      rule.ingredients.some((f) =>
        ["fish", "chicken", "beef", "pork", "shrimp", "squid"].includes(f),
      )
    )
      contract.conflicts.push(
        "A requested animal ingredient conflicts with the selected diet.",
      );
    if (/\b(vegan|thuan chay)\b/.test(diet) && rule.ingredients.includes("egg"))
      contract.conflicts.push(
        "The egg request conflicts with the selected vegan diet.",
      );
    const avoided = input.avoid.split(/[,;\n]+/).map(normalizeAvoidance);
    if (
      rule.ingredients.some((food) =>
        avoided.some((term) => foods[food].aliases.includes(term)),
      )
    )
      contract.conflicts.push(
        "A required ingredient is listed in Ingredients to avoid.",
      );
  }
  for (const rule of contract.rules.filter(
    (r) => r.cuisine && r.countMode === "exact",
  )) {
    const required = new Set(
      contract.rules
        .filter((r) => r.cuisine === rule.cuisine)
        .flatMap((r) => r.slots),
    );
    if (required.size > rule.count)
      contract.conflicts.push(
        "The requested cuisine count conflicts with the requested meal slots.",
      );
  }
  contract.conflicts = [...new Set(contract.conflicts)];
  return contract;
}
export function foodLabel(food: FoodCode, language: "en" | "vi") {
  return foods[food][language];
}
export function mealContainsFood(
  meal: Meal,
  food: FoodCode,
  vi: Record<string, string> = {},
) {
  return meal.ingredients.some((ingredient) => {
    const en = normalizeAvoidance(ingredient.name),
      translated = normalizeAvoidance(vi[ingredient.name] || "");
    // Fish sauce/stock does not make a meal a fish dish.
    if (
      food === "fish" &&
      /\b(sauce|stock|broth|nuoc mam)\b/.test(en + " " + translated)
    )
      return false;
    return foods[food].aliases.some(
      (alias) => contains(en, alias) || contains(translated, alias),
    );
  });
}
export type RequestViolation = {
  ruleId: string;
  slot?: string;
  reason:
    | "ingredient"
    | "cuisine"
    | "cuisine_count"
    | "excluded_ingredient"
    | "cooking_method";
  ingredient?: FoodCode;
};
export function requestedCookingMatches(meal: Meal, rule: RequestRule) {
  if (!rule.cookingMethod) return true;
  const patterns = {
    fried: /\b(fried|fry|fries|frying|chien|ran)\b/i,
    baked: /\b(bake|baked|baking|roast|roasted|roasting|nuong)\b/i,
    grilled: /\b(grill|grilled|grilling|barbecue|barbecued|nuong)\b/i,
    steamed: /\b(steam|steamed|steaming|hap)\b/i,
    stewed:
      /\b(stew|stewed|stewing|braise|braised|braising|simmer|simmered|kho|ham)\b/i,
  };
  const method = patterns[rule.cookingMethod];
  const instructions = meal.steps
    .flatMap((step) => step.text.split(/[.!?]\s+/).map(normalizeAvoidance))
    .filter((step) => !/\b(do not|never|avoid)\b/.test(step));
  const proteinFoods = rule.ingredients.filter((food) =>
    ["fish", "chicken", "beef", "pork", "shrimp", "squid", "tofu"].includes(
      food,
    ),
  );
  const targets = proteinFoods.length ? proteinFoods : rule.ingredients;
  return (
    method.test(normalizeAvoidance(meal.main)) &&
    instructions.some((step) => method.test(step)) &&
    targets.every((food) =>
      instructions.some(
        (step) =>
          method.test(step) &&
          (foods[food].aliases.some((alias) => contains(step, alias)) ||
            (food === "fish" && /\bfillets?\b/.test(step))),
      ),
    )
  );
}
export function requestViolations(
  plan: Plan,
  input: MenuInput,
  mode: "batch" | "week" | "alternatives" = "week",
): RequestViolation[] {
  const contract = compileAdditionalRequest(input),
    violations: RequestViolation[] = [];
  for (const meal of plan.meals) {
    for (const food of contract.excludedIngredients)
      if (
        mealContainsFood(meal, food, plan.translations?.vi) ||
        ingredientWarnings(
          meal.ingredients,
          [{ id: "request", name: "request", avoid: [food] }],
          (name) => plan.translations?.vi[name] || name,
        ).length
      )
        violations.push({
          ruleId: "global-exclusion",
          slot: meal.id,
          reason: "excluded_ingredient",
          ingredient: food,
        });
    if (mode === "alternatives") continue;
    if (
      contract.rules.some((rule) => rule.cuisine) &&
      !CUISINE_CODES.includes(meal.cuisine as CuisineCode)
    )
      violations.push({
        ruleId: "cuisine-classification",
        slot: meal.id,
        reason: "cuisine",
      });
    for (const rule of contract.rules) {
      if (rule.slots.includes(meal.id)) {
        for (const food of rule.excludedIngredients)
          if (mealContainsFood(meal, food, plan.translations?.vi))
            violations.push({
              ruleId: rule.id,
              slot: meal.id,
              reason: "excluded_ingredient",
              ingredient: food,
            });
        for (const food of rule.ingredients)
          if (!mealContainsFood(meal, food, plan.translations?.vi))
            violations.push({
              ruleId: rule.id,
              slot: meal.id,
              reason: "ingredient",
              ingredient: food,
            });
        if (!requestedCookingMatches(meal, rule))
          violations.push({
            ruleId: rule.id,
            slot: meal.id,
            reason: "cooking_method",
          });
        if (rule.cuisine && cuisineCode(meal.cuisine || "") !== rule.cuisine)
          violations.push({
            ruleId: rule.id,
            slot: meal.id,
            reason: "cuisine",
          });
      } else if (
        rule.cuisine &&
        rule.countMode === "exact" &&
        cuisineCode(meal.cuisine || "") === rule.cuisine
      )
        violations.push({
          ruleId: rule.id,
          slot: meal.id,
          reason: "cuisine_count",
        });
    }
  }
  if (mode !== "alternatives")
    for (const rule of contract.rules.filter(
      (rule) =>
        rule.countMode === "exact" && !rule.cuisine && rule.ingredients.length,
    )) {
      const matching = plan.meals.filter(
        (meal) =>
          rule.ingredients.every((food) =>
            mealContainsFood(meal, food, plan.translations?.vi),
          ) && requestedCookingMatches(meal, rule),
      );
      if (
        matching.some((meal) => !rule.slots.includes(meal.id)) ||
        (mode === "week" && matching.length !== rule.count)
      )
        violations.push({ ruleId: rule.id, reason: "cuisine_count" });
    }
  if (mode === "week")
    for (const rule of contract.rules) {
      if (
        rule.cuisine &&
        rule.countMode === "exact" &&
        plan.meals.filter(
          (meal) => cuisineCode(meal.cuisine || "") === rule.cuisine,
        ).length !== rule.count
      )
        violations.push({ ruleId: rule.id, reason: "cuisine_count" });
    }
  return violations;
}
export function additionalRequestPayload(
  input: MenuInput,
  batch: MenuInput,
  alternatives = false,
) {
  const contract = compileAdditionalRequest(input);
  return {
    verbatim: alternatives
      ? contract.rules
          .reduce(
            (remaining, rule) => remaining.replace(rule.source, ""),
            contract.originalText,
          )
          .trim()
      : contract.originalText,
    originalWeeklyRequest: contract.originalText,
    priority:
      "Explicit additional-request instructions override master-prompt and default cuisine/variety preferences. Keep selected schedule, servings, dietary exclusions, appliances, time limit, JSON format and bilingual quantity protections.",
    interpretation: contract.rules,
    globalExclusions: contract.excludedIngredients,
    batchRules: alternatives
      ? []
      : contract.rules.filter((rule) =>
          rule.slots.some((id) =>
            batch.days.some((day) =>
              batch.mealTypes.some((type) => slotId(day, type) === id),
            ),
          ),
        ),
    scheduledOnly: alternatives
      ? "These five alternatives are unscheduled and never count toward a weekly cuisine count or satisfy a dated meal request. Follow global exclusions/preferences, but do not repeat a dated request five times."
      : "Apply each dated/counted request only to its assigned slots across the full week, never once per batch.",
    slotRequirements: alternatives
      ? []
      : batch.days.flatMap((day) =>
          batch.mealTypes.map((type) => {
            const id = slotId(day, type);
            return {
              id,
              required: contract.rules.filter((r) => r.slots.includes(id)),
              forbiddenCuisines: [
                ...new Set(
                  contract.rules
                    .filter(
                      (r) =>
                        r.cuisine &&
                        r.countMode === "exact" &&
                        !r.slots.includes(id),
                    )
                    .map((r) => r.cuisine),
                ),
              ],
            };
          }),
        ),
    remainingPreferences:
      "Also apply the complete verbatim request, including preferences not represented by structured rules. Do not silently replace requested ingredients with substitutes or discard the request to copy the example or avoid a previous dish.",
  };
}
