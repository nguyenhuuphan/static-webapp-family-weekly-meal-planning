import type { Meal, Plan } from "src/types";
import original from "../../public/meal-plan.json";

export function ingredientIds(meal: Meal): Meal {
  return {
    ...meal,
    ingredients: meal.ingredients.map((i, index) => ({
      ...i,
      id: i.id || `${meal.id}-ingredient-${index}`,
    })),
  };
}

export function normalizeIngredientLinks(plan: Plan): Plan {
  return {
    ...plan,
    meals: plan.meals.map((meal) => {
      const normalized = ingredientIds(meal);
      const baseline = (original as Plan).meals.find(
        (m) => m.id === (meal.recipeId || meal.id),
      );
      const exactIngredients =
        baseline &&
        JSON.stringify(
          meal.ingredients.map(({ name, qty, unit }) => ({ name, qty, unit })),
        ) ===
          JSON.stringify(
            baseline.ingredients.map(({ name, qty, unit }) => ({
              name,
              qty,
              unit,
            })),
          );
      if (!exactIngredients) return normalized;
      return {
        ...normalized,
        prep: normalized.prep.map((step, index) => {
          const originalStep = baseline.prep[index];
          if (
            step.ingredients !== undefined ||
            step.text !== originalStep?.text ||
            !originalStep.ingredients
          )
            return step;
          return {
            ...step,
            ingredients: originalStep.ingredients.map((ref) => {
              const position = baseline.ingredients.findIndex(
                (i) => i.id === ref.ingredientId,
              );
              return {
                ingredientId: normalized.ingredients[position].id!,
                qty: ref.qty,
              };
            }),
          };
        }),
      };
    }),
  };
}
