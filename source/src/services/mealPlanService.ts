import { validatePlan } from "src/validations";
import type { Plan } from "src/types";
export async function fetchMealPlan(): Promise<Plan> {
  const response = await fetch(import.meta.env.BASE_URL + "meal-plan.json");
  if (!response.ok) throw Error("Meal data could not be loaded.");
  const plan = await response.json();
  const errors = validatePlan(plan);
  if (errors.length) throw Error(errors.join("\n"));
  return plan;
}
