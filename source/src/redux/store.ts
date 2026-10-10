import { configureStore } from "@reduxjs/toolkit";
import planner from "./plannerSlice";
export const createPlannerStore = () =>
  configureStore({ reducer: { planner } });
export type PlannerStore = ReturnType<typeof createPlannerStore>;
export type IRootState = ReturnType<PlannerStore["getState"]>;
export type AppDispatch = PlannerStore["dispatch"];
