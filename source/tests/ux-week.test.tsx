import { it, expect } from "vitest";
import { boot, nav, fireEvent, screen, readState } from "./uxSupport";
it("accepts a Wednesday and starts its Monday week", async () => {
  await boot();
  nav("Settings");
  fireEvent.change(screen.getByLabelText("Week beginning"), {
    target: { value: "2026-11-04" },
  });
  expect(readState().weekStart).toBe("2026-11-02");
});
