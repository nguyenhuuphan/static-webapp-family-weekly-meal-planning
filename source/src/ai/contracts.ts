import {
  DAYS,
  MEAL_TYPES,
  type Day,
  type MealType,
  type Plan,
} from "src/types";
import { isMonday } from "src/utils";
export const DEFAULT_MASTER_PROMPT =
  "Plan practical, varied family meals with easily available ingredients. Prefer Vietnamese home cooking, reuse ingredients across meals to reduce waste, and explain advance preparation separately from cooking. Include a main dish, a simple side, precise quantities, cooking instructions and appropriate storage/thawing guidance. Adapt to the selected cuisines and household requirements.";
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
