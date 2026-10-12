import { expect, it } from "vitest";
import { STORAGE_KEY } from "../src/domain";
import {
  boot,
  fireEvent,
  freshState,
  nav,
  plan,
  readState,
  screen,
} from "./uxSupport";

it("keeps unreadable original data untouched across temporary edits", async () => {
  const raw = '{"plan":broken';
  localStorage.setItem(STORAGE_KEY, raw);
  await boot();
  expect(
    screen.getByRole("heading", { name: "Saved data needs recovery" }),
  ).toBeTruthy();
  fireEvent.change(
    screen.getByRole("combobox", { name: "Diners: Monday · Lunch" }),
    { target: { value: "1" } },
  );
  nav("Shopping");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});

it("restores an explicit last valid snapshot and archives the failed original", async () => {
  const snapshot = freshState(structuredClone(plan));
  snapshot.mealServings = { "mon-lunch": 1 };
  localStorage.setItem(STORAGE_KEY, "broken-original");
  localStorage.setItem(STORAGE_KEY + ":last-good", JSON.stringify(snapshot));
  await boot();
  fireEvent.click(
    screen.getByRole("button", { name: "Restore last valid snapshot" }),
  );
  expect(readState().mealServings?.["mon-lunch"]).toBe(1);
  const key = Object.keys(localStorage).find((k) =>
    k.startsWith(STORAGE_KEY + ":recovery:"),
  );
  expect(key && localStorage.getItem(key)).toBe("broken-original");
  expect(
    screen.queryByRole("heading", { name: "Saved data needs recovery" }),
  ).toBeNull();
});
