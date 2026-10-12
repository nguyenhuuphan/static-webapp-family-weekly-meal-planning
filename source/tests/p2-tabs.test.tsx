import { expect, it } from "vitest";
import { act } from "@testing-library/react";
import { STORAGE_KEY } from "../src/domain";
import {
  storageService,
  StorageConflictError,
} from "../src/services/storageService";
import {
  boot,
  fireEvent,
  freshState,
  plan,
  readState,
  screen,
} from "./uxSupport";
it("rejects a stale write even before the other-tab event arrives", () => {
  const s = freshState(structuredClone(plan));
  localStorage.setItem(STORAGE_KEY, "newer-copy");
  expect(() => storageService.write(s, "older-copy")).toThrow(
    StorageConflictError,
  );
  expect(localStorage.getItem(STORAGE_KEY)).toBe("newer-copy");
});
it("pauses stale edits and explicitly loads another tab's valid changes", async () => {
  await boot(freshState(structuredClone(plan)));
  const other = readState();
  other.mealServings = { "mon-lunch": 1 };
  const raw = JSON.stringify(other);
  act(() => {
    localStorage.setItem(STORAGE_KEY, raw);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: raw,
        storageArea: localStorage,
      }),
    );
  });
  fireEvent.change(screen.getByLabelText("Diners: Monday · Lunch"), {
    target: { value: "0" },
  });
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  fireEvent.click(
    screen.getByRole("button", { name: "Load changes from other tab" }),
  );
  expect(
    (screen.getByLabelText("Diners: Monday · Lunch") as HTMLSelectElement)
      .value,
  ).toBe("1");
  expect(
    screen.queryByRole("heading", { name: "Data changed in another tab" }),
  ).toBeNull();
});
