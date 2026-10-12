import { DAYS, type Plan, type Meal } from "src/types";
export function validatePreparationLinks(meal: Meal): string[] {
  const errors: string[] = [],
    allocated = new Map<string, number>(),
    ids = new Set<string>();
  for (const i of Array.isArray(meal.ingredients) ? meal.ingredients : [])
    if (i?.id !== undefined) {
      if (typeof i.id !== "string" || !i.id || ids.has(i.id))
        errors.push("Ingredient IDs must be unique.");
      ids.add(i.id);
    }
  for (const task of Array.isArray(meal.prep) ? meal.prep : []) {
    if (task?.ingredients === undefined) continue;
    if (!Array.isArray(task.ingredients)) {
      errors.push("Invalid preparation ingredient links.");
      continue;
    }
    const seen = new Set<string>();
    for (const ref of task.ingredients) {
      const item = meal.ingredients?.find((i) => i?.id === ref?.ingredientId);
      if (
        !ref ||
        !item ||
        !Number.isFinite(ref.qty) ||
        ref.qty <= 0 ||
        seen.has(ref.ingredientId)
      )
        errors.push("Invalid preparation ingredient allocation.");
      else
        allocated.set(
          ref.ingredientId,
          (allocated.get(ref.ingredientId) || 0) + ref.qty,
        );
      seen.add(ref?.ingredientId);
    }
  }
  for (const i of Array.isArray(meal.ingredients) ? meal.ingredients : [])
    if (i && (allocated.get(i.id || "") || 0) > i.qty + 0.000001)
      errors.push(
        "Prepared allocations exceed the recipe ingredient quantity.",
      );
  return errors;
}
export function validatePlan(p: unknown): string[] {
  const errors: string[] = [];
  const v = p as Plan;
  if (!v || v.schemaVersion !== 1) return ["Expected schemaVersion: 1."];
  if (!Number.isInteger(v.servings) || v.servings < 1 || v.servings > 12)
    errors.push("Base servings must be a whole number from 1 to 12.");
  if (!Array.isArray(v.meals) || v.meals.length !== 10)
    return [...errors, "Exactly ten meals are required."];
  const ids = new Set(),
    slots = new Set();
  for (const m of v.meals) {
    if (m) errors.push(...validatePreparationLinks(m));
    if (
      !m ||
      typeof m.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(m.id) ||
      ids.has(m.id)
    )
      errors.push("Meal IDs must be unique, using letters, numbers, _ or -.");
    ids.add(m?.id);
    const slot = m?.day + "|" + m?.type;
    if (
      !DAYS.includes(m?.day) ||
      !["Lunch", "Dinner"].includes(m?.type) ||
      slots.has(slot)
    )
      errors.push("Use each Monday–Friday lunch/dinner slot exactly once.");
    slots.add(slot);
    for (const k of ["main", "side", "storage", "thaw"] as const)
      if (typeof m?.[k] !== "string" || !m[k].trim())
        errors.push(`${m?.id}: ${k} is required.`);
    if (!Number.isFinite(m?.minutes) || m.minutes < 1 || m.minutes > 240)
      errors.push(`${m?.id}: cooking estimate must be 1–240 minutes.`);
    if (
      !Array.isArray(m?.ingredients) ||
      !m.ingredients.length ||
      m.ingredients.length > 100
    )
      errors.push(`${m?.id}: provide 1–100 ingredients.`);
    else
      for (const i of m.ingredients)
        if (
          !i ||
          typeof i.name !== "string" ||
          !i.name.trim() ||
          !["g", "ml", "each", "tsp", "tbsp"].includes(i.unit) ||
          !Number.isFinite(i.qty) ||
          i.qty <= 0 ||
          typeof i.category !== "string" ||
          !i.category.trim()
        )
          errors.push(`${m.id}: invalid ingredient.`);
    for (const k of ["prep", "steps"] as const)
      if (
        !Array.isArray(m?.[k]) ||
        !m[k].length ||
        m[k].length > 100 ||
        m[k].some(
          (s) =>
            !s ||
            typeof s.text !== "string" ||
            (s.storage !== undefined && typeof s.storage !== "string") ||
            (s.label !== undefined && typeof s.label !== "string") ||
            !s.text.trim() ||
            !Number.isFinite(s.minutes) ||
            s.minutes < 0 ||
            s.minutes > 240,
        )
      )
        errors.push(
          `${m?.id}: ${k} needs 1–100 steps with text and valid minutes.`,
        );
  }
  return [...new Set(errors)];
}
export function parseBackup(raw: unknown): { plan: Plan; servings: number } {
  const v = raw as { plan?: Plan; servings?: number };
  const plan = v?.plan || (raw as Plan);
  const errors = validatePlan(plan);
  if (errors.length) throw Error(errors.join("\n"));
  const servings = v.plan ? (v.servings ?? plan.servings) : plan.servings;
  if (!Number.isInteger(servings) || servings < 1 || servings > 12)
    throw Error("Servings must be a whole number from 1 to 12.");
  return { plan, servings };
}
