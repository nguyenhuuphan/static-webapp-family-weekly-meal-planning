import {
  preparationParts,
  preparationPartKey,
  preparationPartIngredients,
} from "./preparationParts";
import original from "../../public/meal-plan.json";
import type { Meal, Plan, Step, Unit } from "src/types";

export type PrepOperation =
  | "sliceThin"
  | "cutChicken"
  | "portionShrimp"
  | "portionGroundPork"
  | "portionFish"
  | "sliceMelon"
  | "washGreens"
  | "blanchGreens"
  | "sliceCabbage"
  | "shredCabbage"
  | "slicePumpkin"
  | "sliceChayote"
  | "trimBeans"
  | "cutTomato"
  | "sliceAromatics"
  | "keepEggs"
  | "prepareSauces"
  | "cookJustInTime"
  | "prepareMixed"
  | "reviewIndividually";

type Profile = { ingredient?: string; operation: PrepOperation };
const ingredient = (name: string, operation: PrepOperation): Profile => ({
  ingredient: name,
  operation,
});
const sauces: Profile = { operation: "prepareSauces" };
const mixed: Profile = { operation: "prepareMixed" };

// Reviewed compatibility profiles, independent of UI language. Match the original
// instruction AND ingredient quantity before applying a profile to imported data.
// Unknown/edited instructions remain separate rather than guessing from prose.
const profiles: Record<string, Profile[]> = {
  "mon-lunch": [
    ingredient("Pork shoulder, boneless", "sliceThin"),
    ingredient("Shrimp, peeled", "portionShrimp"),
    ingredient("Winter melon, peeled", "sliceMelon"),
    sauces,
  ],
  "mon-dinner": [
    ingredient("Basa fillet", "portionFish"),
    sauces,
    ingredient("Water spinach, trimmed", "washGreens"),
  ],
  "tue-lunch": [
    ingredient("Chicken thigh, boneless", "cutChicken"),
    ingredient("Mustard greens, trimmed", "blanchGreens"),
    mixed,
  ],
  "tue-dinner": [
    ingredient("Beef, stir-fry cut", "sliceThin"),
    mixed,
    sauces,
    sauces,
  ],
  "wed-lunch": [
    ingredient("Shrimp, peeled", "portionShrimp"),
    sauces,
    ingredient("Malabar spinach, trimmed", "blanchGreens"),
  ],
  "wed-dinner": [
    ingredient("Ground pork", "portionGroundPork"),
    ingredient("Eggs", "keepEggs"),
    ingredient("Cabbage, trimmed", "sliceCabbage"),
    ingredient("Spring onion", "sliceAromatics"),
  ],
  "thu-lunch": [
    ingredient("Tilapia fillet", "portionFish"),
    sauces,
    ingredient("Pumpkin, peeled and deseeded", "slicePumpkin"),
  ],
  "thu-dinner": [
    ingredient("Pork shoulder, boneless", "sliceThin"),
    ingredient("Chayote, peeled", "sliceChayote"),
  ],
  "fri-lunch": [
    ingredient("Chicken thigh, boneless", "cutChicken"),
    ingredient("Ground pork", "portionGroundPork"),
    ingredient("Cabbage, trimmed", "shredCabbage"),
    sauces,
  ],
  "fri-dinner": [
    ingredient("Beef, stir-fry cut", "sliceThin"),
    ingredient("Green beans, trimmed", "trimBeans"),
    ingredient("Tomato", "cutTomato"),
    mixed,
  ],
};

export type PrepAllocation = {
  displayIngredients?: string[];
  displayText?: string;
  displayVi?: string;
  baselineStorage: boolean;
  key: string;
  meal: Meal;
  task: Step;
  taskIndex: number;
  quantity: number | null;
};
export type PrepGroup = {
  displayIngredients?: string[];
  key: string;
  ingredient: string | null;
  operation: PrepOperation;
  quantity: number | null;
  unit: Unit | null;
  category: string;
  allocations: PrepAllocation[];
};

function isProfileCooking(meal: Meal, taskIndex: number) {
  return (
    profiles[meal.recipeId || meal.id]?.[taskIndex]?.operation ===
      "prepareSauces" &&
    original.meals.find((item) => item.id === (meal.recipeId || meal.id))?.prep[
      taskIndex
    ]?.text === meal.prep[taskIndex]?.text
  );
}
export function isCookingPreparation(meal: Meal, taskIndex: number): boolean {
  const recipe = meal.recipeId || meal.id;
  const profile = profiles[recipe]?.[taskIndex];
  if (
    profile &&
    original.meals.find((item) => item.id === recipe)?.prep[taskIndex]?.text ===
      meal.prep[taskIndex]?.text
  )
    return profile.operation === "prepareSauces";
  return preparationParts(meal, meal.prep[taskIndex]).every(
    (part) => part.category === "Cooking",
  );
}
export function cookingPreparations(
  meal: Meal,
  vi: Record<string, string> = {},
) {
  return meal.prep.flatMap((task, index) =>
    isProfileCooking(meal, index)
      ? [{ text: task.text, vi: vi[task.text], rice: false }]
      : preparationParts(meal, task, vi)
          .filter((part) => part.category === "Cooking")
          .map((part) => ({
            text: part.text
              .replace(
                /(?:^|(?<=[.!?])\s+)(?:Label|Ghi nhãn|Dán nhãn)[^.]*[.!?]?/giu,
                "",
              )
              .trim(),
            vi: part.vi
              ?.replace(
                /(?:^|(?<=[.!?])\s+)(?:Label|Ghi nhãn|Dán nhãn)[^.]*[.!?]?/giu,
                "",
              )
              .trim(),
            rice: true,
          })),
  );
}

export function groupPreparation(
  plan: Plan,
  servings: number,
  portions: Record<string, number> = {},
): PrepGroup[] {
  const groups = new Map<string, PrepGroup>();
  for (const meal of plan.meals) {
    const count = portions[meal.id] ?? servings;
    if (!count) continue;
    const factor = count / plan.servings;
    meal.prep.forEach((task, taskIndex) => {
      const baseline = original.meals.find(
        (item) => item.id === (meal.recipeId || meal.id),
      );
      const candidate = profiles[meal.recipeId || meal.id]?.[taskIndex];
      const currentIngredient = candidate?.ingredient
        ? meal.ingredients.find((item) => item.name === candidate.ingredient)
        : undefined;
      const originalIngredient = candidate?.ingredient
        ? baseline?.ingredients.find(
            (item) => item.name === candidate.ingredient,
          )
        : undefined;
      const matches =
        baseline?.prep[taskIndex]?.text === task.text &&
        (!candidate?.ingredient ||
          (currentIngredient &&
            originalIngredient &&
            currentIngredient.qty === originalIngredient.qty &&
            currentIngredient.unit === originalIngredient.unit));
      const profile = matches ? candidate : undefined;
      if (!profile || profile.operation === "prepareMixed") {
        const parts = preparationParts(meal, task, plan.translations?.vi);
        const advanceParts = parts.filter(
          (part) => part.category !== "Cooking",
        );
        for (const part of parts) {
          const sourceKey = `${meal.id}:${taskIndex}`;
          const key =
            part.category === "Cooking" || advanceParts.length > 1
              ? preparationPartKey(sourceKey, part.category)
              : sourceKey;
          const operation: PrepOperation =
            part.category === "Cooking"
              ? "cookJustInTime"
              : "reviewIndividually";
          groups.set(`individual:${key}`, {
            key: `individual:${key}`,
            ingredient: null,
            displayIngredients: preparationPartIngredients(
              meal,
              part.category,
              part.text,
              plan.translations?.vi,
            ),
            operation,
            quantity: null,
            unit: null,
            category: part.category,
            allocations: [
              {
                key,
                meal,
                task,
                taskIndex,
                quantity: null,
                displayIngredients: preparationPartIngredients(
                  meal,
                  part.category,
                  part.text,
                  plan.translations?.vi,
                ),
                baselineStorage: meal.storage === baseline?.storage,
                ...(parts.length > 1
                  ? { displayText: part.text, displayVi: part.vi }
                  : {}),
              },
            ],
          });
        }
        return;
      }
      const name = profile?.ingredient || null;
      const operation = profile?.operation || "reviewIndividually";
      const measure = name ? currentIngredient!.unit : null;
      const quantity = name ? currentIngredient!.qty * factor : null;
      const taskKey = `${meal.id}:${taskIndex}`;
      const key =
        operation === "reviewIndividually"
          ? `individual:${taskKey}`
          : `${name || "shared"}|${operation}|${measure || ""}`;
      const group = groups.get(key) || {
        key,
        ingredient: name,
        operation,
        quantity: quantity === null ? null : 0,
        unit: measure,
        category: name
          ? currentIngredient!.category
          : operation === "prepareSauces"
            ? "Pantry"
            : "Other",
        allocations: [],
      };
      if (quantity !== null) group.quantity! += quantity;
      group.allocations.push({
        key: taskKey,
        meal,
        task,
        taskIndex,
        quantity,
        baselineStorage: meal.storage === baseline?.storage,
      });
      groups.set(key, group);
    });
  }
  // Vegetables first, then raw proteins, followed by individually measured sauces.
  // Preserve recipe order inside each category without sorting translated labels.
  const rank: Record<string, number> = {
    Produce: 0,
    Protein: 1,
    Pantry: 2,
    Other: 3,
  };
  return [...groups.values()].sort(
    (a, b) => (rank[a.category] ?? 2) - (rank[b.category] ?? 2),
  );
}

/** One visible card per unreviewed recipe, retaining every independent task key. */
export function recipePreparationCards(groups: PrepGroup[]): PrepGroup[] {
  const output: PrepGroup[] = [],
    recipes = new Map<string, PrepGroup>();
  for (const group of groups) {
    if (group.operation !== "reviewIndividually") {
      output.push(group);
      continue;
    }
    for (const allocation of group.allocations) {
      const recipeKey = `${allocation.meal.id}:${group.category}`;
      let recipe = recipes.get(recipeKey);
      if (!recipe) {
        recipe = {
          ...group,
          key: `recipe:${recipeKey}`,
          allocations: [],
        };
        recipes.set(recipeKey, recipe);
        output.push(recipe);
      }
      recipe.displayIngredients = [
        ...new Set([
          ...(recipe.displayIngredients || []),
          ...(group.displayIngredients || []),
        ]),
      ];
      recipe.allocations.push(allocation);
    }
  }
  return output;
}
