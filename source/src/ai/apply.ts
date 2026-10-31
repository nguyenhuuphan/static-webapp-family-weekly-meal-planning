import type { Plan, State } from "src/types";
import { startWeek } from "src/helpers/scheduling";
import { normalizeIngredientLinks } from "src/helpers/ingredientLinks";
import { validatePlan } from "src/validations";
import { isMonday } from "src/utils";
export function applyGeneratedMenu(
  state: State,
  plan: Plan,
  weekStart: string,
): State {
  if (validatePlan(plan).length || !isMonday(weekStart))
    throw Error("Invalid generated plan.");
  if (
    state.timer ||
    state.timers?.length ||
    Object.keys(state.cookingBatches || {}).length
  )
    throw Error("Finish cooking and timers before replacing this week's plan.");
  const next = startWeek(state, weekStart);
  return {
    ...next,
    plan: normalizeIngredientLinks(structuredClone(plan)),
    servings: plan.servings,
  };
}
