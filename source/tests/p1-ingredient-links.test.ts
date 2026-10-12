import { expect, it } from "vitest";
import data from "../public/meal-plan.json";
import { freshState, hydrateState, validatePlan } from "../src/domain";
import type { Plan } from "../src/types";
import { changePortions } from "../src/helpers/scheduling";
import { savedFoodCredits } from "../src/helpers/shopping";

it("credits explicitly linked ingredients in customized and mixed preparation tasks", () => {
  const s = freshState(structuredClone(data) as Plan),
    meal = s.plan.meals[0];
  meal.main = "Custom recipe";
  meal.ingredients = [
    {
      id: "protein",
      name: "Custom protein",
      qty: 120,
      unit: "g",
      category: "Protein",
    },
    {
      id: "sauce",
      name: "Custom sauce",
      qty: 6,
      unit: "tsp",
      category: "Pantry",
    },
  ];
  meal.prep = [
    {
      text: "Prepare protein and sauce",
      minutes: 0,
      ingredients: [
        { ingredientId: "protein", qty: 120 },
        { ingredientId: "sauce", qty: 4 },
      ],
    },
    {
      text: "Portion remaining sauce",
      minutes: 0,
      ingredients: [{ ingredientId: "sauce", qty: 2 }],
    },
  ];
  s.progress.prep[meal.id + ":0"] = true;
  s.progress.prep[meal.id + ":1"] = true;
  const next = changePortions(s, meal.id, 1);
  const credits = savedFoodCredits(next.savedFood![0], 1);
  expect(credits.find((i) => i.id === "protein")?.qty).toBe(60);
  expect(credits.find((i) => i.id === "sauce")?.qty).toBe(3);
  expect(validatePlan(s.plan)).toEqual([]);
  meal.prep[1].ingredients![0].qty = 3;
  expect(validatePlan(s.plan)).toContain(
    "Prepared allocations exceed the recipe ingredient quantity.",
  );
});

it("migrates known legacy recipes but leaves unknown instructions for confirmation", () => {
  const s = freshState(structuredClone(data) as Plan);
  s.plan.meals.forEach((m) => {
    m.ingredients.forEach((i) => delete i.id);
    m.prep.forEach((p) => delete p.ingredients);
  });
  s.plan.meals[1].prep[0].text = "A newly imported preparation instruction";
  const restored = hydrateState(s, data as Plan);
  expect(restored.plan.meals[0].prep[0].ingredients?.length).toBeGreaterThan(0);
  expect(restored.plan.meals[1].prep[0].ingredients).toBeUndefined();
  expect(restored.plan.meals[0].ingredients.every((i) => !!i.id)).toBe(true);
});
