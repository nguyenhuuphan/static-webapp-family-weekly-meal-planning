import { it, expect } from "vitest";
import { waitFor } from "@testing-library/react";
import { boot, fireEvent, screen } from "./uxSupport";
it("explains invalid fields inline and focuses the first error", async () => {
  await boot();
  fireEvent.click(screen.getByRole("button", { name: "Edit Monday Lunch" }));
  const input = screen.getByLabelText("Main dish");
  fireEvent.change(input, { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
  await waitFor(() => expect(document.activeElement).toBe(input));
  expect(input.getAttribute("aria-invalid")).toBe("true");
  const description = input.getAttribute("aria-describedby")!;
  expect(document.getElementById(description)?.textContent).toContain(
    "Enter a valid value",
  );
});
