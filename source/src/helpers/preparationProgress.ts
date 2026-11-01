import type { State } from "src/types";
import {
  advancePreparationParts,
  preparationPartKey,
  sourcePreparationKey,
} from "./preparationParts";
export function preparationChecked(state: State, key: string) {
  return (
    !!state.progress.prep[sourcePreparationKey(key)] ||
    !!state.progress.prep[key]
  );
}
export function preparationKeys(state: State, key: string) {
  const source = sourcePreparationKey(key),
    separator = source.lastIndexOf(":"),
    id = source.slice(0, separator),
    index = Number(source.slice(separator + 1));
  const meal = state.plan.meals.find((m) => m.id === id);
  return [
    source,
    ...(meal?.prep[index]
      ? advancePreparationParts(meal, index).map((p) =>
          preparationPartKey(source, p.category),
        )
      : []),
  ];
}
/** Mutates the reducer's draft, preserving the original preparation timestamp and key. */
export function setPreparationProgress(
  state: State,
  key: string,
  value: boolean,
) {
  const source = sourcePreparationKey(key),
    separator = source.lastIndexOf(":"),
    id = source.slice(0, separator),
    index = Number(source.slice(separator + 1));
  const meal = state.plan.meals.find((m) => m.id === id);
  if (!meal || !meal.prep[index]) return;
  const parts = advancePreparationParts(meal, index);
  const keys = parts.map((part) => preparationPartKey(source, part.category));
  if (key !== source && !keys.includes(key)) return;
  if (key !== source) {
    if (state.progress.prep[source])
      keys.forEach((part) => {
        state.progress.prep[part] = true;
      });
    state.progress.prep[key] = value;
    state.progress.prep[source] = keys.every(
      (part) => state.progress.prep[part],
    );
  } else {
    state.progress.prep[source] = value;
    keys.forEach((part) => {
      state.progress.prep[part] = value;
    });
  }
  state.preparedTasks ??= {};
  if (state.progress.prep[source]) {
    const servings = state.mealServings?.[id] ?? state.servings;
    state.preparedTasks[source] = {
      servings,
      at: state.preparedTasks[source]?.at || new Date().toISOString(),
    };
    if (!state.mealStorage?.[id]) {
      state.mealStorage ??= {};
      const at = new Date().toISOString();
      state.mealStorage[id] = {
        stage: "unknown",
        place: "unknown",
        events: [{ type: "prepared", at, stage: "unknown", place: "unknown" }],
      };
    }
  } else {
    delete state.preparedTasks[source];
    delete state.progress.ready[id];
  }
}
