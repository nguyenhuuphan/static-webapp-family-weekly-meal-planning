import { useMemo, useState } from "react";
import { usePersistentState } from "src/hooks/usePersistentState";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Snowflake,
} from "lucide-react";
import { useI18n, useText } from "src/i18n";
import type { MessageKey } from "src/i18n/locales/en";
import { groupPreparation, type PrepOperation } from "src/helpers/preparation";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { mealPortions } from "src/utils";
import MealDetails from "./MealDetails";

const operationKeys = {
  sliceThin: "prepSliceThin",
  cutChicken: "prepCutChicken",
  portionShrimp: "prepPortionShrimp",
  portionGroundPork: "prepPortionGroundPork",
  portionFish: "prepPortionFish",
  sliceMelon: "prepSliceMelon",
  washGreens: "prepWashGreens",
  blanchGreens: "prepBlanchGreens",
  sliceCabbage: "prepSliceCabbage",
  shredCabbage: "prepShredCabbage",
  slicePumpkin: "prepSlicePumpkin",
  sliceChayote: "prepSliceChayote",
  trimBeans: "prepTrimBeans",
  cutTomato: "prepCutTomato",
  sliceAromatics: "prepSliceAromatics",
  keepEggs: "prepKeepEggs",
  prepareSauces: "prepPrepareSauces",
  prepareMixed: "prepPrepareMixed",
  reviewIndividually: "prepReviewIndividually",
} satisfies Record<PrepOperation, MessageKey>;

const categories = [
  { key: "Produce", title: "prepCategoryProduce" },
  { key: "Protein", title: "prepCategoryProtein" },
  { key: "Pantry", title: "prepCategoryPantry" },
  { key: "Other", title: "prepCategoryOther" },
] satisfies { key: string; title: MessageKey }[];

const PrepDay: React.FC = () => {
  const text = useText();
  const [collapsed, setCollapsed] = usePersistentState<Record<string, boolean>>(
    "prep:collapsed",
    {},
  );
  const [remainingOnly, setRemainingOnly] = usePersistentState(
    "prep:remaining",
    false,
  );
  const [expanded, setExpanded] = usePersistentState<Record<string, boolean>>(
    "prep:expanded",
    {},
  );
  const [undo, setUndo] = usePersistentState<{
    before: Record<string, boolean>;
    preparedTasks?: typeof s.preparedTasks;
    ready: Record<string, boolean>;
    after: boolean;
    plan: string;
  } | null>("prep:undo", null);
  const { t: tr, content: ct, number, unit, instruction } = useI18n();
  const { s, plan, navigate, toggle, update } = useMealPlanner();
  const prepIdentity = JSON.stringify([
    plan,
    s.servings,
    s.weekStart,
    s.mealServings,
  ]);
  const complete = (keys: string[], checked: boolean) => {
    setUndo({
      preparedTasks: s.preparedTasks,
      before: Object.fromEntries(
        keys.map((key) => [key, !!s.progress.prep[key]]),
      ),
      ready: Object.fromEntries(
        keys.map((key) => {
          const mealId = key.slice(0, key.lastIndexOf(":"));
          return [mealId, !!s.progress.ready[mealId]];
        }),
      ),
      after: checked,
      plan: prepIdentity,
    });
    keys.forEach((key) => toggle("prep", key, checked));
    setExpanded((current) => {
      const next = { ...current };
      groups.forEach((group) => {
        if (
          group.allocations.some((a) => keys.includes(a.key)) &&
          group.allocations.every((a) =>
            keys.includes(a.key) ? checked : !!s.progress.prep[a.key],
          )
        ) {
          next[group.key] = false;
        }
      });
      return next;
    });
  };
  const groups = useMemo(
    () =>
      groupPreparation(plan, s.servings, s.mealServings).filter(
        (group) => group.operation !== "prepareSauces",
      ),
    [plan, s.servings, s.mealServings],
  );
  const completedGroups = groups.filter((group) =>
    group.allocations.every((allocation) => s.progress.prep[allocation.key]),
  ).length;
  const nextGroup = groups.find((group) =>
    group.allocations.some((allocation) => !s.progress.prep[allocation.key]),
  )?.key;
  return (
    <>
      <Heading
        eyebrow={tr("sundayPrepWeekdayPeace")}
        title={tr("prepBatchTitle")}
        description={tr("prepBatchDescription")}
      >
        <Button onClick={() => navigate("safety")}>
          <ShieldCheck size={17} />
          {tr("safetyNotes")}
        </Button>
      </Heading>
      <p className="caption" id="prep-completion-help">
        {text(
          "Chỉ đánh dấu hoàn tất khi phần đó đã sơ chế, chia đúng lượng, ướp theo món và cất đúng nơi. Làm dở thì để chưa đánh dấu; có thể mở lại bất kỳ nhóm nào.",
          "Mark a portion complete after preparing, dividing, seasoning as directed and storing it. Leave unfinished portions unchecked; you can reopen any group.",
        )}
      </p>
      <div className="progress-panel">
        <div>
          <strong>
            {tr("prepGroupsProgress", {
              count: completedGroups,
              total: groups.length,
            })}
          </strong>
          <span>{tr("prepBatchCount", { count: groups.length })}</span>
        </div>
        <progress value={completedGroups} max={groups.length} />
      </div>
      <div className="notice warning">
        <Snowflake size={19} />
        <p>
          <strong>{tr("keepColdFoodCold")}</strong>{" "}
          {tr("fridge4CFreezer18CFreezeTuesdayFridayProteinsPromptlyMove")}
        </p>
      </div>
      <div className="prep-collapse-controls">
        <Button
          aria-pressed={!remainingOnly}
          onClick={() => setRemainingOnly(false)}
        >
          {tr("prepAll")}
        </Button>
        <Button
          aria-pressed={remainingOnly}
          onClick={() => setRemainingOnly(true)}
        >
          {tr("prepRemaining")}
        </Button>
        {undo &&
          undo.plan === prepIdentity &&
          Object.keys(undo.before).every(
            (key) => !!s.progress.prep[key] === undo.after,
          ) && (
            <Button
              onClick={() => {
                Object.entries(undo.before).forEach(([key, value]) =>
                  toggle("prep", key, value),
                );
                update((state) => {
                  const preparedTasks = { ...state.preparedTasks };
                  for (const key of Object.keys(undo.before)) {
                    if (undo.preparedTasks?.[key])
                      preparedTasks[key] = undo.preparedTasks[key];
                    else delete preparedTasks[key];
                  }
                  return {
                    ...state,
                    preparedTasks,
                    progress: {
                      ...state.progress,
                      ready: { ...state.progress.ready, ...undo.ready },
                    },
                  };
                });
                setUndo(null);
              }}
            >
              {tr("prepUndo")}
            </Button>
          )}
        <Button
          onClick={() =>
            setCollapsed(
              Object.fromEntries(categories.map(({ key }) => [key, true])),
            )
          }
        >
          <ChevronUp size={16} />
          {tr("prepCollapseAll")}
        </Button>
        <Button
          onClick={() => {
            setCollapsed({});
            setExpanded(
              Object.fromEntries(groups.map((group) => [group.key, true])),
            );
          }}
        >
          <ChevronDown size={16} />
          {tr("prepExpandAll")}
        </Button>
      </div>
      {remainingOnly && completedGroups === groups.length && (
        <p role="status">{tr("prepEmpty")}</p>
      )}
      <div className="prep-batch-list">
        {categories.map((category) => {
          const categoryGroups = groups.filter(
            (group) =>
              (!remainingOnly ||
                group.allocations.some(
                  (allocation) => !s.progress.prep[allocation.key],
                )) &&
              (category.key === "Other"
                ? !["Produce", "Protein", "Pantry"].includes(group.category)
                : group.category === category.key),
          );
          if (!categoryGroups.length) return null;
          return (
            <section
              className="prep-category"
              key={category.key}
              aria-labelledby={`prep-category-${category.key}`}
            >
              <header className="prep-category-heading">
                <h2 id={`prep-category-${category.key}`}>
                  {tr(category.title)}
                </h2>
                <span className="pill amber">
                  {tr("prepBatchCount", { count: categoryGroups.length })}
                </span>
                <Button
                  aria-expanded={!collapsed[category.key]}
                  aria-controls={`prep-category-content-${category.key}`}
                  onClick={() =>
                    setCollapsed((current) => ({
                      ...current,
                      [category.key]: !current[category.key],
                    }))
                  }
                >
                  {collapsed[category.key] ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronUp size={16} />
                  )}
                  {tr(
                    collapsed[category.key]
                      ? "prepExpandCategory"
                      : "prepCollapseCategory",
                    { category: tr(category.title) },
                  )}
                </Button>
              </header>
              <div
                className="prep-category-groups"
                id={`prep-category-content-${category.key}`}
                hidden={!!collapsed[category.key]}
              >
                {categoryGroups.map((group) => {
                  const groupIndex = groups.indexOf(group);
                  const done = group.allocations.filter(
                    (allocation) => s.progress.prep[allocation.key],
                  ).length;
                  const allDone = done === group.allocations.length;
                  const isOpen = expanded[group.key] ?? group.key === nextGroup;
                  const name = group.ingredient
                    ? ct(group.ingredient)
                    : group.operation === "prepareSauces"
                      ? tr("prepSaucesTitle")
                      : group.operation === "prepareMixed"
                        ? tr("prepMixedTitle")
                        : ct(group.allocations[0].meal.main);
                  return (
                    <section
                      key={group.key}
                      className={`panel prep-batch ${allDone ? "prepared" : ""}`}
                      aria-labelledby={`prep-group-${groupIndex}`}
                    >
                      <div className="prep-batch-heading">
                        <div>
                          <span className="eyebrow">
                            {group.ingredient
                              ? ct(group.category)
                              : tr("prepRecipeSpecific")}
                          </span>
                          <h3 id={`prep-group-${groupIndex}`}>{name}</h3>
                        </div>
                        {group.quantity !== null && group.unit && (
                          <strong className="prep-batch-quantity">
                            {number(group.quantity)}{" "}
                            <span>{unit(group.unit)}</span>
                          </strong>
                        )}
                        <span className={`pill ${allDone ? "green" : "amber"}`}>
                          {allDone ? (
                            <>
                              <Check size={13} />
                              {tr("prepared")}
                            </>
                          ) : (
                            tr("prepPortionProgress", {
                              count: done,
                              total: group.allocations.length,
                            })
                          )}
                        </span>
                      </div>
                      <Button
                        aria-expanded={isOpen}
                        aria-controls={`prep-body-${groupIndex}`}
                        aria-label={tr("prepGroupDetails", {
                          ingredient: name,
                        })}
                        onClick={() =>
                          setExpanded((current) => ({
                            ...current,
                            [group.key]: !isOpen,
                          }))
                        }
                      >
                        {isOpen ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                        {tr("prepGroupDetails", { ingredient: name })}
                      </Button>
                      <div
                        id={`prep-body-${groupIndex}`}
                        hidden={!isOpen}
                        className="prep-group-body"
                      >
                        <h4>{tr("prepSharedAction")}</h4>
                        <p className="prep-batch-operation">
                          {tr(operationKeys[group.operation])}
                        </p>
                        {group.operation === "reviewIndividually" && (
                          <p className="caption">{tr("prepUnknownHelp")}</p>
                        )}
                        <h4>{tr("prepDivideAction")}</h4>
                        <div className="prep-allocations">
                          {group.allocations.map((allocation) => (
                            <div
                              className={`prep-allocation ${s.progress.prep[allocation.key] ? "checked" : ""}`}
                              key={allocation.key}
                            >
                              <div className="prep-allocation-heading">
                                {allocation.quantity !== null && group.unit && (
                                  <strong className="prep-portion-quantity">
                                    {number(allocation.quantity)}{" "}
                                    {unit(group.unit)}
                                  </strong>
                                )}
                                <MealDetails
                                  meal={allocation.meal}
                                  factor={
                                    mealPortions(s, allocation.meal) /
                                    plan.servings
                                  }
                                />
                              </div>
                              <p className="prep-portion-instruction">
                                {["sliceThin", "cutChicken"].includes(
                                  group.operation,
                                )
                                  ? instruction(
                                      allocation.task.text,
                                      mealPortions(s, allocation.meal) /
                                        plan.servings,
                                    )
                                      .split(/\.\s+/)
                                      .slice(1)
                                      .join(". ")
                                  : instruction(
                                      allocation.task.text,
                                      mealPortions(s, allocation.meal) /
                                        plan.servings,
                                    )}
                              </p>
                              {["sliceThin", "cutChicken"].includes(
                                group.operation,
                              ) && (
                                <details className="prep-original">
                                  <summary>
                                    {tr("prepOriginalInstruction")}
                                  </summary>
                                  <p>
                                    {instruction(
                                      allocation.task.text,
                                      mealPortions(s, allocation.meal) /
                                        plan.servings,
                                    )}
                                  </p>
                                </details>
                              )}
                              <div className="prep-storage-inline">
                                <Snowflake size={16} />
                                <p>
                                  <strong>{tr("store")}</strong>{" "}
                                  {allocation.task.storage
                                    ? ct(allocation.task.storage)
                                    : !allocation.baselineStorage
                                      ? ct(allocation.meal.storage)
                                      : group.operation === "keepEggs"
                                        ? tr(
                                            "keepEggsIntactInTheirCartonInTheRefrigerator",
                                          )
                                        : group.operation ===
                                              "reviewIndividually" ||
                                            !group.ingredient
                                          ? ct(allocation.meal.storage)
                                          : group.category === "Protein"
                                            ? ct(allocation.meal.storage).split(
                                                /\.\s+/,
                                              )[0] + "."
                                            : ct(allocation.meal.storage)
                                                .split(/\.\s+/)
                                                .slice(1)
                                                .join(". ")}
                                </p>
                              </div>
                              <p className="caption">
                                <strong>
                                  {text("Nhãn phần", "Portion label")}:{" "}
                                </strong>
                                {allocation.task.label ||
                                  `${ct(allocation.meal.day)} · ${ct(allocation.meal.type)} · ${name}`}
                              </p>
                              <label className="prep-row">
                                <input
                                  type="checkbox"
                                  aria-describedby="prep-completion-help"
                                  checked={!!s.progress.prep[allocation.key]}
                                  aria-label={tr("prepTaskLabel", {
                                    day: ct(allocation.meal.day),
                                    type: ct(allocation.meal.type),
                                    count: allocation.taskIndex + 1,
                                  })}
                                  onChange={(event) =>
                                    complete(
                                      [allocation.key],
                                      event.target.checked,
                                    )
                                  }
                                />
                                <span>{tr("prepPortionDone")}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                        {group.allocations.length > 1 && (
                          <label className="prep-batch-complete">
                            <input
                              type="checkbox"
                              checked={allDone}
                              ref={(input) => {
                                if (input)
                                  input.indeterminate = done > 0 && !allDone;
                              }}
                              aria-label={tr("prepCompleteGroupLabel", {
                                ingredient: name,
                              })}
                              onChange={(event) =>
                                complete(
                                  group.allocations.map(
                                    (allocation) => allocation.key,
                                  ),
                                  event.target.checked,
                                )
                              }
                            />
                            {tr("prepCompleteGroup")}
                          </label>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
};
export default PrepDay;
