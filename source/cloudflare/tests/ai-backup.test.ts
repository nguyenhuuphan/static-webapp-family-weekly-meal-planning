import { afterEach, describe, expect, it, vi } from "vitest";
import { generateWithBackup, CLOUDFLARE_MODEL } from "../ai";
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
    const result = await generateWithBackup(
      env,
      aiInput,
      DEFAULT_MASTER_PROMPT,
      [],
      context,
    );
    expect(result.provider).toBe("cloudflare");
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
    for (let i = 0; i < 6; i++)
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
