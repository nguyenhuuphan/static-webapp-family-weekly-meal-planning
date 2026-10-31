import { getStore } from "@netlify/blobs";
export const aiStore = () =>
  getStore({ name: "family-menu-ai", consistency: "strong" });
// CAS makes the family-wide limit work across concurrent function instances.
export async function reserveGeneration(): Promise<boolean> {
  const store = aiStore();
  const limit = Math.min(
    10,
    Math.max(
      0,
      Number.parseInt(process.env.AI_MAX_DAILY_REQUESTS || "3", 10) || 0,
    ),
  );
  const key = "quota/" + new Date().toISOString().slice(0, 10);
  for (let attempt = 0; attempt < 4; attempt++) {
    const old = await store.getWithMetadata(key, { type: "json" });
    const count =
      Number((old?.data as { count?: number } | undefined)?.count) || 0;
    if (count >= limit) return false;
    const result = await store.setJSON(
      key,
      { count: count + 1 },
      old ? { onlyIfMatch: old.etag } : { onlyIfNew: true },
    );
    if (result.modified) return true;
  }
  return false;
}
