import { createHash, timingSafeEqual } from "node:crypto";
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export function authorize(request: Request): Response | null {
  const code = process.env.FAMILY_ACCESS_CODE;
  if (!code || code.length < 16)
    return json(
      {
        error:
          "Configure FAMILY_ACCESS_CODE with at least 16 characters in Netlify.",
      },
      503,
    );
  const supplied =
    request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(code), hash(supplied)))
    return json({ error: "Invalid family access code." }, 401);
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "Cross-origin request refused." }, 403);
  return null;
}
