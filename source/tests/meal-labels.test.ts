import { expect, it } from "vitest";
import { currentMealLabel } from "../src/helpers/mealLabels";

it("updates English and Vietnamese portion labels without changing storage guidance", () => {
  expect(currentMealLabel("Label MON LUNCH — PORK. Refrigerate for 1 day.", "Friday · Dinner")).toBe("Label Friday · Dinner — PORK. Refrigerate for 1 day.");
  expect(currentMealLabel("Ghi nhãn THỨ HAI TRƯA — THỊT HEO.", "Thứ Sáu · Tối")).toBe("Ghi nhãn Thứ Sáu · Tối — THỊT HEO.");
});
