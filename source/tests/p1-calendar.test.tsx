import { expect, it } from "vitest";
import { calendarDate, calendarFood } from "../src/helpers/calendar";
import {
  changePortions,
  mergeFood,
  startWeek,
} from "../src/helpers/scheduling";
import {
  boot,
  fireEvent,
  freshState,
  plan,
  readState,
  screen,
} from "./uxSupport";

it("merges one saved portion into two planned portions without displacing the recipe", () => {
  let s = freshState(structuredClone(plan));
  const meal = s.plan.meals[0];
  meal.prep.forEach((_, i) => {
    s.progress.prep[`${meal.id}:${i}`] = true;
  });
  s = changePortions(s, meal.id, 1);
  const food = s.savedFood![0];
  s = changePortions(s, meal.id, 2);
  const merged = mergeFood(s, food.id, meal.id);
  expect(merged.plan.meals[0].main).toBe(meal.main);
  expect(merged.savedFood![0].status).toBe("assigned");
  expect(merged.mealAllocatedPortions?.[meal.id]).toBe(1);
  expect(merged.preparedTasks?.[`${meal.id}:0`].servings).toBe(2);
  expect(() => mergeFood(merged, food.id, meal.id)).toThrow();
});

it("browses a seven-day calendar without resetting current progress", async () => {
  const s = freshState(structuredClone(plan));
  s.weekStart = "2026-10-12";
  s.progress.prep["kept"] = true;
  await boot(s);
  expect(screen.getByText("Saturday")).toBeTruthy();
  expect(screen.getByText("Sunday")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next week" }));
  expect(readState().weekStart).toBe(s.weekStart);
  expect(readState().progress.prep.kept).toBe(true);
  expect(calendarDate(s.weekStart, 6)).toBe("2026-10-18");
  expect(calendarFood(s, "2026-10-18", "Lunch")).toEqual([]);
  const next = startWeek(s, "2026-10-19", {});
  expect(next.weekArchive?.[s.weekStart].plan).toEqual(s.plan);
});
