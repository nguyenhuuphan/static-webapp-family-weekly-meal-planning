# Languages and recipe translations

The application supports English and Vietnamese without a translation service or additional runtime dependency. The React provider in `source/src/i18n` owns language selection separately from the Redux meal plan. Switching languages does not change recipe data, checklist keys, servings, the selected view, or running timers.

## Structure

- `locales/en.ts`: the canonical message catalogue and typed message IDs.
- `locales/vi.ts`: a complete Vietnamese catalogue checked with `satisfies Messages`.
- `catalog.ts`: the language registry, native language names, Intl locale identifiers and preference resolution.
- `translate.ts`: pure interpolation, plural selection, numbers, dates, measurements, instruction rendering and validation error presentation.
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

Built-in recipe content uses exact original text as its translation lookup key. If the user changes or imports an instruction, it no longer matches the original and is displayed as entered. This deliberately prevents an old translation from hiding edited quantities or safety instructions. Unknown content is never automatically sent to an external service.

The editor translates unchanged built-in field values for display while keeping the underlying original draft. Editing a field stores the user's new text; changing languages does not reset the draft. Export/import preserve the original or edited content, independently of interface language. Advanced JSON uses canonical field names and values, not translated schema keys.

For the planned AI feature, store the generated content's language explicitly. If multilingual generated recipes are added, store each translation with its source revision; invalidate translations when their source changes. Do not infer recipe language from the UI preference or silently translate generated/user text through the built-in catalogue.

## Formatting

Use the provider's Intl formatters for visible numbers and dates. Date-only week values use UTC internally for stable calendar arithmetic and are not shifted by browser timezone. Measurement tokens stay machine-readable (`[300 g]`, `[2 tsp]`) in stored instructions; rendering applies recipe translations, scales quantities, then formats numbers and unit labels. Search matches both original and translated ingredient names, with Vietnamese diacritics ignored.

Netlify hosting and build settings remain unchanged. `npm run build` outputs `source/dist`. Deploy the build output or use the existing Git deployment.

## Preparation groups

`helpers/preparation.ts` derives ingredient groups from reviewed compatibility profiles independently of the UI language. Shared cutting is shown above individual recipe allocations; seasoning and storage instructions remain separate. Different cuts of the same ingredient stay in separate groups. Totals and allocations scale with servings, while progress retains the existing `mealId:taskIndex` keys for backup compatibility.

Profiles apply only when the original instruction and ingredient quantity/unit match. New or edited instructions remain individual rather than guessing whether preparation is compatible. For future AI recipes, add validated structured preparation metadata (ingredient references, cut, operation and allocations) rather than parsing generated prose. The supplied backup schema remains unchanged.
