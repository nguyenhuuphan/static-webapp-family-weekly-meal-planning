import defaults from "../public/meal-plan.json";
import type { Plan, State } from "../src/types";
import { freshState, hydrateState, STORAGE_KEY } from "../src/domain";
import { calculatePlanner } from "../api/calculations";
import { executeCommand } from "../api/commands";
export const TEST_CODE = "test-only-family-access-code";
export const apiFixture: {
  state: State | null;
  revision: number;
  requests: any[];
  handler:
    | ((
        url: string,
        init?: RequestInit,
      ) => Response | Promise<Response | null> | null)
    | null;
  previous: State | null;
  receipts: Map<string, string>;
} = {
  state: null,
  revision: 1,
  requests: [],
  handler: null,
  previous: null,
  receipts: new Map(),
};
export function resetApiFixture() {
  apiFixture.state = null;
  apiFixture.revision = 1;
  apiFixture.requests = [];
  apiFixture.handler = null;
  apiFixture.previous = null;
  apiFixture.receipts.clear();
}
export function fixtureEnvelope() {
  if (!apiFixture.state) {
    try {
      apiFixture.state = hydrateState(
        JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"),
        defaults as Plan,
      );
    } catch {
      apiFixture.state = freshState(defaults as Plan);
    }
  }
  return {
    state: apiFixture.state,
    revision: apiFixture.revision,
    calculations: calculatePlanner(apiFixture.state),
    serverTime: new Date().toISOString(),
  };
}
export function withPlannerApi(other: typeof fetch): typeof fetch {
  return (async (url: any, init?: RequestInit) => {
    const path = String(url);
    if (!path.includes("/api/v1/")) return other(url, init);
    apiFixture.requests.push({ url: path, ...init });
    const custom = await apiFixture.handler?.(path, init);
    if (custom) return custom;
    if ((init?.headers as any)?.Authorization !== `Bearer ${TEST_CODE}`)
      return Response.json({ error: "invalid_family_code" }, { status: 401 });
    if (path.includes("/events")) return Response.json({ recorded: true });
    if (path.includes("/planner")) return Response.json(fixtureEnvelope());
    if (path.includes("/commands")) {
      const body = JSON.parse(init?.body as string);
      fixtureEnvelope();
      const hash = JSON.stringify(body.command);
      if (apiFixture.receipts.has(body.id))
        return apiFixture.receipts.get(body.id) === hash
          ? Response.json({ ...fixtureEnvelope(), replayed: true })
          : Response.json({ error: "command_id_conflict" }, { status: 409 });
      if (body.revision !== apiFixture.revision)
        return Response.json({ error: "revision_conflict" }, { status: 409 });
      try {
        const previous = structuredClone(apiFixture.state!);
        apiFixture.state = executeCommand(
          previous,
          body.command,
          defaults as Plan,
          apiFixture.previous || undefined,
        );
        apiFixture.previous = previous;
        apiFixture.revision++;
        apiFixture.receipts.set(body.id, hash);
        return Response.json(fixtureEnvelope());
      } catch (e) {
        return Response.json(
          { error: "invalid_operation", message: String(e) },
          { status: 400 },
        );
      }
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }) as typeof fetch;
}
