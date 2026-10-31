import { json, readJSON, sameOrigin } from "../http";
import { DocumentStore } from "../store";
import type { Env } from "../types";

export async function translate(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);
  if (!sameOrigin(request))
    return json({ error: "Cross-origin request refused." }, 403);
  try {
    const { text, target } = (await readJSON(request, 4000)) as {
      text: unknown;
      target: unknown;
    };
    if (
      typeof text !== "string" ||
      !text.trim() ||
      new TextEncoder().encode(text).length > 500 ||
      !["en", "vi"].includes(target as string)
    )
      return json({ error: "Invalid translation request." }, 400);
    const source = /[ăâđêôơưà-ỹ]/i.test(text) ? "vi" : "en";
    if (source === target) return json({ translation: text });
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify([target, text])),
    );
    const cacheKey = Array.from(new Uint8Array(hash), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
    // Reuse translations across devices/deploys without spending provider quota.
    let cache: DocumentStore | undefined;
    try {
      cache = new DocumentStore(env.DB, "translations");
      const cached = (await cache.get(cacheKey)) as {
        translation?: string;
      } | null;
      if (typeof cached?.translation === "string") return json(cached);
    } catch {
      /* Translation still works when the optional cache is unavailable. */
    }
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", `${source}|${target}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok)
      return json({ error: "Translation service unavailable." }, 503);
    const data = (await response.json()) as {
      responseStatus?: number | string;
      quotaFinished?: boolean;
      responseData?: { translatedText?: unknown };
    };
    const translation = data.responseData?.translatedText;
    // Never show machine output that changes quantities, timings or tokens.
    const numbers = (value: string) =>
      (value.match(/\d+(?:[.,]\d+)?/g) || []).join("|");
    const tokens = (value: string) =>
      (value.match(/\[[\d.]+ (?:g|ml|each|tsp|tbsp)\]/g) || []).join("|");
    if (
      Number(data.responseStatus) !== 200 ||
      data.quotaFinished ||
      typeof translation !== "string" ||
      !translation.trim() ||
      numbers(text) !== numbers(translation) ||
      tokens(text) !== tokens(translation)
    )
      return json(
        { error: "Translation unavailable or changed quantities." },
        503,
      );
    try {
      await cache?.setJSON(cacheKey, { translation });
    } catch {
      /* Optional cache. */
    }
    return json({ translation });
  } catch {
    return json({ error: "Translation unavailable." }, 503);
  }
}
