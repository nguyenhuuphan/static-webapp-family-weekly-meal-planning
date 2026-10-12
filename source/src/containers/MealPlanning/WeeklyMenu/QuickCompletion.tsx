import { useState } from "react";
import type { Meal } from "src/types";
import { mealPortions } from "src/domain";
import { completeMealQuickly } from "src/helpers/cooking";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useText } from "src/i18n";
import { Button } from "src/modules/shared-main/components";

export default function QuickCompletion({ meal }: { meal: Meal }) {
  const { s, update } = useMealPlanner(),
    text = useText();
  const count = s.cookingBatches?.[meal.id]?.servings ?? mealPortions(s, meal);
  const [open, setOpen] = useState(false),
    [cooked, setCooked] = useState(count),
    [eaten, setEaten] = useState(count);
  if (s.progress.done[meal.id] || !mealPortions(s, meal)) return null;
  if (!open)
    return (
      <Button
        onClick={() => {
          setCooked(count);
          setEaten(count);
          setOpen(true);
        }}
      >
        {text("Hoàn thành bữa ăn", "Complete meal")}
      </Button>
    );
  const valid =
    Number.isInteger(cooked) &&
    cooked >= 1 &&
    cooked <= count &&
    Number.isInteger(eaten) &&
    eaten >= 0 &&
    eaten <= cooked;
  return (
    <section
      aria-label={text("Hoàn thành bữa ăn nhanh", "Quick meal completion")}
      className="notice meal-outcome"
    >
      <p>
        {text(
          "Ghi nhận bữa đã nấu và đã ăn. Nguyên liệu được ghi nhận đã dùng; phần chưa ăn được giữ trong đồ đã nấu.",
          "Record a meal already cooked and eaten. Ingredients are recorded as used; uneaten portions are saved as cooked food.",
        )}
      </p>
      <label>
        {text("Số phần đã nấu", "Portions cooked")}
        <input
          type="number"
          min={1}
          max={count}
          step={1}
          value={cooked}
          onChange={(e) => {
            const value = +e.target.value;
            setCooked(value);
            setEaten((old) => Math.min(old, value));
          }}
        />
      </label>
      <label>
        {text("Số phần đã ăn", "Portions eaten")}
        <input
          type="number"
          min={0}
          max={cooked}
          step={1}
          value={eaten}
          onChange={(e) => setEaten(+e.target.value)}
        />
      </label>
      <div className="actions">
        <Button
          primary
          disabled={!valid}
          onClick={() => {
            if (update((s) => completeMealQuickly(s, meal.id, cooked, eaten)))
              setOpen(false);
          }}
        >
          {text("Xác nhận hoàn thành", "Confirm completion")}
        </Button>
        <Button onClick={() => setOpen(false)}>{text("Hủy", "Cancel")}</Button>
      </div>
    </section>
  );
}
