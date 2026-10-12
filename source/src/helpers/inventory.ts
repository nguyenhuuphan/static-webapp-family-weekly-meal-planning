import type { Ingredient, State } from "src/types";
import { ingredientKey, mealPortions } from "src/utils";
import {
  availableAcquisitions,
  ingredientCredit,
  reconcileShopping,
} from "./shopping";

export const normalizedIngredient = (i: Ingredient): Ingredient =>
  i.unit === "tbsp" ? { ...i, qty: i.qty * 3, unit: "tsp" } : i;

export function consumeMeal(state: State, id: string, count?: number): State {
  if (state.stockUses?.[id]) return state;
  const meal = state.plan.meals.find((m) => m.id === id);
  if (!meal) throw Error("Meal not found.");
  const next = structuredClone(state);
  const use = {
    home: {} as Record<string, number>,
    purchased: {} as Record<string, number>,
    ingredients: [] as Ingredient[],
  };
  for (const raw of meal.ingredients) {
    const credit = ingredientCredit(state.mealCredits?.[id], raw);
    const item = normalizedIngredient({
      ...raw,
      qty: Math.max(
        0,
        (raw.qty * (count ?? mealPortions(state, meal))) / state.plan.servings -
          credit,
      ),
    });
    const key = ingredientKey(item);
    const available = availableAcquisitions(state, key);
    use.home[key] = Math.min(item.qty, available.home);
    use.purchased[key] = Math.min(
      Math.max(0, item.qty - use.home[key]),
      available.purchased,
    );
    use.ingredients.push(item);
  }
  next.stockUses = { ...next.stockUses, [id]: use };
  return next;
}

export function stocktakeCandidates(state: State) {
  const metadata = new Map<string, Ingredient>();
  for (const meal of state.plan.meals)
    for (const raw of meal.ingredients) {
      const i = normalizedIngredient(raw);
      metadata.set(ingredientKey(i), i);
    }
  for (const [key, item] of Object.entries(state.purchased || {}))
    metadata.set(key, item as Ingredient);
  return [
    ...new Set([
      ...Object.keys(state.pantry || {}),
      ...Object.keys(state.purchased || {}),
    ]),
  ].map((key) => {
    const available = availableAcquisitions(state, key);
    return {
      key,
      item: metadata.get(key),
      estimated: Math.round((available.home + available.purchased) * 100) / 100,
    };
  });
}

export function updateHomeStock(
  state: State,
  key: string,
  amount: number,
): State {
  if (!Number.isFinite(amount) || amount < 0)
    throw Error("Invalid stock quantity.");
  const used = Object.values(state.stockUses || {}).reduce(
    (n, use) => n + (use.home[key] || 0),
    0,
  );
  const next = { ...state, pantry: { ...state.pantry, [key]: amount + used } };
  return reconcileShopping(next);
}
