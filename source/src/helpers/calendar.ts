import { DAYS, type State } from "src/types";
export const CALENDAR_DAYS = [...DAYS, "Saturday", "Sunday"] as const;
export function calendarDate(start: string, offset: number) {
  const date = new Date(start + "T12:00:00");
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function calendarFood(
  state: State,
  date: string,
  type: "Lunch" | "Dinner",
) {
  return (state.savedFood || []).filter(
    (f) =>
      f.date === date &&
      f.type === type &&
      ["scheduled", "used"].includes(f.status),
  );
}
