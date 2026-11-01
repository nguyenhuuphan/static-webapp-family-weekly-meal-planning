import { it, expect } from "vitest";
import { boot, nav, fireEvent, screen, freshState, plan } from "./uxSupport";
it("explains missing readiness and focuses the required confirmation", async () => {
  const initial = freshState(plan);
  initial.plan.meals[0].prep.forEach(
    (_, index) => (initial.progress.prep[`mon-lunch:${index}`] = true),
  );
  await boot(initial);
  await nav("Cook");
  const finish = screen.getByRole("button", {
    name: "Finish meal",
  }) as HTMLButtonElement;
  expect(finish.disabled).toBe(true);
  await fireEvent.click(screen.getByRole("button", { name: "Review now" }));
  const ready = screen.getByRole("checkbox", { name: /I checked:/ });
  expect(document.activeElement).toBe(ready);
  await fireEvent.click(ready);
  expect(finish.disabled).toBe(false);
});
