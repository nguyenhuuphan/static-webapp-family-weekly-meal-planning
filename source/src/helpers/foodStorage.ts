import type { FoodStorage } from "src/types";

export const unknownStorage = (): FoodStorage => ({
  stage: "unknown",
  place: "unknown",
  events: [],
});
export function validateFoodStorage(value: FoodStorage) {
  if (
    !value ||
    !["unknown", "raw", "cooked"].includes(value.stage) ||
    !["unknown", "fridge", "freezer", "room"].includes(value.place) ||
    !Array.isArray(value.events)
  )
    throw Error("Invalid food storage record.");
  let previous = 0;
  for (const event of value.events) {
    const time = Date.parse(event.at);
    if (
      ![
        "prepared",
        "frozen",
        "thawing",
        "thawed",
        "cooked",
        "checked",
      ].includes(event.type) ||
      !Number.isFinite(time) ||
      time < previous ||
      !["unknown", "raw", "cooked"].includes(event.stage) ||
      !["unknown", "fridge", "freezer", "room"].includes(event.place)
    )
      throw Error("Invalid storage history.");
    previous = time;
  }
  return value;
}
export function recordStorage(
  value: FoodStorage | undefined,
  type: FoodStorage["events"][number]["type"],
  at: string,
  stage: FoodStorage["stage"],
  place: FoodStorage["place"],
): FoodStorage {
  const next = {
    stage: type === "cooked" ? ("cooked" as const) : stage,
    place: type === "frozen" ? ("freezer" as const) : place,
    events: [...(value?.events || [])],
  };
  if (!Number.isFinite(Date.parse(at)) || Date.parse(at) > Date.now())
    throw Error("Choose a valid time, no later than now.");
  next.events.push({ type, at, stage: next.stage, place: next.place });
  next.events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  next.stage = next.events[next.events.length - 1].stage;
  next.place = next.events[next.events.length - 1].place;
  return validateFoodStorage(next);
}
