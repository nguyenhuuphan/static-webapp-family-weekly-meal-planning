import defaultTranslations from "../i18n/locales/vi.recipes.json";
import type { Meal, MealAlternative, Plan, State } from "src/types";
import { validatePlan } from "src/validations";
import { replaceMeal } from "src/helpers";

// Rebase linked ingredient IDs when a recipe moves into a different slot.
export function recipeWithId<T extends MealAlternative>(
  recipe: T,
  id: string,
): T {
  const copy = structuredClone(recipe);
  const ids = new Map(
    copy.ingredients.map((i, n) => [i.id, `${id}-ingredient-${n}`]),
  );
  copy.ingredients = copy.ingredients.map((i, n) => ({
    ...i,
    id: `${id}-ingredient-${n}`,
  }));
  for (const step of [...copy.prep, ...copy.steps])
    if (step.ingredients)
      step.ingredients = step.ingredients.map((ref) => ({
        ...ref,
        ingredientId: ids.get(ref.ingredientId) || ref.ingredientId,
      }));
  return { ...copy, id };
}
export function unschedule(meal: Meal, id: string): MealAlternative {
  const { day: _day, type: _type, ...recipe } = meal;
  return recipeWithId(recipe, id);
}
export function swapPlanMeal(
  plan: Plan,
  mealId: string,
  alternativeId: string,
): Plan {
  const original = plan.meals.find((m) => m.id === mealId);
  const option = plan.alternatives?.find((m) => m.id === alternativeId);
  if (!original || !option) throw Error("This recipe is no longer available.");
  const replacement: Meal = {
    ...recipeWithId(option, original.id),
    day: original.day,
    type: original.type,
  };
  const returned = unschedule(original, alternativeId);
  const translations = { ...plan.translations?.vi };
  // A recipe returned to the pool can be selected for another day. Remove stale container/day labels.
  const flexible = (source: string) => {
    const result = source.replace(
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|MON|TUE|WED|THU|FRI|SAT|SUN)(?:\s+(?:Breakfast|Lunch|Dinner))?\b/gi,
      "planned meal",
    );
    if (result !== source) {
      const translated =
        translations[source] ||
        (defaultTranslations as Record<string, string>)[source];
      if (translated)
        Object.defineProperty(translations, result, {
          value: translated.replace(
            /(?:THỨ|Thứ|thứ)\s+(?:HAI|BA|TƯ|NĂM|SÁU|BẢY|Hai|Ba|Tư|Năm|Sáu|Bảy|hai|ba|tư|năm|sáu|bảy)|(?:CHỦ NHẬT|Chủ nhật|chủ nhật)/g,
            "ngày nấu",
          ),
          enumerable: true,
          configurable: true,
          writable: true,
        });
    }
    return result;
  };
  returned.storage = flexible(returned.storage);
  returned.thaw = flexible(returned.thaw);
  for (const step of [...returned.prep, ...returned.steps]) {
    step.text = flexible(step.text);
    if (step.label) step.label = flexible(step.label);
    if (step.storage) step.storage = flexible(step.storage);
  }
  const next = {
    ...plan,
    translations: { vi: translations },
    meals: plan.meals.map((m) => (m.id === mealId ? replacement : m)),
    alternatives: plan.alternatives!.map((m) =>
      m.id === alternativeId ? returned : m,
    ),
  };
  const errors = validatePlan(next);
  if (errors.length) throw Error(errors.join("\n"));
  return next;
}
export function canSwapMeal(state: State, mealId: string): boolean {
  return (
    !state.progress.done[mealId] &&
    !state.cookingBatches?.[mealId] &&
    state.timer?.mealId !== mealId &&
    !state.timers?.some((timer) => timer.mealId === mealId)
  );
}
export function swapStateMeal(
  state: State,
  mealId: string,
  alternativeId: string,
): State {
  if (!canSwapMeal(state, mealId))
    throw Error("Finish cooking before replacing this meal.");
  const plan = swapPlanMeal(state.plan, mealId, alternativeId);
  const updated = replaceMeal(
    state,
    mealId,
    plan.meals.find((m) => m.id === mealId)!,
  );
  updated.plan.alternatives = plan.alternatives;
  return updated;
}
