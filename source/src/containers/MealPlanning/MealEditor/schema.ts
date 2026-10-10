import type { Plan, Meal } from "src/types";
import { validatePlan } from "src/validations";
export const validateMealDraft = (plan: Plan, id: string, draft: Meal) =>
  validatePlan({
    ...plan,
    meals: plan.meals.map((m) => (m.id === id ? draft : m)),
  });
