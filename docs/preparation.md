Preparation categories and mealtime tasks
========================================

Prep Day groups vegetables/herbs separately from meat/seafood/eggs. Reviewed bundled preparation profiles retain their existing compatible quantity groups. Generated or edited instructions are categorized from the actual ingredients and clear action clauses, independently of the display language. Independent vegetable and protein actions inside one old instruction can appear as separate checklist items. Inseparable or unidentified actions stay in Other instead of receiving an invented ingredient allocation.

This is a presentation change: existing recipe text, ingredient quantities, purchase history and saved-food records are not rewritten. One recipe/category card collects its relevant actions. Existing English/Vietnamese translations are split by category locally, preserving quantities without calling a translation or AI API.

Split checklist items use `original-prep-key::Produce` / `::Protein` (and other applicable categories) in the existing synchronized `progress.prep` map. The original preparation key becomes complete only when all advance-preparation parts are complete. Existing original-key completions count as all parts complete; unchecking one part preserves the other parts. Preparation timestamps and saved-food credits remain attached to the original key, with no guessed credits for partially complete mixed tasks. Undo restores both source and part flags and the original timestamp. Changing portion counts clears partial flags to prevent completion for an old quantity from carrying into a new one.

Rinsing/cooking rice is excluded from advance preparation and its readiness requirement. Existing rice instructions appear under **Cook → Prepare fresh before cooking**, without advance container-label directions. Rice vinegar, rice flour, rice noodles and rice paper are not treated as plain rice. The shared AI system prompt and English default master prompt request fresh rice at mealtime and separate vegetable/protein prep entries for future menus.

The ingredient-allocation editor is collapsed and optional. It is used when reserving prepared amounts for another meal; an unassigned mapping does not mean ingredients are missing and does not block preparation completion. Explicit allocation validation and its errors remain unchanged.

For unreviewed recipes, card titles list the ingredients actually handled in that category (for example broccoli in Vegetables, salmon in Proteins), with the recipe/day shown as context. They do not classify a whole meal by its main dish.

Inline storage notes show only sentences that clearly apply to that category. Mixed or general meal-storage advice stays available in meal details, rather than repeating raw-meat instructions under vegetable actions. Storage times and temperatures are not rewritten.
