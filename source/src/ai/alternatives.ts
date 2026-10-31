import type { MenuInput } from "./contracts";
import { DAYS, type Plan } from "../types";
import { unschedule } from "../helpers/mealAlternatives";
export function alternativeInput(input: MenuInput): MenuInput {
  return {
    ...input,
    days: [...DAYS.slice(0, 5)],
    mealTypes: [
      input.mealTypes.includes("Lunch") ? "Lunch" : input.mealTypes[0],
    ],
  };
}
export function attachAlternatives(plan: Plan, options: Plan): Plan {
  if (options.meals.length !== 5 || options.servings !== plan.servings)
    throw Error("Invalid alternatives");
  const names = new Set(
    plan.meals.map((m) => m.main.trim().toLocaleLowerCase()),
  );
  for (const meal of options.meals) {
    const name = meal.main.trim().toLocaleLowerCase();
    if (names.has(name)) throw Error("Alternative dishes must be different");
    names.add(name);
  }
  return {
    ...plan,
    alternatives: options.meals.map((meal, index) =>
      unschedule(meal, `alternative-${index + 1}`),
    ),
    translations: {
      vi: { ...plan.translations?.vi, ...options.translations?.vi },
    },
  };
}
