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
it("previews a full backup without changing data until restore and preserves progress", async () => {
  await boot();
  nav("Settings");
  const backup = freshState(plan);
  backup.servings = 4;
  backup.progress.done["mon-lunch"] = true;
  backup.pantry = { "Shrimp, peeled|g": 200 };
  backup.timers = [
    { mealId: "mon-dinner", step: 1, end: Date.now() + 60000, paused: 30 },
  ];
  const file = new File([JSON.stringify(backup)], "backup.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", {
    value: async () => JSON.stringify(backup),
  });
  fireEvent.change(screen.getByLabelText("Choose backup to restore"), {
    target: { files: [file] },
  });
  await screen.findByRole("button", { name: "Restore this backup" });
  expect(readState().servings).toBe(2);
  fireEvent.click(screen.getByRole("button", { name: "Restore this backup" }));
  expect(readState().servings).toBe(4);
  expect(readState().progress.done["mon-lunch"]).toBe(true);
  expect(readState().pantry).toEqual(backup.pantry);
  expect(readState().timers?.[0].paused).toBe(30);
});
