import { expect, it } from "vitest";
import {
  beginCooking,
  finishCooking,
  eatCookedFood,
  undoCooking,
  finishSavedFood,
} from "../src/helpers/cooking";
import { changePortions, assignFood } from "../src/helpers/scheduling";
import {
  availableAcquisitions,
  shoppingRequirements,
} from "../src/helpers/shopping";
import { hydrateState } from "../src/helpers";
import {
  boot,
  fireEvent,
  freshState,
  nav,
  plan,
  readState,
  screen,
} from "./uxSupport";

function prepared() {
  const s = freshState(structuredClone(plan)),
    meal = s.plan.meals[0];
  meal.prep.forEach((_, i) => {
    s.progress.prep[`${meal.id}:${i}`] = true;
  });
  s.progress.ready[meal.id] = true;
  const i = meal.ingredients[0];
  s.pantry = { [i.name + "|" + i.unit]: i.qty * 2 };
  return s;
}

it("conserves cooked, eaten and leftover portions and never consumes cooked leftovers twice", () => {
  const s = prepared(),
    meal = s.plan.meals[0],
    ingredient = meal.ingredients[0],
    key = ingredient.name + "|" + ingredient.unit;
  const batch = beginCooking(s, meal.id);
  expect(() => changePortions(batch, meal.id, 1)).toThrow();
  const done = finishCooking(batch, meal.id, 2, 1);
  const leftover = done.savedFood![0];
  expect(done.mealResults?.[meal.id]).toMatchObject({
    cooked: 2,
    eaten: 1,
    remaining: 1,
  });
  expect(leftover.kind).toBe("cooked");
  expect(leftover.storage?.stage).toBe("cooked");
  expect(leftover.cookedAt).toBe(done.mealResults?.[meal.id].at);
  expect(done.cookingBatches).toEqual({});
  expect(availableAcquisitions(done, key).home).toBe(ingredient.qty);
  expect(() => finishCooking(done, meal.id, 2, 1)).toThrow();
  leftover.status = "scheduled";
  leftover.date = s.weekStart;
  leftover.type = "Dinner";
  expect(shoppingRequirements(done)).toEqual(
    shoppingRequirements({ ...done, savedFood: [] }),
  );
  const eaten = eatCookedFood(done, leftover.id, 1);
  expect(eaten.savedFood![0].status).toBe("used");
  expect(availableAcquisitions(eaten, key)).toEqual(
    availableAcquisitions(done, key),
  );
  expect(eaten.savedFood![0].cookedAt).toBe(leftover.cookedAt);
  expect(() => undoCooking(eaten, meal.id)).toThrow();
  expect(hydrateState(eaten, plan).mealResults).toEqual(done.mealResults);
});

it("keeps uncooked prepared surplus when actual cooked quantity is smaller", () => {
  const s = prepared(),
    id = s.plan.meals[0].id;
  const done = finishCooking(beginCooking(s, id), id, 1, 1);
  expect(
    done.savedFood?.some((f) => f.kind === "prepared" && f.servings === 1),
  ).toBe(true);
});

it("finishes a two-person meal with one cooked leftover through the cooking screen", async () => {
  const s = prepared();
  await boot(s);
  nav("Cook");
  fireEvent.change(screen.getByLabelText("Eaten"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Finish meal" }));
  expect(readState().mealResults?.[s.plan.meals[0].id].remaining).toBe(1);
  nav("This Week");
  fireEvent.click(screen.getByText("Review and arrange"));
  expect(screen.getByText(/1 cooked portions/)).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "USDA: Leftovers and Food Safety" }),
  ).toBeTruthy();
});

it("converts current-week reserved prep into consumption without freeing ingredients", () => {
  let s = prepared();
  const id = s.plan.meals[0].id,
    ingredient = s.plan.meals[0].ingredients[0],
    key = ingredient.name + "|" + ingredient.unit;
  s = changePortions(s, id, 0);
  const foodId = s.savedFood![0].id;
  s = changePortions(s, id, 2);
  s = assignFood(s, foodId, id);
  s.progress.ready[id] = true;
  const finished = finishCooking(s, id, 2, 1);
  expect(availableAcquisitions(finished, key).home).toBe(ingredient.qty);
  expect(finished.stockUses?.[id].home[key]).toBe(ingredient.qty);
  const undone = undoCooking(finished, id);
  expect(availableAcquisitions(undone, key).home).toBe(ingredient.qty);
});

it("accounts for an additional raw recipe when it is actually used", () => {
  const s = prepared(),
    meal = s.plan.meals[0],
    ingredient = meal.ingredients[0],
    key = ingredient.name + "|" + ingredient.unit;
  s.savedFood = [
    {
      id: "extra",
      kind: "recipe",
      meal: structuredClone(meal),
      baseServings: s.plan.servings,
      servings: 1,
      preparedTasks: {},
      storageNote: "",
      status: "scheduled",
      date: s.weekStart,
      type: "Dinner",
    },
  ];
  const used = finishSavedFood(s, "extra");
  expect(used.plan.meals).toHaveLength(10);
  expect(used.stockUses?.["saved-extra"].home[key]).toBe(ingredient.qty / 2);
  expect(availableAcquisitions(used, key).home).toBe(ingredient.qty * 1.5);
  expect(used.savedFood![0].status).toBe("used");
  expect(() => finishSavedFood(used, "extra")).toThrow();
});
