import { apiEndpoint } from "./apiEndpoint";
import type { PlannerEnvelope } from "../../api/calculations";
import type { PlannerCommand } from "../../api/commands";
export type { PlannerEnvelope };
export class PlannerApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
  }
}
export function browserClientId() {
  try {
    let id = localStorage.getItem("planner:client-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("planner:client-id", id);
    }
    return id;
  } catch {
    return "browser";
  }
}
export async function plannerRequest<T>(
  code: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(apiEndpoint("v1/" + path), {
    method: body ? "POST" : "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${code}`,
      "X-Client-Id": browserClientId(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new PlannerApiError(
      response.status,
      "network",
      "Could not read the API response.",
    );
  }
  if (!response.ok)
    throw new PlannerApiError(
      response.status,
      result.error || "network",
      result.message || result.error || "API request failed.",
    );
  return result as T;
}
export const readPlanner = (code: string) =>
  plannerRequest<PlannerEnvelope>(code, "planner");
export const sendCommand = (
  code: string,
  id: string,
  revision: number,
  command: PlannerCommand,
) =>
  plannerRequest<PlannerEnvelope>(code, "commands", { id, revision, command });
