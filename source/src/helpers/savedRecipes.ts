import type { Meal, State } from "src/types";

/** Compare recipe content per portion, independently of calendar slot or batch ID. */
export function recipeKey(meal: Meal, base: number): string {
  const steps = (items: Meal["prep"]) =>
    items.map((step) => ({
      ...step,
      text: step.text.replace(
        /\[([\d.]+) (g|ml|each|tsp|tbsp)\]/g,
        (_, qty, unit) => `[${Number(qty) / base} ${unit}]`,
      ),
      ingredients: step.ingredients?.map((ref) => ({
        ingredient: meal.ingredients.find((i) => i.id === ref.ingredientId)
          ?.name,
        qty: ref.qty / base,
      })),
    }));
  return JSON.stringify({
    main: meal.main,
    side: meal.side,
    ingredients: meal.ingredients.map(({ id: _id, qty, ...i }) => ({
      ...i,
      qty: qty / base,
    })),
    prep: steps(meal.prep),
    steps: steps(meal.steps),
    storage: meal.storage,
    thaw: meal.thaw,
  });
}

/** Recipe suggestions carry no physical stock. Keep physical batches separate. */
export function uniqueSavedRecipes(state: State): State {
  const keys = new Set(
    (state.savedFood || [])
      .filter(
        (f) =>
          f.kind !== "recipe" && ["pending", "scheduled"].includes(f.status),
      )
      .map((f) => recipeKey(f.meal, f.baseServings)),
  );
  let changed = false;
  const savedFood = state.savedFood?.map((f) => {
    if (f.kind !== "recipe" || f.status !== "pending") return f;
    const key = recipeKey(f.meal, f.baseServings);
    if (keys.has(key)) {
      changed = true;
      return { ...f, status: "discarded" as const };
    }
    keys.add(key);
    return f;
  });
  return changed ? { ...state, savedFood } : state;
}
