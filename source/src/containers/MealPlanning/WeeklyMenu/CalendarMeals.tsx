import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useI18n, useText } from "src/i18n";
import { calendarFood } from "src/helpers/calendar";

export default function CalendarMeals({
  date,
  type,
}: {
  date: string;
  type: "Lunch" | "Dinner";
}) {
  const { s } = useMealPlanner(),
    { content: ct } = useI18n(),
    text = useText();
  return (
    <div className="calendar-food" aria-label={`${date} · ${ct(type)}`}>
      {calendarFood(s, date, type).map((f) => (
        <article key={f.id} className="scheduled-food">
          <span className="pill">
            {f.status === "used"
              ? text("Đã dùng", "Used")
              : f.kind === "cooked"
                ? text("Đồ đã nấu", "Cooked food")
                : f.kind === "prepared"
                  ? text("Đồ đã chuẩn bị", "Prepared food")
                  : text("Bữa thêm", "Additional meal")}
          </span>
          <h4>
            {ct(f.meal.main)} ·{" "}
            {f.status === "used" && f.kind === "cooked"
              ? f.eatenServings
              : f.servings}{" "}
            {text("phần", "portions")}
          </h4>
          <a
            href={`#food-${f.id}`}
            onClick={() =>
              setTimeout(() => {
                const target = document.getElementById(`food-${f.id}`);
                let details = target?.closest("details");
                while (details) {
                  details.open = true;
                  details = details.parentElement?.closest("details");
                }
                target?.focus();
              }, 0)
            }
          >
            {text("Xem / sắp xếp phần này", "View / arrange this food")}
          </a>
        </article>
      ))}
    </div>
  );
}
