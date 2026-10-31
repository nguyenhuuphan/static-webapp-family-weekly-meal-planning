import { hydrateState } from "../../src/helpers";
import type { Plan } from "../../src/types";
import { parseBackup } from "../../src/validations";
import { json, readJSON } from "../http";
import { DocumentStore } from "../store";
import type { Env } from "../types";
export async function familyPlan(
  request: Request,
  env: Env,
): Promise<Response> {
  const store = new DocumentStore(env.DB, "planner");
  if (request.method === "GET") {
    const entry = await store.getWithMetadata("state.json");
    return json({ state: entry?.data ?? null, revision: entry?.etag ?? null });
  }
  if (request.method !== "PUT")
    return json({ error: "Method not allowed." }, 405);
  try {
    const body = (await readJSON(request, 1_000_000)) as {
      state: unknown;
      revision: string | null;
    };
    const { plan } = parseBackup(body.state);
    if (
      body.revision !== null &&
      (typeof body.revision !== "string" || !body.revision)
    )
      return json({ error: "Invalid revision." }, 400);
    if (!(body.state as { progress?: unknown })?.progress)
      return json({ error: "Invalid saved state." }, 400);
    // Full-state validation covers imported pantry, food records and timers as well as the plan.
    const state = hydrateState(body.state, plan as Plan);
    const result = await store.setJSON(
      "state.json",
      state,
      body.revision === null
        ? { onlyIfNew: true }
        : { onlyIfMatch: body.revision },
    );
    return result.modified
      ? json({ revision: result.etag })
      : json({ error: "A newer shared copy exists." }, 409);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error && error.message === "too_large"
            ? "Plan exceeds 1 MB."
            : "Invalid saved state.",
      },
      error instanceof Error && error.message === "too_large" ? 413 : 400,
    );
  }
}
