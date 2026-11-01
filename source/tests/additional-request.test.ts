import { describe, expect, it } from "vitest";
import {
  compileAdditionalRequest,
  additionalRequestPayload,
  requestViolations,
} from "../src/ai/additionalRequest";
import {
  assertAdditionalRequest,
  generationPayload,
} from "../src/server/gemini";
import { aiInput } from "./ai-fixtures";
import type { Meal, Plan } from "../src/types";
const input = {
  ...aiInput,
  days: ["Monday", "Wednesday", "Friday"] as const,
  mealTypes: ["Lunch", "Dinner"] as const,
  customPrompt: "I need 1 western meal with fried fish and broccoli.",
};
const full = {
  ...input,
  days: [...input.days],
  mealTypes: [...input.mealTypes],
};
function plan(): Plan {
  return {
    schemaVersion: 2,
    name: "Test",
    servings: 2,
    meals: full.days.flatMap((day) =>
      full.mealTypes.map((type) => ({
        id: `${day.slice(0, 3).toLowerCase()}-${type.toLowerCase()}`,
        day,
        type,
        cuisine:
          day === "Monday" && type === "Lunch" ? "European" : "Vietnamese",
        main:
          day === "Monday" && type === "Lunch"
            ? "Fried salmon with broccoli"
            : "Chicken with rice",
        side: "None",
        minutes: 25,
        ingredients: [
          { name: "Salmon fillet", qty: 250, unit: "g", category: "Protein" },
          {
            name: "Broccoli florets",
            qty: 200,
            unit: "g",
            category: "Produce",
          },
        ],
        prep: [{ text: "Prepare ingredients.", minutes: 3 }],
        steps: [
          {
            text: "Pan-fry the salmon fillet in oil until golden and fully cooked.",
            minutes: 10,
          },
        ],
        storage: "Refrigerate.",
        thaw: "Thaw in refrigerator.",
      })),
    ),
  };
}
describe("explicit additional meal requests", () => {
  it("compiles the user's exact example, including frying and real broccoli", () => {
    const contract = compileAdditionalRequest(full);
    expect(contract.conflicts).toEqual([]);
    expect(contract.rules[0]).toMatchObject({
      count: 1,
      countMode: "exact",
      cuisine: "European",
      ingredients: ["fish", "broccoli"],
      cookingMethod: "fried",
      slots: ["mon-lunch"],
    });
    expect(() => assertAdditionalRequest(plan(), full)).not.toThrow();
  });
  it("preserves a named Monday dinner assignment across meal-time batches", () => {
    const requested = {
      ...full,
      customPrompt:
        "I need only 1 western meal have fish and brocolli at dinner time on Monday",
    };
    const contract = compileAdditionalRequest(requested);
    expect(contract.rules[0].slots).toEqual(["mon-dinner"]);
    const lunch = additionalRequestPayload(requested, {
      ...requested,
      mealTypes: ["Lunch"],
    });
    expect(lunch.batchRules).toEqual([]);
    expect(
      lunch.slotRequirements.every((slot) =>
        slot.forbiddenCuisines.includes("European"),
      ),
    ).toBe(true);
    const dinner = additionalRequestPayload(requested, {
      ...requested,
      mealTypes: ["Dinner"],
    });
    expect(dinner.slotRequirements[0].required).toHaveLength(1);
    const options = additionalRequestPayload(requested, requested, true);
    expect(options.batchRules).toEqual([]);
    expect(options.slotRequirements).toEqual([]);
  });
  it("rejects a title-only match, fish sauce, another vegetable, a different cooking method or repeated Western meals", () => {
    for (const mutate of [
      (p: Plan) => {
        p.meals[0].ingredients[0].name = "Fish sauce";
      },
      (p: Plan) => {
        p.meals[0].ingredients[1].name = "Mustard greens";
      },
      (p: Plan) => {
        p.meals[0].main = "Steamed salmon with broccoli";
      },
      (p: Plan) => {
        p.meals[1].cuisine = "European";
      },
      (p: Plan) => {
        p.meals[0].steps[0].text =
          "Steam the salmon. Fry the broccoli in another pan.";
      },
    ]) {
      const next = plan();
      mutate(next);
      expect(() => assertAdditionalRequest(next, full)).toThrow(
        "additional_request_mismatch",
      );
    }
  });
  it("handles Vietnamese and keeps the exact request ahead of master/default preferences", () => {
    const requested = {
      ...full,
      customPrompt:
        "Tôi cần đúng 1 bữa Âu có cá chiên và bông cải xanh vào bữa tối thứ Hai.",
    };
    expect(compileAdditionalRequest(requested).rules[0]).toMatchObject({
      count: 1,
      cuisine: "European",
      cookingMethod: "fried",
      ingredients: ["fish", "broccoli"],
      slots: ["mon-dinner"],
    });
    const payload = generationPayload(
      { ...requested, mealTypes: ["Dinner"] },
      "Always Vietnamese",
      [],
      { requirements: requested, meals: [] },
    );
    expect(payload.additionalRequest.verbatim).toBe(requested.customPrompt);
    expect(payload.additionalRequest.slotRequirements[0].required).toHaveLength(
      1,
    );
  });
  it("finds schedule/diet/allergy conflicts before generation without discarding other free text", () => {
    expect(
      compileAdditionalRequest({
        ...full,
        days: ["Wednesday"],
        customPrompt: "One western meal with fish on Monday at dinner",
      }).conflicts.length,
    ).toBeGreaterThan(0);
    expect(
      compileAdditionalRequest({ ...full, diet: "Vegetarian" }).conflicts
        .length,
    ).toBeGreaterThan(0);
    expect(
      compileAdditionalRequest({ ...full, avoid: "fish" }).conflicts.length,
    ).toBeGreaterThan(0);
    const soft = {
      ...full,
      customPrompt: "Please keep the meals easy for a busy week.",
    };
    expect(additionalRequestPayload(soft, soft).verbatim).toBe(
      soft.customPrompt,
    );
    expect(compileAdditionalRequest(soft).rules).toEqual([]);
  });
  it("applies global exclusions to alternatives, but never duplicates dated requirements there", () => {
    const requested = {
      ...full,
      customPrompt: full.customPrompt + "\nNo peanuts.",
    };
    const options = plan();
    options.meals[0].ingredients.push({
      name: "Peanut oil",
      qty: 1,
      unit: "tbsp",
      category: "Pantry",
    });
    expect(
      requestViolations(options, requested, "alternatives").some(
        (v) => v.reason === "excluded_ingredient",
      ),
    ).toBe(true);
    options.meals[0].ingredients.pop();
    options.meals[0].cuisine = "Vietnamese";
    options.meals[0].main = "Steamed fish";
    expect(requestViolations(options, requested, "alternatives")).toEqual([]);
  });
});
