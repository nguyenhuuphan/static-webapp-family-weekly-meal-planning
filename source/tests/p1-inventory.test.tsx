import { expect, it } from "vitest";
import { consumeMeal } from "../src/helpers/inventory";
import {
  availableAcquisitions,
  shoppingRequirements,
} from "../src/helpers/shopping";
import { startWeek } from "../src/helpers/scheduling";
import {
  boot,
  fireEvent,
  freshState,
  nav,
  plan,
  readState,
  screen,
  within,
} from "./uxSupport";

it("deducts meal usage once and preserves purchase history at rollover", () => {
  const s = freshState(structuredClone(plan));
  const ingredient = s.plan.meals[0].ingredients[0],
    key = ingredient.name + "|" + ingredient.unit;
  s.pantry = { [key]: ingredient.qty * 2 };
  const used = consumeMeal(s, s.plan.meals[0].id);
  used.progress.done[s.plan.meals[0].id] = true;
  expect(availableAcquisitions(used, key).home).toBe(ingredient.qty);
  expect(consumeMeal(used, s.plan.meals[0].id)).toEqual(used);
  expect(shoppingRequirements(used).flatMap((i) => i.meals)).not.toContain(
    s.plan.meals[0].id,
  );
  const next = startWeek(used, "2026-10-19", { [key]: 75 });
  expect(next.pantry?.[key]).toBe(75);
  expect(next.stockUses).toEqual({});
  expect(next.stockHistory?.[0].uses).toEqual(used.stockUses);
});

it("requires an actual stocktake before a new week is saved", async () => {
  const s = freshState(structuredClone(plan));
  s.weekStart = "2026-10-12";
  s.pantry = { "Shrimp, peeled|g": 500 };
  await boot(s);
  nav("Settings");
  fireEvent.change(screen.getByLabelText("Week beginning"), {
    target: { value: "2026-10-20" },
  });
  expect(readState().weekStart).toBe("2026-10-12");
  const panel = within(
    screen.getByRole("region", { name: "Stocktake before new week" }),
  );
  fireEvent.change(panel.getByRole("spinbutton"), { target: { value: "125" } });
  expect(
    (
      panel.getByRole("button", {
        name: "Confirm stocktake and start week",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(panel.getByRole("checkbox"));
  fireEvent.click(
    panel.getByRole("button", { name: "Confirm stocktake and start week" }),
  );
  expect(readState().weekStart).toBe("2026-10-19");
  expect(readState().pantry?.["Shrimp, peeled|g"]).toBe(125);
});
