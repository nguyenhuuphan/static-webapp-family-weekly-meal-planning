import data from "../../public/meal-plan.json";
import type { Plan } from "src/types";
export const createMealPlanFixture = (): Plan => structuredClone(data as Plan);
