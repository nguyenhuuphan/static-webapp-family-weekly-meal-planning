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
import { hydrateState, timerSeconds } from "../src/domain";
it("supports two timers without replacement and persists pause add-time and resume", async () => {
  await boot();
  nav("Cook");
  fireEvent.click(
    screen.getByRole("button", { name: "Start timer for step 1" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Start timer for step 3" }),
  );
  expect(readState().timers).toHaveLength(1);
  fireEvent.click(screen.getAllByRole("button", { name: "Pause" })[0]);
  const paused = readState().timers![0].paused!;
  expect(paused).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole("button", { name: "+1 min" })[0]);
  expect(readState().timers![0].paused).toBe(paused + 60);
  fireEvent.click(screen.getByRole("button", { name: "Resume" }));
  expect(readState().timers![0].paused).toBeUndefined();
  expect(readState().timers![0].end).toBeGreaterThan(Date.now());
  expect(readState().timer?.step).toBe(2);
});
it("validates restored timers and keeps paused timers stable", () => {
  const state = freshState(plan);
  state.timers = [
    { mealId: "mon-lunch", step: 0, end: 1, paused: 90 },
    { mealId: "missing", step: 0, end: 1 },
  ];
  const restored = hydrateState(state, plan);
  expect(restored.timers).toHaveLength(1);
  expect(timerSeconds(restored.timers![0], 100000)).toBe(90);
});
