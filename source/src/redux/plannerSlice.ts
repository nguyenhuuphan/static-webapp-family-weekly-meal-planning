import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { State, Plan } from "src/types";
interface PlannerState {
  current: State | null;
  defaults: Plan | null;
}
const initialState: PlannerState = { current: null, defaults: null };
// Redux holds confirmed API state and the offline read cache; business mutations run on the server.
const slice = createSlice({
  name: "planner",
  initialState,
  reducers: {
    initialized: (
      _state,
      action: PayloadAction<{ current: State; defaults: Plan }>,
    ) => action.payload,
    stateChanged: (state, action: PayloadAction<State>) => {
      state.current = action.payload;
    },
  },
});
export const { initialized, stateChanged } = slice.actions;
export default slice.reducer;
