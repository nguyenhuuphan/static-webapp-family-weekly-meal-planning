import type {
  State,
  Meal,
  Plan,
  Progress,
  SavedFood,
  FoodStorage,
  Ingredient,
} from "src/types";
import { freshProgress, hydrateState, replaceMeal } from "src/helpers";
import { uniqueSavedRecipes } from "src/helpers/savedRecipes";
import {
  startWeek,
  retainPrepared,
  changePortions,
  swapSchedule,
  assignFood,
  mergeFood,
} from "src/helpers/scheduling";
import {
  beginCooking,
  cancelCooking,
  finishCooking,
  completeMealQuickly,
  eatCookedFood,
  finishSavedFood,
  undoCooking,
} from "src/helpers/cooking";
import {
  updateHomeStock,
  recordPurchase,
  consumeMeal,
} from "src/helpers/inventory";
import {
  saveInvoice,
  validatePurchaseHistory,
  type ShoppingInvoice,
} from "src/helpers/purchaseHistory";
import { sourcePreparationKey } from "src/helpers/preparationParts";
import { setPreparationProgress } from "src/helpers/preparationProgress";
import { swapStateMeal } from "src/helpers/mealAlternatives";
import { applyGeneratedMenu } from "src/ai/apply";
import {
  shoppingRequirements,
  availableAcquisitions,
  committedPurchases,
  reconcileShopping,
} from "src/helpers/shopping";
import { ingredientKey, mealPortions } from "src/utils";
import { validateFoodStorage } from "src/helpers/foodStorage";
export const COMMANDS = [
  "progress.set",
  "prep.complete",
  "prep.restore",
  "meal.portions",
  "day.skip",
  "day.restore",
  "schedule.swap",
  "meal.replace",
  "alternative.swap",
  "purchase.record",
  "purchase.update",
  "invoice.save",
  "pantry.set",
  "household.servings",
  "week.start",
  "avoidance.add",
  "avoidance.remove",
  "storage.meal",
  "saved.patch",
  "saved.assign",
  "saved.merge",
  "saved.eat",
  "saved.finish",
  "cooking.begin",
  "cooking.cancel",
  "cooking.finish",
  "cooking.quick",
  "cooking.step",
  "timer.start",
  "timer.change",
  "menu.apply",
  "state.restore",
  "state.undo",
  "prep.links",
] as const;
export type CommandName = (typeof COMMANDS)[number];
export type PlannerCommand = { name: CommandName; args: Record<string, any> };
function str(value: unknown, max = 300): string {
  if (typeof value !== "string" || !value || value.length > max)
    throw Error("Invalid text value.");
  return value;
}
function num(value: unknown, min = 0, max = 1e6): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw Error("Invalid numeric value.");
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw Error("Invalid boolean value.");
  return value;
}
function meal(state: State, id: unknown) {
  const m = state.plan.meals.find((m) => m.id === str(id));
  if (!m) throw Error("Meal not found.");
  return m;
}
function toggle(
  state: State,
  group: Exclude<keyof Progress, "cook">,
  key: string,
  value: boolean,
) {
  if (!["shopping", "owned", "prep", "ready", "done"].includes(group))
    throw Error("Unknown progress group.");
  let next = structuredClone(state);
  if (group === "done") {
    if (!value) return undoCooking(next, key);
    next = consumeMeal(next, key);
    next.progress.done[key] = true;
    return reconcileShopping(next);
  }
  if (group === "prep") {
    setPreparationProgress(next, key, value);
    return next;
  }
  next.progress[group][key] = value;
  if (group === "shopping") {
    next.purchased ??= {};
    if (!value) delete next.purchased[key];
    else {
      const item = shoppingRequirements(next).find(
        (i) => ingredientKey(i) === key,
      );
      if (!item) throw Error("Ingredient not found.");
      next.purchased[key] = {
        ...item,
        qty:
          Math.max(0, item.qty - availableAcquisitions(next, key).home) +
          Math.max(
            0,
            (committedPurchases(next)[key] || 0) - (next.pantry?.[key] || 0),
          ),
      };
    }
  }
  return next;
}
export function executeCommand(
  state: State,
  command: PlannerCommand,
  defaults: Plan,
  undoState?: State,
): State {
  if (
    !COMMANDS.includes(command.name) ||
    !command.args ||
    typeof command.args !== "object" ||
    Array.isArray(command.args)
  )
    throw Error("Unknown command.");
  const a = command.args;
  let next: State;
  switch (command.name) {
    case "progress.set":
      next = toggle(state, a.group, str(a.key), bool(a.value));
      break;
    case "prep.complete": {
      if (!Array.isArray(a.keys) || a.keys.length > 200)
        throw Error("Invalid prep keys.");
      next = structuredClone(state);
      for (const key of a.keys)
        setPreparationProgress(next, str(key), bool(a.value));
      break;
    }
    case "prep.restore": {
      if (!a.before || !Array.isArray(a.touched))
        throw Error("Invalid preparation undo.");
      next = structuredClone(state);
      for (const key of a.touched) {
        str(key);
        next.progress.prep[key] = bool(a.before[key]);
      }
      next.preparedTasks ??= {};
      for (const source of new Set(
        (a.touched as string[]).map(sourcePreparationKey),
      )) {
        if (a.preparedTasks?.[source])
          next.preparedTasks[source] = a.preparedTasks[source];
        else delete next.preparedTasks[source];
      }
      next.progress.ready = { ...next.progress.ready, ...a.ready };
      break;
    }
    case "meal.portions":
      next = changePortions(state, meal(state, a.id).id, num(a.count, 0, 12));
      break;
    case "day.skip":
    case "day.restore": {
      next = state;
      for (const m of state.plan.meals.filter(
        (m) => m.day === a.day && !state.progress.done[m.id],
      ))
        if (command.name === "day.skip" || mealPortions(state, m) === 0)
          next = changePortions(
            next,
            m.id,
            command.name === "day.skip"
              ? 0
              : Math.min(
                  state.servings,
                  state.lastMealServings?.[m.id] || state.servings,
                ),
          );
      break;
    }
    case "schedule.swap":
      next = swapSchedule(state, meal(state, a.id).id, str(a.target));
      break;
    case "meal.replace":
      next = replaceMeal(state, meal(state, a.id).id, a.meal as Meal);
      break;
    case "alternative.swap":
      next = swapStateMeal(state, meal(state, a.id).id, str(a.alternativeId));
      break;
    case "purchase.record": {
      const key = str(a.key);
      const item = shoppingRequirements(state).find(
        (i) => ingredientKey(i) === key,
      );
      if (!item) throw Error("Ingredient not found.");
      next = recordPurchase(
        state,
        item as Ingredient,
        num(a.qty, 0.000001),
        str(a.location),
        a.packages,
        a.packageSize,
        a.details,
      );
      break;
    }
    case "purchase.update": {
      str(a.id);
      if (!state.purchaseReceipts?.some((r) => r.id === a.id))
        throw Error("Purchase not found.");
      next = {
        ...state,
        purchaseReceipts: state.purchaseReceipts.map((r) =>
          r.id === a.id
            ? {
                ...r,
                paid: a.paid ?? undefined,
                invoiceId: a.invoiceId || undefined,
              }
            : r,
        ),
      };
      validatePurchaseHistory(next);
      break;
    }
    case "invoice.save":
      next = saveInvoice(state, a.invoice as ShoppingInvoice);
      break;
    case "pantry.set":
      next = updateHomeStock(state, str(a.key), num(a.amount));
      break;
    case "household.servings": {
      const servings = num(a.servings, 1, 12);
      if (!Number.isInteger(servings)) throw Error("Invalid servings.");
      next = { ...startWeek(state, state.weekStart), servings };
      break;
    }
    case "week.start":
      next = startWeek(state, str(a.weekStart), a.stock);
      break;
    case "avoidance.add": {
      str(a.name, 160);
      if (!Array.isArray(a.avoid) || a.avoid.length > 30)
        throw Error("Invalid exclusions.");
      next = {
        ...state,
        avoidanceProfiles: [
          ...(state.avoidanceProfiles || []),
          {
            id: crypto.randomUUID(),
            name: a.name.trim(),
            avoid: a.avoid.map((s: unknown) => str(s, 100)),
          },
        ],
      };
      break;
    }
    case "avoidance.remove":
      next = {
        ...state,
        avoidanceProfiles: state.avoidanceProfiles?.filter(
          (p) => p.id !== str(a.id),
        ),
      };
      break;
    case "storage.meal":
      next = {
        ...state,
        mealStorage: {
          ...state.mealStorage,
          [meal(state, a.id).id]: validateFoodStorage(a.storage as FoodStorage),
        },
      };
      break;
    case "saved.patch": {
      if (!state.savedFood?.some((f) => f.id === str(a.id)))
        throw Error("Saved food not found.");
      if (
        !a.patch ||
        Object.keys(a.patch).some(
          (k) =>
            ![
              "date",
              "type",
              "status",
              "storage",
              "storageNote",
              "meal",
            ].includes(k),
        )
      )
        throw Error("Invalid saved-food fields.");
      next = reconcileShopping({
        ...state,
        savedFood: state.savedFood.map((f) =>
          f.id === a.id ? { ...f, ...a.patch } : f,
        ),
      });
      break;
    }
    case "saved.assign":
      next = assignFood(state, str(a.id), str(a.target));
      break;
    case "saved.merge":
      next = mergeFood(state, str(a.id), str(a.target));
      break;
    case "saved.eat":
      next = eatCookedFood(state, str(a.id), num(a.eaten, 0, 12));
      break;
    case "saved.finish":
      next = finishSavedFood(state, str(a.id));
      break;
    case "cooking.begin":
      next = beginCooking(state, meal(state, a.id).id);
      break;
    case "cooking.cancel":
      next = cancelCooking(state, meal(state, a.id).id);
      break;
    case "cooking.finish":
      next = finishCooking(
        state,
        meal(state, a.id).id,
        num(a.cooked, 1, 12),
        num(a.eaten, 0, 12),
      );
      break;
    case "cooking.quick":
      next = completeMealQuickly(
        state,
        meal(state, a.id).id,
        num(a.cooked, 1, 12),
        num(a.eaten, 0, 12),
      );
      break;
    case "cooking.step": {
      const m = meal(state, a.id),
        index = num(a.index, 0, m.steps.length - 1);
      if (!Number.isInteger(index)) throw Error("Invalid step.");
      next = beginCooking(state, m.id);
      next = {
        ...next,
        progress: {
          ...next.progress,
          cook: { ...next.progress.cook, [m.id]: index },
        },
      };
      break;
    }
    case "timer.start": {
      const m = meal(state, a.id),
        index = num(a.index, 0, m.steps.length - 1);
      if (!Number.isInteger(index)) throw Error("Invalid step.");
      next = beginCooking(state, m.id);
      next = {
        ...next,
        timers: [
          ...(next.timers || []),
          ...(next.timer ? [next.timer] : []),
        ].filter((t) => !(t.mealId === m.id && t.step === index)),
        timer: {
          mealId: m.id,
          step: index,
          end: Date.now() + m.steps[index].minutes * 60000,
        },
      };
      break;
    }
    case "timer.change": {
      str(a.id);
      num(a.index, 0, 100);
      const transform = (t: NonNullable<State["timer"]>) => {
        if (a.action === "dismiss") return null;
        const remaining =
          t.paused ?? Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
        if (a.action === "extend")
          return t.paused !== undefined
            ? { ...t, paused: t.paused + 60 }
            : { ...t, end: Math.max(Date.now(), t.end) + 60000 };
        if (a.action === "toggle")
          return t.paused !== undefined
            ? { ...t, end: Date.now() + t.paused * 1000, paused: undefined }
            : { ...t, paused: remaining };
        throw Error("Invalid timer action.");
      };
      next = {
        ...state,
        timer:
          state.timer &&
          state.timer.mealId === a.id &&
          state.timer.step === a.index
            ? transform(state.timer)
            : state.timer,
        timers: state.timers?.flatMap((t) => {
          const v = t.mealId === a.id && t.step === a.index ? transform(t) : t;
          return v ? [v] : [];
        }),
      };
      break;
    }
    case "menu.apply": {
      if (a.weekStart) next = applyGeneratedMenu(state, a.plan, a.weekStart);
      else {
        next = {
          ...retainPrepared(state),
          plan: a.plan,
          servings: a.servings ?? a.plan.servings,
          mealServings: {},
          mealCredits: {},
          mealCreditSources: {},
          mealCreditWeeks: {},
          mealAllocatedPortions: {},
          mealStorage: {},
          mealResults: {},
          stockUses: Object.fromEntries(
            Object.entries(state.stockUses || {}).map(([key, use]) => [
              key.startsWith("history-")
                ? key
                : "history-" + crypto.randomUUID(),
              use,
            ]),
          ),
          cookingBatches: {},
          preparedTasks: {},
          progress: freshProgress(),
          timer: null,
          timers: [],
        };
      }
      break;
    }
    case "state.restore":
      next = hydrateState(a.state, defaults);
      break;
    case "state.undo": {
      if (!undoState) throw Error("Undo is no longer available.");
      next = {
        ...structuredClone(undoState),
        corrections: [
          ...(state.corrections || []),
          {
            at: new Date().toISOString(),
            food: state.savedFood || [],
            results: state.mealResults || {},
            uses: state.stockUses || {},
          },
        ].slice(-20),
      };
      break;
    }
    case "prep.links": {
      const m = meal(state, a.id),
        index = num(a.index, 0, m.prep.length - 1);
      next = {
        ...state,
        plan: {
          ...state.plan,
          meals: state.plan.meals.map((m) =>
            m.id === a.id
              ? {
                  ...m,
                  prep: m.prep.map((p, i) =>
                    i === index ? { ...p, ingredients: a.refs } : p,
                  ),
                }
              : m,
          ),
        },
      };
      break;
    }
    default:
      throw Error("Unknown command.");
  }
  return uniqueSavedRecipes(hydrateState(next, defaults));
}
