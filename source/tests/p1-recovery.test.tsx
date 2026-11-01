import { expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { STORAGE_KEY } from "../src/domain";
import { boot, fireEvent, screen, readState } from "./uxSupport";
it("loads authoritative server state while preserving an unreadable browser cache for recovery", async () => {
  const raw = '{"plan":broken';
  localStorage.setItem(STORAGE_KEY, raw);
  await boot();
  await waitFor(() => expect(readState().plan.meals).toHaveLength(10));
  expect(localStorage.getItem(STORAGE_KEY + ":pre-api-backup")).toBe(raw);
  expect(
    screen.queryByRole("heading", { name: "Saved data needs recovery" }),
  ).toBeNull();
});
it("preserves unreadable cache and disables saving when no family connection exists", async () => {
  const raw = "broken-original";
  localStorage.setItem(STORAGE_KEY, raw);
  localStorage.removeItem("family-access-code-v1");
  await boot();
  expect(
    screen.getByRole("heading", { name: "Saved data needs recovery" }),
  ).toBeTruthy();
  await fireEvent.change(screen.getByLabelText("Diners: Monday · Lunch"), {
    target: { value: "1" },
  });
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});
