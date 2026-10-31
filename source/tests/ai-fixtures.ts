import original from "../public/meal-plan.json";
import type { MenuInput } from "../src/ai/contracts";
import type { Plan } from "../src/types";
export const aiInput: MenuInput = {
  weekStart: "2026-11-02",
  servings: 3,
  days: ["Saturday"],
  mealTypes: ["Breakfast"],
  cuisines: ["Vietnamese"],
  equipment: ["Gas stove"],
  diet: "Balanced",
  avoid: "",
  maxMinutes: 45,
  budget: "",
  pantry: "",
  customPrompt: "More vegetables",
};
export function aiOutput(input = aiInput) {
  const meals = input.days.flatMap((day) =>
    input.mealTypes.map((type) => ({
      ...structuredClone((original as Plan).meals[0]),
      id: `${day.slice(0, 3).toLowerCase()}-${type.toLowerCase()}`,
      day,
      type,
      equipment: [
        ...input.equipment.filter((e) => e !== "No heating appliance"),
      ],
    })),
  );
  const name = "A fresh family menu";
  const sources = [
    name,
    ...meals.flatMap((m) => [
      m.main,
      m.side,
      m.storage,
      m.thaw,
      ...m.ingredients.flatMap((i) => [i.name, i.category]),
      ...m.prep.map((s) => s.text),
      ...m.steps.map((s) => s.text),
    ]),
  ];
  return {
    name,
    meals,
    translations: [...new Set(sources)].map((source) => ({
      source,
      vi: "VI " + source,
    })),
  };
}
export function aiPlan(input = aiInput): Plan {
  const output = aiOutput(input);
  return {
    schemaVersion: 2,
    name: output.name,
    servings: input.servings,
    meals: output.meals,
    translations: {
      vi: Object.fromEntries(output.translations.map((t) => [t.source, t.vi])),
    },
  };
}
