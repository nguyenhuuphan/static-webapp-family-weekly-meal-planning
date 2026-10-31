import {
  generateMenuBatch,
  generationPayload,
  providerSchema,
  SYSTEM,
  validateGeneratedPlan,
  GenerationError,
  type WeekContext,
} from "../src/server/gemini";
import type { Plan } from "../src/types";
import type { MenuInput } from "../src/ai/contracts";
import type { Env } from "./types";
import { reserveGeneration } from "./store";
export const CLOUDFLARE_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const FALLBACK_CODES = new Set([
  "quota",
  "provider_busy",
  "provider_error",
  "provider_access",
  "invalid_output",
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
  // At most six bounded backup calls/day for this app, below the free 10k neuron allowance.
  // A shared account's other Workers AI usage still counts toward the account limit.
  if (
    new TextEncoder().encode(
      SYSTEM + payload + JSON.stringify(providerSchema(input)),
    ).length > 64000
  )
    throw new GenerationError("backup_input_limit");
  if (!(await reserveGeneration(env.DB, "6", "cloudflare-ai")))
    throw new GenerationError("backup_quota");
  try {
    const output = await env.AI!.run(CLOUDFLARE_MODEL, {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: payload + "\n/no_think" },
      ],
      response_format: {
        type: "json_schema",
        json_schema: providerSchema(input),
      },
      max_tokens: 32768,
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
    throw new GenerationError("backup_unavailable");
  }
}
