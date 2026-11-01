import { it, expect } from "vitest";
import { boot, nav, fireEvent, screen, within } from "./uxSupport";
it("keeps preparation filters and undo available after navigating away", async () => {
  await boot();
  await nav("Prep Day");
  const group = screen.getByRole("region", { name: "Pork shoulder, boneless" });
  await fireEvent.click(
    within(group).getByRole("button", {
      name: "Show preparation: Pork shoulder, boneless",
    }),
  );
  await fireEvent.click(
    within(group).getByRole("checkbox", {
      name: "Mark all portions prepared: Pork shoulder, boneless",
    }),
  );
  await fireEvent.click(screen.getByRole("button", { name: "Remaining" }));
  await nav("Shopping");
  await nav("Prep Day");
  expect(
    screen
      .getByRole("button", { name: "Remaining" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    screen.queryByRole("region", { name: "Pork shoulder, boneless" }),
  ).toBeNull();
  await fireEvent.click(
    screen.getByRole("button", { name: "Undo last completion" }),
  );
  expect(
    screen.getByRole("region", { name: "Pork shoulder, boneless" }),
  ).toBeTruthy();
});
