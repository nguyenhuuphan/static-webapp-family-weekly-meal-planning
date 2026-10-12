import FoodStorageEditor from "src/modules/shared-main/components/FoodStorageEditor";
import { useState } from "react";
import type { SavedFood } from "src/types";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useI18n, useText } from "src/i18n";
import { reconcileShopping } from "src/helpers/shopping";
import { assignFood } from "src/helpers/scheduling";
import { currentMealLabel } from "src/helpers/mealLabels";
import { mealPortions } from "src/utils";
import { Button } from "src/modules/shared-main/components";

function FoodCard({ food }: { food: SavedFood }) {
  const { s, update, setToast } = useMealPlanner();
  const { content: ct, instruction } = useI18n();
  const text = useText();
  const [target, setTarget] = useState("");
  const [date, setDate] = useState(food.date || "");
  const [type, setType] = useState<"Lunch" | "Dinner">(food.type || "Dinner");
  const [storage, setStorage] = useState(food.storageNote);
  const [reviewed, setReviewed] = useState(false);
  const change = (patch: Partial<SavedFood>) =>
    update((s) =>
      reconcileShopping({
        ...s,
        savedFood: s.savedFood?.map((f) =>
          f.id === food.id ? { ...f, ...patch } : f,
        ),
      }),
    );
  const destination = s.plan.meals.find((m) => m.id === target);
  const label = food.date
    ? `${food.date} · ${ct(food.type || "Dinner")}`
    : text("Chưa có lịch ăn", "Not scheduled");
  const tasks = Object.entries(food.preparedTasks);
  const factor = food.servings / food.baseServings;
  return (
    <article className="saved-food-card">
      <h3>
        {ct(food.meal.main)} · {food.servings} {text("phần", "portions")}
      </h3>
      <p>
        {food.kind === "prepared"
          ? text(
              "Đồ đã chuẩn bị — có thể mới sơ chế một phần nguyên liệu.",
              "Prepared food — some ingredients may still need preparation.",
            )
          : text(
              "Công thức chưa có lịch — không phải thực phẩm đã sơ chế.",
              "Unscheduled recipe — not prepared food.",
            )}
      </p>
      {food.status === "scheduled" && (
        <p role="status">
          {text("Đã lên lịch", "Scheduled")}: {food.date} ·{" "}
          {ct(food.type || "Dinner")}
        </p>
      )}
      {tasks.length > 0 && (
        <ul>
          {tasks.map(([index, task]) => (
            <li key={index}>
              {instruction(
                food.meal.prep[Number(index)]?.text || "",
                task.servings / food.baseServings,
              )}{" "}
              · {task.servings} {text("phần", "portions")} ·{" "}
              {text("Sơ chế", "Prepared")}:{" "}
              {task.at
                ? new Date(task.at).toLocaleString()
                : text("Chưa ghi nhận ngày", "Date not recorded")}
            </li>
          ))}
        </ul>
      )}
      <p className="notice warning">
        {text(
          "Hướng dẫn dưới đây theo công thức gốc; không xác nhận thực phẩm còn dùng được ở ngày mới.",
          "Guidance below belongs to the original recipe; it does not confirm food is usable on the new date.",
        )}
      </p>
      <p className="caption">
        {ct(food.meal.storage)} {ct(food.meal.thaw)}
      </p>
      {food.kind === "prepared" && (
        <FoodStorageEditor
          value={food.storage}
          onChange={(storage) => change({ storage })}
        />
      )}
      {food.kind === "prepared" && (
        <>
          <label>
            {text("Bảo quản thực tế / ghi chú", "Actual storage / notes")}
            <input
              value={storage}
              onChange={(e) => setStorage(e.target.value)}
              onBlur={() => change({ storageNote: storage })}
            />
          </label>
          <label className="readiness">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {text(
              "Tôi đã kiểm tra bảo quản và rã đông. Đổi lịch không làm mới ngày sơ chế.",
              "I reviewed storage and thawing. Rescheduling does not reset preparation dates.",
            )}
          </label>
        </>
      )}
      <label>
        {text("Thay một bữa chưa chuẩn bị", "Replace an unprepared meal")}
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">{text("Chọn bữa", "Choose meal")}</option>
          {s.plan.meals
            .filter(
              (m) =>
                !s.progress.done[m.id] &&
                mealPortions(s, m) > 0 &&
                mealPortions(s, m) <= food.servings &&
                !m.prep.some((_, i) => s.progress.prep[`${m.id}:${i}`]) &&
                !s.progress.ready[m.id] &&
                s.timer?.mealId !== m.id &&
                !s.timers?.some((t) => t.mealId === m.id),
            )
            .map((m) => (
              <option key={m.id} value={m.id}>
                {ct(m.day)} · {ct(m.type)} · {ct(m.main)} ({mealPortions(s, m)})
              </option>
            ))}
        </select>
      </label>
      {destination && (
        <p>
          {ct(food.meal.main)} → {ct(destination.day)} · {ct(destination.type)}.{" "}
          {text(
            "Món bị thay được giữ ở công thức chưa có lịch; nguyên liệu đã mua vẫn được giữ.",
            "The replaced recipe is kept unscheduled; purchased ingredients are retained.",
          )}
        </p>
      )}
      <Button
        disabled={!destination || (food.kind === "prepared" && !reviewed)}
        onClick={() => {
          try {
            update((s) => assignFood(s, food.id, target));
          } catch (e) {
            setToast((e as Error).message);
          }
        }}
      >
        {text("Xác nhận thay bữa", "Confirm replacement")}
      </Button>
      <details>
        <summary>
          {text(
            "Chọn ngày khác / cuối tuần / tuần sau",
            "Choose another date / weekend / next week",
          )}
        </summary>
        <p>
          {text(
            "Đây là bữa bổ sung, không thay món đang có trong lịch. Chọn “Thay một bữa” nếu muốn thay món.",
            "This adds a separate meal without replacing the weekly menu. Choose replacement above to replace a planned meal.",
          )}
        </p>
        <label>
          {text("Ngày ăn", "Meal date")}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          {text("Buổi", "Meal time")}
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="Lunch">{ct("Lunch")}</option>
            <option value="Dinner">{ct("Dinner")}</option>
          </select>
        </label>
        <Button
          disabled={
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            (food.kind === "prepared" && !reviewed)
          }
          onClick={() =>
            change({ date, type, storageNote: storage, status: "scheduled" })
          }
        >
          {text("Lưu lịch ăn", "Save meal date")}
        </Button>
      </details>
      <details>
        <summary>
          {text("Xem nguyên liệu và hướng dẫn", "Ingredients and instructions")}
        </summary>
        <ul>
          {food.meal.ingredients.map((i, index) => (
            <li key={index}>
              {ct(i.name)} · {Math.round(i.qty * factor * 100) / 100} {i.unit}
            </li>
          ))}
        </ul>
        <h4>
          {text("Kiểm tra phần chưa sơ chế", "Review remaining preparation")}
        </h4>
        <ul>
          {food.meal.prep.map((p, index) => (
            <li key={index}>
              {currentMealLabel(instruction(p.text, factor), label)}{" "}
              {food.preparedTasks[index]?.servings >= food.servings
                ? text("(Đã sơ chế)", "(Prepared)")
                : text(
                    "(Cần kiểm tra / làm thêm)",
                    "(Review / prepare remaining portions)",
                  )}
            </li>
          ))}
        </ul>
        <h4>{text("Nấu ăn", "Cooking")}</h4>
        <ol>
          {food.meal.steps.map((step, i) => (
            <li key={i}>{instruction(step.text, factor)}</li>
          ))}
        </ol>
      </details>
      <div className="actions">
        {food.status === "scheduled" && (
          <Button
            onClick={() =>
              change({ status: "pending", date: undefined, type: undefined })
            }
          >
            {text("Bỏ lịch, giữ phần đồ ăn", "Unschedule and keep food")}
          </Button>
        )}
        <Button
          onClick={() => {
            if (
              confirm(
                text(
                  "Ghi nhận đã dùng hết số phần này?",
                  "Record all these portions as used?",
                ),
              )
            )
              change({ status: "used" });
          }}
        >
          {text(
            food.kind === "prepared"
              ? "Đã dùng / ăn theo cách khác"
              : "Đã dùng công thức",
            food.kind === "prepared" ? "Used / eaten elsewhere" : "Recipe used",
          )}
        </Button>
        <Button
          onClick={() => {
            if (
              confirm(
                text(
                  "Ghi nhận đã bỏ? Thao tác này sẽ được lưu trong lịch sử.",
                  "Record as discarded? This remains in history.",
                ),
              )
            )
              change({ status: "discarded" });
          }}
        >
          {text(
            food.kind === "prepared" ? "Đã bỏ" : "Bỏ công thức",
            food.kind === "prepared" ? "Discarded" : "Remove recipe",
          )}
        </Button>
      </div>
    </article>
  );
}

export default function SavedFoodPanel() {
  const { s } = useMealPlanner();
  const text = useText();
  const { content: ct } = useI18n();
  const active = (s.savedFood || []).filter((f) =>
    ["pending", "scheduled"].includes(f.status),
  );
  const history = (s.savedFood || []).filter(
    (f) => !["pending", "scheduled"].includes(f.status),
  );
  if (!s.savedFood?.length) return null;
  return (
    <section
      className="panel saved-food"
      aria-label={text("Đồ cần sắp xếp", "Food to arrange")}
    >
      <h2>
        {text(
          "Đồ đã chuẩn bị & công thức chưa có lịch",
          "Prepared food & unscheduled recipes",
        )}
      </h2>
      <p>
        {text(
          "Được giữ qua các tuần. Không tự dời lịch hoặc tự kéo dài thời gian bảo quản.",
          "Kept across weeks. Dates and storage durations are never extended automatically.",
        )}
      </p>
      {active
        .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
        .map((food) => (
          <FoodCard key={food.id} food={food} />
        ))}
      {history.length > 0 && (
        <details>
          <summary>
            {text("Lịch sử xử lý", "Handling history")} ({history.length})
          </summary>
          <ul>
            {history.map((f) => (
              <li key={f.id}>
                {ct(f.meal.main)} ·{" "}
                {text(
                  f.status === "assigned"
                    ? "Đã phân bổ vào bữa"
                    : f.status === "used"
                      ? "Đã dùng"
                      : "Đã bỏ",
                  f.status === "assigned"
                    ? "Assigned to meal"
                    : f.status === "used"
                      ? "Used"
                      : "Discarded",
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
