import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { Plugin } from "vite";
export function workerSource(version: string, assets: string[]) {
  return `const PREFIX = "weekday-table:" + self.registration.scope;
const CACHE = PREFIX + ${JSON.stringify(version)};
const URLS = ${JSON.stringify(assets)}.map(path => new URL(path, self.registration.scope).href);
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS.map(url => new Request(url, { cache: "reload" })))).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil((async () => { const own = (await caches.keys()).filter(key => key.startsWith(PREFIX)); await Promise.all(own.filter(key => key !== CACHE && !own.slice(-2).includes(key)).map(key => caches.delete(key))); await self.clients.claim(); })()));
self.addEventListener("message", event => { if (event.data === "ACTIVATE_UPDATE") self.skipWaiting(); });
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.searchParams.has("sign-in") || url.pathname.startsWith("/cdn-cgi/")) return;
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const key = event.request.mode === "navigate" ? new URL("index.html", self.registration.scope).href : url.href;
  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try { const response = await fetch(event.request); if (response.ok && !response.redirected) return response; } catch {}
      const saved = await (await caches.open(CACHE)).match(key);
      if (saved) return saved;
      return fetch(event.request);
    })());
    return;
  }
  if (event.request.mode !== "navigate" && !URLS.includes(key)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(event.request)));
});`;
}
export function offlineBundle(): Plugin {
  let output = "";
  return {
    name: "weekday-table-offline",
    apply: "build",
    configResolved(config) {
      output = resolve(config.root, config.build.outDir);
    },
    async writeBundle() {
      const files: string[] = [];
      async function walk(directory: string) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = resolve(directory, entry.name);
          if (entry.isDirectory()) await walk(path);
          else if (
            entry.name !== "sw.js" &&
            !entry.name.startsWith("_") &&
            !entry.name.endsWith(".map")
          )
            files.push(path);
        }
      }
      await walk(output);
      files.sort();
      const hash = createHash("sha256");
      for (const file of files) hash.update(await readFile(file));
      const urls = files.map((file) =>
        relative(output, file).replaceAll("\\", "/"),
      );
      await writeFile(
        resolve(output, "sw.js"),
        workerSource("weekday-table-" + hash.digest("hex").slice(0, 16), urls),
      );
    },
  };
}
