import { useState } from "react";
import type { Meal } from "src/types";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useI18n, useText } from "src/i18n";
import { swapSchedule, changePortions } from "src/helpers/scheduling";
import { mealPortions } from "src/utils";
import { Button } from "src/modules/shared-main/components";

export default function ScheduleControls({ meal }: { meal: Meal }) {
  const { s, update } = useMealPlanner();
  const { content: ct } = useI18n();
  const text = useText();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  if (s.progress.done[meal.id]) return null;
  const other = s.plan.meals.find((m) => m.id === target);
  return (
    <div className="schedule-controls">
      <label>
        {text("Người ăn", "Diners")}
        <select
          aria-label={`${text("Người ăn", "Diners")}: ${ct(meal.day)} · ${ct(meal.type)}`}
          disabled={
            !!s.cookingBatches?.[meal.id] ||
            s.timer?.mealId === meal.id ||
            s.timers?.some((t) => t.mealId === meal.id)
          }
          value={mealPortions(s, meal)}
          onChange={(e) =>
            update((s) => changePortions(s, meal.id, Number(e.target.value)))
          }
        >
          {Array.from({ length: s.servings + 1 }, (_, count) => (
            <option key={count} value={count}>
              {count === 0
                ? text("Không ăn tại nhà", "Not eating at home")
                : `${count} ${text("người ăn", "diners")}`}
            </option>
          ))}
        </select>
      </label>
      {s.cookingBatches?.[meal.id] && (
        <p role="status">
          {text(
            "Mẻ đang nấu giữ nguyên số phần. Ghi số đã ăn và phần dư khi hoàn tất.",
            "Cooking keeps its batch size. Record portions eaten and leftovers when finishing.",
          )}
        </p>
      )}
      <Button aria-expanded={open} onClick={() => setOpen(!open)}>
        {text("Đổi lịch", "Move meal")}
      </Button>
      {open && (
        <div className="schedule-preview">
          <label>
            {text("Hoán đổi với bữa", "Swap with meal")}
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">
                {text("Chọn bữa đích", "Choose destination")}
              </option>
              {s.plan.meals
                .filter((m) => m.id !== meal.id && !s.progress.done[m.id])
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {ct(m.day)} · {ct(m.type)} · {ct(m.main)}
                  </option>
                ))}
            </select>
          </label>
          {other && (
            <p>
              {ct(meal.main)} → {ct(other.day)} · {ct(other.type)}
              <br />
              {ct(other.main)} → {ct(meal.day)} · {ct(meal.type)}
            </p>
          )}
          <p className="caption">
            {text(
              "Giữ tiến độ sơ chế theo món. Kiểm tra lại bảo quản và rã đông sau khi đổi lịch.",
              "Preparation follows each recipe. Review storage and thawing after moving meals.",
            )}
          </p>
          <Button
            disabled={!other}
            onClick={() => {
              update((s) => swapSchedule(s, meal.id, target));
              setOpen(false);
              setTarget("");
            }}
          >
            {text("Xác nhận hoán đổi", "Confirm swap")}
          </Button>
        </div>
      )}
    </div>
  );
}
