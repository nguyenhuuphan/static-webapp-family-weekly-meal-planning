import { afterEach, describe, expect, it } from "vitest";
import { database } from "./database";
import { DocumentStore } from "../store";
import { admitMenu, menuAllowance } from "../menu-allowance";
const dbs: ReturnType<typeof database>[] = [];
function setup() {
  const db = database();
  dbs.push(db);
  return { db: db.db, store: new DocumentStore(db.db, "ai") };
}
afterEach(() => dbs.splice(0).forEach((db) => db.close()));
describe("completed-menu allowance", () => {
  it("ignores old attempt counters and failed/diagnostic jobs, while counting completed menus", async () => {
    const { db, store } = setup(),
      createdAt = new Date().toISOString();
    await store.setJSON("quota/" + createdAt.slice(0, 10), { count: 3 });
    await store.setJSON("jobs/ready", { createdAt, status: "ready" });
    await store.setJSON("jobs/failed", { createdAt, status: "failed" });
    await store.setJSON("jobs/diagnostic", {
      createdAt,
      status: "ready",
      diagnostic: true,
    });
    expect(await menuAllowance(db)).toMatchObject({
      limit: 10,
      used: 1,
      remaining: 9,
    });
  });
  it("atomically admits one concurrent job and releases a failed job without double refunds", async () => {
    const { db, store } = setup(),
      createdAt = new Date().toISOString();
    for (const id of ["a", "b"])
      await store.setJSON("jobs/" + id, {
        createdAt,
        status: "queued",
        admissionPending: true,
      });
    const admitted = await Promise.all([
      admitMenu(db, "a", "1"),
      admitMenu(db, "b", "1"),
    ]);
    expect(admitted.filter(Boolean)).toHaveLength(1);
    const winner = admitted[0] ? "a" : "b",
      loser = admitted[0] ? "b" : "a";
    expect(await menuAllowance(db, "1")).toMatchObject({
      used: 1,
      remaining: 0,
    });
    await store.setJSON("jobs/" + winner, { createdAt, status: "failed" });
    expect(await menuAllowance(db, "1")).toMatchObject({
      used: 0,
      remaining: 1,
    });
    expect(await admitMenu(db, loser, "1")).toBe(true);
    expect(await admitMenu(db, loser, "1")).toBe(false);
    expect(await menuAllowance(db, "1")).toMatchObject({
      used: 1,
      remaining: 0,
    });
  });
  it("retains previous-day successes and resets at midnight UTC (07:00 Vietnam)", async () => {
    const { db, store } = setup();
    await store.setJSON("jobs/yesterday", {
      status: "ready",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    });
    const allowance = await menuAllowance(db);
    expect(allowance.used).toBe(0);
    expect(allowance.resetsAt).toMatch(/T00:00:00.000Z$/);
  });
});
