# Languages and recipe translations

The application uses `i18next` and `react-i18next` for bundled English/Vietnamese interface translations. Interface labels and built-in recipes consume no external translation quota. New saved content can be translated automatically through a Netlify Function calling the free MyMemory service. The React provider in `source/src/i18n` owns language selection separately from the Redux meal plan. Switching languages does not change recipe data, checklist keys, servings, the selected view, or running timers.

## Structure

- `locales/en.ts`: the canonical message catalogue and typed message IDs.
- `locales/vi.ts`: a complete Vietnamese catalogue checked with `satisfies Messages`.
- `catalog.ts`: the language registry, native language names, Intl locale identifiers and preference resolution.
- `engine.ts`: synchronous i18next resources, interpolation and plural selection.
- `translate.ts`: typed translation adapter, numbers, dates, measurements, instruction rendering and validation error presentation.
- `automatic.ts`: queued/deduplicated automatic content translations with a session cache and original-text fallback.
- `index.tsx`: the React provider, `useI18n()` and accessible language selector.
- `locales/vi.recipes.json`: translations of the built-in recipe text, separate from UI messages.

Preferences resolve in this order: a valid saved language, the browser's preferred supported language, then English. The preference uses `weekday-table:language`, independently of meal data. Storage failure does not prevent switching. Cross-tab storage events synchronize language selection. The document's `lang` and title follow the selected language.

## Adding a language

1. Add `locales/<code>.ts`, exporting a catalogue that `satisfies Messages`.
2. Keep interpolation placeholders identical to English. Translate whole sentences containing values rather than assembling translated fragments.
3. Add the language to `languages` in `catalog.ts` with its native name, Intl locale and optional recipe translation map. The selector and `Language` type update automatically.
4. For count messages, add the appropriate `_one`, `_other`, `_few`, etc. variants to the shared catalogue when the new language needs them. Selection uses `Intl.PluralRules`, not an English singular/plural conditional.
5. Translate built-in recipe content if desired. Preserve every bracketed quantity token, cooking temperature and timing. Missing content translations fall back to the original text.
6. Run `npm test` and `npm run build`. The localization tests check catalogue keys/placeholders and built-in recipe quantity tokens.

Usage:

```tsx
const { t, content, number, unit, date } = useI18n();
t("mealCount", { count: plan.meals.length });
content(meal.main);
`${number(ingredient.qty)} ${unit(ingredient.unit)}`;
date(weekStart, meal.day);
```

English message IDs are stable identifiers: changing English copy should not rename the ID. UI code does not branch on `vi`/`en`. Domain values such as `Monday`, `Lunch`, ingredient categories, units, quantities and IDs remain canonical; translate their presentation only. Select options must use explicit canonical `value` attributes.

## Recipe content and editing

Built-in recipe content uses exact original text as its translation lookup key. If the user changes or imports text, it no longer matches the built-in catalogue. When the target language differs, saved text is automatically submitted to `/.netlify/functions/translate`, which calls MyMemory over HTTPS. No consent dialog is shown. The UI immediately displays the original until a translation is available. Responses are kept in memory for the session and successfully translated text is cached in Netlify Blobs by a hash of source text and target language, reducing repeated quota usage across devices. No family access code is sent to MyMemory. The recipe editor retains original custom text to avoid changing input values while typing.

The editor translates unchanged built-in field values for display while keeping the underlying original draft. Editing a field stores the user's new text; changing languages does not reset the draft. Export/import preserve the original or edited content, independently of interface language. Advanced JSON uses canonical field names and values, not translated schema keys.

For the planned AI feature, store the generated content's language explicitly. If multilingual generated recipes are added, store each translation with its source revision; invalidate translations when their source changes. Do not infer recipe language from the UI preference or silently translate generated/user text through the built-in catalogue.

## Formatting

Use the provider's Intl formatters for visible numbers and dates. Date-only week values use UTC internally for stable calendar arithmetic and are not shifted by browser timezone. Measurement tokens stay machine-readable (`[300 g]`, `[2 tsp]`) in stored instructions; rendering applies recipe translations, scales quantities, then formats numbers and unit labels. Search matches both original and translated ingredient names, with Vietnamese diacritics ignored.

Netlify Functions are required for automatic custom-content translation and family sync; see [Netlify setup](netlify-sync.md). `npm run build` outputs `source/dist`. Deploy the build output or use the existing Git deployment.

## Preparation groups

`helpers/preparation.ts` derives ingredient groups from reviewed compatibility profiles independently of the UI language. Shared cutting is shown above individual recipe allocations; seasoning and storage instructions remain separate. Different cuts of the same ingredient stay in separate groups. Totals and allocations scale with servings, while progress retains the existing `mealId:taskIndex` keys for backup compatibility.

Profiles apply only when the original instruction and ingredient quantity/unit match. New or edited instructions remain individual rather than guessing whether preparation is compatible. For future AI recipes, add validated structured preparation metadata (ingredient references, cut, operation and allocations) rather than parsing generated prose. The supplied backup schema remains unchanged.

Category completion marks every visible allocation in that category using its existing progress key. Reviewed sauce/seasoning-only instructions are displayed before cooking instead of on Prep Day, and are excluded from advance-preparation totals and readiness. Existing marinade instructions stay in advance preparation. Edited or unknown instructions remain in advance preparation until their compatibility is explicitly reviewed.

## Free service limits

MyMemory's anonymous free tier currently documents a 5,000-character daily allowance and 500-byte maximum per query: https://mymemory.translated.net/doc/usagelimits.php and https://mymemory.translated.net/doc/spec.php . Shared server egress can share a quota. No paid key is configured. Quota exhaustion, timeouts and rejected translations retain source text; failures are not retried repeatedly within the same page session. Refreshing allows another attempt. Long text is split at word boundaries into requests of at most 500 UTF-8 bytes, keeping bracketed quantity tokens whole and preserving whitespace between chunks. A single indivisible token over this limit is left unchanged.

Source-language detection is a lightweight English/Vietnamese heuristic: Vietnamese diacritics imply Vietnamese, otherwise English. Unaccented Vietnamese or mixed-language content may need manual correction. Numbers and bracketed quantity tokens must match exactly in translated output or it is rejected; this is not a guarantee of medical or food-safety accuracy. Original content remains in storage, exports and the editor. Service-generated translations are display-only and are not authoritative recipe data.
