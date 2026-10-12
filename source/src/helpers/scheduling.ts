import type { State } from "src/types";

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
  delete next.progress.ready[first];
  delete next.progress.ready[second];
  return next;
}
