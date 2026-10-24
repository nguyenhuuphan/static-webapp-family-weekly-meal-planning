# Family sharing on Netlify

Users can share the complete planner state (recipes, servings, progress, pantry, food records and timer deadlines) across devices. Browser local storage remains the immediate local copy. JSON is saved as `state.json` in the site-level Netlify Blobs store `family-meal-planner`; it is never written into source code or committed to Git. Static files cannot accept writes after deployment.

## Deploy

1. Deploy this repository through Netlify's Git integration. Root `netlify.toml` uses base `source`, build `npm run build`, publish `dist`, and functions `netlify/functions` relative to that base. A standalone `source` checkout has matching configuration. Use Node 24. A drag-and-drop upload of `dist` alone does not deploy functions.
2. In Netlify site environment variables, create **FAMILY_ACCESS_CODE** with a random code of at least 16 characters, available to **Functions** in the production context. Generate a strong value locally, for example `openssl rand -hex 24`. Keep it private and share it with family members through a private channel. Do not add a `VITE_` prefix, commit it, or put it into client build variables. The browser holds the entered code only in memory for the current page session.
3. Deploy/redeploy so the functions receive the variable. The code uses Netlify's built-in Blobs credentials; no separate storage token or database is required. Avoid exposing production credentials to untrusted deploy previews. If Blobs is unavailable for the site, requests fail safely with 503 and keep local data.
4. On the device containing the desired current plan, export a backup, expand **Family sync**, enter the code, then select **Share current copy for the first time**. This creates a shared copy only when none exists.
5. On other devices on the same site, enter the same code and select **Open shared data**. This replaces that device's planner with the shared copy, so export a backup first if needed. Language, navigation, audio permissions and scroll preferences remain device-specific.

Each Netlify site is one family workspace with one shared code. This is not a multi-tenant account system. Anyone with that code can read and modify the shared planner. Rotating the server variable and redeploying revokes the old code; devices then reconnect with the new one. Disconnect stops subsequent sync attempts; requests already accepted by the server may finish. Reloading requires entering the code again.

## Saving and conflicts

The app checks for changes roughly every two seconds while connected and open. It uploads local changes using the last server ETag and downloads newer shared state when there is no active editor draft. Conditional Blob writes (`onlyIfNew` / `onlyIfMatch`) prevent concurrent clients from silently overwriting one another. A conflict pauses sync and retains local data. Export the local backup, disconnect, then open the shared copy; manually reapply desired changes. Automatic merging is deliberately avoided.

Offline changes remain local. The UI reports sync errors and offers retry. A retry uses the prior server revision, so a newer shared copy still causes a conflict. Closing the page before upload does not imply cloud persistence: wait for **Synced**. Reopening a shared copy explicitly replaces local data; export unsynced local edits first. Browser storage failures and cross-tab conflicts pause cloud synchronization until resolved.

## Automatic translation

Interface text uses bundled i18next English/Vietnamese dictionaries and consumes **zero external translation quota**. Built-in recipes also use bundled translations. New saved recipe text is automatically translated for display by MyMemory through the `translate` function without a consent popup. Successful translations are cached in a separate Netlify Blobs store, `family-translations`, and in page memory. Edits change the cache key. The source JSON is never replaced by machine output. See [translation limits and accuracy](localization.md#free-service-limits).

MyMemory requires outbound HTTPS access to `api.mymemory.translated.net`. No paid translation key is required. The free allowance is limited and may be shared by server IP; this is not unlimited free translation. Netlify Functions and Blobs usage remain subject to the site's Netlify plan limits.

## Verify after deployment

- Opening `/.netlify/functions/family-plan` without a code returns 401; a missing/short server secret returns 503. No JSON planner data is exposed without a valid code.
- Create a shared copy, open it on a second device, edit a meal on the first and wait for **Synced**. The second should receive the change while not editing.
- Edit both devices before either saves: one succeeds, the other reports a conflict; neither silently replaces the newer server state.
- Disconnect network access and edit: the local copy persists and sync reports an error; retry after reconnecting.
- Change the interface language: labels change without translation API calls. Save a new short English recipe title and view Vietnamese (or vice versa); its display should translate without changing the exported source. Inspect the original in the editor. Quota/network failures leave the original visible.

## Development validation

Run `npm ci`, `npm test` and `npm run build` in `source`. TypeScript checks include Netlify Functions. Function tests mock Netlify Blobs and MyMemory and exercise authentication, conditional writes, validation and translation fallback. React tests cover loading shared state, sending subsequent changes with the fetched revision and preserving data on conflicts. To run real functions locally, use Netlify CLI `netlify dev` with an authorized linked development site and a private `FAMILY_ACCESS_CODE` in an ignored local `.env`; plain `npm run dev` runs only Vite, so cloud features fall back to local mode there.

Automated local checks are not proof of a deployed Netlify site. Real cross-device persistence and provider access must be verified on the deployed site after the environment variable is configured.
