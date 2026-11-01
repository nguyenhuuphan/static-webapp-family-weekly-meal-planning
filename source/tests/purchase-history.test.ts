import { expect, it } from "vitest";
import original from "../public/meal-plan.json";
import { freshState, hydrateState } from "../src/helpers";
import { recordPurchase } from "../src/helpers/inventory";
import { startWeek } from "../src/helpers/scheduling";
import {
  parseMoney,
  moneyInput,
  validPurchaseDate,
  saveInvoice,
  type ShoppingInvoice,
} from "../src/helpers/purchaseHistory";
import type { Plan } from "../src/types";
const invoice: ShoppingInvoice = {
  id: "20000000-0000-4000-8000-000000000001",
  shop: "Siêu thị",
  purchasedOn: "2026-11-01",
  total: { amount: 125000, currency: "VND" },
  note: "Cá hồi",
  photos: ["20000000-0000-4000-8000-000000000002"],
  createdAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-01T10:00:00Z",
};
it("stores exact money in currency minor units, distinguishing blank from zero", () => {
  expect(parseMoney("", "VND")).toBeUndefined();
  expect(parseMoney("0", "VND")).toEqual({ amount: 0, currency: "VND" });
  expect(parseMoney("125000", "VND")).toEqual({
    amount: 125000,
    currency: "VND",
  });
  expect(parseMoney("12.34", "USD")).toEqual({ amount: 1234, currency: "USD" });
  expect(moneyInput({ amount: 1234, currency: "USD" })).toBe("12.34");
  for (const bad of ["-1", "NaN", "1e3", "1.5", "100000000000001"])
    expect(() => parseMoney(bad, "VND")).toThrow();
  expect(() => parseMoney("1.123", "USD")).toThrow();
  expect(validPurchaseDate("2026-02-30")).toBe(false);
  expect(validPurchaseDate("2026-99-01")).toBe(false);
});
it("keeps invoices, photo references, prices and ingredient snapshots through backup and a new week", () => {
  let s = freshState(structuredClone(original as Plan));
  s.weekStart = "2026-10-26";
  s = saveInvoice(s, invoice);
  s = recordPurchase(
    s,
    s.plan.meals[0].ingredients[0],
    500,
    "fridge",
    undefined,
    undefined,
    {
      paid: { amount: 125000, currency: "VND" },
      invoiceId: invoice.id,
      purchasedOn: invoice.purchasedOn,
      shop: invoice.shop,
    },
  );
  const history = structuredClone(s.purchaseReceipts);
  const next = startWeek(
    hydrateState(JSON.parse(JSON.stringify(s)), original as Plan),
    "2026-11-02",
  );
  expect(next.shoppingInvoices).toEqual([invoice]);
  expect(next.purchaseReceipts).toEqual(history);
  expect(next.purchaseReceipts?.[0].name).toBe(
    s.plan.meals[0].ingredients[0].name,
  );
  expect(next.purchased).toEqual({});
  const changed = saveInvoice(next, { ...invoice, note: "Edited" });
  expect(changed.shoppingInvoices).toHaveLength(1);
  expect(next.shoppingInvoices?.[0].note).toBe("Cá hồi");
});
it("rejects corrupt financial values and photo references while accepting older unpriced records", () => {
  const s = freshState(structuredClone(original as Plan));
  expect(() =>
    saveInvoice(s, { ...invoice, total: { amount: -1, currency: "VND" } }),
  ).toThrow();
  expect(() => saveInvoice(s, { ...invoice, photos: ["bad"] })).toThrow();
  const recorded = recordPurchase(
    s,
    s.plan.meals[0].ingredients[0],
    1,
    "unknown",
  );
  expect(() => hydrateState(recorded, original as Plan)).not.toThrow();
  recorded.purchaseReceipts![0].paid = { amount: 0.5, currency: "VND" };
  expect(() => hydrateState(recorded, original as Plan)).toThrow();
});
