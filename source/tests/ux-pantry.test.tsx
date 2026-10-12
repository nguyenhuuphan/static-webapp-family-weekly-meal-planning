import { it, expect } from "vitest";
import { boot, nav, fireEvent, screen, within, readState } from "./uxSupport";
it("subtracts partial pantry stock and lets users clear fully-owned quantities", async () => {
  await boot();
  nav("Shopping");
  const input = screen.getByRole("spinbutton", {
    name: "Amount at home: Shrimp, peeled (g)",
  });
  fireEvent.change(input, { target: { value: "200" } });
  fireEvent.blur(input);
  let row = screen
    .getByRole("checkbox", { name: "Bought Shrimp, peeled" })
    .closest(".shopping-row") as HTMLElement;
  expect(row.querySelector(".quantity")?.textContent).toContain("300 g");
  fireEvent.click(within(row).getByRole("checkbox", { name: "At home" }));
  expect(readState().pantry?.["Shrimp, peeled|g"]).toBe(500);
  fireEvent.click(screen.getByRole("button", { name: "At home" }));
  row = screen
    .getByRole("checkbox", { name: "Bought Shrimp, peeled" })
    .closest(".shopping-row") as HTMLElement;
  fireEvent.click(within(row).getByRole("checkbox", { name: "At home" }));
  expect(readState().pantry?.["Shrimp, peeled|g"]).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "To buy" }));
  expect(
    screen.getByRole("checkbox", { name: "Bought Shrimp, peeled" }),
  ).toBeTruthy();
});
