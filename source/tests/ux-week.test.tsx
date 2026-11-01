import { it, expect } from "vitest";
import {
  boot,
  nav,
  fireEvent,
  screen,
  readState,
  freshState,
  plan,
} from "./uxSupport";
it("accepts a Wednesday and starts its Monday week", async () => {
  const initial = freshState(plan);
  initial.weekStart = "2026-10-26";
  await boot(initial);
  await nav("Settings");
  await fireEvent.change(screen.getByLabelText("Week beginning"), {
    target: { value: "2026-11-04" },
  });
  expect(readState().weekStart).not.toBe("2026-11-02");
  await fireEvent.click(
    screen.getByRole("checkbox", {
      name: "I checked the actual remaining stock",
    }),
  );
  await fireEvent.click(
    screen.getByRole("button", { name: "Confirm stocktake and start week" }),
  );
  expect(readState().weekStart).toBe("2026-11-02");
});
