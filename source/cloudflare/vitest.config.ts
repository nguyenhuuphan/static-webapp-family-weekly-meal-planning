import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      src: fileURLToPath(new URL("../src", import.meta.url)),
      "cloudflare:workers": fileURLToPath(
        new URL("./tests/runtime.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["cloudflare/tests/**/*.test.ts"],
    maxWorkers: 2,
  },
});
