import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { State, Plan, Progress } from "src/types";
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
      if (group === "prep" && !value)
        delete state.current.progress.ready[key.slice(0, key.lastIndexOf(":"))];
    },
    progressReset: (state) => {
      if (!state.current) return;
      state.current.progress = freshProgress();
      state.current.timer = null;
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
