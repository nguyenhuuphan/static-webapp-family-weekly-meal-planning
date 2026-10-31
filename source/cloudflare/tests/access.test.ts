import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { authenticatedByAccess } from "../access";
import app from "../worker";
import { database } from "./database";
import type { Env } from "../types";
const domain = "unit-test-family.cloudflareaccess.com",
  aud = "test-only-audience";
let pair: CryptoKeyPair,
  jwk: JsonWebKey & { kid: string },
  db: ReturnType<typeof database>,
  env: Env;
const encoded = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
beforeAll(async () => {
  pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  jwk = {
    ...((await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey),
    kid: "unit-test-key",
  };
});
beforeEach(() => {
  db = database();
  env = {
    DB: db.db,
    CF_ACCESS_TEAM_DOMAIN: domain,
    CF_ACCESS_AUD: aud,
    FAMILY_ACCESS_CODE: "test-only-family-access-code",
    ASSETS: {
      fetch: vi.fn().mockResolvedValue(
        new Response("<html>Application</html>", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    },
  } as unknown as Env;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ keys: [jwk] })),
  );
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});
async function token(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000),
    header = encoded({ alg: "RS256", kid: jwk.kid });
  const payload = encoded({
    iss: "https://" + domain,
    aud: [aud],
    iat: now,
    exp: now + 600,
    ...overrides,
  });
  const data = header + "." + payload;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    pair.privateKey,
    new TextEncoder().encode(data),
  );
  return data + "." + Buffer.from(signature).toString("base64url");
}
const context = {} as ExecutionContext;
it("accepts a signed Access assertion behind Static Assets without ctx.access", async () => {
  const request = new Request("https://app.workers.dev/", {
    headers: { "Cf-Access-Jwt-Assertion": await token() },
  });
  expect(await authenticatedByAccess(request, env, context)).toBe(true);
  const response = await app.fetch(request, env, context);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("Application");
  expect(response.headers.get("Content-Security-Policy")).toContain(
    "default-src 'self'",
  );
});
it("rejects an expired token, wrong audience, wrong issuer and forged signature", async () => {
  for (const claims of [
    { exp: 1 },
    { aud: ["another-app"] },
    { iss: "https://someone-else.cloudflareaccess.com" },
  ]) {
    expect(
      await authenticatedByAccess(
        new Request("https://app.workers.dev/", {
          headers: { "Cf-Access-Jwt-Assertion": await token(claims) },
        }),
        env,
        context,
      ),
    ).toBe(false);
  }
  const forged = (await token()).split(".");
  forged[1] = encoded({
    iss: "https://" + domain,
    aud: [aud],
    iat: 1,
    exp: 9999999999,
  });
  expect(
    await authenticatedByAccess(
      new Request("https://app.workers.dev/", {
        headers: { "Cf-Access-Jwt-Assertion": forged.join(".") },
      }),
      env,
      context,
    ),
  ).toBe(false);
});
it("fails closed before Access configuration and prevents development bypass on public hosts", async () => {
  env.DEV_ALLOW_AUTH_BYPASS = "true";
  env.CF_ACCESS_AUD = "";
  expect(
    (await app.fetch(new Request("https://app.workers.dev/"), env, context))
      .status,
  ).toBe(403);
  expect(
    await authenticatedByAccess(
      new Request("http://localhost:8787/"),
      env,
      context,
    ),
  ).toBe(true);
});
it("requires both Access and the family code for private API requests", async () => {
  const access = await token();
  const anonymous = await app.fetch(
    new Request("https://app.workers.dev/api/family-plan"),
    env,
    context,
  );
  expect(anonymous.status).toBe(403);
  const denied = await app.fetch(
    new Request("https://app.workers.dev/api/family-plan", {
      headers: { "Cf-Access-Jwt-Assertion": access },
    }),
    env,
    context,
  );
  expect(denied.status).toBe(401);
  const response = await app.fetch(
    new Request("https://app.workers.dev/api/health", {
      headers: {
        "Cf-Access-Jwt-Assertion": access,
        Authorization: "Bearer " + env.FAMILY_ACCESS_CODE,
      },
    }),
    env,
    context,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    status: "ok",
    database: "ok",
    aiConfigured: false,
  });
});
it("rejects cross-origin writes even with valid login and family credentials", async () => {
  const response = await app.fetch(
    new Request("https://app.workers.dev/api/family-plan", {
      method: "PUT",
      headers: {
        "Cf-Access-Jwt-Assertion": await token(),
        Authorization: "Bearer " + env.FAMILY_ACCESS_CODE,
        Origin: "https://foreign.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
    env,
    context,
  );
  expect(response.status).toBe(403);
});
