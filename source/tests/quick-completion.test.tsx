import { expect, it } from "vitest";
import {
  boot,
  fireEvent,
  freshState,
  plan,
  readState,
  screen,
  within,
} from "./uxSupport";
import { completeMealQuickly, undoCooking } from "../src/helpers/cooking";
it("completes from the weekly menu without visiting cooking and saves leftovers", async () => {
  const s = freshState(structuredClone(plan)),
    meal = s.plan.meals[0];
  const raw = meal.ingredients[0],
    key = raw.name + "|" + raw.unit;
  s.pantry = { [key]: raw.qty };
  await boot(s);
  fireEvent.click(screen.getAllByRole("button", { name: "Complete meal" })[0]);
  const form = within(
    screen.getByRole("region", { name: "Quick meal completion" }),
  );
  fireEvent.change(form.getByLabelText("Portions eaten"), {
    target: { value: "1" },
  });
  fireEvent.click(form.getByRole("button", { name: "Confirm completion" }));
  const next = readState();
  expect(next.progress.done[meal.id]).toBe(true);
  expect(next.mealResults?.[meal.id]).toMatchObject({
    cooked: 2,
    eaten: 1,
    remaining: 1,
  });
  expect(next.savedFood?.[0]).toMatchObject({ kind: "cooked", servings: 1 });
  expect(next.stockUses?.[meal.id].home[key]).toBe(raw.qty);
  expect(next.progress.prep).toEqual({});
  expect(next.progress.ready).toEqual({});
  expect(screen.getByRole("navigation")).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "This Week" })
      .getAttribute("aria-current"),
  ).toBe("page");
  const undone = undoCooking(next, meal.id);
  expect(undone.stockUses?.[meal.id]).toBeUndefined();
  expect(undone.savedFood).toHaveLength(0);
});
it("rejects duplicate completion, skipped meals and impossible portions", () => {
  const s = freshState(structuredClone(plan)),
    id = s.plan.meals[0].id;
  expect(() => completeMealQuickly(s, id, 2, 3)).toThrow();
  const done = completeMealQuickly(s, id, 2, 2);
  expect(() => completeMealQuickly(done, id, 2, 2)).toThrow();
  s.mealServings = { [id]: 0 };
  expect(() => completeMealQuickly(s, id, 2, 2)).toThrow();
});
it("cancel leaves the meal and inventory unchanged", async () => {
  await boot(freshState(structuredClone(plan)));
  const before = readState();
  fireEvent.click(screen.getAllByRole("button", { name: "Complete meal" })[0]);
  fireEvent.click(
    within(
      screen.getByRole("region", { name: "Quick meal completion" }),
    ).getByRole("button", { name: "Cancel" }),
  );
  expect(readState()).toEqual(before);
});
