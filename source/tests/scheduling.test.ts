import { expect, it } from "vitest";
import data from "../public/meal-plan.json";
import type { Plan } from "../src/types";
import { freshState, aggregate, validatePlan } from "../src/domain";
import { swapSchedule } from "../src/helpers/scheduling";

it("swaps calendar slots while retaining preparation, purchases and timers", () => {
  const s = freshState(structuredClone(data) as Plan);
  const [a, b] = s.plan.meals;
  s.progress.prep[a.id + ":0"] = true;
  s.progress.ready[a.id] = true;
  s.timer = { mealId: a.id, step: 0, end: 12345 };
  const next = swapSchedule(s, a.id, b.id);
  expect(next.plan.meals[0].type).toBe(b.type);
  expect(next.progress.prep[a.id + ":0"]).toBe(true);
  expect(next.progress.ready[a.id]).toBeUndefined();
  expect(next.timer).toEqual(s.timer);
  expect(aggregate(next.plan, next.servings)).toEqual(
    aggregate(s.plan, s.servings),
  );
  expect(validatePlan(next.plan)).toEqual([]);
  s.progress.done[b.id] = true;
  expect(() => swapSchedule(s, a.id, b.id)).toThrow();
});
