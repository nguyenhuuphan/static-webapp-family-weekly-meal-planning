import bundledPlan from "../../public/meal-plan.json";
import { storageService } from "./storageService";
import { validatePlan } from "src/validations";
import type { Plan } from "src/types";
export async function fetchMealPlan(): Promise<Plan> {
  try {
    if (storageService.raw() !== null)
      return structuredClone(bundledPlan) as Plan;
  } catch {
    /* Use the bundle when storage is inaccessible. */
  }
  let response: Response;
  try {
    response = await fetch(import.meta.env.BASE_URL + "meal-plan.json");
  } catch {
    return structuredClone(bundledPlan) as Plan;
  }
  if (!response.ok) throw Error("Meal data could not be loaded.");
  const plan = await response.json();
  const errors = validatePlan(plan);
  if (errors.length) throw Error(errors.join("\n"));
  return plan;
}
