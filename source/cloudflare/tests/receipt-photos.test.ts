import { afterEach, beforeEach, expect, it } from "vitest";
import { database } from "./database";
import { receiptPhotos } from "../routes/receipt-photos";
import type { Env } from "../types";
let db: ReturnType<typeof database>, env: Env;
const invoiceId = "20000000-0000-4000-8000-000000000001",
  id = "20000000-0000-4000-8000-000000000002";
const data =
  "data:image/jpeg;base64," +
  btoa(String.fromCharCode(255, 216, 255, 0, 255, 217));
function request(method = "GET", body?: unknown, photo = id) {
  return new Request("https://example.test/api/receipt-photos?id=" + photo, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  db = database();
  env = { DB: db.db } as Env;
});
afterEach(() => db.close());
it("stores private photo bytes idempotently and retrieves them independently of planner JSON", async () => {
  expect((await receiptPhotos(request("GET"), env)).status).toBe(404);
  expect(
    (await receiptPhotos(request("POST", { id, invoiceId, data }), env)).status,
  ).toBe(201);
  expect(
    (await receiptPhotos(request("POST", { id, invoiceId, data }), env)).status,
  ).toBe(200);
  const found = await receiptPhotos(request(), env);
  expect(found.headers.get("Cache-Control")).toBe("no-store");
  expect(await found.json()).toEqual({ data });
  const rows = await env.DB.prepare(
    "SELECT COUNT(*) n FROM receipt_photos",
  ).first<{ n: number }>();
  expect(rows?.n).toBe(1);
  expect(
    (
      await receiptPhotos(
        request("POST", { id, invoiceId: crypto.randomUUID(), data }),
        env,
      )
    ).status,
  ).toBe(409);
});
it("refuses SVG, arbitrary payloads, malformed IDs and oversized camera uploads", async () => {
  for (const invalid of [
    "data:image/svg+xml;base64,PHN2Zy8+",
    "data:image/jpeg;base64,AAAA",
    "data:image/jpeg;base64,invalid==",
  ])
    expect(
      (
        await receiptPhotos(
          request("POST", { id, invoiceId, data: invalid }),
          env,
        )
      ).status,
    ).toBe(400);
  expect(
    (await receiptPhotos(request("GET", undefined, "../private"), env)).status,
  ).toBe(400);
  const huge = "data:image/jpeg;base64," + btoa("a".repeat(524289));
  expect(
    (await receiptPhotos(request("POST", { id, invoiceId, data: huge }), env))
      .status,
  ).toBe(413);
});
it("bounds per-receipt storage even when clients submit different IDs", async () => {
  for (let i = 0; i < 6; i++)
    expect(
      (
        await receiptPhotos(
          request("POST", { id: crypto.randomUUID(), invoiceId, data }),
          env,
        )
      ).status,
    ).toBe(201);
  expect(
    (
      await receiptPhotos(
        request("POST", { id: crypto.randomUUID(), invoiceId, data }),
        env,
      )
    ).status,
  ).toBe(409);
});
it("discards only unlinked draft photos and preserves images referenced by saved family receipts", async () => {
  await receiptPhotos(request("POST", { id, invoiceId, data }), env);
  const state = { shoppingInvoices: [{ photos: [id] }] };
  await env.DB.prepare(
    "INSERT INTO documents(namespace,key,value,revision) VALUES('planner','state.json',?,'test')",
  )
    .bind(JSON.stringify(state))
    .run();
  expect((await receiptPhotos(request("DELETE"), env)).status).toBe(409);
  expect((await receiptPhotos(request(), env)).status).toBe(200);
  await env.DB.prepare("DELETE FROM documents WHERE namespace='planner'").run();
  expect((await receiptPhotos(request("DELETE"), env)).status).toBe(200);
  expect((await receiptPhotos(request("DELETE"), env)).status).toBe(200);
  expect((await receiptPhotos(request(), env)).status).toBe(404);
});
it("round-trips prices and invoice references through the family sync API", async () => {
  const { familyPlan } = await import("../routes/family-plan");
  const { freshState } = await import("../../src/helpers");
  const { recordPurchase } = await import("../../src/helpers/inventory");
  const { saveInvoice } = await import("../../src/helpers/purchaseHistory");
  const original = (await import("../../public/meal-plan.json")).default;
  let state = freshState(original as import("../../src/types").Plan);
  const now = new Date().toISOString();
  state = saveInvoice(state, {
    id: invoiceId,
    shop: "Market",
    purchasedOn: "2026-11-01",
    total: { amount: 125000, currency: "VND" },
    note: "Food",
    photos: [id],
    createdAt: now,
    updatedAt: now,
  });
  state = recordPurchase(
    state,
    state.plan.meals[0].ingredients[0],
    500,
    "fridge",
    undefined,
    undefined,
    {
      paid: { amount: 125000, currency: "VND" },
      invoiceId,
      purchasedOn: "2026-11-01",
    },
  );
  const saved = await familyPlan(
    new Request("https://example.test/api/family-plan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, revision: null }),
    }),
    env,
  );
  expect(saved.status).toBe(200);
  const read = (await (
    await familyPlan(new Request("https://example.test/api/family-plan"), env)
  ).json()) as { state: import("../../src/types").State };
  expect(read.state.shoppingInvoices).toEqual(state.shoppingInvoices);
  expect(read.state.purchaseReceipts).toEqual(state.purchaseReceipts);
});
