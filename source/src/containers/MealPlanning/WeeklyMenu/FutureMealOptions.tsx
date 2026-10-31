import { MEAL_TYPES } from "src/types";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useI18n, useText } from "src/i18n";
import { CALENDAR_DAYS, calendarDate } from "src/helpers/calendar";

export default function FutureMealOptions() {
  const { s } = useMealPlanner(),
    text = useText(),
    { content: ct } = useI18n();
  return (
    <>
      {[
        [5, 7],
        [7, 14],
      ].map(([from, to]) => (
        <optgroup
          key={from}
          label={
            from === 5
              ? text(
                  "Cuối tuần này · bữa bổ sung",
                  "This weekend · additional meal",
                )
              : text("Tuần sau · bữa bổ sung", "Next week · additional meal")
          }
        >
          {Array.from({ length: to - from }, (_, i) => from + i).flatMap(
            (offset) =>
              (s.plan.schemaVersion === 2
                ? MEAL_TYPES
                : (["Lunch", "Dinner"] as const)
              ).map((type) => (
                <option
                  key={`${offset}-${type}`}
                  value={`date:${calendarDate(s.weekStart, offset)}:${type}`}
                >
                  {ct(CALENDAR_DAYS[offset % 7])} ·{" "}
                  {calendarDate(s.weekStart, offset)} · {ct(type)}
                </option>
              )),
          )}
        </optgroup>
      ))}
    </>
  );
}
