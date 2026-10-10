import { createContext, useContext } from "react";
import type { usePlannerController } from "./usePlannerController";
export type PlannerModel = NonNullable<
  ReturnType<typeof usePlannerController>["model"]
>;
export const MealPlannerContext = createContext<PlannerModel | null>(null);
export function useMealPlanner() {
  const model = useContext(MealPlannerContext);
  if (!model) throw Error("MealPlannerContext is required.");
  return model;
}
