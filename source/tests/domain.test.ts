import { describe, it, expect } from "vitest";
import data from "../public/meal-plan.json";
import type { Plan } from "../src/types";
import {
  aggregate,
  validatePlan,
  scaleText,
  timerSeconds,
  parseBackup,
  freshState,
  hydrateState,
  replaceMeal,
  isMonday,
} from "../src/domain";
const plan = data as Plan;
describe("weekday meal data", () => {
  it("has 10 complete and unique slots", () => {
    expect(validatePlan(plan)).toEqual([]);
    expect(plan.meals).toHaveLength(10);
  });
  it("includes soup proteins and consolidates measures", () => {
    const items = aggregate(plan, 2);
    const qty = (n: string) => items.find((i) => i.name === n)?.qty;
    expect(qty("Shrimp, peeled")).toBe(500);
    expect(qty("Ground pork")).toBe(250);
    expect(qty("Chicken thigh, boneless")).toBe(600);
    expect(qty("Beef, stir-fry cut")).toBe(600);
    expect(qty("Cabbage, trimmed")).toBe(550);
    expect(qty("Eggs")).toBe(5);
    expect(items.filter((i) => i.name === "Cooking oil")).toHaveLength(1);
  });
  it("scales instructions and amounts together", () => {
    expect(
      aggregate(plan, 4).find((i) => i.name === "Shrimp, peeled")?.qty,
    ).toBe(1000);
    expect(scaleText("Use [300 g], [2 tsp], [3 each].", 2)).toBe(
      "Use 600 g, 4 tsp, 6 each.",
    );
  });
  it("rejects weekends, duplicate slots, invalid amounts and steps", () => {
    for (const modify of [
      (p: Plan) => (p.meals[0].day = "Saturday" as never),
      (p: Plan) => (p.meals[1].type = "Lunch"),
      (p: Plan) => (p.meals[0].ingredients[0].qty = -1),
      (p: Plan) => (p.meals[0].steps = []),
    ]) {
      const p = structuredClone(plan);
      modify(p);
      expect(validatePlan(p).length).toBeGreaterThan(0);
    }
  });
  it("imports old JSON backups and rejects invalid serving counts", () => {
    expect(parseBackup({ plan, servings: 4 }).servings).toBe(4);
    expect(parseBackup(plan).servings).toBe(2);
    expect(() => parseBackup({ plan, servings: 20 })).toThrow();
  });
  it("preserves v1 browser progress and timers when upgrading", () => {
    const s = freshState(plan);
    s.progress.shopping["Shrimp, peeled|g"] = true;
    s.progress.done["mon-lunch"] = true;
    s.timer = { mealId: "mon-lunch", step: 0, end: Date.now() + 60000 };
    const hydrated = hydrateState(JSON.parse(JSON.stringify(s)), plan);
    expect(hydrated.progress.done["mon-lunch"]).toBe(true);
    expect(hydrated.progress.shopping["Shrimp, peeled|g"]).toBe(true);
    expect(hydrated.timer).toEqual(s.timer);
  });
  it("recipe edit resets only affected meal and shopping data", () => {
    const s = freshState(plan);
    s.progress.done["mon-lunch"] = true;
    s.progress.done["mon-dinner"] = true;
    s.progress.prep["mon-lunch:0"] = true;
    s.progress.shopping.x = true;
    const changed = { ...plan.meals[0], main: "New pork" };
    const n = replaceMeal(s, changed.id, changed);
    expect(n.plan.meals[0].main).toBe("New pork");
    expect(n.progress.done["mon-lunch"]).toBeUndefined();
    expect(n.progress.done["mon-dinner"]).toBe(true);
    expect(n.progress.shopping).toEqual({ x: true });
    expect(s.plan.meals[0].main).not.toBe("New pork");
  });
  it("timer math survives refresh and does not run negative", () => {
    expect(timerSeconds({ mealId: "x", step: 0, end: 10000 }, 4000)).toBe(6);
    expect(timerSeconds({ mealId: "x", step: 0, end: 10000 }, 11000)).toBe(0);
  });
  it("validates Monday week starts", () => {
    expect(isMonday("2026-10-12")).toBe(true);
    expect(isMonday("2026-10-10")).toBe(false);
  });
});
