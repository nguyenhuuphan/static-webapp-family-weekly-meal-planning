# AI menu generation

The weekly-plan screen has a **Create menu with AI** button. A modal collects the target week, 1–12 diners, days (Monday–Sunday), meal times (breakfast/lunch/dinner), cuisines, cooking appliances, dietary restrictions, available ingredients, cooking-time limit, budget preference and a custom request. The number of slots is derived from selected days × meal times (1–21). The family master prompt is editable and shared in Netlify Blobs.

The user reviews the complete request before **Generate menu** calls Gemini. The current plan remains unchanged while generating and editing the draft. The draft can be reopened on another device with the family code. Edited meals are saved with conditional revision checks. **Apply this menu** archives the prior week, preserves physical prepared-food records, resets plan-specific progress and switches to the selected week. An active timer, cooking batch, storage recovery or unresolved cross-tab conflict prevents replacement. Changes received while the modal was open require reviewing again before applying. When Family Sync is connected, the accepted state follows its existing conditional-save flow; otherwise it remains on the device until the user connects Family Sync.

## Appliances

Options include air fryer, electric/induction/gas stove, blender, oven, microwave, rice cooker, steamer and pressure cooker, plus a custom appliance. Users must select at least one option. **No heating appliance** requests cold meals and cannot be combined with another appliance. Basic knives, boards, bowls and cookware are assumed. Requirements include the selected appliances; every generated meal declares its required appliances. The server rejects unselected declarations and detects common unselected appliance names in instructions. This catches common mistakes but cannot prove that arbitrary natural-language instructions require no other equipment. Review the draft before cooking.

## Provider and cost controls

- Uses Gemini Developer API, with fixed server-side model `gemini-2.5-flash-lite`, JSON Schema output, a 180-second deadline/32,768-token ceiling for up to 10 meals, or 360 seconds/65,536 tokens for larger weeks. No personal ChatGPT account, model chosen by a browser request, paid-provider fallback or automatic regeneration is used.
- The site owner supplies **GEMINI_API_KEY** privately in Netlify Functions/Production. Keep the key out of `VITE_*` variables and source control. For a free-only deployment, use a Google AI Studio project without paid billing enabled and verify the model's current free-tier availability for the project/region. Code cannot determine the billing tier of an API key; a model being eligible for a free tier does not make requests free on a billed project. See https://ai.google.dev/gemini-api/docs/pricing .
- Default family-wide limit: 3 submitted jobs per UTC day. **AI_MAX_DAILY_REQUESTS** may be set by the site owner from 0 to a hard maximum of 10. Netlify Blobs compare-and-set operations enforce the counter across instances. Attempts that fail after submission consume one allowance; there is no automatic retry spending another allowance.
- Duplicate submission IDs and repeated background invocations do not generate again. Opening a saved menu, editing a draft and switching languages make no additional Gemini calls.
- Generated English recipe text has an exact-source Vietnamese translation map stored with the plan. Quantities and instruction tokens must remain unchanged. Unknown manually edited text no longer matches its prior translation; ordinary app translation fallback may then apply.
- Form data and the master prompt are sent to Gemini. Free-tier data handling differs from paid services; review Google's current terms and avoid unnecessary personal information. The UI shows a short disclosure before generation. AI suggestions are not allergy or food-safety certification; the server also checks known restricted ingredients using the app's existing ingredient-warning rules.

Netlify Functions/Blobs remain subject to the site's own plan and usage limits, separately from Gemini's quota.

## Runtime and authentication

`ai-menu` authenticates with the existing family code, validates inputs, saves master-prompt preferences/drafts and queues a background job. `generate-menu-background` claims the job once, calls Gemini, validates the entire plan and saves either a ready draft or a failure code. Neither writes the active family planner. Queued/running jobs older than 20 minutes are reported as timed out.

The server-only `family-menu-ai` Blob store contains settings, jobs, claims and per-day allowance records. All application routes to it require the family code. Data is not saved into the Git repository. Provider error messages and API keys are not returned to the browser.

Netlify SSO is retained. Browser requests include the existing SSO session normally; the dispatcher forwards its cookie only to the background Function on the same site. SSO failures do not trigger a paid or unauthenticated fallback. If SSO blocks a request, sign in and retry explicitly. Background Functions must be available on the Netlify account.

## Data compatibility

Schema v1 retains exactly ten weekday lunch/dinner slots. Schema v2 accepts 1–21 unique slots across all seven days and all three meal types, plus optional appliance metadata and an exact-source Vietnamese translation map. Legacy defaults and backups remain v1 and continue to work. The calendar, cooking picker, saved-food schedules, backup validation, shopping and preparation accept v2. Missing preparation compatibility profiles remain individual tasks rather than guessing shared preparation.

## Verification

`npm test` checks the wizard, preview/edit/apply workflow, existing-data preservation, 21-slot support, legacy backups, translation/quantity validation, selected appliances, authenticated endpoints, concurrent quota reservations, conditional draft writes, duplicate submissions, background failures and missing configuration. `npm run build` checks TypeScript (including Functions) and builds static assets.

`scripts/ai-live-smoke.mjs` is disabled by default. Setting **AI_RUN_LIVE_SMOKE=true** in Netlify's build environment enables one live, synthetic one-meal provider check during the build. It runs on Netlify using the private API key and reports only the result/model/counts or a redacted provider error. It does not change any family menu or Blob data. Remove the temporary flag after a diagnostic build so later deployments make no AI calls. The diagnostic consumes provider quota independently of the application's daily job counter. The key needs build scope only for this opt-in check; ordinary generation needs only Functions scope.
