import { expect, it } from "vitest";
import { freshState, hydrateState } from "../src/domain";
import data from "../public/meal-plan.json";
import type { Plan } from "../src/types";
import { recordStorage } from "../src/helpers/foodStorage";
import {
  assignFood,
  changePortions,
  startWeek,
} from "../src/helpers/scheduling";

it("retains preparation, freezing and thawing history through splitting and weekly assignment", () => {
  const s = freshState(structuredClone(data) as Plan),
    id = s.plan.meals[0].id;
  let storage = recordStorage(
    undefined,
    "prepared",
    "2026-10-01T10:00:00Z",
    "raw",
    "fridge",
  );
  storage = recordStorage(
    storage,
    "frozen",
    "2026-10-01T11:00:00Z",
    "raw",
    "fridge",
  );
  storage = recordStorage(
    storage,
    "thawing",
    "2026-10-10T10:00:00Z",
    "raw",
    "fridge",
  );
  s.mealStorage = { [id]: storage };
  s.progress.prep[id + ":0"] = true;
  const next = changePortions(s, id, 0);
  expect(next.savedFood![0].storage).toEqual(storage);
  const week = startWeek(next, "2026-10-19");
  const assigned = assignFood(
    week,
    week.savedFood![0].id,
    week.plan.meals[1].id,
  );
  expect(assigned.mealStorage?.[week.plan.meals[1].id]).toEqual(storage);
  expect(hydrateState(assigned, s.plan).mealStorage).toEqual(
    assigned.mealStorage,
  );
});

it("accepts late-recorded past events chronologically and rejects future timestamps", () => {
  const frozen = recordStorage(
    undefined,
    "frozen",
    "2026-10-02T10:00:00Z",
    "raw",
    "freezer",
  );
  const history = recordStorage(
    frozen,
    "prepared",
    "2026-10-01T10:00:00Z",
    "raw",
    "fridge",
  );
  expect(history.events[0].type).toBe("prepared");
  expect(history.place).toBe("freezer");
  expect(() =>
    recordStorage(history, "cooked", "2099-01-01T10:00:00Z", "cooked", "room"),
  ).toThrow();
});
