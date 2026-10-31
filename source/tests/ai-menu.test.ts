import { afterEach, describe, expect, it, vi } from "vitest";
import { validateMenuInput, DEFAULT_MASTER_PROMPT } from "../src/ai/contracts";
import {
  generateMenu,
  validateGeneratedPlan,
  GenerationError,
} from "../netlify/ai/gemini";
import { validatePlan } from "../src/validations";
import { freshState, hydrateState } from "../src/helpers";
import { applyGeneratedMenu } from "../src/ai/apply";
import { aggregate } from "../src/utils";
import { calendarDate, CALENDAR_DAYS } from "../src/helpers/calendar";
import { createTranslator } from "../src/i18n/translate";
import { DAYS, MEAL_TYPES, type Plan } from "../src/types";
import original from "../public/meal-plan.json";
import { aiInput, aiOutput, aiPlan, aiBilingualOutput } from "./ai-fixtures";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("AI requirements and flexible weeks", () => {
  it("accepts 1–21 slots including weekend breakfasts while preserving v1 validation", () => {
    expect(validateMenuInput(aiInput)).toEqual(aiInput);
    const full = { ...aiInput, days: [...DAYS], mealTypes: [...MEAL_TYPES] };
    const plan = validateGeneratedPlan(aiBilingualOutput(full), full);
    expect(plan.meals).toHaveLength(21);
    expect(validatePlan(plan)).toEqual([]);
    expect(validatePlan(original)).toEqual([]);
    const invalid = structuredClone(original) as Plan;
    invalid.meals[0].day = "Saturday";
    expect(validatePlan(invalid).length).toBeGreaterThan(0);
    expect(CALENDAR_DAYS).toHaveLength(7);
    expect(calendarDate("2026-11-02", 6)).toBe("2026-11-08");
    expect(createTranslator("vi").date("2026-11-02", "Sunday")).toContain("8");
  });
  it("rejects missing equipment, contradictory cold-meal selections and invalid slots", () => {
    for (const patch of [
      { equipment: [] },
      { equipment: ["No heating appliance", "Oven"] },
      { days: [] },
      { mealTypes: ["Lunch", "Lunch"] },
      { servings: 13 },
    ])
      expect(() => validateMenuInput({ ...aiInput, ...patch })).toThrow();
  });
  it("requires all requested slots, complete translations and unchanged amounts", () => {
    const output = aiOutput();
    expect(validateGeneratedPlan(output, aiInput).schemaVersion).toBe(2);
    expect(() =>
      validateGeneratedPlan({ ...output, meals: [] }, aiInput),
    ).toThrow();
    expect(() =>
      validateGeneratedPlan({ ...output, translations: [] }, aiInput),
    ).toThrow();
    const changed = structuredClone(output);
    const token = changed.translations.find((t) =>
      t.source.includes("[300 g]"),
    )!;
    token.vi = token.vi.replace("[300 g]", "[999 g]");
    expect(() => validateGeneratedPlan(changed, aiInput)).toThrow();
  });
  it("converts paired bilingual fields into the saved plan and rejects missing or changed translations", () => {
    expect(validateGeneratedPlan(aiBilingualOutput(), aiInput)).toEqual(
      validateGeneratedPlan(aiOutput(), aiInput),
    );
    const incomplete = aiBilingualOutput();
    delete incomplete.meals["sat-breakfast"];
    expect(() => validateGeneratedPlan(incomplete, aiInput)).toThrow(
      GenerationError,
    );
    const missing = aiBilingualOutput();
    Object.assign(missing.meals["sat-breakfast"].main, { vi: undefined });
    expect(() => validateGeneratedPlan(missing, aiInput)).toThrow(
      GenerationError,
    );
    const changed = aiBilingualOutput();
    changed.meals["sat-breakfast"].prep[0].text.vi += " 999";
    expect(() => validateGeneratedPlan(changed, aiInput)).toThrow(
      GenerationError,
    );
  });
  it("assigns canonical slots to constrained bilingual arrays and rejects a missing slot", () => {
    const input = { ...aiInput, days: [...DAYS], mealTypes: [...MEAL_TYPES] };
    const output = aiBilingualOutput(input);
    const array = { ...output, meals: Object.values(output.meals) };
    const plan = validateGeneratedPlan(array, input);
    expect(plan).toEqual(validateGeneratedPlan(output, input));
    expect(plan.meals.at(-1)?.id).toBe("sun-dinner");
    array.meals.pop();
    expect(() => validateGeneratedPlan(array, input)).toThrow("invalid_output");
  });
  it("returns a Workflow-serializable translation map without invoking prototype setters", () => {
    const output = aiOutput();
    output.translations.push({ source: "__proto__", vi: "A safe translation" });
    const plan = validateGeneratedPlan(output, aiInput);
    expect(Object.getPrototypeOf(plan.translations!.vi)).toBe(Object.prototype);
    expect(Object.hasOwn(plan.translations!.vi, "__proto__")).toBe(true);
    expect(plan.translations!.vi["__proto__"]).toBe("A safe translation");
  });
  it("rejects missing side ingredients, placeholder instructions and amounts that cannot scale", () => {
    const missingSide = aiBilingualOutput();
    const meal = missingSide.meals["sat-breakfast"];
    meal.side = { en: "Toast", vi: "Bánh mì nướng" };
    meal.ingredients = [
      {
        ...meal.ingredients[0],
        name: { en: "Eggs", vi: "Trứng" },
        qty: 2,
        unit: "each",
      },
    ];
    meal.prep = meal.prep.map(({ text, minutes }) => ({ text, minutes }));
    expect(() => validateGeneratedPlan(missingSide, aiInput)).toThrow(
      "incomplete_recipe",
    );
    const terse = aiBilingualOutput();
    terse.meals["sat-breakfast"].steps = [
      { text: { en: "Boil eggs.", vi: "Luộc trứng." }, minutes: 10 },
    ];
    expect(() => validateGeneratedPlan(terse, aiInput)).toThrow(
      "incomplete_recipe",
    );
    try {
      validateGeneratedPlan(terse, aiInput);
    } catch (error) {
      expect(error).toMatchObject({
        diagnostic: {
          reason: "instruction_detail",
          slot: "sat-breakfast",
          stepCount: 1,
          instructionCharacters: "Boil eggs.".length,
        },
      });
    }
    const unscaled = aiBilingualOutput();
    unscaled.meals["sat-breakfast"].steps[0].text = {
      en: "Add 300 g pork to the pan over medium heat.",
      vi: "Cho 300 g thịt heo vào chảo trên lửa vừa.",
    };
    expect(() => validateGeneratedPlan(unscaled, aiInput)).toThrow(
      "incomplete_recipe",
    );
  });
  it("accepts a simple cold dish without forcing extra ingredients or heating steps", () => {
    const text = (en: string, vi: string) => ({ en, vi });
    const output = {
      name: text("Cold breakfast", "Bữa sáng nguội"),
      meals: {
        "sat-breakfast": {
          equipment: [],
          main: text("Bananas", "Chuối"),
          side: text("None", "Không có"),
          minutes: 1,
          storage: text("Eat fresh.", "Ăn ngay khi còn tươi."),
          thaw: text("No thawing needed.", "Không cần rã đông."),
          ingredients: [
            {
              name: text("Bananas", "Chuối"),
              qty: 3,
              unit: "each",
              category: text("Produce", "Rau củ quả"),
            },
          ],
          prep: [
            { text: text("Peel the bananas.", "Bóc vỏ chuối."), minutes: 0 },
          ],
          steps: [
            { text: text("Serve immediately.", "Dùng ngay."), minutes: 0 },
          ],
        },
      },
    };
    expect(
      validateGeneratedPlan(output, {
        ...aiInput,
        equipment: ["No heating appliance"],
      }).meals,
    ).toHaveLength(1);
  });
  it("rejects declared and hidden unavailable appliances and restricted ingredients", () => {
    const output = aiOutput();
    output.meals[0].equipment = ["Oven"];
    expect(() => validateGeneratedPlan(output, aiInput)).toThrow();
    const hidden = aiOutput();
    hidden.meals[0].steps[0].text = "Cook in the oven for [10 each].";
    hidden.translations.push({
      source: hidden.meals[0].steps[0].text,
      vi: hidden.meals[0].steps[0].text,
    });
    expect(() => validateGeneratedPlan(hidden, aiInput)).toThrow(
      GenerationError,
    );
    expect(() =>
      validateGeneratedPlan(aiOutput(), { ...aiInput, avoid: "pork" }),
    ).toThrow(GenerationError);
  });
  it("bounds generated ingredient and instruction arrays independently of the provider schema", () => {
    for (const [field, count] of [
      ["ingredients", 31],
      ["prep", 11],
      ["steps", 16],
    ] as const) {
      const output = aiOutput();
      const items = output.meals[0][field];
      Object.assign(output.meals[0], {
        [field]: Array.from({ length: count }, () => structuredClone(items[0])),
      });
      expect(() => validateGeneratedPlan(output, aiInput)).toThrow(
        GenerationError,
      );
    }
  });
  it("applies only on acceptance, archives old state, preserves prepared food and supports backup hydration", () => {
    const before = freshState(original as Plan);
    before.weekStart = "2026-10-26";
    before.progress.prep["mon-lunch:0"] = true;
    const snapshot = structuredClone(before);
    const plan = aiPlan();
    const next = applyGeneratedMenu(before, plan, aiInput.weekStart);
    expect(before).toEqual(snapshot);
    expect(next.plan.meals).toHaveLength(1);
    expect(next.weekArchive?.[before.weekStart].plan).toEqual(before.plan);
    expect(next.savedFood?.some((f) => f.meal.id === "mon-lunch")).toBe(true);
    expect(
      hydrateState(JSON.parse(JSON.stringify(next)), original as Plan).plan,
    ).toEqual(next.plan);
    expect(aggregate(next.plan, next.servings).length).toBeGreaterThan(0);
    expect(() =>
      applyGeneratedMenu(
        {
          ...before,
          timer: { mealId: "mon-lunch", step: 0, end: Date.now() + 1000 },
        },
        plan,
        aiInput.weekStart,
      ),
    ).toThrow();
  });
  it("uses saved Vietnamese recipe translations without requesting machine translation", () => {
    const plan = aiPlan();
    const translate = createTranslator("vi", false, plan.translations!.vi);
    expect(translate.content(plan.meals[0].main)).toBe(
      plan.translations!.vi[plan.meals[0].main],
    );
    expect(translate.content("My edited recipe")).toBe("My edited recipe");
  });
});
describe("Gemini API boundary", () => {
  it("assembles a complete week from bounded meal-time requests and stops on a failed batch", async () => {
    const input = { ...aiInput, days: [...DAYS], mealTypes: [...MEAL_TYPES] };
    const requests: (typeof input)[] = [];
    const fetcher = vi.fn().mockImplementation(async (_url, init) => {
      const batch = JSON.parse(JSON.parse(init.body).input).requirements;
      requests.push(batch);
      expect(batch.mealTypes).toHaveLength(1);
      expect(
        JSON.parse(init.body).response_format.schema.properties.meals.minItems,
      ).toBe(7);
      return Response.json({
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [
              { type: "text", text: JSON.stringify(aiBilingualOutput(batch)) },
            ],
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const plan = await generateMenu(input, DEFAULT_MASTER_PROMPT, [], {
      apiKey: "test-key",
    });
    expect(requests.map((batch) => batch.mealTypes[0])).toEqual(MEAL_TYPES);
    expect(plan.meals).toHaveLength(21);
    expect(plan.meals.slice(0, 3).map((meal) => meal.id)).toEqual([
      "mon-breakfast",
      "mon-lunch",
      "mon-dinner",
    ]);
    expect(validatePlan(plan)).toEqual([]);
    fetcher
      .mockClear()
      .mockResolvedValueOnce(
        Response.json({
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    aiBilingualOutput({ ...input, mealTypes: ["Breakfast"] }),
                  ),
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    await expect(
      generateMenu(input, DEFAULT_MASTER_PROMPT, [], { apiKey: "test-key" }),
    ).rejects.toMatchObject({ code: "quota" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("sends master prompt, equipment and form data through the fixed server-side model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-key");
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        status: "completed",
        steps: [
          {
            type: "model_thought",
            content: [{ type: "text", text: "Not the recipe JSON" }],
          },
          {
            type: "model_output",
            content: [
              { type: "text", text: JSON.stringify(aiBilingualOutput()) },
            ],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const plan = await generateMenu(aiInput, DEFAULT_MASTER_PROMPT, [
      "Previous meal",
    ]);
    expect(plan.meals[0].type).toBe("Breakfast");
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
    );
    expect(init.headers["x-goog-api-key"]).toBe("test-only-key");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe("gemini-3.5-flash-lite");
    expect(sent.store).toBe(false);
    const requirements = JSON.parse(sent.input);
    expect(requirements.requirements.equipment).toEqual(["Gas stove"]);
    expect(requirements.masterPrompt).toBe(DEFAULT_MASTER_PROMPT);
    expect(requirements.recentMealsToAvoid).toEqual(["Previous meal"]);
    expect(requirements.referenceServings).toBe(original.servings);
    expect(requirements.referenceIngredientNames).toContain("Garlic");
    expect(requirements.referenceRecipe.main.en).toBe(original.meals[0].main);
    expect(requirements.referenceRecipe.ingredients[0].qty).toBe(
      original.meals[0].ingredients[0].qty,
    );
    expect(requirements.referenceRecipe.steps[0].text.en).toBe(
      original.meals[0].steps[0].text,
    );
    expect(sent.response_format.mime_type).toBe("application/json");
    const mealSchema = requirements.responseSchema.properties.meals;
    expect(mealSchema.type).toBe("array");
    expect(mealSchema.minItems).toBe(1);
    expect(mealSchema.maxItems).toBe(1);
    expect(
      sent.response_format.schema.properties.meals.items.properties.main
        .required,
    ).toEqual(["en", "vi"]);
    expect(sent.response_format.schema.properties.meals.minItems).toBe(1);
    expect(sent.response_format.schema.properties.meals.maxItems).toBe(1);
    expect(
      JSON.stringify(sent.response_format.schema.properties.meals.items),
    ).not.toMatch(/"(?:minItems|maxItems|minimum|maximum|enum)":/);
    const recipeSchema = mealSchema.items;
    expect(plan.meals[0].id).toBe("sat-breakfast");
    expect(recipeSchema.properties.minutes.maximum).toBe(aiInput.maxMinutes);
    expect(recipeSchema.properties.equipment.items.enum).toEqual(
      aiInput.equipment,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not retry quota errors or accept incomplete output", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-key");
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({}, { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      generateMenu(aiInput, DEFAULT_MASTER_PROMPT, []),
    ).rejects.toMatchObject({ code: "quota" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(
      Response.json({
        status: "incomplete",
        steps: [],
      }),
    );
    await expect(
      generateMenu(aiInput, DEFAULT_MASTER_PROMPT, []),
    ).rejects.toMatchObject({ code: "invalid_output" });
  });
  it("reports temporary provider overload without retrying or exposing its message", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { status: "UNAVAILABLE", message: "Provider details" } },
          { status: 503 },
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    const error = await generateMenu(aiInput, DEFAULT_MASTER_PROMPT, [], {
      apiKey: "test-key",
    }).catch((error) => error);
    expect(error).toMatchObject({
      code: "provider_busy",
      diagnostic: {
        httpStatus: 503,
        status: "UNAVAILABLE",
        reason: "availability",
      },
    });
    expect(JSON.stringify(error)).not.toContain("Provider details");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("retains only safe diagnostic categories from provider errors", async () => {
    const key = "test-only-private-key";
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: {
            status: "INVALID_ARGUMENT",
            message: `API key not valid: ${key}`,
          },
        },
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const error = await generateMenu(aiInput, DEFAULT_MASTER_PROMPT, [], {
      apiKey: key,
    }).catch((error) => error);
    expect(error).toMatchObject({
      code: "provider_access",
      diagnostic: {
        httpStatus: 400,
        status: "INVALID_ARGUMENT",
        reason: "api_key",
      },
    });
    expect(JSON.stringify(error)).not.toContain(key);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(
      Response.json(
        {
          error: {
            status: "NOT_FOUND",
            message: "Model is not found for this project.",
          },
        },
        { status: 404 },
      ),
    );
    await expect(
      generateMenu(aiInput, DEFAULT_MASTER_PROMPT, [], { apiKey: key }),
    ).rejects.toMatchObject({
      diagnostic: { httpStatus: 404, status: "NOT_FOUND", reason: "model" },
    });
  });
  it("redacts keys from explicitly enabled administration diagnostics", async () => {
    const key = "test-only-private-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              status: "INVALID_ARGUMENT",
              message: `API key not valid: ${key}`,
            },
          },
          { status: 400 },
        ),
      ),
    );
    const onProviderFailure = vi.fn().mockResolvedValue(undefined);
    await generateMenu(aiInput, DEFAULT_MASTER_PROMPT, [], {
      apiKey: key,
      onProviderFailure,
    }).catch(() => undefined);
    expect(onProviderFailure).toHaveBeenCalledWith({
      httpStatus: 400,
      status: "INVALID_ARGUMENT",
      message: "API key not valid: [redacted]",
    });
  });
});
