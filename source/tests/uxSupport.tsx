import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import App from "../src/App";
import data from "../public/meal-plan.json";
import { freshState, STORAGE_KEY } from "../src/domain";
import type { Plan, State } from "../src/types";
export const plan = data as Plan;
export const readState = (): State =>
  JSON.parse(localStorage.getItem(STORAGE_KEY)!);
export const nav = (name: string) =>
  fireEvent.click(
    within(screen.getByRole("navigation")).getByRole("button", { name }),
  );
export async function boot(initial?: State) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => structuredClone(plan) })),
  );
  // These fixtures exercise Monday lunch independently of today's weekday.
  if (!localStorage.getItem("planner:selected"))
    localStorage.setItem("planner:selected", "mon-lunch");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
  if (initial) localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  const view = render(<App />);
  await screen.findByRole("navigation");
  return view;
}
export { fireEvent, screen, within, freshState };
