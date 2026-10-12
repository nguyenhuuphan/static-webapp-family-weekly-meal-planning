import { it, expect } from "vitest";
import { freshState, plan } from "./uxSupport";
import { replaceMeal } from "../src/domain";
it("invalidates changed ingredient quantities while preserving unrelated shopping and pantry checks", () => {
  const state = freshState(structuredClone(plan));
  state.progress.shopping["Shrimp, peeled|g"] = true;
  state.progress.shopping["Beef, stir-fry cut|g"] = true;
  state.progress.owned["Beef, stir-fry cut|g"] = true;
  const meal = structuredClone(state.plan.meals[0]);
  meal.ingredients.find((item) => item.name === "Shrimp, peeled")!.qty += 100;
  const next = replaceMeal(state, meal.id, meal);
  expect(next.progress.shopping["Shrimp, peeled|g"]).toBeUndefined();
  expect(next.progress.shopping["Beef, stir-fry cut|g"]).toBe(true);
  expect(next.progress.owned["Beef, stir-fry cut|g"]).toBe(true);
});
