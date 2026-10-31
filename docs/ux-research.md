# Family cooking UX review

Reviewed 31 October 2026. This is desk research using primary project documentation and accessibility/design guidance, combined with an audit of this application's actual mobile interface. It is not a claim of a controlled user study. The owner has confirmed production email sign-in, the default menu and the family-sync connection.

## What a household needs to accomplish

1. Decide what to cook for the coming week, within household size, available time, equipment and dietary requirements.
2. Turn that plan into a practical shopping list, taking existing ingredients into account.
3. Prepare ingredients and cook with readable instructions, quantities and progress that survive interruptions.
4. Keep the family looking at the same plan across devices, while preserving a recoverable device copy.

AI is a way to prepare a draft for the first task. It must not bypass review, replace an active plan on its own, change quantities in translation or require a personal ChatGPT subscription.

## Primary sources and implications

| Source | Observed guidance or feature | Implication for this app |
| --- | --- | --- |
| [Mealie project documentation](https://github.com/mealie-recipes/mealie/blob/mealie-next/README.md) | Connects recipe management, weekly meal planning and shopping lists organised into supermarket sections. | Keep the plan-to-shopping handoff explicit. Grocery totals should derive from the accepted plan, not a second editable AI shopping list. |
| [Tandoor project documentation](https://github.com/TandoorRecipes/recipes) | Multiple meals per day, shopping lists from recipes/plans, scaling, collaboration and mobile use. | Retain flexible day/meal selections, household portions and bilingual recipe editing; avoid a fixed ten-slot assumption in generated plans. |
| [KitchenOwl project documentation](https://github.com/TomBursch/kitchenowl) | Collaborative real-time shopping, recipes, meal plans and partial offline support. | Clearly distinguish a device copy from connected family data. Preserve local work during network failure and make reconnection discoverable. |
| [Grocy project documentation](https://github.com/grocy/grocy) | Treats stock, shopping and meal planning as connected household tasks. | Reuse existing pantry and prepared-food records. Do not reset physical food inventory merely because a new menu is accepted. |
| [GOV.UK question pages](https://github.com/alphagov/govuk-design-system/blob/main/src/patterns/question-pages/index.md) | Ask only necessary questions, group related questions, use specific headings, carry answers forward, provide Back and Continue, mark optional fields. | Group the AI wizard around household/schedule, preferences, review and draft. Retain answers when going back and focus the new step heading. |
| [GOV.UK check answers](https://github.com/alphagov/govuk-design-system/blob/main/src/patterns/check-answers/index.md) | Let people review before submission and change individual sections. The final action should state what it does. | Show a readable request summary, direct editing links and an explicit Generate menu action. Applying the generated draft is a separate action. |
| [W3C target size guidance](https://github.com/w3c/wcag/blob/main/understanding/22/target-size-minimum.html) | WCAG 2.2 AA uses a 24 × 24 CSS-pixel minimum target or specified exceptions; larger targets help users activate controls accurately. | Use at least 44-pixel option labels and primary controls as a product comfort target for one-handed kitchen use. This is not a claim that 44 pixels is the AA requirement. |
| [W3C focus visibility guidance](https://github.com/w3c/wcag/blob/main/understanding/22/focus-not-obscured-minimum.html) | Persistent headers/footers must not completely obscure the item receiving keyboard focus. | Keep dialog navigation reachable, restore focus when closing, reset scrolling on a step change and allow space around focused controls. |

These are feature and interaction findings, not evidence that a specific visual style improves nutrition or that an AI recipe is safe for an allergy. Food safety and dietary restrictions still require user review.

## Findings in the existing interface

The 390 × 844 Vietnamese mobile audit showed the expanded family-connection form occupying most of the first viewport. The weekly plan and AI action were pushed below the fold. Connection setup is occasional; planning and cooking are the repeated tasks.

The AI dialog already protects the active menu and collects the right household inputs, but its preference step is long. Step changes did not explicitly reset the dialog's scrolling or move focus to a new heading. Day selection required several individual checkbox actions. The desktop sidebar also described the app as having no account or automatic sync, which no longer matched the Cloudflare deployment.

The default recipe is a useful quality reference: it has exact ingredient quantities, distinct preparation/cooking steps and storage/thawing guidance. Sending one complete bilingual example preserves this detail without spending input quota on all ten default meals. A separate, explicitly labelled list identifies previous dishes to avoid, so the previous menu does not become a list of suggestions for the new week. Ingredient reuse and recipe repetition are distinct requirements.

An initial live 21-slot generation returned all slots and translations, but some recipes were too terse: an eggs-and-toast breakfast omitted bread from its ingredients, and several hot meals used placeholder cooking directions. The generation boundary therefore checks basic side-ingredient completeness, useful heating instructions and quantity tokens that the app can scale. These checks are a quality floor, not proof of culinary completeness or allergy safety.

The first automated accessibility audit found generic calendar containers with prohibited accessible labels and insufficient contrast in day numbers, dinner badges and notices. Calendar groups now use appropriate semantics only when they have content, and the affected foreground colours are darker.

AI plans can include rice and bread in their actual ingredient lists. The default menu's separate-rice guidance therefore remains specific to that default instead of being presented as a universal rule. The calendar also omits meal types the plan did not request while retaining additional scheduled food.

## Implementation priorities

- **Reliability:** verify a complete bilingual Gemini week, preserve the active menu until Apply, and make durable Workflow results serializable. Keep credentials server-side and error details private.
- **Information hierarchy:** make connection status compact and disclose code entry and connection controls on demand. Keep local/family state understandable without hiding errors.
- **Free-tier use:** pause family polling in hidden/offline tabs, refresh when returning, and debounce local saves. Visible idle tabs poll every five seconds; an in-flight guard prevents overlapping writes from foreground events.
- **Planning flow:** use a task-oriented page title and a clear handoff to shopping, preparation and cooking. Keep the AI action visible on mobile.
- **Wizard clarity:** give each stage a heading and short explanation, maintain focus and scroll position, offer weekday/full-week presets, and make checkbox labels easy to tap.
- **Review and reuse:** keep previous answers, identify optional detail, provide direct ways back to the relevant questions and never call Gemini merely by opening the popup or changing language.
- **Bilingual consistency:** use local UI translations, bundled default-recipe translations and the generated plan's saved translation map. Avoid additional AI calls when switching English/Vietnamese.

## Validation

Use unit/integration tests for input validation, draft review/edit/apply, data preservation, family concurrency and failure recovery. Use actual Chromium at 320, 390, 768 and 1440 pixels for visible controls, overflow, keyboard focus, dialog navigation and the planning-to-shopping/preparation/cooking handoffs.

Remote AI verification uses the deployed Cloudflare Workflow with synthetic ten-meal and full 21-meal requests. It must return a complete validated English/Vietnamese plan, leave the active planner unchanged and remove its temporary job/diagnostic rows. The separate private-site verifier checks HTTP authentication and APIs when environment egress permits it. A local mock or a successful build alone does not establish that Gemini works in production.

Recorded checks for this change:

- **Automated application tests:** 141 frontend/domain tests and 15 Cloudflare authentication/route/Workflow tests passed. Frontend and Worker TypeScript checks and the production build passed.
- **Actual Chromium:** English and Vietnamese at 320, 390, 768 and 1440 pixels passed the request/review/draft/edit/apply flow and the shopping, preparation, cooking, settings and language-switch handoffs. These UI checks replay a saved synthetic Gemini result; they do not count as live provider verification. Two additional 390-pixel cases in both languages applied the final complete 21-meal production fixture and repeated those handoffs. Keyboard checks at 390 pixels verified visible focused controls and restored focus after closing.
- **Accessibility scans:** the weekly-plan and preference screens in both languages at 390 pixels had zero violations in the automated WCAG A/AA checks used. This covers those screens and rules, not full application accessibility conformance.
- **Actual isolated D1 sync:** two independent browser profiles connected to shared data, preserved rapid changes during a delayed response, stopped hidden-tab requests, refreshed on return and rejected a stale write with HTTP 409. Missing-family-code requests were denied and the planner did not persist the credential. Production family data was not used or changed by this test.
- **Actual production AI:** the deployed native Workflow returned and persisted a validated 21-slot English/Vietnamese result. It left the active planner unchanged, and its synthetic job and private diagnostic rows were removed. The final three-batch run returned 21 meals and 207 Vietnamese translations, with 19 distinct main dishes. Every heated recipe had at least four cooking steps and 243 English instruction characters. Representative recipes were manually checked for main/side ingredient coverage. Variety remains model-generated guidance, not a guarantee that every dish differs from earlier weeks.
- **Production access:** the owner confirmed email sign-in, the default menu and the family-sync connection. The environment's egress proxy blocks automated HTTP access to the private public hostname; native Cloudflare administration checks and local browser checks are reported separately. Owner-only Access, required secret names and the absence of temporary service tokens were checked through Cloudflare administration APIs.

A live constrained seven-lunch batch returned seven unique dishes, none from the previous menu, with at least four cooking steps and 376 instruction characters per heated recipe. Larger decoder bounds exceeded Google's serving limits. Generation therefore uses one durable batch per selected meal time and assembles a ready draft only when every batch succeeds. A full 21-meal week uses three calls instead of a single overloaded constraint; both languages remain in those same calls. The review screen shows the request count before generation.

The provider review also used Google's [current model catalogue](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) and [pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite). Repeated live HTTP 503 responses on 3.1 Flash-Lite motivated switching the single configured model to stable 3.5 Flash-Lite, which has a documented free API tier. A live 21-meal request succeeded on that model. Google availability and quota still apply; the app does not enable billing, retry automatically or switch to a paid fallback.

Ideas such as barcode scanning, nutrition scoring, paid search, notification services and importing arbitrary recipe websites are outside this change. They add operational or safety requirements and do not resolve the current family's core planning flow.
