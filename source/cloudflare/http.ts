import type { Env } from "./types";
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}
export async function requireFamilyCode(
  request: Request,
  env: Env,
): Promise<Response | null> {
  if (!sameOrigin(request))
    return json({ error: "Cross-origin request refused." }, 403);
  if (!env.FAMILY_ACCESS_CODE || env.FAMILY_ACCESS_CODE.length < 16)
    return json({ error: "Family access is not configured." }, 503);
  const supplied =
    request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
  const hash = async (value: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    );
  const [expected, actual] = await Promise.all([
    hash(env.FAMILY_ACCESS_CODE),
    hash(supplied),
  ]);
  let difference = 0;
  for (let i = 0; i < expected.length; i++)
    difference |= expected[i] ^ actual[i];
  return difference
    ? json({ error: "Invalid family access code." }, 401)
    : null;
}
export async function readJSON(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw Error("invalid_input");
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes)
    throw Error("too_large");
  if (!request.body) throw Error("invalid_input");
  const reader = request.body.getReader(),
    parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw Error("too_large");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    data.set(part, offset);
    offset += part.length;
  }
  return JSON.parse(new TextDecoder().decode(data));
}
