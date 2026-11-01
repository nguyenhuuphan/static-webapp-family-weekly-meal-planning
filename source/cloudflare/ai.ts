import {
  additionalRequestPayload,
  compileAdditionalRequest,
  CUISINE_CODES,
} from "../src/ai/additionalRequest";
import {
  CHOICES_SYSTEM,
  CHOICES_SCHEMA,
  validateChoices,
  choiceRecipeSchema,
} from "./alternativeChoices";
import {
  normalizeRecipeTranslations,
  translationRepairRequest,
  TRANSLATION_REPAIR_SYSTEM,
} from "../src/server/recipeTranslations";
import {
  generateMenuBatch,
  generationPayload,
  providerSchema,
  SYSTEM,
  RESPONSE_SCHEMA,
  validateGeneratedPlan,
  GenerationError,
  type WeekContext,
} from "../src/server/gemini";
import type { Plan } from "../src/types";
import type { MenuProviderProgress } from "../src/ai/contracts";
import { GEMINI_MODEL } from "../src/server/gemini";
import type { MenuInput } from "../src/ai/contracts";
import type { Env } from "./types";
import { reserveGeneration } from "./store";
export const CLOUDFLARE_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const boundedText = (en: number, vi: number) => ({
  type: "object",
  properties: {
    en: { type: "string", minLength: 1, maxLength: en },
    vi: { type: "string", minLength: 1, maxLength: vi },
  },
  required: ["en", "vi"],
  additionalProperties: false,
});
export function cloudflareSchema(input: MenuInput) {
  const schema = providerSchema(input);
  const recipe = schema.properties.meals
    .items as typeof RESPONSE_SCHEMA.properties.meals.items;
  // Cloudflare supports nested array constraints. Enforce enough real steps at decoding time.
  return {
    ...schema,
    properties: {
      ...schema.properties,
      name: boundedText(100, 150),
      meals: {
        ...schema.properties.meals,
        items: {
          ...recipe,
          properties: {
            ...recipe.properties,
            ...Object.fromEntries(
              ["storage", "thaw"].map((key) => [
                key,
                {
                  type: "object",
                  properties: {
                    en: { type: "string", maxLength: 300 },
                    vi: { type: "string", maxLength: 450 },
                  },
                  required: ["en", "vi"],
                  additionalProperties: false,
                },
              ]),
            ),
            cuisine: { type: "string", enum: CUISINE_CODES },
            equipment: input.equipment.includes("No heating appliance")
              ? { type: "array", items: { type: "string" }, maxItems: 0 }
              : {
                  type: "array",
                  items: { type: "string", enum: input.equipment },
                },
            minutes: { type: "integer", minimum: 1, maximum: input.maxMinutes },
            main: boundedText(120, 180),
            side: boundedText(120, 180),
            prep: {
              ...recipe.properties.prep,
              maxItems: 3,
              items: {
                ...recipe.properties.prep.items,
                properties: {
                  ...recipe.properties.prep.items.properties,
                  text: boundedText(240, 360),
                },
              },
            },
            ingredients: {
              ...recipe.properties.ingredients,
              maxItems: 12,
              items: {
                ...recipe.properties.ingredients.items,
                properties: {
                  ...recipe.properties.ingredients.items.properties,
                  name: boundedText(96, 144),
                  category: boundedText(32, 48),
                  unit: {
                    type: "string",
                    enum: ["g", "ml", "each", "tsp", "tbsp"],
                  },
                  qty: { type: "number", exclusiveMinimum: 0 },
                },
              },
            },
            steps: {
              ...recipe.properties.steps,
              minItems: 4,
              maxItems: 6,
              items: {
                ...recipe.properties.steps.items,
                properties: {
                  ...recipe.properties.steps.items.properties,
                  text: {
                    ...recipe.properties.steps.items.properties.text,
                    properties: {
                      en: { type: "string", minLength: 40, maxLength: 300 },
                      vi: { type: "string", minLength: 1, maxLength: 450 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
export function parseCloudflareOutput(output: unknown): unknown {
  let raw: unknown = output;
  if (raw && typeof raw === "object") {
    const response = raw as {
      response?: unknown;
      choices?: { finish_reason?: string; message?: { content?: string } }[];
    };
    if (response.choices?.[0]?.finish_reason === "length")
      throw new GenerationError("output_limit", { reason: "output_limit" });
    raw = response.choices?.[0]?.message?.content ?? response.response ?? raw;
  }
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new GenerationError("invalid_output", { reason: "invalid_json" });
    }
  }
  return raw;
}
const FALLBACK_CODES = new Set([
  "quota",
  "provider_busy",
  "provider_error",
  "provider_access",
  "invalid_output",
  "output_limit",
  "incomplete_recipe",
  "unavailable_equipment",
  "restricted_ingredient",
  "not_configured",
  "additional_request_mismatch",
]);
export async function generateWithBackup(
  env: Env,
  input: MenuInput,
  masterPrompt: string,
  recentMeals: string[],
  context: WeekContext,
  onProviderFailure?: (failure: {
    httpStatus: number;
    status?: string;
    message: string;
  }) => Promise<void>,
  onProviderStart?: (
    event: Omit<MenuProviderProgress, "batch">,
  ) => Promise<void>,
) {
  if (compileAdditionalRequest(context.requirements).conflicts.length)
    throw new GenerationError("request_conflict");
  let chosenNames: string[] | undefined;
  const validateBatch = (plan: Plan) => {
    if (
      chosenNames &&
      JSON.stringify(plan.meals.map((meal) => meal.main)) !==
        JSON.stringify(chosenNames)
    )
      throw new GenerationError("invalid_output", {
        reason: "alternative_choice_mismatch",
      });
    if (context.alternatives) {
      const names = new Set(
        context.meals.map((m) => m.main.trim().toLowerCase()),
      );
      for (const meal of plan.meals) {
        const name = meal.main.trim().toLowerCase();
        if (names.has(name))
          throw new GenerationError("invalid_output", {
            reason: "duplicate_alternative",
          });
        names.add(name);
      }
    }
    return plan;
  };
  let fallbackReason: string | undefined;
  try {
    if (!env.GEMINI_API_KEY) throw new GenerationError("not_configured");
    await onProviderStart?.({ provider: "gemini", model: GEMINI_MODEL });
    const plan = await generateMenuBatch(
      input,
      masterPrompt,
      recentMeals,
      { apiKey: env.GEMINI_API_KEY, onProviderFailure },
      context,
    );
    return { plan: validateBatch(plan), provider: "gemini" as const };
  } catch (error) {
    if (
      !env.AI ||
      (error instanceof GenerationError && !FALLBACK_CODES.has(error.code))
    )
      throw error;
    fallbackReason = error instanceof GenerationError ? error.code : "network";
  }
  const basePayload = {
    ...generationPayload(input, masterPrompt, recentMeals, context),
    // The decoding schema is supplied once through response_format, not repeated in the user prompt.
    responseSchema:
      "Use the JSON schema supplied in response_format. For object meals, use the slot IDs as keys.",
    referenceNote:
      "referenceRecipe is a PARTIAL format example, not a complete recipe to copy. Generate complete new recipes for every slot.",
    outputStyle:
      "Return compact JSON. Write concise, actionable instructions: at most 12 ingredients, 3 prep steps and 6 cooking steps per recipe. Include quantities, doneness and safe storage, but no repeated explanations, duplicate keys or paragraph-long ingredient names. Finish every slot and its Vietnamese translation within the response budget.",
  };
  // Keep the bundled recipe as a short format example; its full instructions
  // duplicate system guidance and leave less input room for the household request.
  basePayload.referenceRecipe = {
    ...basePayload.referenceRecipe,
    ingredients: basePayload.referenceRecipe.ingredients.slice(0, 3),
    prep: basePayload.referenceRecipe.prep.slice(0, 1),
    steps: basePayload.referenceRecipe.steps.slice(0, 2),
  };
  let payload = JSON.stringify(basePayload);
  let outputSchema: unknown = cloudflareSchema(input);
  if (
    !context.alternatives &&
    compileAdditionalRequest(context.requirements).rules.some(
      (rule) => rule.cuisine,
    )
  ) {
    const base = cloudflareSchema(input),
      recipe = base.properties.meals.items;
    const requirements = additionalRequestPayload(
      context.requirements,
      input,
      false,
    );
    outputSchema = {
      ...base,
      properties: {
        ...base.properties,
        meals: {
          type: "object",
          properties: Object.fromEntries(
            requirements.slotRequirements.map((slot) => {
              const expected = slot.required.find(
                (rule) => rule.cuisine,
              )?.cuisine;
              const allowed = expected
                ? [expected]
                : CUISINE_CODES.filter(
                    (code) => !slot.forbiddenCuisines.includes(code),
                  );
              return [
                slot.id,
                {
                  ...recipe,
                  properties: {
                    ...recipe.properties,
                    cuisine: { type: "string", enum: allowed },
                  },
                },
              ];
            }),
          ),
          required: requirements.slotRequirements.map((slot) => slot.id),
          additionalProperties: false,
        },
      },
    };
    payload = JSON.stringify(basePayload);
  }
  if (context.alternatives) {
    const choiceInput = JSON.stringify({
      unavailableAppliances: basePayload.unavailableAppliances,
      additionalRequest: additionalRequestPayload(
        context.requirements,
        input,
        true,
      ),
      requirements: {
        ...context.requirements,
        customPrompt: additionalRequestPayload(
          context.requirements,
          input,
          true,
        ).verbatim,
      },
      masterPrompt,
      plannedMeals: context.meals.map((meal) => ({
        main: meal.main,
        ingredients: meal.ingredients.map((i) => i.name),
      })),
      previousMealsToAvoid: recentMeals,
    });
    if (
      new TextEncoder().encode(
        CHOICES_SYSTEM + choiceInput + JSON.stringify(CHOICES_SCHEMA),
      ).length > (context.diagnostic ? 24000 : 64000)
    )
      throw new GenerationError("backup_input_limit");
    if (
      !(await reserveGeneration(
        env.DB,
        context.diagnostic ? "8" : "6",
        context.diagnostic ? "cloudflare-ai-diagnostics" : "cloudflare-ai",
      ))
    )
      throw new GenerationError("backup_quota");
    await onProviderStart?.({
      provider: "cloudflare",
      model: CLOUDFLARE_MODEL,
      activity: "planning_alternatives",
      ...(fallbackReason ? { fallbackReason } : {}),
    });
    let result: unknown;
    try {
      result = await env.AI!.run(CLOUDFLARE_MODEL, {
        messages: [
          { role: "system", content: CHOICES_SYSTEM },
          { role: "user", content: choiceInput + "\n/no_think" },
        ],
        response_format: { type: "json_schema", json_schema: CHOICES_SCHEMA },
        max_tokens: 1024,
        stream: false,
      });
    } catch {
      throw new GenerationError("backup_unavailable");
    }
    const choices = validateChoices(
      parseCloudflareOutput(result),
      context.meals,
    );
    chosenNames = choices.map((choice) => choice.en);
    outputSchema = choiceRecipeSchema(cloudflareSchema(input), input, choices);
    payload = JSON.stringify({
      ...basePayload,
      chosenAlternatives: choices,
      finalInstruction:
        "Write the five chosen recipes exactly once using the supplied object keys and fixed dish names. Do not invent or repeat dish names. Produce complete recipes matching the original requirements and all translations.",
    });
  }
  // Six regular calls below ~800 neurons each; eight smaller diagnostic calls below ~612 each.
  // A shared account's other Workers AI usage still counts toward the account limit.
  if (
    new TextEncoder().encode(SYSTEM + payload + JSON.stringify(outputSchema))
      .length > (context.diagnostic ? 24000 : 64000)
  )
    throw new GenerationError("backup_input_limit");
  if (
    !(await reserveGeneration(
      env.DB,
      context.diagnostic ? "8" : "6",
      context.diagnostic ? "cloudflare-ai-diagnostics" : "cloudflare-ai",
    ))
  )
    throw new GenerationError("backup_quota");
  try {
    await onProviderStart?.({
      provider: "cloudflare",
      model: CLOUDFLARE_MODEL,
      ...(fallbackReason ? { fallbackReason } : {}),
    });
    const output = await env.AI!.run(CLOUDFLARE_MODEL, {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: payload + "\n/no_think" },
      ],
      response_format: {
        type: "json_schema",
        json_schema: outputSchema,
      },
      max_tokens: 16384,
      stream: false,
    });
    let raw = normalizeRecipeTranslations(parseCloudflareOutput(output));
    const repair = translationRepairRequest(raw);
    if (repair) {
      // One small translation-only request. English recipes and all protected numbers stay fixed.
      if (
        !(await reserveGeneration(
          env.DB,
          context.diagnostic ? "8" : "6",
          context.diagnostic ? "cloudflare-ai-diagnostics" : "cloudflare-ai",
        ))
      )
        throw new GenerationError("backup_quota");
      await onProviderStart?.({
        provider: "cloudflare",
        model: CLOUDFLARE_MODEL,
        activity: "repairing_translations",
        ...(fallbackReason ? { fallbackReason } : {}),
      });
      const repaired = await env.AI!.run(CLOUDFLARE_MODEL, {
        messages: [
          { role: "system", content: TRANSLATION_REPAIR_SYSTEM },
          { role: "user", content: repair.input + "\n/no_think" },
        ],
        response_format: { type: "json_schema", json_schema: repair.schema },
        max_tokens: 4096,
        stream: false,
      });
      try {
        raw = repair.apply(parseCloudflareOutput(repaired));
      } catch {
        throw new GenerationError("invalid_output", {
          reason: "translation_repair",
        });
      }
    }

    return {
      plan: validateBatch(validateGeneratedPlan(raw, input, context)),
      provider: "cloudflare" as const,
    };
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if (onProviderFailure) {
      let message =
        error instanceof Error ? error.message : "Unknown backup failure";
      for (const secret of [env.GEMINI_API_KEY, env.FAMILY_ACCESS_CODE])
        if (secret) message = message.replaceAll(secret, "[redacted]");
      await onProviderFailure({
        httpStatus: 0,
        message: message.replace(/AIza[\w-]+/g, "[redacted]").slice(0, 1600),
      }).catch(() => undefined);
    }
    throw new GenerationError("backup_unavailable");
  }
}
