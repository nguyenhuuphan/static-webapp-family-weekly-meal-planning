import { apiEndpoint } from "src/services/apiEndpoint";
export class MenuApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export async function menuRequest<T>(
  code: string,
  body?: unknown,
  job?: string,
): Promise<T> {
  const response = await fetch(
    apiEndpoint("ai-menu") + (job ? "?job=" + encodeURIComponent(job) : ""),
    {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${code}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    },
  );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new MenuApiError("network");
  }
  if (!response.ok)
    throw new MenuApiError(
      [401, 403].includes(response.status)
        ? "unauthorized"
        : typeof data.error === "string"
          ? data.error
          : "network",
    );
  return data;
}
