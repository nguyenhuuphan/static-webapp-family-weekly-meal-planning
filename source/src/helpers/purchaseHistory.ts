import type { State } from "src/types";
export const CURRENCIES = ["VND", "USD", "EUR"] as const;
export type Money = { amount: number; currency: (typeof CURRENCIES)[number] };
export type ShoppingInvoice = {
  id: string;
  shop: string;
  purchasedOn: string;
  total?: Money;
  note: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
};
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function localPurchaseDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function validPurchaseDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const date = new Date(s + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s
  );
}
export function validMoney(value: unknown): value is Money {
  if (!value || typeof value !== "object") return false;
  const m = value as Money;
  return (
    CURRENCIES.includes(m.currency) &&
    Number.isSafeInteger(m.amount) &&
    m.amount >= 0 &&
    m.amount <= 1e14
  );
}
export function parseMoney(
  value: string,
  currency: Money["currency"],
): Money | undefined {
  if (!value.trim()) return undefined;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw Error("invalid_price");
  const amount = Number(value) * (currency === "VND" ? 1 : 100);
  const result = { amount: Math.round(amount), currency };
  if (!validMoney(result) || Math.abs(amount - result.amount) > 0.00001)
    throw Error("invalid_price");
  return result;
}
export const moneyInput = (value?: Money) =>
  value ? String(value.amount / (value.currency === "VND" ? 1 : 100)) : "";
export function formatMoney(value: Money, language = "vi") {
  return new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: value.currency,
    maximumFractionDigits: value.currency === "VND" ? 0 : 2,
  }).format(value.amount / (value.currency === "VND" ? 1 : 100));
}
export function validatePurchaseHistory(state: State) {
  const invoices = state.shoppingInvoices;
  if (
    invoices !== undefined &&
    (!Array.isArray(invoices) || invoices.length > 2000)
  )
    throw Error("Invalid invoice history.");
  const ids = new Set<string>();
  for (const invoice of invoices || []) {
    if (
      !invoice ||
      !UUID.test(invoice.id) ||
      ids.has(invoice.id) ||
      typeof invoice.shop !== "string" ||
      invoice.shop.length > 160 ||
      !validPurchaseDate(invoice.purchasedOn) ||
      (invoice.total !== undefined && !validMoney(invoice.total)) ||
      typeof invoice.note !== "string" ||
      invoice.note.length > 2000 ||
      !Array.isArray(invoice.photos) ||
      invoice.photos.length > 6 ||
      new Set(invoice.photos).size !== invoice.photos.length ||
      invoice.photos.some((id) => typeof id !== "string" || !UUID.test(id)) ||
      typeof invoice.createdAt !== "string" ||
      typeof invoice.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(invoice.createdAt)) ||
      !Number.isFinite(Date.parse(invoice.updatedAt))
    )
      throw Error("Invalid invoice history.");
    ids.add(invoice.id);
  }
  for (const receipt of state.purchaseReceipts || []) {
    if (
      (receipt.paid !== undefined && !validMoney(receipt.paid)) ||
      (receipt.invoiceId !== undefined &&
        (typeof receipt.invoiceId !== "string" ||
          !UUID.test(receipt.invoiceId))) ||
      (receipt.name !== undefined &&
        (typeof receipt.name !== "string" ||
          !receipt.name.trim() ||
          receipt.name.length > 300)) ||
      (receipt.shop !== undefined &&
        (typeof receipt.shop !== "string" || receipt.shop.length > 160)) ||
      (receipt.purchasedOn !== undefined &&
        !validPurchaseDate(receipt.purchasedOn))
    )
      throw Error("Invalid purchase price.");
  }
}
export function saveInvoice(state: State, invoice: ShoppingInvoice): State {
  const next = {
    ...state,
    shoppingInvoices: [
      ...(state.shoppingInvoices || []).filter((i) => i.id !== invoice.id),
      invoice,
    ],
  };
  validatePurchaseHistory(next);
  return next;
}
export function purchaseName(
  state: State,
  receipt: NonNullable<State["purchaseReceipts"]>[number],
) {
  return (
    receipt.name ||
    state.purchased?.[receipt.key]?.name ||
    [...(state.stockHistory || [])]
      .reverse()
      .find((entry) => entry.purchased?.[receipt.key])?.purchased?.[receipt.key]
      ?.name ||
    receipt.key.split("|")[0]
  );
}
