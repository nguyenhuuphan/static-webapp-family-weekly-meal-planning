import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  base: "./",
  resolve: { alias: { src: fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
