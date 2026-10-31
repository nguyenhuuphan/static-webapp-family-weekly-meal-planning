import {
  DAYS,
  MEAL_TYPES,
  type Day,
  type MealType,
  type Plan,
} from "src/types";
import { isMonday } from "src/utils";
export const DEFAULT_MASTER_PROMPT =
  "Plan a practical, varied weekly family menu with easily available ingredients. Follow the selected household size, days, meal times, dietary restrictions, allergies, cooking appliances, time limit, budget, pantry and custom request. Apply the following preferences across the ENTIRE week, including meals already planned in other meal-time batches.\n\n1. Savory main dishes: Prefer each distinct savory main dish only once per week. Repeat a dish only when the household constraints make it necessary, and never more than twice in the week. Renaming or translating a dish does not make it a different dish.\n\n2. Main-ingredient variety: Track the actual primary ingredient and fish species, rather than just the recipe title. If basa has already been used, prefer salmon, pompano, cobia, mackerel, tuna or another suitable available fish for later fish meals. Choose alternatives that fit the budget, pantry, dietary restrictions and available equipment.\n\n3. A new cooking method is not a new ingredient: Braised basa and fried basa still use the SAME fish species and count as repeated use of basa when checking ingredient variety. Apply the same reasoning to other primary ingredients. Count substantial main-dish proteins; shared seasonings such as fish sauce and small soup garnishes are not the main protein.\n\n4. Rotate food groups: Alternate pork, beef, chicken, fish, shrimp, squid, eggs and other suitable proteins to avoid monotonous consecutive meals. Adapt this rotation to the selected diet and excluded ingredients; never introduce a prohibited food to satisfy variety.\n\n5. Cuisine: Prefer Central Vietnamese home cooking with rich, savory, appetizing flavors. Mix in occasional simple meals such as spaghetti or fried rice. Adapt seasoning to the household and honor an explicitly selected cuisine when it differs from this default preference.\n\n6. Shopping and preparation: Reuse vegetables, aromatics and seasonings to reduce waste and combine compatible advance-preparation tasks, while limiting repeated savory mains. Include a main dish and a simple side or soup where appropriate, exact quantities for the selected servings, separate advance-preparation and cooking steps, realistic timings and suitable storage/thawing guidance. Reusing ingredients must not become an excuse to repeat the same main dishes.\n\n7. Vietnamese language: ALWAYS write natural Vietnamese with full, correct diacritics in every Vietnamese field, including the plan title, dish names, ingredients, categories, preparation instructions, cooking instructions and storage/thawing guidance. Never use unaccented Vietnamese or transliterated spellings. Also supply the corresponding English fields required by the application's bilingual format. Preserve all numeric amounts, units and bracketed quantity tokens exactly between the two languages.\n\nBefore returning a batch, compare it with the meals already planned for this week and check dish repetition, fish-species variety and protein-group rotation. Use the bundled default recipe as a reference for structure and useful detail, not as a list of dishes to copy.";
export const COOKING_EQUIPMENT = [
  ["Air fryer", "Nồi chiên không dầu", "Air fryer"],
  ["Electric stove", "Bếp điện", "Electric stove"],
  ["Induction stove", "Bếp từ", "Induction stove"],
  ["Gas stove", "Bếp ga", "Gas stove"],
  ["Blender", "Máy xay", "Blender"],
  ["Oven", "Lò nướng", "Oven"],
  ["Microwave", "Lò vi sóng", "Microwave"],
  ["Rice cooker", "Nồi cơm điện", "Rice cooker"],
  ["Steamer", "Nồi hấp", "Steamer"],
  ["Pressure cooker", "Nồi áp suất", "Pressure cooker"],
  [
    "No heating appliance",
    "Không có thiết bị gia nhiệt (món nguội)",
    "No heating appliance (cold meals)",
  ],
] as const;
export type MenuInput = {
  weekStart: string;
  servings: number;
  days: Day[];
  mealTypes: MealType[];
  cuisines: string[];
  equipment: string[];
  diet: string;
  avoid: string;
  maxMinutes: number;
  budget: string;
  pantry: string;
  customPrompt: string;
};
export type MenuJob = {
  id: string;
  revision?: string;
  status: "queued" | "running" | "ready" | "failed";
  createdAt: string;
  input: MenuInput;
  masterPrompt: string;
  recentMeals: string[];
  plan?: Plan;
  error?: string;
  errorCode?: string;
  errorDiagnostic?: {
    httpStatus?: number;
    status?: string;
    reason: string;
    slot?: string;
    stepCount?: number;
    instructionCharacters?: number;
  };
  /** Administration-only synthetic job flag; never accepted by the generation API. */
  diagnostic?: boolean;
};
export function validateMenuInput(raw: unknown): MenuInput {
  if (!raw || typeof raw !== "object") throw Error("Invalid input.");
  const input = raw as MenuInput;
  if (
    !isMonday(input.weekStart) ||
    !Number.isInteger(input.servings) ||
    input.servings < 1 ||
    input.servings > 12
  )
    throw Error("Choose a Monday and 1–12 people.");
  for (const [values, allowed] of [
    [input.days, DAYS],
    [input.mealTypes, MEAL_TYPES],
  ] as const) {
    if (
      !Array.isArray(values) ||
      !values.length ||
      new Set(values).size !== values.length ||
      values.some(
        (value: string) => !(allowed as readonly string[]).includes(value),
      )
    )
      throw Error("Choose valid days and meals.");
  }
  if (
    !Number.isInteger(input.maxMinutes) ||
    input.maxMinutes < 5 ||
    input.maxMinutes > 240
  )
    throw Error("Cooking time must be 5–240 minutes.");
  if (
    !Array.isArray(input.cuisines) ||
    !input.cuisines.length ||
    input.cuisines.length > 6 ||
    input.cuisines.some(
      (v) => typeof v !== "string" || !v.trim() || v.length > 80,
    )
  )
    throw Error("Choose at least one cuisine.");
  if (
    !Array.isArray(input.equipment) ||
    !input.equipment.length ||
    input.equipment.length > 12 ||
    new Set(input.equipment).size !== input.equipment.length ||
    input.equipment.some(
      (v) => typeof v !== "string" || !v.trim() || v.length > 80,
    )
  )
    throw Error("Choose your cooking equipment.");
  if (
    input.equipment.includes("No heating appliance") &&
    input.equipment.length !== 1
  )
    throw Error("Choose cold meals or cooking appliances, not both.");
  for (const key of [
    "diet",
    "avoid",
    "budget",
    "pantry",
    "customPrompt",
  ] as const)
    if (typeof input[key] !== "string" || input[key].length > 2000)
      throw Error("Additional information is too long.");
  return {
    weekStart: input.weekStart,
    servings: input.servings,
    days: [...input.days],
    mealTypes: [...input.mealTypes],
    cuisines: [...input.cuisines],
    equipment: [...input.equipment],
    diet: input.diet.trim(),
    avoid: input.avoid.trim(),
    maxMinutes: input.maxMinutes,
    budget: input.budget.trim(),
    pantry: input.pantry.trim(),
    customPrompt: input.customPrompt.trim(),
  };
}
export function validateMasterPrompt(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 6000)
    throw Error("Master prompt must contain 1–6000 characters.");
  return raw.trim();
}
export const menuSlotId = (day: Day, type: MealType) =>
  `${day.slice(0, 3).toLowerCase()}-${type.toLowerCase()}`;
export const isJobId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
