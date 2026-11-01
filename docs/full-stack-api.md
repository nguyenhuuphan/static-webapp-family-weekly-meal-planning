# Full-stack API and persistence

The React UI reads authoritative state from an authenticated Hono API. All planner changes are named server commands, validated by the backend and committed by Prisma. Redux and `weekday-table:v1` are confirmed-state/offline read caches. Editing while disconnected does not claim a successful save or silently upload a stale browser document on reconnect.

## Runtime choices

- The existing free deployment uses **Cloudflare Workers with Node.js compatibility**, Prisma's D1 adapter, D1, Static Assets and durable AI Workflows. Workers is not a separate always-running Node.js process. This keeps the current URL, sign-in and free hosting arrangement.
- `api/node.ts` is a real **Node.js 24 server** using `@hono/node-server` and Prisma's SQLite adapter. It serves the same API, AI/photo/translation handlers and built React frontend. Its database must be on a persistent disk. SQLite on an ephemeral hosting disk is not durable; use one server instance per SQLite database. A public Node deployment requires a hosting account plus Cloudflare Access configuration; it is not created automatically by the Worker deployment.

The same Prisma schema and numbered SQL migrations support both adapters. Node/Worker generated clients are generated separately; they must not be committed or shipped into the frontend bundle. `prisma generate` uses Prisma's bundled schema WASM, avoiding an unnecessary native schema-engine download. SQL migrations run through the project's migration runners, not `prisma db push`.

## Local Node development

From `source/`:

```sh
npm ci
# Set FAMILY_ACCESS_CODE to a private development code of at least 16 characters.
# Optionally set DATABASE_URL=file:/absolute/path/planner.db
npm run db:migrate:node
npm run dev:api
# In a second terminal; Vite proxies /api to 127.0.0.1:3001:
npm run dev
```

The Node entry also applies pending migrations on startup. By default it listens only on `127.0.0.1:3001`, storing SQLite in ignored `.data/planner.db`. `HOST`, `PORT`, `DATABASE_URL`, `FAMILY_ACCESS_CODE` configure it. An ignored `.env` may supply these variables; existing environment values win.

To serve a built frontend: `npm run build && npm run start:api`. Set `NODE_ENV=production`, a persistent `DATABASE_URL`, `CF_ACCESS_AUD` and `CF_ACCESS_TEAM_DOMAIN` for a public server. Access JWT assertions are verified against Cloudflare's signing keys. Never expose the database file or bypass Access on a public hostname. Gemini uses server-only `GEMINI_API_KEY`; optional Node backup AI uses a dedicated `CLOUDFLARE_AI_ACCOUNT_ID` / `CLOUDFLARE_AI_TOKEN`. The administration/deployment token is never repurposed as a runtime AI credential.

## API contract

All `/api/v1/*` routes require Cloudflare Access, same-origin checks, and `Authorization: Bearer <family code>`. Development Access bypass works on loopback hosts only. `X-Client-Id` identifies an anonymous browser; only its SHA-256 hash enters the activity log. Responses use `Cache-Control: no-store`.

| Route | Behavior |
| --- | --- |
| `GET /api/v1/planner` | Confirmed state, numeric revision and server-calculated shopping/preparation/readiness/stocktake projections |
| `POST /api/v1/commands` | `{id: UUID, revision: number, command: {name, args}}`; returns the confirmed envelope |
| `GET /api/v1/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&timezone=Asia/Ho_Chi_Minh` | Purchases, invoice totals, daily spending, cooked/eaten/leftover portions, anonymous activity; maximum 366-day range |
| `POST /api/v1/events` | Only `{id: UUID, kind: "view.open", view: allowlisted screen}`; no arbitrary event properties |
| `GET /api/v1/health` | Authenticated Prisma connectivity check |

Server commands cover shopping, prices/invoices, stock, preparation, portions/schedules, alternatives/recipes, saved food, cooking, timers, generated-menu application, backup restoration and undo. See the explicit allowlist in `api/commands.ts`. Requests cannot submit arbitrary SQL or arbitrary reducer callbacks.

A request ID is an idempotency key. Successful IDs/fingerprints are stored atomically with the state. Retrying the same ID and command from the same browser returns the current envelope without buying or consuming stock again; changed content/actor under the same ID returns 409. An expected-revision mismatch returns 409 and never overwrites newer state. The UI loads the latest server copy and offers a pre-conflict download. An unconfirmed request is retained in session storage and retried with its original ID, including after a page reload. New writes are blocked while confirmation is pending.

One SQLite compare-and-swap statement triggers all projection/history/audit updates atomically, including on D1, which does not support Prisma interactive transactions. A failed projection rolls back the whole command. The last 20 state versions support server undo. Server-calculated display projections are cached separately with a SHA-256 match to their confirmed state JSON, so shopping/preparation remain readable offline without calculating business results in the browser. A cached revision never authorizes a write. An offline browser cache is preserved separately before its first replacement; restoration to the server always requires the explicit Restore action.

## Data and reports

Prisma models include planner state, idempotency receipts, state versions, normalized purchase/invoice/meal report tables, activity events, existing AI/settings/translation documents and private receipt photos. Report projections are updated in the same transaction as the confirmed state. Only changed projection rows are rewritten to conserve D1's write allowance.

Money is stored in integer minor units and summed using BigInt. API totals are decimal strings; currencies are never mixed. Spending counts invoice totals and purchases not covered by any recorded invoice total once. Zero prices are distinct from missing prices. Receipt photo bytes remain in their existing private table and pass through authenticated endpoints; no images are embedded in planner JSON or activity events.

Activity records contain only a command/screen type, timestamp and hashed browser ID. They expire after 90 days and are capped at 5,000 events. Prompts, recipe contents, invoice notes/photos, email addresses and IP addresses are excluded. This is an operational household activity report, not behavioral profiling.

## Cloudflare migration / deployment

1. Back up the live D1 database (including private photos) and Access policies. Keep private snapshots out of Git.
2. Run all tests and `npm run build`; validate a copy of the current planner document against `0003_full_stack_api.sql` first.
3. Apply `npm run db:migrate:remote`. Migration 0003 imports existing `documents(planner,state.json)` atomically if no API state exists. It does not replace the family's menu with defaults and does not change receipt-photo rows.
4. Deploy the Worker and assets with `PERSISTENCE_MODE=prisma`. Keep existing family/Gemini secrets, AI binding, workflows and Access policies.
5. Verify `/api/v1/health`, read planner/reports, and exercise a controlled API save after Access login. Check the expected existing menu, purchase/receipt counts and photo metadata. No generation is necessary to test persistence.

After migration, the legacy `/api/family-plan` GET can read the confirmed state. Database triggers also fence legacy JSON writers as soon as API state exists, protecting edits during the interval between migration and deployment. Legacy whole-document PUTs return `api_upgrade_required` (409) and ask cached clients to reload. State is also mirrored to the legacy document after each successful command so an emergency old-code rollback can read the latest data. Legacy-write fences must be deliberately removed as part of a rollback. Never roll back to an old writer without first pausing edits and backing up the new tables; idempotency and command histories cannot be reconstructed from a JSON-only writer.

Validation: `npm test` includes frontend/domain, Cloudflare and real Prisma/SQLite API suites. `npm run typecheck` checks frontend, Worker and Node. A local Worker smoke test must also exercise the workerd-generated Prisma client against D1; a Node-only test cannot validate that runtime.
