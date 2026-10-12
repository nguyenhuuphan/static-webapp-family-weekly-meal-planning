export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;
export type Day = (typeof DAYS)[number];
export type Unit = "g" | "ml" | "each" | "tsp" | "tbsp";
export type Ingredient = {
  name: string;
  qty: number;
  unit: Unit;
  category: string;
};
export type Step = {
  text: string;
  minutes: number;
  storage?: string;
  label?: string;
};
export type Meal = {
  id: string;
  day: Day;
  type: "Lunch" | "Dinner";
  main: string;
  side: string;
  minutes: number;
  ingredients: Ingredient[];
  prep: Step[];
  steps: Step[];
  storage: string;
  thaw: string;
};
export type Plan = {
  schemaVersion: 1;
  name: string;
  servings: number;
  meals: Meal[];
};
export type Progress = {
  shopping: Record<string, boolean>;
  owned: Record<string, boolean>;
  prep: Record<string, boolean>;
  ready: Record<string, boolean>;
  done: Record<string, boolean>;
  cook: Record<string, number>;
};
export type Timer = {
  mealId: string;
  step: number;
  end: number;
  paused?: number;
} | null;
export type State = {
  pantry?: Record<string, number>;
  plan: Plan;
  servings: number;
  weekStart: string;
  progress: Progress;
  timer: Timer;
  timers?: NonNullable<Timer>[];
};
export type View = "week" | "shop" | "prep" | "cook" | "settings" | "safety";
