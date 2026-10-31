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

The default recipe is a useful quality reference: it has exact ingredient quantities, distinct preparation/cooking steps and storage/thawing guidance. Sending one complete bilingual example preserves this detail without spending input quota on all ten default meals.

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

Remote AI verification uses the deployed Cloudflare Workflow with a synthetic ten-meal request. It must return a complete validated English/Vietnamese plan, leave the active planner unchanged and remove its temporary job/diagnostic rows. The separate private-site verifier checks HTTP authentication and APIs when environment egress permits it. A local mock or a successful build alone does not establish that Gemini works in production.

Ideas such as barcode scanning, nutrition scoring, paid search, notification services and importing arbitrary recipe websites are outside this change. They add operational or safety requirements and do not resolve the current family's core planning flow.
