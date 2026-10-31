import { fileURLToPath, URL } from "node:url";
import { offlineBundle } from "./build/offline.ts";
import { defineConfig } from "vitest/config";
export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.APP_BUILD": JSON.stringify(
      process.env.COMMIT_REF?.slice(0, 7) || "local",
    ),
  },
  plugins: [offlineBundle()],
  resolve: { alias: { src: fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    maxWorkers: 2,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules/**", "dist/**", "cloudflare/tests/**"],
  },
});
