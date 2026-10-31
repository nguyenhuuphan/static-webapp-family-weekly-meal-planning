import type { Env } from "./types";
const keysCache = new Map<string, { expires: number; keys: JsonWebKey[] }>();
const decode = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
const parse = (value: string) =>
  JSON.parse(new TextDecoder().decode(decode(value)));
async function publicKeys(
  domain: string,
  refresh = false,
): Promise<JsonWebKey[]> {
  const cached = keysCache.get(domain);
  if (cached && cached.expires > Date.now() && !refresh) return cached.keys;
  const response = await fetch(`https://${domain}/cdn-cgi/access/certs`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw Error("Access keys unavailable");
  const data = (await response.json()) as { keys?: JsonWebKey[] };
  if (!Array.isArray(data.keys)) throw Error("Invalid Access keys");
  keysCache.set(domain, {
    keys: data.keys,
    expires: Date.now() + 5 * 60 * 1000,
  });
  return data.keys;
}
export async function authenticatedByAccess(
  request: Request,
  env: Env,
  context?: ExecutionContext,
): Promise<boolean> {
  const hostname = new URL(request.url).hostname;
  if (
    env.DEV_ALLOW_AUTH_BYPASS === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
  )
    return true;
  if (
    !env.CF_ACCESS_AUD ||
    !env.CF_ACCESS_TEAM_DOMAIN ||
    !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.CF_ACCESS_TEAM_DOMAIN)
  )
    return false;
  // Static Assets routing does not propagate ctx.access; verify the signed assertion as well.
  if (context?.access?.aud === env.CF_ACCESS_AUD) return true;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || token.length > 16384) return false;
  try {
    const segments = token.split(".");
    if (segments.length !== 3) return false;
    const header = parse(segments[0]),
      claims = parse(segments[1]);
    const now = Math.floor(Date.now() / 1000);
    if (
      header.alg !== "RS256" ||
      typeof header.kid !== "string" ||
      claims.iss !== `https://${env.CF_ACCESS_TEAM_DOMAIN}` ||
      !Array.isArray(claims.aud) ||
      !claims.aud.includes(env.CF_ACCESS_AUD) ||
      typeof claims.exp !== "number" ||
      claims.exp <= now ||
      typeof claims.iat !== "number" ||
      claims.iat > now + 30 ||
      (claims.nbf !== undefined &&
        (typeof claims.nbf !== "number" || claims.nbf > now + 30))
    )
      return false;
    let keys = await publicKeys(env.CF_ACCESS_TEAM_DOMAIN);
    let jwk = keys.find(
      (key) => (key as JsonWebKey & { kid?: string }).kid === header.kid,
    );
    if (!jwk) {
      keys = await publicKeys(env.CF_ACCESS_TEAM_DOMAIN, true);
      jwk = keys.find(
        (key) => (key as JsonWebKey & { kid?: string }).kid === header.kid,
      );
    }
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decode(segments[2]),
      new TextEncoder().encode(segments[0] + "." + segments[1]),
    );
  } catch {
    return false;
  }
}
