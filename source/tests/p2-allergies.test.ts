import { expect, it } from "vitest";
import { ingredientWarnings } from "../src/helpers/allergies";
import type { Ingredient } from "../src/types";
it("warns about seasoning ingredients and custom label tags for each person", () => {
  const ingredients: Ingredient[] = [
    { name: "Soy sauce", qty: 1, unit: "tsp", category: "Pantry" },
    {
      name: "Custom seasoning",
      qty: 1,
      unit: "g",
      category: "Pantry",
      allergenTags: ["peanut"],
    },
  ];
  const result = ingredientWarnings(ingredients, [
    { id: "a", name: "An", avoid: ["đậu nành"] },
    { id: "b", name: "Bình", avoid: ["peanut"] },
  ]);
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({ person: "An", ingredient: "Soy sauce" });
  expect(
    ingredientWarnings(
      [{ ...ingredients[0], name: "Rice", allergenTags: [] }],
      [{ id: "a", name: "An", avoid: ["soy"] }],
    ),
  ).toEqual([]);
});
