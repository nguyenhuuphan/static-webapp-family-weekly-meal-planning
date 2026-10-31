import type { MealType } from "src/types";
import FutureMealOptions from "./FutureMealOptions";
import AllergyWarnings from "src/modules/shared-main/components/AllergyWarnings";
import { useState } from "react";
import type { SavedFood } from "src/types";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useText, useI18n } from "src/i18n";
import { eatCookedFood } from "src/helpers/cooking";
import { reconcileShopping } from "src/helpers/shopping";
import FoodStorageEditor from "src/modules/shared-main/components/FoodStorageEditor";
import { Button } from "src/modules/shared-main/components";

export default function CookedFoodCard({ food }: { food: SavedFood }) {
  const { update } = useMealPlanner(),
    text = useText(),
    { content: ct } = useI18n();
  const [date, setDate] = useState(food.date || "");
  const [type, setType] = useState<MealType>(food.type || "Dinner");
  const [eaten, setEaten] = useState("1"),
    [reviewed, setReviewed] = useState(false);
  const change = (patch: Partial<SavedFood>) =>
    update((s) =>
      reconcileShopping({
        ...s,
        savedFood: s.savedFood?.map((f) =>
          f.id === food.id ? { ...f, ...patch } : f,
        ),
      }),
    );
  return (
    <article className="saved-food-card">
      <h3>
        {ct(food.meal.main)} · {food.servings}{" "}
        {text("phần đã nấu", "cooked portions")}
      </h3>
      <p>
        {text("Nấu lúc", "Cooked at")}:{" "}
        {food.cookedAt
          ? new Date(food.cookedAt).toLocaleString()
          : text("Chưa ghi nhận", "Not recorded")}
      </p>
      <p className="notice">
        {text(
          "Làm lạnh trong vòng 2 giờ (1 giờ nếu trên 32°C); chia hộp nông. Đồ chín bảo quản đúng cách ở ≤4°C thường dùng trong 3–4 ngày; hâm tới 74°C, đo bằng nhiệt kế. Đổi ngày ăn không làm mới thời điểm nấu.",
          "Refrigerate within 2 hours (1 hour above 32°C), using shallow containers. Leftovers properly refrigerated at ≤4°C generally keep 3–4 days. Reheat to 74°C, measured with a food thermometer. Rescheduling does not reset cooking time.",
        )}{" "}
        <a
          href="https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety"
          target="_blank"
          rel="noreferrer"
        >
          USDA: Leftovers and Food Safety
        </a>
      </p>
      <AllergyWarnings ingredients={food.meal.ingredients} />
      <FoodStorageEditor
        cookedOnly
        value={food.storage}
        onChange={(storage) => {
          change({ storage });
          setReviewed(false);
        }}
      />
      <label>
        {text("Ghi chú bảo quản thực tế", "Actual storage notes")}
        <input
          value={food.storageNote}
          onChange={(e) => change({ storageNote: e.target.value })}
        />
      </label>
      <label className="readiness">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        {text(
          "Tôi đã kiểm tra thời gian và điều kiện bảo quản thực tế",
          "I reviewed actual storage time and conditions",
        )}
      </label>
      {food.status === "scheduled" && (
        <p role="status">
          {text("Đã lên lịch", "Scheduled")}: {food.date} ·{" "}
          {ct(food.type || "Dinner")}
        </p>
      )}
      <p>
        {text(
          "Thêm phần đồ chín vào lịch 7 ngày. Kiểm tra và bỏ bữa gốc nếu dùng phần này thay bữa đã lên kế hoạch.",
          "Add cooked food to the seven-day calendar. Review and skip the original meal if these portions replace a planned meal.",
        )}
      </p>
      <label>
        {text("Chọn nhanh cuối tuần / tuần sau", "Choose weekend / next week")}
        <select
          value={`date:${date}:${type}`}
          onChange={(e) => {
            const [, date, type] = e.target.value.split(":");
            setDate(date || "");
            setType((type as MealType) || "Dinner");
          }}
        >
          <option value="">{text("Chọn bữa", "Choose meal")}</option>
          <FutureMealOptions />
        </select>
      </label>
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
        disabled={!reviewed || !/^\d{4}-\d{2}-\d{2}$/.test(date)}
        onClick={() => change({ date, type, status: "scheduled" })}
      >
        {text("Lưu lịch ăn", "Save meal date")}
      </Button>
      <label>
        {text("Số phần đã ăn", "Portions eaten")}
        <input
          type="number"
          min={1}
          max={food.servings}
          step={1}
          value={eaten}
          onChange={(e) => setEaten(e.target.value)}
        />
      </label>
      <div className="actions">
        <Button
          disabled={
            !reviewed ||
            !Number.isInteger(+eaten) ||
            +eaten < 1 ||
            +eaten > food.servings
          }
          onClick={() => {
            update((s) => eatCookedFood(s, food.id, +eaten));
            setReviewed(false);
          }}
        >
          {text("Ghi nhận đã ăn", "Record portions eaten")}
        </Button>
        {food.status === "scheduled" && (
          <Button
            onClick={() =>
              change({ date: undefined, type: undefined, status: "pending" })
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
                  "Ghi nhận đã bỏ phần đồ chín này?",
                  "Record these cooked portions as discarded?",
                ),
              )
            )
              change({ status: "discarded" });
          }}
        >
          {text("Đã bỏ", "Discarded")}
        </Button>
      </div>
    </article>
  );
}
