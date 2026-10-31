import { authenticatedByAccess } from "./access";
import { json, requireFamilyCode, sameOrigin } from "./http";
import { aiMenu } from "./routes/ai-menu";
import { familyPlan } from "./routes/family-plan";
import { translate } from "./routes/translate";
import type { Env } from "./types";
export { MenuWorkflow } from "./workflow";
function securityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      if (!(await authenticatedByAccess(request, env, ctx)))
        return securityHeaders(
          json({ error: "Cloudflare Access sign-in is required." }, 403),
        );
      const path = new URL(request.url).pathname.replace(
        /^\/\.netlify\/functions\//,
        "/api/",
      );
      if (path.startsWith("/api/")) {
        if (!sameOrigin(request))
          return securityHeaders(
            json({ error: "Cross-origin request refused." }, 403),
          );
        if (path === "/api/translate")
          return securityHeaders(await translate(request, env));
        const denied = await requireFamilyCode(request, env);
        if (denied) return securityHeaders(denied);
        if (path === "/api/family-plan")
          return securityHeaders(await familyPlan(request, env));
        if (path === "/api/ai-menu")
          return securityHeaders(await aiMenu(request, env));
        if (path === "/api/health" && request.method === "GET") {
          await env.DB.prepare("SELECT 1 FROM documents LIMIT 1").first();
          return securityHeaders(
            json({
              status: "ok",
              database: "ok",
              aiConfigured: !!env.GEMINI_API_KEY,
            }),
          );
        }
        return securityHeaders(json({ error: "Not found." }, 404));
      }
      if (!["GET", "HEAD"].includes(request.method))
        return securityHeaders(json({ error: "Method not allowed." }, 405));
      return securityHeaders(await env.ASSETS.fetch(request));
    } catch {
      return securityHeaders(
        json(
          {
            error:
              "The service is temporarily unavailable. Your device copy is retained.",
          },
          503,
        ),
      );
    }
  },
} satisfies ExportedHandler<Env>;
