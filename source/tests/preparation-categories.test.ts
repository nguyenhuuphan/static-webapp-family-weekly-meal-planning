import { expect, it } from "vitest";
import original from "../public/meal-plan.json";
import type { Meal, Plan } from "../src/types";
import { freshState, hydrateState } from "../src/helpers";
import {
  groupPreparation,
  recipePreparationCards,
  isCookingPreparation,
  cookingPreparations,
} from "../src/helpers/preparation";
import { preparationParts } from "../src/helpers/preparationParts";
import {
  setPreparationProgress,
  preparationChecked,
} from "../src/helpers/preparationProgress";
import { isPrepared } from "../src/utils";
const make = () => {
  const plan = structuredClone(original as Plan);
  const meal = plan.meals[0];
  meal.main = "Chicken with vegetables";
  meal.ingredients = [
    {
      id: "chicken",
      name: "Chicken thigh, boneless",
      category: "Protein",
      qty: 300,
      unit: "g",
    },
    {
      id: "broccoli",
      name: "Broccoli, trimmed",
      category: "Produce",
      qty: 250,
      unit: "g",
    },
    { id: "ginger", name: "Ginger", category: "Produce", qty: 15, unit: "g" },
    { id: "rice", name: "White rice", category: "Pantry", qty: 150, unit: "g" },
    { id: "salt", name: "Salt", category: "Pantry", qty: 0.5, unit: "tsp" },
  ];
  meal.prep = [
    {
      text: "Rinse [150 g] white rice and cook in the rice cooker. Label MON LUNCH — RICE.",
      minutes: 15,
    },
    {
      text: "Slice [15 g] ginger. Cut [300 g] chicken into pieces and season with [0.5 tsp] salt.",
      minutes: 4,
    },
    { text: "Cut [250 g] broccoli into florets.", minutes: 3 },
  ];
  plan.schemaVersion = 2;
  plan.meals = [meal];
  plan.translations = {
    vi: {
      [meal.prep[0].text]:
        "Vo [150 g] gạo và nấu bằng nồi cơm điện. Ghi nhãn THỨ HAI TRƯA — CƠM.",
      [meal.prep[1].text]:
        "Cắt lát [15 g] gừng. Cắt [300 g] thịt gà thành miếng và ướp với [0.5 tsp] muối.",
      [meal.prep[2].text]: "Cắt [250 g] súp lơ xanh thành nhánh.",
    },
  };
  return plan;
};
it("separates actual vegetable and protein actions, preserving bilingual quantities and the original recipe", () => {
  const plan = make(),
    before = JSON.stringify(plan);
  const groups = recipePreparationCards(groupPreparation(plan, 2)).filter(
    (g) => g.category !== "Cooking",
  );
  expect(groups.map((g) => g.category)).toEqual(["Produce", "Protein"]);
  const vegetables = groups.find((g) => g.category === "Produce")!,
    protein = groups.find((g) => g.category === "Protein")!;
  expect(
    vegetables.allocations.map((a) => a.displayText || a.task.text).join(" "),
  ).not.toContain("Cut [300 g] chicken");
  expect(protein.allocations[0].displayText).toContain("Cut [300 g] chicken");
  expect(protein.allocations[0].displayVi).toContain("Cắt [300 g] thịt gà");
  expect(vegetables.displayIngredients).toContain("Broccoli, trimmed");
  expect(vegetables.displayIngredients).not.toContain(
    "Chicken thigh, boneless",
  );
  expect(vegetables.allocations[0].displayVi).toContain("[15 g] gừng");
  expect(JSON.stringify(plan)).toBe(before);
});
it("keeps rice at mealtime and does not require its preparation checkbox to cook", () => {
  const plan = make(),
    meal = plan.meals[0],
    s = freshState(plan);
  expect(isCookingPreparation(meal, 0)).toBe(true);
  expect(isCookingPreparation(meal, 1)).toBe(false);
  setPreparationProgress(s, "mon-lunch:1", true);
  setPreparationProgress(s, "mon-lunch:2", true);
  expect(isPrepared(s, meal)).toBe(true);
  expect(s.progress.prep["mon-lunch:0"]).toBeUndefined();
  const rice = cookingPreparations(meal, plan.translations?.vi);
  expect(rice).toHaveLength(1);
  expect(rice[0].text).toContain("cook in the rice cooker");
  expect(rice[0].text).not.toContain("Label");
  expect(rice[0].vi).not.toContain("Ghi nhãn");
});
it("tracks split actions independently, migrates old completion and restores partial progress after reload", () => {
  const plan = make(),
    s = freshState(plan);
  setPreparationProgress(s, "mon-lunch:1::Produce", true);
  expect(preparationChecked(s, "mon-lunch:1::Produce")).toBe(true);
  expect(preparationChecked(s, "mon-lunch:1::Protein")).toBe(false);
  expect(s.progress.prep["mon-lunch:1"]).toBe(false);
  expect(s.preparedTasks?.["mon-lunch:1"]).toBeUndefined();
  const restored = hydrateState(
    JSON.parse(JSON.stringify(s)),
    original as Plan,
  );
  setPreparationProgress(restored, "mon-lunch:1::Protein", true);
  expect(restored.progress.prep["mon-lunch:1"]).toBe(true);
  expect(restored.preparedTasks?.["mon-lunch:1"]?.servings).toBe(2);
  delete restored.progress.prep["mon-lunch:1::Produce"];
  delete restored.progress.prep["mon-lunch:1::Protein"];
  expect(preparationChecked(restored, "mon-lunch:1::Produce")).toBe(true);
  setPreparationProgress(restored, "mon-lunch:1::Produce", false);
  expect(preparationChecked(restored, "mon-lunch:1::Protein")).toBe(true);
  expect(restored.progress.prep["mon-lunch:1"]).toBe(false);
});
it("keeps rice vinegar and marinade seasonings out of the rice/vegetable cooking split", () => {
  const meal = make().meals[0];
  meal.ingredients.push({
    id: "vinegar",
    name: "Rice vinegar",
    category: "Pantry",
    qty: 1,
    unit: "tsp",
  });
  const task = {
    text: "Cut [300 g] chicken into pieces. Mix with [15 g] ginger and [1 tsp] rice vinegar.",
    minutes: 3,
  };
  expect(preparationParts(meal, task).map((p) => p.category)).toEqual([
    "Protein",
  ]);
});
it("keeps raw-meat storage out of vegetable preparation without inventing replacement storage", async () => {
  const { categoryStorageText } =
    await import("../src/helpers/preparationParts");
  const meal = make().meals[0];
  const guidance =
    "Keep raw chicken sealed below 4°C. Refrigerate prepared vegetables in airtight containers.";
  expect(categoryStorageText(meal, "Produce", guidance)).toBe(
    "Refrigerate prepared vegetables in airtight containers.",
  );
  expect(categoryStorageText(meal, "Protein", guidance)).toBe(
    "Keep raw chicken sealed below 4°C.",
  );
  expect(
    categoryStorageText(
      meal,
      "Produce",
      "Store chicken and vegetables refrigerated.",
    ),
  ).toBe("");
});
