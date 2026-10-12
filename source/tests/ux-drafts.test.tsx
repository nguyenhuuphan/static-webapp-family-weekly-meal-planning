import { it, expect } from "vitest";
import { boot, nav, fireEvent, screen } from "./uxSupport";
it("keeps an unsaved meal draft across navigation and guards page exit", async () => {
  await boot();
  fireEvent.click(screen.getByRole("button", { name: "Edit Monday Lunch" }));
  fireEvent.change(screen.getByLabelText("Main dish"), {
    target: { value: "My draft" },
  });
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  nav("Shopping");
  nav("This Week");
  fireEvent.click(screen.getByRole("button", { name: "Edit Monday Lunch" }));
  expect((screen.getByLabelText("Main dish") as HTMLInputElement).value).toBe(
    "My draft",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
  expect(sessionStorage.getItem("meal-draft:mon-lunch")).toBeNull();
});
