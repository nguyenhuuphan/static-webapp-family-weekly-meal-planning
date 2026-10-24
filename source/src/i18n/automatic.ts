import type { Language } from "./catalog";

const cache = new Map<string, string>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
const queue: (() => Promise<void>)[] = [];
let running = false;
let version = 0;
export const subscribeTranslations = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const translationVersion = () => version;
async function drain() {
  if (running) return;
  running = true;
  while (queue.length) await queue.shift()!();
  running = false;
}
export function automaticContent(value: string, target: Language): string {
  // Calls are scheduled outside render and deduplicated by source text/language.
  const source = /[ăâđêôơưà-ỹ]/i.test(value) ? "vi" : "en";
  if (source === target || !/[a-zăâđêôơưà-ỹ]/i.test(value)) return value;
  const byteLength = (text: string) => new TextEncoder().encode(text).length;
  if (byteLength(value) > 500) {
    // Keep bracketed quantities whole, and preserve whitespace between chunks.
    const chunks: string[] = [];
    let chunk = "";
    for (const token of value.match(/\[[^\]]*\]|\S+|\s+/g) || []) {
      if (byteLength(token) > 500) return value;
      if (byteLength(chunk + token) > 500) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += token;
    }
    if (chunk) chunks.push(chunk);
    return chunks
      .map((part) => {
        const [, before, body, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(part)!;
        return before + automaticContent(body, target) + after;
      })
      .join("");
  }
  const key = JSON.stringify([target, value]);
  if (cache.has(key)) return cache.get(key)!;
  if (!pending.has(key)) {
    pending.add(key);
    queue.push(async () => {
      try {
        const response = await fetch("/.netlify/functions/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value, target }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw Error();
        const result = await response.json();
        if (typeof result.translation !== "string") throw Error();
        cache.set(key, result.translation);
      } catch {
        cache.set(key, value);
      } finally {
        pending.delete(key);
        version++;
        listeners.forEach((listener) => listener());
      }
    });
    setTimeout(() => void drain(), 0);
  }
  return value;
}
