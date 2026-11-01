import { beforeEach, afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrateNode } from "../../scripts/migrate-node";
import { nodeDatabase } from "../node-database";
import { PlannerService } from "../planner-service";
import { api } from "../app";
import { buildReport } from "../reports";
import { prismaD1Gateway } from "../database";
import { DocumentStore } from "../../cloudflare/store";
import { freshState } from "../../src/helpers";
import { ingredientKey } from "../../src/utils";
import defaults from "../../public/meal-plan.json";
import type { Plan } from "../../src/types";
import type { PlannerCommand } from "../commands";
let dir: string,
  url: string,
  db: ReturnType<typeof nodeDatabase>,
  service: PlannerService;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "planner-api-test-"));
  url = "file:" + join(dir, "data.db");
  migrateNode(url);
  db = nodeDatabase(url);
  service = new PlannerService(db);
});
afterEach(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});
const cmd = async (
  command: PlannerCommand,
  revision?: number,
  id = crypto.randomUUID(),
  actor = "device-one",
) =>
  service.command(
    { id, revision: revision ?? (await service.read()).revision, command },
    actor,
  );
it("persists default state and migrations are repeatable", async () => {
  const first = await service.read();
  expect(first.state.plan.meals).toHaveLength(10);
  expect(first.calculations.shopping.length).toBeGreaterThan(0);
  migrateNode(url);
  expect((await service.read()).revision).toBe(first.revision);
  expect(await db.mealRecord.count()).toBe(10);
});
it("imports existing state and receipt photos without changing the source JSON", async () => {
  await db.$disconnect();
  const legacy = freshState(defaults as Plan);
  legacy.servings = 4;
  const sql = new DatabaseSync(url.slice(5));
  sql.exec(
    "DROP TABLE _api_migrations; DROP TRIGGER planner_state_insert; DROP TRIGGER planner_state_update; DELETE FROM planner_state;",
  );
  const raw = JSON.stringify(legacy);
  sql
    .prepare(
      "INSERT OR REPLACE INTO documents(namespace,key,value,revision) VALUES(?,?,?,?)",
    )
    .run("planner", "state.json", raw, "legacy-revision");
  const photo = crypto.randomUUID(),
    invoice = crypto.randomUUID();
  sql
    .prepare(
      "INSERT INTO receipt_photos(id,invoice_id,data,byte_size) VALUES(?,?,?,?)",
    )
    .run(photo, invoice, "private-jpeg", 12);
  sql.close();
  migrateNode(url);
  db = nodeDatabase(url);
  service = new PlannerService(db);
  expect((await service.read()).state.servings).toBe(4);
  expect(
    (await db.plannerState.findUniqueOrThrow({ where: { id: "family" } }))
      .value,
  ).toBe(raw);
  expect(
    (await db.receiptPhoto.findUniqueOrThrow({ where: { id: photo } })).data,
  ).toBe("private-jpeg");
});
it("uses compare-and-swap so another device cannot overwrite a later revision", async () => {
  const v = await service.read();
  await cmd(
    { name: "meal.portions", args: { id: "mon-lunch", count: 1 } },
    v.revision,
  );
  await expect(
    cmd(
      { name: "household.servings", args: { servings: 6 } },
      v.revision,
      crypto.randomUUID(),
      "device-two",
    ),
  ).rejects.toMatchObject({ status: 409, code: "revision_conflict" });
  expect((await service.read()).state.mealServings?.["mon-lunch"]).toBe(1);
  expect((await service.read()).state.servings).toBe(2);
});
it("retries the same purchase once and rejects reused IDs with different intent", async () => {
  const v = await service.read(),
    key = ingredientKey(v.calculations.shopping[0]),
    id = crypto.randomUUID();
  const command: PlannerCommand = {
    name: "purchase.record",
    args: {
      key,
      qty: 500,
      location: "fridge",
      details: {
        paid: { amount: 50000, currency: "VND" },
        purchasedOn: "2026-11-01",
      },
    },
  };
  await cmd(command, v.revision, id);
  expect(await cmd(command, v.revision, id)).toMatchObject({
    revision: 2,
    replayed: true,
  });
  expect(await db.purchaseRecord.count()).toBe(1);
  expect(await db.commandReceipt.count()).toBe(1);
  expect((await service.read()).state.purchased?.[key].qty).toBe(500);
  await expect(
    cmd({ ...command, args: { ...command.args, qty: 1000 } }, v.revision, id),
  ).rejects.toMatchObject({ code: "command_id_conflict" });
  await expect(
    cmd(command, v.revision, id, "device-two"),
  ).rejects.toMatchObject({ code: "command_id_conflict" });
});
it("projects invoice totals without double counting linked purchase prices or mixing currencies", async () => {
  const v = await service.read(),
    key = ingredientKey(v.calculations.shopping[0]),
    id = crypto.randomUUID(),
    now = new Date().toISOString();
  await cmd({
    name: "invoice.save",
    args: {
      invoice: {
        id,
        shop: "Market",
        purchasedOn: "2026-11-01",
        total: { amount: 100000, currency: "VND" },
        note: "",
        photos: [],
        createdAt: now,
        updatedAt: now,
      },
    },
  });
  for (const details of [
    { paid: { amount: 40000, currency: "VND" }, invoiceId: id },
    { paid: { amount: 25000, currency: "VND" } },
    { paid: { amount: 1234, currency: "USD" } },
    { paid: { amount: 0, currency: "EUR" } },
    {},
  ])
    await cmd({
      name: "purchase.record",
      args: {
        key,
        qty: 100,
        location: "fridge",
        details: { ...details, purchasedOn: "2026-11-01" },
      },
    });
  const report = await buildReport(db, "2026-11-01", "2026-11-01");
  expect(report.spending).toEqual(
    expect.arrayContaining([
      { currency: "VND", amountMinor: "125000" },
      { currency: "USD", amountMinor: "1234" },
      { currency: "EUR", amountMinor: "0" },
    ]),
  );
  expect(report.unpricedPurchases).toBe(1);
  expect(report.invoices).toBe(1);
  expect(report.purchases).toBe(5);
});
it("rolls back state, receipt and report rows together if a projection fails", async () => {
  const v = await service.read();
  await db.$executeRawUnsafe(
    "CREATE TRIGGER fail_report BEFORE UPDATE ON meal_records BEGIN SELECT RAISE(ABORT,'simulated failure'); END",
  );
  await expect(
    cmd({ name: "meal.portions", args: { id: "mon-lunch", count: 1 } }),
  ).rejects.toThrow();
  expect((await service.read()).revision).toBe(v.revision);
  expect(await db.commandReceipt.count()).toBe(0);
  expect(await db.stateVersion.count()).toBe(0);
});
it("preserves independent prep checks and only marks source complete when all parts are done", async () => {
  const state = freshState(defaults as Plan),
    meal = state.plan.meals[0];
  meal.ingredients = [
    {
      id: "chicken",
      name: "Chicken",
      category: "Protein",
      qty: 300,
      unit: "g",
    },
    {
      id: "broccoli",
      name: "Broccoli",
      category: "Produce",
      qty: 200,
      unit: "g",
    },
    { id: "rice", name: "Rice", category: "Pantry", qty: 150, unit: "g" },
  ];
  meal.prep = [
    { text: "Slice chicken. Cut broccoli.", minutes: 3 },
    { text: "Rinse rice and cook in a rice cooker.", minutes: 15 },
  ];
  await cmd({ name: "state.restore", args: { state } });
  const groups = (await service.read()).calculations.preparation;
  expect(groups.some((g) => g.operation === "cookJustInTime")).toBe(false);
  await cmd({
    name: "prep.complete",
    args: { keys: ["mon-lunch:0::Produce"], value: true },
  });
  expect((await service.read()).state.progress.prep["mon-lunch:0"]).toBe(false);
  await cmd({
    name: "prep.complete",
    args: { keys: ["mon-lunch:0::Protein"], value: true },
  });
  expect((await service.read()).calculations.meals["mon-lunch"].prepared).toBe(
    true,
  );
});
it("undo restores the previous server revision and keeps a correction audit", async () => {
  await cmd({ name: "meal.portions", args: { id: "mon-lunch", count: 1 } });
  await cmd({ name: "state.undo", args: {} });
  const state = (await service.read()).state;
  expect(state.mealServings?.["mon-lunch"] ?? state.servings).toBe(2);
  expect(state.corrections).toHaveLength(1);
  expect(await db.commandReceipt.count()).toBe(2);
  expect(await db.stateVersion.count()).toBe(2);
});
it("records only allowlisted anonymous navigation events and deduplicates retries", async () => {
  const id = crypto.randomUUID();
  const send = (body: unknown) =>
    api.request(
      "/api/v1/events",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": "a-browser-id",
        },
        body: JSON.stringify(body),
      },
      { prisma: db },
    );
  expect((await send({ id, kind: "view.open", view: "reports" })).status).toBe(
    200,
  );
  expect((await send({ id, kind: "view.open", view: "reports" })).status).toBe(
    200,
  );
  expect(await db.behaviorEvent.count()).toBe(1);
  const row = await db.behaviorEvent.findFirstOrThrow();
  expect(row.actor).toMatch(/^[a-f0-9]{64}$/);
  expect(
    (
      await send({
        id: crypto.randomUUID(),
        kind: "view.open",
        view: "prep",
        prompt: "private content",
      })
    ).status,
  ).toBe(400);
});
it("rejects invalid operations and report parameters without changing data", async () => {
  await service.read();
  await expect(
    cmd({
      name: "purchase.record",
      args: { key: "unknown", qty: -1, location: "freezer" },
    }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    buildReport(db, "2026-02-30", "2026-11-01"),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    buildReport(db, "2026-11-01", "2026-11-01", "invalid-zone"),
  ).rejects.toMatchObject({ status: 400 });
  expect((await service.read()).revision).toBe(1);
});
it("retains 20 state versions and expires behavioral data after 90 days", async () => {
  await service.read();
  await db.behaviorEvent.create({
    data: {
      id: crypto.randomUUID(),
      kind: "view.open",
      view: "week",
      actor: "old",
      createdAt: "2020-01-01T00:00:00.000Z",
    },
  });
  for (let i = 0; i < 23; i++)
    await cmd({
      name: "meal.portions",
      args: { id: "mon-lunch", count: (i % 2) + 1 },
    });
  expect(await db.stateVersion.count()).toBe(20);
  expect(await db.behaviorEvent.count({ where: { actor: "old" } })).toBe(0);
});
it("uses the same Prisma connection for legacy AI/translation/photo stores", async () => {
  const store = new DocumentStore(prismaD1Gateway(db), "test");
  await store.setJSON("settings", { master: "private" }, { onlyIfNew: true });
  expect(await store.get("settings")).toEqual({ master: "private" });
  expect(
    await store.setJSON("settings", { master: "changed" }, { onlyIfNew: true }),
  ).toEqual({ modified: false });
  expect(await store.get("settings")).toEqual({ master: "private" });
});

it("persists a running cooking timer while returning inventory and prep calculations", async () => {
  const result = await cmd({
    name: "timer.start",
    args: { id: "mon-lunch", index: 2 },
  });
  expect(result.state.timer?.step).toBe(2);
  expect(result.calculations.stocktake).toBeDefined();
  expect(
    (await service.read()).state.cookingBatches?.["mon-lunch"].servings,
  ).toBe(2);
});

it("calculates stocktake without cancelling cooking and matches the original inventory reservation rules", async () => {
  const { calculateStocktake } = await import("../calculations");
  const { retainPrepared } = await import("../../src/helpers/scheduling");
  const { stocktakeCandidates, recordPurchase } =
    await import("../../src/helpers/inventory");
  const { hydrateState } = await import("../../src/helpers");
  const { setPreparationProgress } =
    await import("../../src/helpers/preparationProgress");
  for (const mode of ["raw", "partly-prepared", "prepared"]) {
    let state = hydrateState(freshState(defaults as Plan), defaults as Plan);
    for (const item of state.plan.meals[0].ingredients)
      state = recordPurchase(state, item, item.qty * 4, "fridge");
    if (mode !== "raw")
      for (const [i] of state.plan.meals[0].prep.entries()) {
        if (mode === "partly-prepared" && i > 0) break;
        setPreparationProgress(state, `mon-lunch:${i}`, true);
      }
    const expected = stocktakeCandidates(retainPrepared(state)).map(
      ({ key, estimated }) => ({ key, estimated }),
    );
    expect(
      calculateStocktake(state).map(({ key, estimated }) => ({
        key,
        estimated,
      })),
    ).toEqual(expected);
  }
});

it("keeps retained-and-reassigned prepared stock out of raw stocktake without double counting", async () => {
  const { calculateStocktake } = await import("../calculations");
  const { retainPrepared, changePortions, assignFood } =
    await import("../../src/helpers/scheduling");
  const { recordPurchase, stocktakeCandidates } =
    await import("../../src/helpers/inventory");
  const { hydrateState } = await import("../../src/helpers");
  const { setPreparationProgress } =
    await import("../../src/helpers/preparationProgress");
  let state = hydrateState(freshState(defaults as Plan), defaults as Plan);
  for (const item of state.plan.meals[0].ingredients)
    state = recordPurchase(state, item, item.qty * 4, "fridge");
  setPreparationProgress(state, "mon-lunch:0", true);
  state = changePortions(state, "mon-lunch", 0);
  const food = state.savedFood!.find((f) => f.kind === "prepared")!;
  state = assignFood(state, food.id, "thu-dinner");
  expect(
    calculateStocktake(state).map(({ key, estimated }) => ({ key, estimated })),
  ).toEqual(
    stocktakeCandidates(retainPrepared(state)).map(({ key, estimated }) => ({
      key,
      estimated,
    })),
  );
});
it("persists photo bytes via Prisma and protects a photo linked by a confirmed invoice", async () => {
  const { receiptPhotos } =
    await import("../../cloudflare/routes/receipt-photos");
  const env = { DB: prismaD1Gateway(db) } as any;
  const id = crypto.randomUUID(),
    invoiceId = crypto.randomUUID(),
    data =
      "data:image/jpeg;base64," +
      btoa(String.fromCharCode(255, 216, 255, 0, 255, 217));
  const request = () =>
    new Request("http://localhost/api/receipt-photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, invoiceId, data }),
    });
  expect((await receiptPhotos(request(), env)).status).toBe(201);
  expect((await receiptPhotos(request(), env)).status).toBe(200);
  expect(await db.receiptPhoto.count()).toBe(1);
  const now = new Date().toISOString();
  await cmd({
    name: "invoice.save",
    args: {
      invoice: {
        id: invoiceId,
        shop: "Test market",
        purchasedOn: "2026-11-01",
        note: "",
        photos: [id],
        createdAt: now,
        updatedAt: now,
      },
    },
  });
  expect(
    (
      await receiptPhotos(
        new Request("http://localhost/api/receipt-photos?id=" + id, {
          method: "DELETE",
        }),
        env,
      )
    ).status,
  ).toBe(409);
  expect(
    await (
      await receiptPhotos(
        new Request("http://localhost/api/receipt-photos?id=" + id),
        env,
      )
    ).json(),
  ).toEqual({ data });
});

it("fences legacy JSON writers during rollout while keeping API-to-legacy mirroring atomic", async () => {
  const before = await service.read();
  await expect(
    db.document.update({
      where: { namespace_key: { namespace: "planner", key: "state.json" } },
      data: {
        value: JSON.stringify({ ...before.state, servings: 9 }),
        revision: "legacy-stale-writer",
      },
    }),
  ).rejects.toThrow();
  expect((await service.read()).state.servings).toBe(2);
  await cmd({ name: "meal.portions", args: { id: "mon-lunch", count: 1 } });
  const mirror = await db.document.findUniqueOrThrow({
    where: { namespace_key: { namespace: "planner", key: "state.json" } },
  });
  expect(mirror.revision).toBe("api-2");
  expect(JSON.parse(mirror.value).mealServings["mon-lunch"]).toBe(1);
});
