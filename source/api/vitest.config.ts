import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  resolve: {
    alias: { src: fileURLToPath(new URL("../src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["api/tests/**/*.test.ts"],
    maxWorkers: 1,
  },
});
