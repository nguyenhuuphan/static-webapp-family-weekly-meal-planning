import { uniqueSavedRecipes } from "../src/helpers/savedRecipes";
import { expect, it } from "vitest";
import { freshState, hydrateState, validatePlan } from "../src/domain";
import type { Plan } from "../src/types";
import data from "../public/meal-plan.json";
import {
  assignFood,
  changePortions,
  startWeek,
} from "../src/helpers/scheduling";
import {
  availableAcquisitions,
  shoppingRequirements,
} from "../src/helpers/shopping";
const plan = data as Plan;
const prepared = () => {
  const s = freshState(structuredClone(plan));
  const m = s.plan.meals[0];
  s.progress.prep[m.id + ":0"] = true;
  s.preparedTasks = {
    [m.id + ":0"]: { servings: 2, at: "2026-10-12T10:00:00Z" },
  };
  return s;
};

it("splits prepared portions without inventing completion or preparation dates", () => {
  const s = prepared(),
    id = s.plan.meals[0].id;
  const next = changePortions(s, id, 1);
  expect(next.savedFood).toHaveLength(1);
  expect(next.savedFood![0].servings).toBe(1);
  expect(next.savedFood![0].preparedTasks[0].at).toBe("2026-10-12T10:00:00Z");
  expect(next.savedFood![0].preparedTasks[1]).toBeUndefined();
  expect(next.preparedTasks![id + ":0"].servings).toBe(1);
  expect(next.progress.prep[id + ":0"]).toBe(true);
  const skipped = changePortions(next, id, 0);
  expect(skipped.savedFood!.reduce((n, f) => n + f.servings, 0)).toBe(2);
  expect(changePortions(skipped, id, 0).savedFood).toHaveLength(2);
});

it("carries physical food across weeks and keeps schedules and notes in backups", () => {
  const s = changePortions(prepared(), plan.meals[0].id, 0);
  Object.assign(s.savedFood![0], {
    date: "2026-10-20",
    type: "Dinner",
    status: "scheduled",
    storageNote: "Freezer, labelled",
  });
  const next = startWeek(s, "2026-10-19");
  expect(next.savedFood![0]).toEqual(s.savedFood![0]);
  expect(next.preparedTasks).toEqual({});
  expect(
    hydrateState(JSON.parse(JSON.stringify(next)), plan).savedFood,
  ).toEqual(next.savedFood);
});

it("replaces an unprepared meal, keeps displaced recipes and credits carried ingredients", () => {
  const s = startWeek(
    changePortions(prepared(), plan.meals[0].id, 0),
    "2026-10-19",
  );
  const destination = s.plan.meals[1];
  const next = assignFood(s, s.savedFood![0].id, destination.id);
  expect(next.plan.meals[1].main).toBe(plan.meals[0].main);
  expect(next.plan.meals[1].day).toBe(destination.day);
  expect(next.savedFood!.find((f) => f.kind === "recipe")!.meal.main).toBe(
    destination.main,
  );
  expect(next.progress.prep[destination.id + ":0"]).toBe(true);
  expect(next.progress.prep[destination.id + ":1"]).toBe(false);
  expect(next.preparedTasks![destination.id + ":0"].at).toBe(
    "2026-10-12T10:00:00Z",
  );
  expect(next.savedFood![0].status).toBe("assigned");
  expect(validatePlan(next.plan)).toEqual([]);
  const name = plan.meals[0].ingredients[0].name;
  const required =
    shoppingRequirements(next).find((i) => i.name === name)?.qty || 0;
  const withoutCredit =
    shoppingRequirements({ ...next, mealCredits: {} }).find(
      (i) => i.name === name,
    )?.qty || 0;
  expect(required).toBeLessThan(withoutCredit);
});

it("blocks replacement of prepared meals and insufficient portions", () => {
  const s = changePortions(prepared(), plan.meals[0].id, 1);
  expect(() => assignFood(s, s.savedFood![0].id, plan.meals[1].id)).toThrow();
  const target = changePortions(s, plan.meals[1].id, 1);
  target.progress.prep[plan.meals[1].id + ":0"] = true;
  expect(() =>
    assignFood(target, s.savedFood![0].id, plan.meals[1].id),
  ).toThrow();
});

it("includes scheduled weekend ingredients only in their corresponding week", () => {
  const s = prepared();
  s.weekStart = "2026-10-12";
  const next = changePortions(s, plan.meals[0].id, 0);
  const base = shoppingRequirements(next);
  Object.assign(next.savedFood![0], {
    date: "2026-10-18",
    type: "Dinner",
    status: "scheduled",
  });
  const weekend = shoppingRequirements(next);
  expect(
    weekend.some((i) => i.meals.some((id) => id.startsWith("saved-"))),
  ).toBe(true);
  next.savedFood![0].date = "2026-10-20";
  expect(shoppingRequirements(next)).toEqual(base);
});

it("rejects malformed physical food records rather than silently losing them", () => {
  const s = changePortions(prepared(), plan.meals[0].id, 0);
  s.savedFood![0].preparedTasks[0].servings = -1;
  expect(() => hydrateState(s, plan)).toThrow();
});

it("does not count food held aside as ingredients available for a restored meal", () => {
  const initial = prepared();
  const ingredient = plan.meals[0].ingredients[0];
  const key = ingredient.name + "|" + ingredient.unit;
  initial.purchased = { [key]: { ...ingredient, qty: ingredient.qty } };
  const cancelled = changePortions(initial, plan.meals[0].id, 0);
  const restored = changePortions(cancelled, plan.meals[0].id, 2);
  expect(availableAcquisitions(restored, key).purchased).toBe(0);
  expect(restored.progress.shopping[key]).toBe(false);
  expect(restored.savedFood![0].servings).toBe(2);
  const fromPantry = {
    ...restored,
    purchased: {},
    pantry: { [key]: ingredient.qty },
  };
  expect(availableAcquisitions(fromPantry, key).home).toBe(0);
});

it("does not create a displaced duplicate when restoring the same recipe", () => {
  const s = startWeek(
    changePortions(prepared(), plan.meals[0].id, 0),
    "2026-10-19",
  );
  const next = assignFood(s, s.savedFood![0].id, plan.meals[0].id);
  expect(next.savedFood).toHaveLength(1);
  expect(next.savedFood![0].status).toBe("assigned");
});

it("cleans duplicate suggestions without merging physical batches", () => {
  const s = changePortions(prepared(), plan.meals[0].id, 0);
  const food = s.savedFood![0];
  s.savedFood!.push(
    { ...structuredClone(food), id: "second-batch" },
    {
      ...structuredClone(food),
      id: "duplicate-recipe",
      kind: "recipe",
      preparedTasks: {},
    },
  );
  const cleaned = uniqueSavedRecipes(s);
  expect(cleaned.savedFood!.filter((f) => f.status === "pending")).toHaveLength(
    2,
  );
  expect(cleaned.savedFood![2].status).toBe("discarded");
  expect(cleaned.savedFood![0]).toEqual(food);
});
