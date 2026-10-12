import { act } from "@testing-library/react";
import { expect, it, vi } from "vitest";
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

it("dismisses the update notification and expires it after eight seconds", async () => {
  await boot(freshState(structuredClone(plan)));
  const select = screen.getByLabelText("Diners: Monday · Lunch");
  fireEvent.change(select, { target: { value: "1" } });
  fireEvent.click(
    screen.getByRole("button", { name: /dismiss notification/i }),
  );
  expect(screen.queryByRole("button", { name: "Undo last action" })).toBeNull();
  vi.useFakeTimers();
  try {
    fireEvent.change(select, { target: { value: "2" } });
    expect(
      screen.getByRole("button", { name: "Undo last action" }),
    ).toBeTruthy();
    act(() => vi.advanceTimersByTime(8000));
    expect(
      screen.queryByRole("button", { name: "Undo last action" }),
    ).toBeNull();
    expect(readState().mealServings?.[plan.meals[0].id]).toBe(2);
  } finally {
    vi.useRealTimers();
  }
});
