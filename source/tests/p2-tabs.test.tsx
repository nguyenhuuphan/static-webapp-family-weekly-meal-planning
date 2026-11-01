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
it("browser storage events cannot overwrite the authoritative server state", async () => {
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
  await fireEvent.change(screen.getByLabelText("Diners: Monday · Lunch"), {
    target: { value: "0" },
  });
  expect(readState().mealServings?.["mon-lunch"]).toBe(0);
});
