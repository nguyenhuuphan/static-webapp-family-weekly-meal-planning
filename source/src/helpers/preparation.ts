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
  key: string;
  meal: Meal;
  task: Step;
  taskIndex: number;
  quantity: number | null;
};
export type PrepGroup = {
  key: string;
  ingredient: string | null;
  operation: PrepOperation;
  quantity: number | null;
  unit: Unit | null;
  category: string;
  allocations: PrepAllocation[];
};

export function isCookingPreparation(meal: Meal, taskIndex: number): boolean {
  return (
    profiles[meal.id]?.[taskIndex]?.operation === "prepareSauces" &&
    original.meals.find((item) => item.id === meal.id)?.prep[taskIndex]
      ?.text === meal.prep[taskIndex]?.text
  );
}

export function groupPreparation(plan: Plan, servings: number): PrepGroup[] {
  const groups = new Map<string, PrepGroup>();
  const factor = servings / plan.servings;
  for (const meal of plan.meals) {
    meal.prep.forEach((task, taskIndex) => {
      const baseline = original.meals.find((item) => item.id === meal.id);
      const candidate = profiles[meal.id]?.[taskIndex];
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
      group.allocations.push({ key: taskKey, meal, task, taskIndex, quantity });
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
