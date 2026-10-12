import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { State, Plan, Progress } from "src/types";
import {
  availableAcquisitions,
  committedPurchases,
  shoppingRequirements,
} from "src/helpers/shopping";
import { aggregate, ingredientKey, mealPortions } from "src/utils";
import { freshProgress } from "src/helpers";
interface IPlannerState {
  current: State | null;
  defaults: Plan | null;
}
const initialState: IPlannerState = { current: null, defaults: null };
const plannerSlice = createSlice({
  name: "planner",
  initialState,
  reducers: {
    progressToggled: (
      state,
      action: PayloadAction<{
        group: Exclude<keyof Progress, "cook">;
        key: string;
        value: boolean;
      }>,
    ) => {
      if (!state.current) return;
      const { group, key, value } = action.payload;
      state.current.progress[group][key] = value;
      if (group === "prep") {
        const current = state.current;
        current.preparedTasks ??= {};
        const mealId = key.slice(0, key.lastIndexOf(":"));
        const meal = current.plan.meals.find((m) => m.id === mealId);
        if (value && meal)
          current.preparedTasks[key] = {
            servings: mealPortions(current, meal),
            at: current.preparedTasks[key]?.at || new Date().toISOString(),
          };
        if (!value) delete current.preparedTasks[key];
      }
      if (group === "shopping") {
        const current = state.current;
        current.purchased ??= {};
        if (!value) delete current.purchased[key];
        else {
          const item = shoppingRequirements(current).find(
            (i) => ingredientKey(i) === key,
          );
          if (item)
            current.purchased[key] = {
              ...item,
              qty:
                Math.max(
                  0,
                  item.qty - availableAcquisitions(current, key).home,
                ) +
                Math.max(
                  0,
                  (committedPurchases(current)[key] || 0) -
                    (current.pantry?.[key] || 0),
                ),
            };
        }
      }
      if (group === "prep" && !value)
        delete state.current.progress.ready[key.slice(0, key.lastIndexOf(":"))];
    },
    progressReset: (state) => {
      if (!state.current) return;
      state.current.progress = freshProgress();
      state.current.timer = null;
      state.current.timers = [];
    },
    initialized: (
      _state,
      action: PayloadAction<{ current: State; defaults: Plan }>,
    ) => action.payload,
    stateChanged: (state, action: PayloadAction<State>) => {
      state.current = action.payload;
    },
  },
});
export const { initialized, stateChanged, progressToggled, progressReset } =
  plannerSlice.actions;
export default plannerSlice.reducer;
