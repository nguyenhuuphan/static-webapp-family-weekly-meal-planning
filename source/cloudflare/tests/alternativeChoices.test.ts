import { describe, expect, it } from "vitest";
import { validateChoices, choiceRecipeSchema } from "../alternativeChoices";
import { cloudflareSchema } from "../ai";
import { alternativeInput } from "../../src/ai/alternatives";
import { aiInput } from "../../tests/ai-fixtures";
const choices = [
  "Ginger chicken",
  "Tomato fish",
  "Egg fried rice",
  "Beef noodles",
  "Vegetable soup",
].map((en, index) => ({ en, vi: `Món khác ${index}` }));
describe("distinct alternative recipe contracts", () => {
  it("binds each complete recipe to its own unique English and Vietnamese name", () => {
    const input = alternativeInput(aiInput),
      schema = choiceRecipeSchema(
        cloudflareSchema(input),
        input,
        validateChoices({ choices }, []),
      );
    const recipes = Object.values(schema.properties.meals.properties);
    expect(recipes).toHaveLength(5);
    recipes.forEach((recipe, index) => {
      expect(recipe.properties.main.properties.en.enum).toEqual([
        choices[index].en,
      ]);
      expect(recipe.properties.main.properties.vi.enum).toEqual([
        choices[index].vi,
      ]);
      expect(recipe.properties.steps.minItems).toBe(4);
      expect(recipe.properties.equipment.items).toMatchObject({
        enum: aiInput.equipment,
      });
    });
  });
  it("rejects repeated choices and names already in the planned week", () => {
    expect(() =>
      validateChoices({ choices: [...choices.slice(0, 4), choices[0]] }, []),
    ).toThrow();
    expect(() =>
      validateChoices({ choices }, [{ main: choices[0].en }] as never),
    ).toThrow();
    expect(() =>
      validateChoices({ choices: choices.slice(0, 4) }, []),
    ).toThrow();
  });
});
