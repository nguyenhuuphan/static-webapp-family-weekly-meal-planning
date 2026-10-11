# family_meal_planning

## Deploy to Netlify

Run `npm ci` and `npm run build` inside `source` to produce the latest build.
For a manual deployment, upload the **source/dist** folder to Netlify Drop or your
existing site's manual deploy area. Upload the folder whose immediate contents
include `index.html`, `assets/`, and `meal-plan.json`, not this repository's root
folder or the `source` folder.

For a Git deployment, connect this repository. The root `netlify.toml` sets:

- Base directory: `source`
- Build command: `npm run build`
- Publish directory: `dist` (relative to `source`, so the output is `source/dist`)
- Node version: `24`

Redeploy after changing these settings. If Netlify still displays "Page not
found", check the latest deploy's file explorer: `index.html` must be at the
top level of the published files.

## Languages

English and Vietnamese are available from the language selector in the header.
The preference is saved separately from meal data. Built-in recipes, shopping,
preparation, cooking, settings and safety guidance are localized. Custom recipe
text remains as entered.

See [localization architecture and adding languages](docs/localization.md).
