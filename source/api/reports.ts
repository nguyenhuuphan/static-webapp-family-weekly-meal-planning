import type { Database } from "./database";
import { ApiError, PlannerService } from "./planner-service";
import { validPurchaseDate } from "src/helpers/purchaseHistory";
export async function buildReport(
  db: Database,
  from: string,
  to: string,
  timeZone = "Asia/Ho_Chi_Minh",
) {
  if (
    !validPurchaseDate(from) ||
    !validPurchaseDate(to) ||
    from > to ||
    Date.parse(to) - Date.parse(from) > 366 * 86400000
  )
    throw new ApiError(400, "invalid_date_range");
  let day: Intl.DateTimeFormat;
  try {
    day = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    });
    day.format(new Date());
  } catch {
    throw new ApiError(400, "invalid_timezone");
  }
  const [purchases, invoices, invoiced, eventRows, meals] = await Promise.all([
    db.purchaseRecord.findMany({
      where: { purchasedOn: { gte: from, lte: to } },
      orderBy: { purchasedOn: "desc" },
    }),
    db.invoiceRecord.findMany({
      where: { purchasedOn: { gte: from, lte: to } },
      orderBy: { purchasedOn: "desc" },
    }),
    db.invoiceRecord.findMany({
      where: { totalMinor: { not: null } },
      select: { id: true },
    }),
    db.behaviorEvent.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.parse(from) - 86400000).toISOString(),
          lte: new Date(Date.parse(to) + 2 * 86400000).toISOString(),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    db.mealRecord.findMany(),
  ]);
  const invoiceIds = new Set(invoiced.map((i) => i.id));
  const spend = new Map<string, bigint>(),
    daily = new Map<string, bigint>();
  const add = (date: string, currency: string | null, value: bigint | null) => {
    if (currency && value !== null) {
      spend.set(currency, (spend.get(currency) || 0n) + value);
      const key = date + "|" + currency;
      daily.set(key, (daily.get(key) || 0n) + value);
    }
  };
  invoices.forEach((i) => add(i.purchasedOn, i.currency, i.totalMinor));
  purchases
    .filter((p) => !p.invoiceId || !invoiceIds.has(p.invoiceId))
    .forEach((p) => add(p.purchasedOn, p.currency, p.paidMinor));
  const events = eventRows.filter((e) => {
    const d = day.format(new Date(e.createdAt));
    return d >= from && d <= to;
  });
  const actions = new Map<string, number>();
  events.forEach((e) => actions.set(e.kind, (actions.get(e.kind) || 0) + 1));
  const current = JSON.parse(
    (await new PlannerService(db).current()).value,
  ) as import("src/types").State;
  const results = [
    ...Object.values(current.mealResults || {}),
    ...Object.values(current.weekArchive || {}).flatMap((w) =>
      Object.values(w.mealResults || {}),
    ),
  ].filter((r) => {
    const d = day.format(new Date(r.at));
    return d >= from && d <= to;
  });
  return {
    from,
    to,
    timeZone,
    generatedAt: new Date().toISOString(),
    spending: [...spend].map(([currency, amountMinor]) => ({
      currency,
      amountMinor: amountMinor.toString(),
    })),
    dailySpend: [...daily]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, amount]) => ({
        date: key.split("|")[0],
        currency: key.split("|")[1],
        amountMinor: amount.toString(),
      })),
    purchases: purchases.length,
    unpricedPurchases: purchases.filter((p) => p.paidMinor === null).length,
    invoices: invoices.length,
    receiptPhotos: invoices.reduce(
      (n, i) => n + (JSON.parse(i.photos) as string[]).length,
      0,
    ),
    cooking: {
      recordedMeals: results.length,
      cooked: results.reduce((n, r) => n + r.cooked, 0),
      eaten: results.reduce((n, r) => n + r.eaten, 0),
      leftovers: results.reduce((n, r) => n + r.remaining, 0),
      currentPlanned: meals.filter((m) => m.servings > 0).length,
      currentDone: meals.filter((m) => m.done).length,
    },
    activity: {
      activeDevices: new Set(
        events.filter((e) => e.actor !== "system").map((e) => e.actor),
      ).size,
      total: events.length,
      actions: [...actions].map(([kind, count]) => ({ kind, count })),
      recent: events
        .slice(0, 30)
        .map(({ kind, view, createdAt }) => ({ kind, view, createdAt })),
    },
    notes: {
      spendingBasis:
        "Invoice totals plus purchases not covered by an invoice total; currencies are never combined.",
      activityRetentionDays: 90,
    },
  };
}
export type ApiReport = Awaited<ReturnType<typeof buildReport>>;
