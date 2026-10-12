import { expect, it } from "vitest";
import { freshState } from "../src/helpers";
import { recordPurchase, consumeMeal } from "../src/helpers/inventory";
import { availableAcquisitions } from "../src/helpers/shopping";
import { ingredientKey } from "../src/domain";
import { plan } from "./uxSupport";
it("keeps package surplus after consuming the recipe quantity", () => {
  const s = freshState(structuredClone(plan)),
    meal = s.plan.meals[0],
    item = meal.ingredients[0],
    key = ingredientKey(item);
  const bought = recordPurchase(s, item, 500, "freezer", 1, 500);
  const used = consumeMeal(bought, meal.id);
  expect(availableAcquisitions(used, key).purchased).toBe(500 - item.qty);
  expect(used.purchaseReceipts?.[0]).toMatchObject({
    qty: 500,
    packages: 1,
    packageSize: 500,
    location: "freezer",
  });
  expect(() => recordPurchase(s, item, 500, "fridge", 2, 500)).toThrow();
});
