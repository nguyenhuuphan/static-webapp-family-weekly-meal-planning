import { expect, it } from "vitest";
import {
  boot,
  fireEvent,
  freshState,
  plan,
  readState,
  screen,
} from "./uxSupport";
it("undoes attendance changes without losing the original plan", async () => {
  const s = freshState(structuredClone(plan));
  await boot(s);
  const select = screen.getByLabelText("Diners: Monday · Lunch");
  fireEvent.change(select, { target: { value: "1" } });
  expect(readState().mealServings?.[s.plan.meals[0].id]).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Undo last action" }));
  expect(readState().mealServings?.[s.plan.meals[0].id]).toBeUndefined();
  expect(readState().corrections).toHaveLength(1);
});
