import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { json } from "../shared";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "Cross-origin request refused." }, 403);
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4000)
      return json({ error: "Text too long." }, 413);
    const { text, target } = JSON.parse(raw);
    if (
      typeof text !== "string" ||
      !text.trim() ||
      new TextEncoder().encode(text).length > 500 ||
      !["en", "vi"].includes(target)
    )
      return json({ error: "Invalid translation request." }, 400);
    const source = /[ăâđêôơưà-ỹ]/i.test(text) ? "vi" : "en";
    if (source === target) return json({ translation: text });
    const cacheKey = createHash("sha256")
      .update(JSON.stringify([target, text]))
      .digest("hex");
    // Reuse translations across devices/deploys without spending provider quota.
    let cache: ReturnType<typeof getStore> | undefined;
    try {
      cache = getStore("family-translations");
      const cached = (await cache.get(cacheKey, { type: "json" })) as {
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
    const data = await response.json();
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
