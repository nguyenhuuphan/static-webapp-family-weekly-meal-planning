import type { State } from "src/types";
import { aggregate, ingredientKey, mealPortions } from "src/utils";

export function changePortions(state: State, id: string, count: number): State {
  const meal = state.plan.meals.find((m) => m.id === id);
  if (
    !meal ||
    state.progress.done[id] ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > state.servings
  )
    throw Error("Invalid portions for this meal.");
  const next = structuredClone(state);
  next.purchased ??= {};
  const before = aggregate(state.plan, state.servings, state.mealServings);
  for (const item of before) {
    const key = ingredientKey(item);
    if (state.progress.shopping[key] && !next.purchased[key])
      next.purchased[key] = {
        ...item,
        qty: Math.max(0, item.qty - (state.pantry?.[key] || 0)),
      };
  }
  next.mealServings = { ...next.mealServings, [id]: count };
  const after = aggregate(next.plan, next.servings, next.mealServings);
  for (const item of after) {
    const key = ingredientKey(item);
    next.progress.owned[key] = (next.pantry?.[key] || 0) >= item.qty;
    next.progress.shopping[key] =
      (next.purchased[key]?.qty || 0) >=
      Math.max(0, item.qty - (next.pantry?.[key] || 0));
  }
  if (count > mealPortions(state, meal)) {
    for (const key of Object.keys(next.progress.prep))
      if (key.startsWith(id + ":")) delete next.progress.prep[key];
  }
  delete next.progress.ready[id];
  return next;
}

/** Recipe identity and preparation follow the food, rather than the calendar slot. */
export function swapSchedule(
  state: State,
  first: string,
  second: string,
): State {
  if (first === second) return state;
  const a = state.plan.meals.find((m) => m.id === first);
  const b = state.plan.meals.find((m) => m.id === second);
  if (!a || !b || state.progress.done[first] || state.progress.done[second])
    throw Error("Completed meals cannot be moved.");
  const next = structuredClone(state);
  next.plan.meals = next.plan.meals.map((m) =>
    m.id === first
      ? { ...m, day: b.day, type: b.type }
      : m.id === second
        ? { ...m, day: a.day, type: a.type }
        : m,
  );
  // Attendance belongs to the date, while the recipe changes date.
  next.mealServings = {
    ...next.mealServings,
    [first]: mealPortions(state, b),
    [second]: mealPortions(state, a),
  };
  delete next.progress.ready[first];
  delete next.progress.ready[second];
  return next;
}
