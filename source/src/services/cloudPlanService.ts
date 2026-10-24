import type { State } from "src/types";
export class CloudError extends Error {
  constructor(public status: number) {
    super(`Cloud request failed (${status})`);
  }
}
export async function cloudRequest(
  code: string,
  state?: State,
  revision?: string | null,
) {
  const response = await fetch("/.netlify/functions/family-plan", {
    method: state ? "PUT" : "GET",
    headers: {
      Authorization: `Bearer ${code}`,
      ...(state ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    ...(state ? { body: JSON.stringify({ state, revision }) } : {}),
  });
  if (!response.ok) throw new CloudError(response.status);
  const result = await response.json();
  if (!(typeof result.revision === "string" || result.revision === null))
    throw Error("Invalid cloud response");
  return result as { state?: unknown; revision: string | null };
}
