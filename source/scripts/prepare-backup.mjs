// Validates a browser backup and prepares a create-only D1 statement; never logs its contents.
import { readFile, writeFile, chmod } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "vite";
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw Error("Usage: node scripts/prepare-backup.mjs INPUT.json OUTPUT.sql");
const rawText = await readFile(input, "utf8");
if (Buffer.byteLength(rawText) > 1_000_000) throw Error("Backup exceeds 1 MB.");
const raw = JSON.parse(rawText);
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { parseBackup } = await server.ssrLoadModule(
    "/src/validations/index.ts",
  );
  const { freshState, hydrateState } = await server.ssrLoadModule(
    "/src/helpers/index.ts",
  );
  const { plan, servings } = parseBackup(raw);
  const state = raw.progress
    ? hydrateState(raw, plan)
    : { ...freshState(plan), servings };
  delete state.backupVersion;
  const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
  const serialized = JSON.stringify(state);
  const sql = `INSERT INTO documents (namespace,key,value,revision) VALUES ('planner','state.json',${quote(serialized)},${quote(randomUUID())}) ON CONFLICT(namespace,key) DO NOTHING;\n`;
  await writeFile(output, sql, { mode: 0o600 });
  await chmod(output, 0o600);
  console.log(
    JSON.stringify({
      validated: true,
      meals: state.plan.meals.length,
      weekStart: state.weekStart,
      sha256: createHash("sha256").update(serialized).digest("hex"),
      outputProtected: true,
      overwritesExistingData: false,
    }),
  );
} finally {
  await server.close();
}
