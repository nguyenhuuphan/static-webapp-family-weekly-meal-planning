import { fileURLToPath, URL } from "node:url";
import { offlineBundle } from "./build/offline.ts";
import { defineConfig } from "vitest/config";
export default defineConfig({
  base: "./",
  plugins: [offlineBundle()],
  resolve: { alias: { src: fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    maxWorkers: 2,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
