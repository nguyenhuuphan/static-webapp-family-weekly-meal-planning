import { spawnSync } from "node:child_process";
// Client generation validates the schema with Prisma's bundled WebAssembly.
// Avoid downloading the unused native schema-engine in restricted build environments.
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "generate"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PRISMA_SCHEMA_ENGINE_BINARY:
        process.env.PRISMA_SCHEMA_ENGINE_BINARY || process.execPath,
    },
  },
);
process.exit(result.status ?? 1);
