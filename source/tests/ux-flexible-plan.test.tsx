import { expect, it } from "vitest";
import {
  boot,
  fireEvent,
  freshState,
  nav,
  plan,
  readState,
  screen,
  within,
} from "./uxSupport";
import { changePortions } from "../src/helpers/scheduling";

it("skips a day before shopping, excludes it from cooking, and restores prior diner counts", async () => {
  const initial = changePortions(
    freshState(structuredClone(plan)),
    plan.meals[0].id,
    1,
  );
  await boot(initial);
  fireEvent.click(
    screen.getByRole("button", { name: "Skip whole day: Monday" }),
  );
  expect(readState().mealServings?.[plan.meals[0].id]).toBe(0);
  expect(readState().mealServings?.[plan.meals[1].id]).toBe(0);
  expect(screen.getAllByText("Not eating at home").length).toBeGreaterThan(0);
  nav("Cook");
  expect(screen.queryByRole("option", { name: /Monday/ })).toBeNull();
  nav("This Week");
  fireEvent.click(
    screen.getByRole("button", { name: "Restore meals: Monday" }),
  );
  expect(readState().mealServings?.[plan.meals[0].id]).toBe(1);
  expect(readState().mealServings?.[plan.meals[1].id]).toBe(2);
});

it("preserves food after cancellation and schedules it into the next week", async () => {
  const initial = freshState(structuredClone(plan));
  const id = plan.meals[0].id;
  initial.progress.prep[id + ":0"] = true;
  initial.preparedTasks = {
    [id + ":0"]: { servings: 2, at: "2026-10-12T10:00:00Z" },
  };
  await boot(initial);
  fireEvent.change(
    screen.getByRole("combobox", { name: "Diners: Monday · Lunch" }),
    { target: { value: "0" } },
  );
  const panel = within(screen.getByRole("region", { name: "Food to arrange" }));
  fireEvent.click(panel.getByText("Review and arrange"));
  expect(readState().savedFood![0].servings).toBe(2);
  expect(
    (panel.getByRole("button", { name: "Save meal date" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(panel.getByRole("checkbox"));
  const future = "2026-10-20";
  fireEvent.change(panel.getByLabelText("Meal date"), {
    target: { value: future },
  });
  fireEvent.click(panel.getByRole("button", { name: "Save meal date" }));
  expect(readState().savedFood![0].date).toBe("2026-10-20");
  expect(
    within(panel.getByRole("region", { name: "Prepared batches" })).queryByText(
      "Review and arrange",
    ),
  ).toBeNull();
  expect(readState().savedFood![0].preparedTasks[0].at).toBe(
    "2026-10-12T10:00:00Z",
  );
});

it("shows an empty cooking state when the entire week is skipped", async () => {
  const initial = freshState(structuredClone(plan));
  initial.mealServings = Object.fromEntries(plan.meals.map((m) => [m.id, 0]));
  await boot(initial);
  nav("Cook");
  expect(
    screen.getByRole("heading", { name: "No meals to cook" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Finish meal" })).toBeNull();
});

it("offers weekend and next-week meals directly in the destination selector", async () => {
  const initial = freshState(structuredClone(plan));
  initial.weekStart = "2026-10-12";
  initial.progress.prep[plan.meals[0].id + ":0"] = true;
  await boot(changePortions(initial, plan.meals[0].id, 0));
  const panel = within(screen.getByRole("region", { name: "Food to arrange" }));
  fireEvent.click(panel.getByText("Review and arrange"));
  const selector = panel.getByLabelText("Choose destination meal");
  expect(
    within(selector).getByRole("option", {
      name: "Saturday · 2026-10-17 · Lunch",
    }),
  ).toBeTruthy();
  fireEvent.change(selector, { target: { value: "date:2026-10-20:Dinner" } });
  fireEvent.click(panel.getByRole("checkbox"));
  fireEvent.click(panel.getByRole("button", { name: "Save meal date" }));
  expect(readState().savedFood![0]).toMatchObject({
    status: "scheduled",
    date: "2026-10-20",
    type: "Dinner",
  });
  expect(readState().weekStart).toBe("2026-10-12");
});
