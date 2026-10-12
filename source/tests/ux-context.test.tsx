import { it, expect } from "vitest";
import { boot, nav, fireEvent, screen, plan } from "./uxSupport";
it("restores the cooking page and selected meal after reload", async () => {
  const view = await boot();
  nav("Cook");
  const meal = plan.meals.find((item) => item.id === "wed-dinner")!;
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".meal-picker button")).find((item) => item.textContent?.includes(meal.main))!;
  fireEvent.click(button);
  view.unmount();
  await boot();
  expect(JSON.parse(localStorage.getItem("planner:selected")!)).toBe(meal.id);
  expect(screen.getByRole("heading", { name: meal.main })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Cooking instructions" })).toBeTruthy();
});