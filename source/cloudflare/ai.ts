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
import type { MenuInput } from "../src/ai/contracts";
import type { Env } from "./types";
import { reserveGeneration } from "./store";
export const CLOUDFLARE_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
export function cloudflareSchema(input: MenuInput) {
  const schema = providerSchema(input);
  const recipe = schema.properties.meals
    .items as typeof RESPONSE_SCHEMA.properties.meals.items;
  // Cloudflare supports nested array constraints. Enforce enough real steps at decoding time.
  return {
    ...schema,
    properties: {
      ...schema.properties,
      meals: {
        ...schema.properties.meals,
        items: {
          ...recipe,
          properties: {
            ...recipe.properties,
            steps: {
              ...recipe.properties.steps,
              minItems: 4,
              maxItems: 8,
              items: {
                ...recipe.properties.steps.items,
                properties: {
                  ...recipe.properties.steps.items.properties,
                  text: {
                    ...recipe.properties.steps.items.properties.text,
                    properties: {
                      en: { type: "string", minLength: 40 },
                      vi: { type: "string", minLength: 1 },
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
const FALLBACK_CODES = new Set([
  "quota",
  "provider_busy",
  "provider_error",
  "provider_access",
  "invalid_output",
  "incomplete_recipe",
  "unavailable_equipment",
  "restricted_ingredient",
  "not_configured",
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
) {
  const validateBatch = (plan: Plan) => {
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
  try {
    if (!env.GEMINI_API_KEY) throw new GenerationError("not_configured");
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
  }
  const payload = JSON.stringify(
    generationPayload(input, masterPrompt, recentMeals, context),
  );
  // Six regular calls below ~800 neurons each; eight smaller diagnostic calls below ~612 each.
  // A shared account's other Workers AI usage still counts toward the account limit.
  if (
    new TextEncoder().encode(
      SYSTEM + payload + JSON.stringify(cloudflareSchema(input)),
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
  try {
    const output = await env.AI!.run(CLOUDFLARE_MODEL, {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: payload + "\n/no_think" },
      ],
      response_format: {
        type: "json_schema",
        json_schema: cloudflareSchema(input),
      },
      max_tokens: 16384,
      stream: false,
    });
    let raw: unknown = output;
    if (raw && typeof raw === "object") {
      const response = raw as {
        response?: unknown;
        choices?: { finish_reason?: string; message?: { content?: string } }[];
      };
      if (response.choices?.[0]?.finish_reason === "length")
        throw new GenerationError("invalid_output");
      raw = response.choices?.[0]?.message?.content ?? response.response ?? raw;
    }
    if (typeof raw === "string") raw = JSON.parse(raw);
    return {
      plan: validateBatch(validateGeneratedPlan(raw, input)),
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
