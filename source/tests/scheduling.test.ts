import { expect, it } from "vitest";
import data from "../public/meal-plan.json";
import type { Plan } from "../src/types";
import { freshState, aggregate, validatePlan } from "../src/domain";
import { changePortions, swapSchedule } from "../src/helpers/scheduling";

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

it("scales a single meal and preserves purchased quantities after reducing diners", () => {
  const s = freshState(structuredClone(data) as Plan);
  const meal = s.plan.meals[0];
  const before = aggregate(s.plan, s.servings);
  const item = before.find((i) => meal.ingredients.some((raw) => raw.name === i.name))!;
  const key = item.name + "|" + item.unit;
  s.progress.shopping[key] = true;
  const next = changePortions(s, meal.id, 1);
  expect(next.mealServings?.[meal.id]).toBe(1);
  expect(next.purchased?.[key].qty).toBe(item.qty);
  expect(aggregate(next.plan, next.servings, next.mealServings).find((i) => i.name === item.name)!.qty).toBeLessThan(item.qty);
  expect(next.progress.shopping[key]).toBe(true);
  expect(s.mealServings).toBeUndefined();
  expect(() => changePortions(s, meal.id, 3)).toThrow();
});
it("keeps attendance at the original calendar slots when swapping recipes", () => {
  const s = freshState(structuredClone(data) as Plan);
  const [a, b] = s.plan.meals;
  const next = swapSchedule(changePortions(s, a.id, 1), a.id, b.id);
  expect(next.mealServings?.[a.id]).toBe(2);
  expect(next.mealServings?.[b.id]).toBe(1);
});
