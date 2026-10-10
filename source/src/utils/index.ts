import { DAYS, type Plan, type Meal, type State, type Timer } from "src/types";
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const ingredientKey = (i: { name: string; unit: string }) =>
  i.name + "|" + i.unit;
export function defaultMonday() {
  const d = new Date();
  d.setDate(
    d.getDate() +
      (d.getDay() === 0 ? 1 : d.getDay() === 6 ? 2 : 1 - d.getDay()),
  );
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function isMonday(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T12:00:00").getDay() === 1
  );
}
export const dateLabel = (start: string, day: string) => {
  const d = new Date(start + "T12:00:00");
  d.setDate(d.getDate() + DAYS.indexOf(day as (typeof DAYS)[number]));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
export function aggregate(plan: Plan, servings: number) {
  const map = new Map<
    string,
    {
      name: string;
      qty: number;
      unit: string;
      category: string;
      meals: string[];
    }
  >();
  for (const m of plan.meals)
    for (const raw of m.ingredients) {
      const i =
        raw.unit === "tbsp" ? { ...raw, qty: raw.qty * 3, unit: "tsp" } : raw;
      const k = ingredientKey(i),
        a = map.get(k) || { ...i, qty: 0, meals: [] };
      a.qty = round(a.qty + (i.qty * servings) / plan.servings);
      a.meals.push(m.id);
      map.set(k, a);
    }
  return [...map.values()].sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}
export const scaleText = (t: string, f: number) =>
  t.replace(
    /\[([\d.]+) (g|ml|each|tsp|tbsp)\]/g,
    (_, n, u) => `${round(Number(n) * f)} ${u}`,
  );
export const isPrepared = (s: State, m: Meal) =>
  m.prep.every((_, i) => s.progress.prep[m.id + ":" + i]);
export const timerSeconds = (t: Timer, now = Date.now()) =>
  t ? Math.max(0, Math.ceil((t.end - now) / 1000)) : 0;
