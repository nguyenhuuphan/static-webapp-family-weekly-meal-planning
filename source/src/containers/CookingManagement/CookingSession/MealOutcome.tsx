import { useEffect, useState } from "react";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useText } from "src/i18n";
import { finishCooking } from "src/helpers/cooking";
import { mealPortions } from "src/domain";
import { Button } from "src/modules/shared-main/components";
export default function MealOutcome() {
  const { s, meal, ready, update } = useMealPlanner();
  const text = useText();
  const batch = s.cookingBatches?.[meal.id]?.servings ?? mealPortions(s, meal);
  const [cooked, setCooked] = useState(String(batch));
  const [eaten, setEaten] = useState(String(batch));
  useEffect(() => {
    setCooked(String(batch));
    setEaten(String(batch));
  }, [meal.id, batch]);
  const result = s.mealResults?.[meal.id];
  if (s.progress.done[meal.id])
    return (
      <p role="status">
        {result
          ? `${text("Đã nấu", "Cooked")}: ${result.cooked} · ${text("Đã ăn", "Eaten")}: ${result.eaten} · ${text("Còn lại", "Remaining")}: ${result.remaining}`
          : text("Bữa ăn đã hoàn tất", "Meal complete")}
      </p>
    );
  const valid =
    cooked !== "" &&
    eaten !== "" &&
    Number.isInteger(+cooked) &&
    +cooked > 0 &&
    +cooked <= batch &&
    Number.isInteger(+eaten) &&
    +eaten >= 0 &&
    +eaten <= +cooked;
  return (
    <div className="meal-outcome">
      <h3>{text("Kết quả bữa ăn", "Meal outcome")}</h3>
      <label>
        {text("Đã nấu", "Cooked")}
        <input
          type="number"
          min={1}
          max={batch}
          step={1}
          value={cooked}
          onChange={(e) => setCooked(e.target.value)}
        />
      </label>
      <label>
        {text("Đã ăn", "Eaten")}
        <input
          type="number"
          min={0}
          max={+cooked}
          step={1}
          value={eaten}
          onChange={(e) => setEaten(e.target.value)}
        />
      </label>
      <p>
        {text("Còn lại", "Remaining")}: {valid ? +cooked - +eaten : "—"}{" "}
        {text("phần", "portions")}
      </p>
      {valid && +cooked > +eaten && (
        <p>
          {text(
            "Phần dư được giữ riêng là đồ đã nấu. Ghi nơi bảo quản ở Đồ cần sắp xếp.",
            "Leftovers are saved separately as cooked food. Record storage under Food to arrange.",
          )}
        </p>
      )}
      <Button
        primary
        disabled={!ready || !valid}
        onClick={() =>
          update((s) => finishCooking(s, meal.id, +cooked, +eaten))
        }
      >
        {text("Hoàn tất bữa ăn", "Finish meal")}
      </Button>
    </div>
  );
}
