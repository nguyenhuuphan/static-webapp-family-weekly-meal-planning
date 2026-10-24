import { getStore } from "@netlify/blobs";
import { authorize, json } from "../shared";
import { parseBackup } from "../../src/validations";

export default async function handler(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  if (!["GET", "PUT"].includes(request.method))
    return json({ error: "Method not allowed." }, 405);
  try {
    const store = getStore({
      name: "family-meal-planner",
      consistency: "strong",
    });
    if (request.method === "GET") {
      const entry = await store.getWithMetadata("state.json", { type: "json" });
      return json(
        entry
          ? { state: entry.data, revision: entry.etag }
          : { state: null, revision: null },
      );
    }
    if (!request.headers.get("Content-Type")?.startsWith("application/json"))
      return json({ error: "JSON required." }, 415);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      return json({ error: "Plan exceeds 1 MB." }, 413);
    let body;
    try {
      body = JSON.parse(raw);
      parseBackup(body.state);
      if (
        !body.state.progress ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.state.weekStart)
      )
        throw Error();
      if (
        body.revision !== null &&
        (typeof body.revision !== "string" || !body.revision)
      )
        throw Error();
    } catch {
      return json({ error: "Invalid plan or revision." }, 400);
    }
    const result = await store.setJSON(
      "state.json",
      body.state,
      body.revision === null
        ? { onlyIfNew: true }
        : { onlyIfMatch: body.revision },
    );
    if (!result.modified)
      return json(
        { error: "Another device saved a newer copy. Load it before editing." },
        409,
      );
    return json({ revision: result.etag });
  } catch {
    return json(
      { error: "Shared storage is unavailable. Your local copy is preserved." },
      503,
    );
  }
}
