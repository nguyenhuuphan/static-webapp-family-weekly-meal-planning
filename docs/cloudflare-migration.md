# Cloudflare migration runbook

Target: one Worker serving React static assets and APIs, D1 for durable JSON documents, Workflows for Gemini generation, and Cloudflare Access for approved-email sign-in. No Pages project, paid Workers subscription, custom domain purchase, R2 bucket or queue is required by this design. Cloudflare and Gemini free tiers have finite quotas. No script enables paid billing.

## Inputs and current protections

- `CLOUDFLARE_API_TOKEN` must be supplied securely to the deployment environment. Minimum account permissions: Account Settings Read, Workers Scripts Edit, D1 Edit, Access Apps and Policies Edit, and Access Organizations/Identity Providers/Groups Edit. Tokens and API keys must never be pasted into Git or chat.
- The owner supplies approved login emails and confirms email OTP as the replacement for Netlify SSO. Account IDs, resource IDs, a free `workers.dev` URL and the Access audience can be discovered/provisioned after authorization. Scope Access to this project only, not all Workers in an existing account.
- Preserve the family code. Put it in the Worker secret `FAMILY_ACCESS_CODE`; the Cloudflare administration token must not be bound to the Worker.
- The owner enters the existing `GEMINI_API_KEY` directly into Cloudflare Worker secrets. The production key on Netlify is marked secret, so the migration must not assume its value is readable through the Netlify API. Keep Gemini on an eligible free project without paid billing; the app does not infer billing tier from a key.
- Ask whether to import the latest browser backup or use bundled defaults. A different hostname cannot read the old origin's local storage. Netlify cloud records alone may not include the latest device edits. Do not delete, reset, or redirect the old Netlify site during migration.

## Local validation

In `source`:

```
npm ci
npm test
npm run build
npm run db:migrate:local
npm run dev:cloudflare
```

`.dev.vars` is ignored and contains only local secrets/settings. `DEV_ALLOW_AUTH_BYPASS=true` works only on loopback hostnames; it does not bypass authentication on `workers.dev`, a custom domain or any other public host. The default Wrangler production config contains no development bypass. Never supply a local bypass in production.

The Cloudflare test suite uses SQLite to exercise real SQL revision checks and a Node shim for Workflow unit tests. Access tests sign genuine test JWTs and reject wrong issuers/audiences, expired signatures, cross-origin writes and requests missing either authentication layer. Local `workerd` smoke checks verify the actual static asset binding, D1 state persistence and HTTP conflict behavior. These checks do not prove a remote account is deployed.

## Provision and deploy

1. Verify the token and select the authorized account. Reuse an existing account `workers.dev` subdomain; do not rename it if the account hosts other apps.
2. Create/reuse the project D1 database `family-weekly-meal-planning`. Replace the placeholder `database_id` in `source/wrangler.jsonc` with its real UUID. Run `npm run db:migrate:remote`.
3. Deploy the Worker and its `MenuWorkflow` using `npm run deploy`. Initial empty Access settings intentionally deny public requests. Workflows contain no HTTP background endpoint and never forward a user's authentication cookie to start a job.
4. Enable the account's free Zero Trust organization if necessary. Create/reuse an email OTP identity provider and a self-hosted Access application for this Worker's production hostname (or a Worker-level destination), with an allow policy containing only the approved emails. Protect previews too, or leave preview URLs disabled as configured. Do not create an everyone/bypass policy.
5. Set `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` in Wrangler vars from the actual Access organization/application, then deploy. The Worker verifies the JWT signature, issuer, audience and expiry. This is necessary even when Access protects Static Assets because its internal router may not propagate `ctx.access`.
6. Set the private Worker secrets `FAMILY_ACCESS_CODE` and `GEMINI_API_KEY`. Inspect secret names/status only when verifying presence. Keep `AI_MAX_DAILY_REQUESTS=3` unless the owner changes the allowance.
7. Import data only after a verified export is available or the owner explicitly chooses defaults. Validate the entire backup and verify a readback before claiming success. Keep a recoverable source copy and do not overwrite a pre-existing destination planner silently.
8. Verify the production URL, Access policy, both authentication layers, cross-device saves, a Gemini job, bilingual review/apply, and existing-data preservation. Do not call migration complete merely because deployment returned success.

Workers and D1 are provisioned in the owner's Cloudflare account. Worker static assets and API routes share one hostname. The canonical routes are `/api/family-plan`, `/api/ai-menu`, `/api/translate` and the authenticated `/api/health`. Legacy `/.netlify/functions/...` aliases remain during migration, but production does not execute the retired Netlify handlers.

## Private production checks

The configured deployment is https://family-weekly-meal-planning.family-3adfa3459c6c.workers.dev . Sign in with the approved owner email, then connect Family Sync using the existing family code. The destination was initialized with the owner-selected bundled menu; personal edits on the old Netlify origin remain there.

From `source`, with the administration token securely available:

```
python3 scripts/verify-cloudflare.py --url https://family-weekly-meal-planning.family-3adfa3459c6c.workers.dev
python3 scripts/verify-cloudflare.py --url https://family-weekly-meal-planning.family-3adfa3459c6c.workers.dev --generate-menu
```

The verifier first checks network reachability, then creates a short-lived Access service token and a token-specific service-auth policy for this application. It checks anonymous blocking, frontend delivery, family authorization, D1 reads, a same-content save/readback, stale-write rejection and custom-content translation. `--generate-menu` additionally requires the Gemini secret and generates one synthetic ten-meal bilingual draft, consuming one daily application allowance. It does not apply the draft to the active menu. The test restores the prior latest-draft pointer only if a newer user job has not replaced it, and removes its own job. Every cleanup path attempts to revoke both the temporary policy and token. Confirm the report's `temporaryAccessRemoved` field; resolve any cleanup errors before finishing.

The administration token needs Access Service Tokens Edit in addition to the provisioning permissions for these automated checks. These tests use a service identity; separately confirm that the owner receives the email OTP and can sign in from a browser. Reports in `/workspace/scratch` contain status and counts, never API keys or recipe contents. A proxy `Tunnel connection failed: 403 Forbidden` is an environment egress error, not evidence that the Cloudflare application rejected the login.

## Importing a backup

Run from `source`:

```
node scripts/prepare-backup.mjs /path/to/backup.json /tmp/family-import.sql
wrangler d1 execute DB --remote --file /tmp/family-import.sql
```

The helper validates the backup using the same application validators/hydration code, prepares a create-only insert and reports a checksum and meal count without logging meal contents. Its SQL output contains private data and is created with mode 0600; keep it outside the checkout and remove it when no longer needed. If the insert changes zero rows, a destination planner already exists: stop and review, rather than reporting an import or overwriting it. Verify the stored JSON checksum/readback after import and retain the original backup until the user confirms the new site.

Namespace mappings for any existing Netlify Blobs records are `family-meal-planner` → `planner`, `family-menu-ai` → `ai`, and `family-translations` → `translations`. Revisions are freshly generated by D1. Source cloud stores must be inspected before transfer; browser-only state requires a user export.

## Authentication renewal and rollback

A sign-in link navigates to `/?sign-in=1` in a new tab. The service worker deliberately leaves this navigation and `/cdn-cgi/` routes to the network, allowing Access login instead of repeatedly serving a cached shell. The original tab can keep its unsaved form while the user renews the login session.

Do not clear browser storage to refresh. The app's online-first navigation and existing service-worker update flow fetch the new shell. A new Cloudflare hostname has separate storage from Netlify; import the verified backup instead of relying on cookies crossing origins.

The old Netlify scripts/configuration and SDK remain only for rollback and legacy regression tests. Netlify builds explicitly set `VITE_API_BASE=/.netlify/functions`; Cloudflare defaults to `/api`. The common Gemini generator is now platform-independent in `source/src/server/gemini.ts`. Removing the retired provider is a later cleanup after successful cutover, not a prerequisite for migration.

## Codex environment Secrets and setup

Secret availability depends on how the Codex environment is started. Check only whether the required variable is present in the current runtime; do not assume a newly saved secret has reached an already-running shell. Do not work around a missing binding by printing a token, committing it, copying it into a persistent token file, or making it a public environment variable.

The private environment setup script can call `scripts/cloudflare-onboarding.sh` with the approved owner email in `CLOUDFLARE_ALLOWED_EMAIL`. The wrapper consumes `CLOUDFLARE_API_TOKEN` in that setup phase and invokes the provisioner. Its sanitized report is written to `/workspace/scratch/cloudflare-migration-status.json`; this report contains deployment status/URLs, not credentials. Restrict this automatic one-time action to the tested migration commit; do not auto-deploy arbitrary future task changes during dependency setup.

The provisioner never enables a paid plan or deletes the Netlify site. Missing runtime keys leave private APIs disabled and are reported explicitly. The owner can then enter the family code and Gemini key directly in the new Cloudflare Worker's Secrets, without giving those values to the agent. A configured deployment report is not proof of owner login, cross-device saves or successful Gemini generation: finish those checks before claiming a complete migration.
