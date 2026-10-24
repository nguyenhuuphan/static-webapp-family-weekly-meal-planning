# Weekday Table · React edition

React 19 + TypeScript + Vite. English/Vietnamese family meal planner with 10 Monday–Friday lunch/dinner slots. No account or paid API keys. Optional family sharing uses Netlify Functions + Blobs; new saved content uses the free MyMemory translation service. UI translations and built-in recipe translations are bundled locally.

## Netlify shared data and automatic translation

See [setup instructions](../docs/netlify-sync.md). Configure a private `FAMILY_ACCESS_CODE` (at least 16 characters) in Netlify Functions environment variables and deploy from Git so both static assets and functions are included. Uploading only `dist` supports local editing and bundled translations but cannot provide shared storage or automatic custom-content translation.

## Deploy the ready-made build

Extract the delivery ZIP. Upload the **dist** folder to https://app.netlify.com/drop or your existing site's manual deploy area. Do not upload the parent folder containing source and dist. This folder already contains compiled React assets, index.html, editable meal-plan.json and _headers. No local install/build is required for manual deployment.

## Develop or deploy from Git

When deploying this entire repository, the root `netlify.toml` sets base directory `source`, build command `npm run build`, and publish directory `dist` relative to that base (the generated `source/dist` folder). If you instead use **source** as a standalone repository root, its included `netlify.toml` sets the same build command and publish directory without a base directory. Node 24 is recommended (Vite requires modern Node). For local development, run `npm ci`, `npm run dev`, `npm test`, and `npm run build` inside **source**. `npm run typecheck` checks TypeScript separately.

## Source structure

Components use a folder per screen with `index.tsx`, typed `React.FC<IProps>` and absolute `src/...` imports. Redux Toolkit owns persisted planner state; transient screen/editor state lives in hooks. There is no backend dependency.

| Folder | Responsibility |
| --- | --- |
| `src/appConfig` | Storage key and app configuration |
| `src/assets` | Code-based table illustration |
| `src/components` | Application loading/error component |
| `src/containers/MealPlanning` | WeeklyMenu and MealEditor with local schema.ts |
| `src/containers/ShoppingManagement` | ShoppingList |
| `src/containers/PreparationManagement` | PrepDay |
| `src/containers/CookingManagement` | CookingSession |
| `src/containers/SettingsManagement` | HouseholdSettings and AdvancedJson |
| `src/containers/SafetyManagement` | SafetyGuide |
| `src/helpers` | State hydration, initialization and recipe replacement |
| `src/hooks` | Planner controller and screen context |
| `src/i18n` | Typed language catalogues, recipe translations, Intl formatting and language preference |
| `src/layout` | AppLayout and Sidebar |
| `src/mocks` | Fresh meal-plan fixture for development/tests |
| `src/modules/shared-main/components` | Shared Button and Heading |
| `src/queries` | Default meal-plan query entry point |
| `src/redux` | Typed store, selector/dispatch hooks and planner slice |
| `src/scss` | Responsive application styles |
| `src/services` | JSON loading and browser persistence |
| `src/types` | Domain types |
| `src/utils` | Quantities, dates and timer calculations |
| `src/validations` | Plan and backup validation |

`src/App.tsx` creates the Redux provider and planner context. Screens read `useMealPlanner()`; Redux actions contain serializable data. `src/domain.ts` is a compatibility export barrel. Default meals remain in `public/meal-plan.json`. To add a new screen, create its folder/index.tsx and wire it into AppLayout/Sidebar. Run `npm run format` to format code.

## Included features

- English/Vietnamese interface and built-in recipe translations, with a persistent language selector. See [localization architecture](../docs/localization.md) to add languages.
- 10 meals with all Sunday-prep, portion labels, storage/thawing and daily cooking instructions.
- Shopping list derived from ingredient data, search, buy checkboxes, at-home exclusions and printing.
- Preparation checklist and manual thaw/readiness confirmations.
- Guided cooking steps, persisted position, an absolute-deadline timer and completion/undo.
- Serving scaling; quantity-bearing instruction text uses `[300 g]`, `[2 tsp]`, `[3 each]` placeholders.
- React recipe editor with ingredient and step fields; add/remove rows; copy recipe pairs between slots; advanced JSON editor.
- Validated JSON import/export, restoring original menu, resetting progress and choosing a Monday week-start.
- Responsive sidebar/mobile navigation, reduced-motion support, system fonts and bundled Lucide icons.

## Preserving the older app's data

The browser key remains `weekday-table:v1` and the JSON schema remains 1. Deploy this upgrade to the **same Netlify site/domain** to read valid old plan edits, servings, progress and active timers automatically. Browser storage is scoped to origin: a different website URL, browser profile or device cannot read it. Export from the older app first for a backup; import works across devices, but starts fresh checklists. Never clear browser storage if you want to preserve it.

## Defaults versus personal edits

The file `public/meal-plan.json` (or `dist/meal-plan.json` in a manual deployment) is the default menu for new browsers. Existing browser edits take precedence. Export provides `{plan, servings}`; to update deployment defaults, use the `plan` object as meal-plan.json and redeploy. Export includes menu and serving setting, not progress, timers or week-start. Family sync is opt-in per page session using the configured family code. JSON is stored in Netlify Blobs, not committed into this repository.

Exactly 10 unique Monday–Friday lunch/dinner slots must exist. Ingredient units: g, ml, each, tsp, tbsp. Tablespoons and teaspoons are consolidated by volume in shopping; no volume-to-weight conversion is invented. Edible weights exclude peel/bones/shells. Rice and cooking water are managed separately.

Changing servings, importing, restoring defaults or choosing a new week resets progress. Saving one recipe/copying a pair clears that meal's prep/readiness/completion/timer and all shopping/at-home flags while retaining other meal progress. Existing food does not change; review quantities and storage after edits. Copying a pair updates storage guidance for manual review.

## Safety and product limits

The app validates structure and slot coverage, not the safety of user-created recipes. Manual prep/thaw checkboxes are not certification. Cooking times are estimates and do not scale with servings: allow batches, check doneness and use a thermometer. Egg quantities can be fractional; round appropriately. The displayed USDA/FoodSafety.gov references have not reviewed this app or its recipes.

Timers keep the deadline across refresh/view changes. There are no OS notifications or guaranteed alarms while the tab is closed/asleep. Pantry exclusions assume the **full** listed quantity is available; partial inventory is not modelled. This is a static app, not an offline PWA.

## Tests and verification

Vitest tests cover quantity aggregation/scaling, schema validation, timer math, old-state hydration, targeted recipe reset, and React interactions in jsdom: shopping/owned flags, prep, cooking, readiness, completion, timer, recipe edit/copy, servings/default restore, advanced JSON, import and export. `npm run build` runs TypeScript checks then produces minified static assets.

Localization tests also cover translation completeness, quantity preservation, browser/saved preferences, unavailable storage, and language switching while shopping, preparing, cooking and editing. Chrome headless checks cover Vietnamese layouts at widths 320–1440 and shopping/settings/editor on mobile, with no horizontal page overflow or runtime exceptions. Print/download behavior and the deployed Netlify site still need deployment-specific checks; this change has not been published to Netlify.
