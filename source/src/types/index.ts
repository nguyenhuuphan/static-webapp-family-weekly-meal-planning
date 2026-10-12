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
  id?: string;
  name: string;
  qty: number;
  unit: Unit;
  category: string;
};
export type Step = {
  ingredients?: { ingredientId: string; qty: number }[];
  text: string;
  minutes: number;
  storage?: string;
  label?: string;
};
export type Meal = {
  recipeId?: string;
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
  weekArchive?: Record<
    string,
    {
      plan: Plan;
      servings: number;
      mealServings?: Record<string, number>;
      done: Record<string, boolean>;
    }
  >;
  mealCreditSources?: Record<
    string,
    { week: string; ingredients: Ingredient[]; accounted?: boolean }[]
  >;
  mealAllocatedPortions?: Record<string, number>;
  mealStorage?: Record<string, FoodStorage>;
  stockUses?: Record<string, StockUse>;
  stockHistory?: {
    weekStart: string;
    purchased: State["purchased"];
    uses: Record<string, StockUse>;
    checkedAt: string;
  }[];
  lastMealServings?: Record<string, number>;
  mealCredits?: Record<string, Ingredient[]>;
  mealCreditWeeks?: Record<string, string>;
  preparedTasks?: Record<string, { servings: number; at: string }>;
  savedFood?: SavedFood[];
  mealServings?: Record<string, number>;
  purchased?: Record<
    string,
    { name: string; unit: string; category: string; qty: number }
  >;
  pantry?: Record<string, number>;
  plan: Plan;
  servings: number;
  weekStart: string;
  progress: Progress;
  timer: Timer;
  timers?: NonNullable<Timer>[];
};
export type StockUse = {
  home: Record<string, number>;
  purchased: Record<string, number>;
  ingredients: Ingredient[];
};
export type SavedFood = {
  creditSources?: {
    week: string;
    ingredients: Ingredient[];
    accounted?: boolean;
  }[];
  storage?: FoodStorage;
  sourceWeek?: string;
  id: string;
  kind: "prepared" | "recipe";
  meal: Meal;
  baseServings: number;
  servings: number;
  preparedTasks: Record<string, { servings: number; at: string }>;
  storageNote: string;
  date?: string;
  type?: "Lunch" | "Dinner";
  status: "pending" | "scheduled" | "used" | "discarded" | "assigned";
};
export type FoodStorage = {
  stage: "unknown" | "raw" | "cooked";
  place: "unknown" | "fridge" | "freezer" | "room";
  events: {
    type: "prepared" | "frozen" | "thawing" | "thawed" | "cooked" | "checked";
    at: string;
    stage: FoodStorage["stage"];
    place: FoodStorage["place"];
  }[];
};
export type View = "week" | "shop" | "prep" | "cook" | "settings" | "safety";
