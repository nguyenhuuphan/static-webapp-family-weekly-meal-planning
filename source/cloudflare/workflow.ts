import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { combineMenuPlans, GenerationError } from "../src/server/gemini";
import { generateWithBackup } from "./ai";
import { alternativeInput, attachAlternatives } from "../src/ai/alternatives";
import type { MenuJob } from "../src/ai/contracts";
import type { Plan } from "../src/types";
import { DocumentStore } from "./store";
import type { Env } from "./types";
const NO_RETRIES = {
  retries: { limit: 0, delay: "1 second" },
  timeout: "10 minutes",
} as const;
function runtimeDiagnostic(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const reason = /cpu|exceeded.*time limit/i.test(message)
    ? "cpu_limit"
    : /timeout|timed out|deadline|abort/i.test(message)
      ? "timeout"
      : /fetch|connect|network|socket/i.test(message)
        ? "network"
        : "runtime";
  return { reason };
}
async function recordSyntheticFailure(env: Env, id: string, error: unknown) {
  let message =
    error instanceof Error ? error.message : "Unknown runtime failure";
  for (const key of [env.GEMINI_API_KEY, env.FAMILY_ACCESS_CODE])
    if (key) message = message.replaceAll(key, "[redacted]");
  await new DocumentStore(env.DB, "diagnostics")
    .setJSON("gemini/" + id, {
      stage: "runtime",
      message: message.replace(/AIza[\w-]+/g, "[redacted]").slice(0, 1600),
    })
    .catch(() => undefined);
}
export class MenuWorkflow extends WorkflowEntrypoint<Env, { id: string }> {
  async run(event: WorkflowEvent<{ id: string }>, step: WorkflowStep) {
    const store = new DocumentStore(this.env.DB, "ai"),
      id = event.payload.id;
    const claimed = await step.do("claim-job", NO_RETRIES, async () => {
      const entry = await store.getWithMetadata<MenuJob>("jobs/" + id);
      if (!entry || entry.data.status !== "queued") return null;
      const job = { ...entry.data, status: "running" as const };
      const result = await store.setJSON("jobs/" + id, job, {
        onlyIfMatch: entry.etag,
      });
      return result.modified ? { job, revision: result.etag! } : null;
    });
    if (!claimed) return;
    try {
      // Return expected provider failures as durable data so their codes survive step replay.
      const plans: Plan[] = [];
      const providers = new Set<"gemini" | "cloudflare">();
      let alternatives: Plan | undefined;
      let failure:
        | {
            status: "failed";
            errorCode: string;
            errorDiagnostic?: MenuJob["errorDiagnostic"];
          }
        | undefined;
      for (const type of [
        ...claimed.job.input.mealTypes,
        "alternatives",
      ] as const) {
        const isAlternative = type === "alternatives";
        const batch = await step.do(
          "generate-validated-" + type.toLowerCase(),
          NO_RETRIES,
          async () => {
            try {
              const generated = await generateWithBackup(
                claimed.job.diagnostic === true &&
                  claimed.job.diagnosticProvider === "cloudflare"
                  ? { ...this.env, GEMINI_API_KEY: undefined }
                  : this.env,
                isAlternative
                  ? alternativeInput(claimed.job.input)
                  : { ...claimed.job.input, mealTypes: [type] },
                claimed.job.masterPrompt,
                claimed.job.recentMeals,
                {
                  requirements: claimed.job.input,
                  meals: plans.flatMap((plan) => plan.meals),
                  alternatives: isAlternative,
                  diagnostic: claimed.job.diagnostic === true,
                },
                claimed.job.diagnostic === true
                  ? async (failure) => {
                      await new DocumentStore(
                        this.env.DB,
                        "diagnostics",
                      ).setJSON("gemini/" + id, failure);
                    }
                  : undefined,
                async (event) => {
                  await store
                    .setJSON("progress/" + id, { ...event, batch: type })
                    .catch(() => undefined);
                },
              );
              return { status: "ready" as const, ...generated };
            } catch (error) {
              if (!(error instanceof GenerationError) && claimed.job.diagnostic)
                await recordSyntheticFailure(this.env, id, error);
              return {
                status: "failed" as const,
                errorCode:
                  error instanceof GenerationError
                    ? error.code
                    : "provider_error",
                ...(error instanceof GenerationError && error.diagnostic
                  ? { errorDiagnostic: error.diagnostic }
                  : !(error instanceof GenerationError)
                    ? { errorDiagnostic: runtimeDiagnostic(error) }
                    : {}),
              };
            }
          },
        );
        if (batch.status === "failed") {
          failure = batch;
          break;
        }
        providers.add(batch.provider);
        if (isAlternative) alternatives = batch.plan;
        else plans.push(batch.plan);
      }
      const result =
        failure ??
        (await step.do("assemble-complete-menu", NO_RETRIES, async () => ({
          status: "ready" as const,
          plan: attachAlternatives(
            combineMenuPlans(plans, claimed.job.input),
            alternatives!,
          ),
          providersUsed: [...providers],
        })));
      await step.do(
        "save-result",
        { retries: { limit: 2, delay: "2 seconds" }, timeout: "30 seconds" },
        async () => {
          await store.setJSON(
            "jobs/" + id,
            { ...claimed.job, ...result },
            { onlyIfMatch: claimed.revision },
          );
        },
      );
    } catch (error) {
      await step.do(
        "save-failure",
        { retries: { limit: 2, delay: "2 seconds" }, timeout: "30 seconds" },
        async () => {
          if (claimed.job.diagnostic)
            await recordSyntheticFailure(this.env, id, error);
          await store.setJSON(
            "jobs/" + id,
            {
              ...claimed.job,
              status: "failed",
              errorCode: "provider_error",
              errorDiagnostic: runtimeDiagnostic(error),
            },
            { onlyIfMatch: claimed.revision },
          );
        },
      );
    }
  }
}
