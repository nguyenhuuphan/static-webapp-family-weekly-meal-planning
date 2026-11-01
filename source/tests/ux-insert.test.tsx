import { it, expect } from "vitest";
import { within } from "@testing-library/react";
import { boot, fireEvent, screen, readState } from "./uxSupport";
it("inserts a scalable ingredient token at the instruction cursor", async () => {
  await boot();
  await fireEvent.click(
    screen.getByRole("button", { name: "Edit Monday Lunch" }),
  );
  const area = screen.getByLabelText("prep step 1") as HTMLTextAreaElement;
  await fireEvent.change(area, { target: { value: "Use " } });
  area.setSelectionRange(4, 4);
  const step = area.closest(".edit-step") as HTMLElement;
  const picker = within(step).getByRole("combobox", {
    name: "Insert ingredient into step 1",
  });
  await fireEvent.change(picker, { target: { value: "0" } });
  expect(area.value).toBe("Use [300 g] Pork shoulder, boneless");
  await fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
  expect(readState().plan.meals[0].prep[0].text).toContain("[300 g]");
});
