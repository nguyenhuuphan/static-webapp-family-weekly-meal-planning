import original from "../../public/meal-plan.json";
import type { Meal } from "src/types";

export function movedFromOriginal(meal: Meal) {
  const baseline = original.meals.find(
    (m) => m.id === (meal.recipeId || meal.id),
  );
  return (
    !!baseline && (baseline.day !== meal.day || baseline.type !== meal.type)
  );
}

/** Change container labels, never storage durations or dates in safety guidance. */
export function currentMealLabel(instruction: string, label: string) {
  return instruction
    .replace(/\b(?:MON|TUE|WED|THU|FRI) (?:LUNCH|DINNER)\b/g, label)
    .replace(/THỨ (?:HAI|BA|TƯ|NĂM|SÁU) (?:TRƯA|TỐI)/g, label);
}
