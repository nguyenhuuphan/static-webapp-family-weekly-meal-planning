import { describe, expect, it } from "vitest";
import {
  normalizeRecipeTranslations,
  canonicalQuantities,
  translationRepairRequest,
  invalidRecipeTranslations,
} from "../src/server/recipeTranslations";
import { validateGeneratedPlan } from "../src/server/gemini";
import { aiBilingualOutput, aiInput } from "./ai-fixtures";
describe("recipe translation quantity protection", () => {
  it("accepts notation-only differences without changing amounts or scaling", () => {
    const raw = aiBilingualOutput();
    const recipe = Object.values(raw.meals)[0];
    recipe.prep[0].text.vi = recipe.prep[0].text.vi
      .replace("[300 g]", "［ 300gram ］")
      .replace("[2 tsp]", "[2 muỗng cà phê]")
      .replace("[0.125 tsp]", "[0,125 thìa cà phê]");
    const plan = validateGeneratedPlan(raw, aiInput);
    const text = plan.meals[0].prep[0].text;
    expect(plan.translations!.vi[text]).toContain("[300 g]");
    expect(plan.translations!.vi[text]).toContain("[0.125 tsp]");
    expect(recipe.prep[0].text.vi).toContain("［ 300gram ］");
  });
  it("canonicalizes decimal notation without rounding numeric values", () => {
    expect(canonicalQuantities("[9007199254740993 g]")).toBe(
      "[9007199254740993 g]",
    );
    expect(canonicalQuantities("[000.12500 tsp]")).toBe("[0.125 tsp]");
  });
  it("normalizes egg counts without dropping the ingredient or changing the count", () => {
    expect(canonicalQuantities("Crack [2 eggs] into a bowl.")).toBe(
      "Crack [2 each] eggs into a bowl.",
    );
    expect(canonicalQuantities("Đập [2 eggs] vào bát.", true)).toBe(
      "Đập [2 each] trứng vào bát.",
    );
    expect(canonicalQuantities("Crack [2 eggs] eggs into a bowl.")).toBe(
      "Crack [2 each] eggs into a bowl.",
    );
  });
  it("localizes known culinary terms while preserving all ingredient quantities", () => {
    const raw = {
      en: "Add [20 g] lemongrass.",
      vi: "Thêm [20 g] cây lemongrass.",
    };
    expect(normalizeRecipeTranslations(raw)).toEqual({
      en: raw.en,
      vi: "Thêm [20 g] sả.",
    });
  });
  it("continues to reject changed amounts and missing translation data", () => {
    const raw = aiBilingualOutput();
    Object.values(raw.meals)[0].prep[0].text.vi = Object.values(
      raw.meals,
    )[0].prep[0].text.vi.replace("[300 g]", "[999g]");
    expect(() => validateGeneratedPlan(raw, aiInput)).toThrow();
    expect(
      invalidRecipeTranslations(normalizeRecipeTranslations(raw)),
    ).toHaveLength(1);
  });
  it("repairs only invalid fields with immutable placeholders for every quantity, time and temperature", () => {
    const raw = {
      good: { en: "Rice", vi: "Cơm" },
      bad: {
        en: "Add [300 g] fish and [0.5 tsp] salt; cook for 5 minutes at 180°C.",
        vi: "Incorrect 999",
      },
    };
    const repair = translationRepairRequest(raw)!;
    const request = JSON.parse(repair.input);
    expect(request.translations).toHaveLength(1);
    expect(request.translations[0].en).not.toMatch(/\d/);
    const fixed = repair.apply({
      translations: [
        {
          id: 0,
          vi: "Cho __KEEP_A__ cá và __KEEP_B__ muối; nấu __KEEP_C__ phút ở __KEEP_D__°C.",
        },
      ],
    }) as typeof raw;
    expect(fixed.good.vi).toBe("Cơm");
    expect(fixed.bad.en).toBe(raw.bad.en);
    expect(fixed.bad.vi).toBe(
      "Cho [300 g] cá và [0.5 tsp] muối; nấu 5 phút ở 180°C.",
    );
    expect(invalidRecipeTranslations(fixed)).toHaveLength(0);
  });
  it("rejects missing, duplicated or reordered markers, new digits and duplicate field IDs", () => {
    const source = { en: "Heat [300 g] fish for 5 minutes.", vi: "Wrong 999" };
    for (const vi of [
      "Cho __KEEP_A__ cá.",
      "__KEEP_A__ __KEEP_A__ __KEEP_B__",
      "__KEEP_B__ __KEEP_A__",
      "__KEEP_A__ __KEEP_B__ 999",
    ]) {
      const repair = translationRepairRequest(structuredClone(source))!;
      expect(() => repair.apply({ translations: [{ id: 0, vi }] })).toThrow();
    }
    expect(
      translationRepairRequest({ en: "__KEEP_A__ [300 g]", vi: "wrong" }),
    ).toBeNull();
    expect(
      translationRepairRequest(
        Array.from({ length: 25 }, () => ({ ...source })),
      ),
    ).toBeNull();
  });
});
