import { it, expect } from "vitest";
import { boot, fireEvent, screen, readState } from "./uxSupport";
it("inserts a scalable ingredient token at the instruction cursor", async () => {
  await boot();
  fireEvent.click(screen.getByRole("button", { name: "Edit Monday Lunch" }));
  const area = screen.getByLabelText("prep step 1") as HTMLTextAreaElement;
  fireEvent.change(area, { target: { value: "Use " } });
  area.setSelectionRange(4, 4);
  const label = area.closest("label")!;
  const picker = label.querySelector("select")!;
  fireEvent.change(picker, { target: { value: "0" } });
  expect(area.value).toBe("Use [300 g] Pork shoulder, boneless");
  fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
  expect(readState().plan.meals[0].prep[0].text).toContain("[300 g]");
});
