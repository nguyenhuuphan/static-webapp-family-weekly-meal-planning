import { STORAGE_KEY } from "src/appConfig";
import type { PlannerEnvelope } from "./plannerApi";
export const PLANNER_CACHE_KEY = STORAGE_KEY + ":api-projections-v1";
type CachedProjection = Pick<
  PlannerEnvelope,
  "revision" | "serverTime" | "calculations"
> & { signature: string };
async function signature(raw: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
/** Offline display cache only. Never supplies an expected revision for server writes. */
export async function cacheProjection(envelope: PlannerEnvelope, raw: string) {
  try {
    const hash = await signature(raw);
    if (localStorage.getItem(STORAGE_KEY) !== raw) return;
    const value: CachedProjection = {
      signature: hash,
      revision: envelope.revision,
      serverTime: envelope.serverTime,
      calculations: envelope.calculations,
    };
    localStorage.setItem(PLANNER_CACHE_KEY, JSON.stringify(value));
  } catch {
    /* Server saving does not depend on cache storage. */
  }
}
export async function readProjection(
  raw: string,
): Promise<CachedProjection | null> {
  try {
    const value = JSON.parse(
      localStorage.getItem(PLANNER_CACHE_KEY) || "null",
    ) as CachedProjection | null;
    return value &&
      Number.isSafeInteger(value.revision) &&
      value.calculations &&
      value.signature === (await signature(raw))
      ? value
      : null;
  } catch {
    return null;
  }
}
