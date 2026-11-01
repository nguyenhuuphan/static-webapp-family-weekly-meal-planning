import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateWithBackup,
  CLOUDFLARE_MODEL,
  parseCloudflareOutput,
  cloudflareSchema,
} from "../ai";
import { database } from "./database";
import type { Env } from "../types";
import { aiInput, aiBilingualOutput } from "../../tests/ai-fixtures";
import { DEFAULT_MASTER_PROMPT } from "../../src/ai/contracts";
const dbs: ReturnType<typeof database>[] = [];
function environment() {
  const db = database();
  dbs.push(db);
  return {
    DB: db.db,
    GEMINI_API_KEY: "test-key",
    AI: {
      run: vi
        .fn()
        .mockResolvedValue({ response: JSON.stringify(aiBilingualOutput()) }),
    },
  } as unknown as Env;
}
const context = { requirements: aiInput, meals: [] };
afterEach(() => {
  dbs.splice(0).forEach((db) => db.close());
  vi.unstubAllGlobals();
});
describe("Cloudflare backup", () => {
  it("falls back on Gemini quota and subjects its output to the same validation", async () => {
    const env = environment();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({}, { status: 429 })),
    );
    const starts = vi.fn().mockResolvedValue(undefined);
    const result = await generateWithBackup(
      env,
      aiInput,
      DEFAULT_MASTER_PROMPT,
      [],
      context,
      undefined,
      starts,
    );
    expect(result.provider).toBe("cloudflare");
    expect(starts.mock.calls.map(([event]) => event.provider)).toEqual([
      "gemini",
      "cloudflare",
    ]);
    expect(starts.mock.calls[1][0].fallbackReason).toBe("quota");
    expect(result.plan.meals).toHaveLength(1);
    expect(env.AI!.run).toHaveBeenCalledWith(
      CLOUDFLARE_MODEL,
      expect.objectContaining({ stream: false, max_tokens: 16384 }),
    );
    vi.mocked(env.AI!.run).mockResolvedValue({
      response: '{"meals":[]}',
    } as never);
    await expect(
      generateWithBackup(env, aiInput, DEFAULT_MASTER_PROMPT, [], context),
    ).rejects.toMatchObject({ code: "invalid_output" });
  });
  it("supports backup alone and caps provider calls rather than making unlimited retries", async () => {
    const env = environment();
    delete env.GEMINI_API_KEY;
    for (let i = 0; i < 6; i++)
      await generateWithBackup(
        env,
        aiInput,
        DEFAULT_MASTER_PROMPT,
        [],
        context,
      );
    await expect(
      generateWithBackup(env, aiInput, DEFAULT_MASTER_PROMPT, [], context),
    ).rejects.toMatchObject({ code: "backup_quota" });
    expect(env.AI!.run).toHaveBeenCalledTimes(6);
  });
  it("keeps bounded administrative checks separate from the family's backup allowance", async () => {
    const env = environment();
    delete env.GEMINI_API_KEY;
    for (let i = 0; i < 8; i++)
      await generateWithBackup(env, aiInput, DEFAULT_MASTER_PROMPT, [], {
        ...context,
        diagnostic: true,
      });
    await expect(
      generateWithBackup(env, aiInput, DEFAULT_MASTER_PROMPT, [], {
        ...context,
        diagnostic: true,
      }),
    ).rejects.toMatchObject({ code: "backup_quota" });
    expect(
      (
        await generateWithBackup(
          env,
          aiInput,
          DEFAULT_MASTER_PROMPT,
          [],
          context,
        )
      ).provider,
    ).toBe("cloudflare");
  });
  it("tries the backup when Gemini mentions an unselected appliance", async () => {
    const env = environment(),
      invalid = aiBilingualOutput();
    const recipe = Object.values(invalid.meals)[0];
    recipe.steps[0].text.en += " Use an oven.";
    recipe.steps[0].text.vi += " Dùng lò nướng.";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [{ type: "text", text: JSON.stringify(invalid) }],
            },
          ],
        }),
      ),
    );
    const result = await generateWithBackup(
      env,
      aiInput,
      DEFAULT_MASTER_PROMPT,
      [],
      context,
    );
    expect(result.provider).toBe("cloudflare");
    expect(env.AI!.run).toHaveBeenCalledTimes(1);
  });
  it("repairs only broken translations once and validates the complete recipe afterwards", async () => {
    const env = environment();
    delete env.GEMINI_API_KEY;
    const raw = aiBilingualOutput();
    Object.values(raw.meals)[0].prep[0].text.vi = "Bản dịch thiếu định lượng";
    vi.mocked(env.AI!.run)
      .mockReset()
      .mockImplementation(async (_model, payload) => {
        const request = payload as { messages: { content: string }[] };
        if (request.messages[0].content.startsWith("Translate each")) {
          const input = JSON.parse(
            request.messages[1].content.replace("\n/no_think", ""),
          );
          return {
            response: {
              translations: input.translations.map(
                (field: { id: number; en: string }) => ({
                  id: field.id,
                  vi: "VI " + field.en,
                }),
              ),
            },
          } as never;
        }
        return { response: raw } as never;
      });
    const starts = vi.fn().mockResolvedValue(undefined);
    const generated = await generateWithBackup(
      env,
      aiInput,
      DEFAULT_MASTER_PROMPT,
      [],
      context,
      undefined,
      starts,
    );
    expect(generated.plan.meals).toHaveLength(1);
    expect(env.AI!.run).toHaveBeenCalledTimes(2);
    expect(starts.mock.calls[1][0].activity).toBe("repairing_translations");
  });
  it("falls back when a structurally valid menu ignores the additional request", async () => {
    const env = environment();
    const input = {
      ...aiInput,
      days: ["Monday"] as typeof aiInput.days,
      mealTypes: ["Dinner"] as typeof aiInput.mealTypes,
      customPrompt: "I need 1 western meal with fried fish and broccoli.",
    };
    const wrong = aiBilingualOutput(input);
    Object.values(wrong.meals)[0].cuisine = "Vietnamese";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [{ type: "text", text: JSON.stringify(wrong) }],
            },
          ],
        }),
      ),
    );
    const fixed = aiBilingualOutput(input),
      meal = Object.values(fixed.meals)[0];
    meal.cuisine = "European";
    meal.main = {
      en: "Fried salmon and broccoli",
      vi: "Cá hồi chiên và bông cải xanh",
    };
    meal.ingredients.push(
      {
        name: { en: "Salmon fillet", vi: "Phi lê cá hồi" },
        qty: 200,
        unit: "g",
        category: { en: "Protein", vi: "Đạm" },
      },
      {
        name: { en: "Broccoli florets", vi: "Bông cải xanh" },
        qty: 200,
        unit: "g",
        category: { en: "Produce", vi: "Rau củ" },
      },
    );
    meal.steps[0].text = {
      en: "Pan-fry the salmon fillet until golden and fully cooked.",
      vi: "Áp chảo chiên phi lê cá hồi đến khi vàng và chín kỹ.",
    };
    vi.mocked(env.AI!.run).mockResolvedValue({ response: fixed } as never);
    const starts = vi.fn().mockResolvedValue(undefined);
    const result = await generateWithBackup(
      env,
      input,
      DEFAULT_MASTER_PROMPT,
      [],
      { requirements: input, meals: [] },
      undefined,
      starts,
    );
    expect(result.provider).toBe("cloudflare");
    expect(starts.mock.calls[1][0].fallbackReason).toBe(
      "additional_request_mismatch",
    );
    expect(result.plan.meals[0].cuisine).toBe("European");
  });
  it("uses successful Gemini output without calling the backup", async () => {
    const env = environment();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [
                { type: "text", text: JSON.stringify(aiBilingualOutput()) },
              ],
            },
          ],
        }),
      ),
    );
    expect(
      (
        await generateWithBackup(
          env,
          aiInput,
          DEFAULT_MASTER_PROMPT,
          [],
          context,
        )
      ).provider,
    ).toBe("gemini");
    expect(env.AI!.run).not.toHaveBeenCalled();
  });
});

it("identifies a truncated response even when it contains parseable partial JSON", () => {
  expect(() =>
    parseCloudflareOutput({
      choices: [{ finish_reason: "length", message: { content: "{}" } }],
      response: {},
    }),
  ).toThrowError(
    expect.objectContaining({
      code: "output_limit",
      diagnostic: { reason: "output_limit" },
    }),
  );
  expect(() => parseCloudflareOutput({ response: "{broken" })).toThrowError(
    expect.objectContaining({
      code: "invalid_output",
      diagnostic: { reason: "invalid_json" },
    }),
  );
  const recipe = cloudflareSchema(aiInput).properties.meals.items;
  expect(recipe.properties.ingredients.maxItems).toBe(12);
  expect(recipe.properties.prep.maxItems).toBe(3);
  expect(recipe.properties.steps.maxItems).toBe(6);
  expect(
    recipe.properties.steps.items.properties.text.properties.en.maxLength,
  ).toBe(300);
});
it("backs up an incomplete Gemini response and records the output-limit reason", async () => {
  const env = environment();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ status: "incomplete" })),
  );
  const starts = vi.fn();
  const result = await generateWithBackup(
    env,
    aiInput,
    DEFAULT_MASTER_PROMPT,
    [],
    context,
    undefined,
    starts,
  );
  expect(result.provider).toBe("cloudflare");
  expect(starts.mock.calls.at(-1)?.[0].fallbackReason).toBe("output_limit");
});
