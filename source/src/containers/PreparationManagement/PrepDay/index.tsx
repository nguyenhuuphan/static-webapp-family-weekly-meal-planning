import {
  preparationChecked,
  preparationKeys,
} from "src/helpers/preparationProgress";
import {
  sourcePreparationKey,
  categoryStorageText,
} from "src/helpers/preparationParts";
import { createTranslator } from "src/i18n/translate";
import PreparationLinks from "src/modules/shared-main/components/PreparationLinks";
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
import {
  groupPreparation,
  recipePreparationCards,
  type PrepOperation,
  type PrepAllocation,
  type PrepGroup,
} from "src/helpers/preparation";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { currentMealLabel, movedFromOriginal } from "src/helpers/mealLabels";
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
  cookJustInTime: "prepCookJustInTime",
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
    touched?: string[];
    preparedTasks?: typeof s.preparedTasks;
    ready: Record<string, boolean>;
    after: boolean;
    plan: string;
  } | null>("prep:undo", null);
  const { t: tr, content: ct, number, unit, instruction, language } = useI18n();
  const { s, plan, navigate, command, preparationGroups, apiRevision } =
    useMealPlanner();
  const prepInstruction = (value: string, meal: (typeof plan.meals)[number]) =>
    currentMealLabel(
      instruction(value, mealPortions(s, meal) / plan.servings),
      `${ct(meal.day)} · ${ct(meal.type)}`,
    );
  const allocationInstruction = (allocation: PrepAllocation) => {
    if (!allocation.displayText)
      return prepInstruction(allocation.task.text, allocation.meal);
    return currentMealLabel(
      createTranslator(
        language,
        false,
        allocation.displayVi
          ? { [allocation.displayText]: allocation.displayVi }
          : {},
      ).instruction(
        allocation.displayText,
        mealPortions(s, allocation.meal) / plan.servings,
      ),
      `${ct(allocation.meal.day)} · ${ct(allocation.meal.type)}`,
    );
  };
  const allocationStorage = (allocation: PrepAllocation, group: PrepGroup) => {
    if (allocation.task.storage) return ct(allocation.task.storage);
    if (group.operation === "reviewIndividually")
      return categoryStorageText(
        allocation.meal,
        group.category,
        ct(allocation.meal.storage),
        plan.translations?.vi,
      );
    if (!allocation.baselineStorage || !group.ingredient)
      return ct(allocation.meal.storage);
    if (group.operation === "keepEggs")
      return tr("keepEggsIntactInTheirCartonInTheRefrigerator");
    return group.category === "Protein"
      ? ct(allocation.meal.storage).split(/\.\s+/)[0] + "."
      : ct(allocation.meal.storage).split(/\.\s+/).slice(1).join(". ");
  };
  const prepIdentity = JSON.stringify([
    plan,
    s.servings,
    s.weekStart,
    s.mealServings || {},
  ]);
  const complete = async (keys: string[], checked: boolean) => {
    setUndo({
      preparedTasks: s.preparedTasks,
      touched: keys,
      before: Object.fromEntries(
        [...new Set(keys.flatMap((key) => preparationKeys(s, key)))].map(
          (key) => [key, !!s.progress.prep[key]],
        ),
      ),
      ready: Object.fromEntries(
        keys.map((key) => {
          const source = sourcePreparationKey(key);
          const mealId = source.slice(0, source.lastIndexOf(":"));
          return [mealId, !!s.progress.ready[mealId]];
        }),
      ),
      after: checked,
      plan: prepIdentity,
    });
    if (!(await command("prep.complete", { keys, value: checked }))) {
      setUndo(null);
      return;
    }
    setExpanded((current) => {
      const next = { ...current };
      groups.forEach((group) => {
        if (
          group.allocations.some((a) => keys.includes(a.key)) &&
          group.allocations.every((a) =>
            keys.includes(a.key) ? checked : preparationChecked(s, a.key),
          )
        ) {
          next[group.key] = false;
        }
      });
      return next;
    });
  };
  const groups = preparationGroups;
  const completedGroups = groups.filter((group) =>
    group.allocations.every((allocation) =>
      preparationChecked(s, allocation.key),
    ),
  ).length;
  const nextGroup = groups.find((group) =>
    group.allocations.some(
      (allocation) => !preparationChecked(s, allocation.key),
    ),
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
      <p className="caption">
        {text(
          "Rau củ và thịt cá được sơ chế riêng. Vo gạo, nấu cơm thực hiện ngay trước bữa ăn.",
          "Prepare vegetables and raw proteins separately. Rinse and cook rice just before the meal.",
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
          (undo.touched || Object.keys(undo.before)).every(
            (key) => preparationChecked(s, key) === undo.after,
          ) && (
            <Button
              onClick={async () => {
                if (
                  !(await command("prep.restore", {
                    before: undo.before,
                    touched: Object.keys(undo.before),
                    preparedTasks: undo.preparedTasks,
                    ready: undo.ready,
                  }))
                )
                  return;
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
      {apiRevision === null && (
        <p className="notice">
          {text(
            "Kết nối dữ liệu gia đình để tải danh sách sơ chế.",
            "Connect family data to load the preparation checklist.",
          )}
        </p>
      )}
      {apiRevision !== null &&
        remainingOnly &&
        completedGroups === groups.length && (
          <p role="status">{tr("prepEmpty")}</p>
        )}
      <div className="prep-batch-list">
        {categories.map((category) => {
          const categoryGroups = groups.filter(
            (group) =>
              (!remainingOnly ||
                group.allocations.some(
                  (allocation) => !preparationChecked(s, allocation.key),
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
                  const done = group.allocations.filter((allocation) =>
                    preparationChecked(s, allocation.key),
                  ).length;
                  const allDone = done === group.allocations.length;
                  const isOpen = expanded[group.key] ?? group.key === nextGroup;
                  const name = group.displayIngredients?.length
                    ? group.displayIngredients.map(ct).join(", ")
                    : group.ingredient
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
                          {group.operation === "reviewIndividually" && (
                            <span className="caption">
                              {ct(group.allocations[0].meal.day)} ·{" "}
                              {ct(group.allocations[0].meal.type)} ·{" "}
                              {ct(group.allocations[0].meal.main)}
                            </span>
                          )}
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
                            tr(
                              group.operation === "reviewIndividually"
                                ? "prepStepProgress"
                                : "prepPortionProgress",
                              {
                                count: done,
                                total: group.allocations.length,
                              },
                            )
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
                        {group.operation === "reviewIndividually" ? (
                          <h4>
                            {text("Các bước sơ chế", "Preparation steps")}
                          </h4>
                        ) : (
                          <>
                            <h4>{tr("prepSharedAction")}</h4>
                            <p className="prep-batch-operation">
                              {tr(operationKeys[group.operation])}
                            </p>
                            <h4>{tr("prepDivideAction")}</h4>
                          </>
                        )}
                        <div className="prep-allocations">
                          {group.allocations.map((allocation) => (
                            <div
                              className={`prep-allocation ${preparationChecked(s, allocation.key) ? "checked" : ""}`}
                              key={allocation.key}
                              data-prep-key={allocation.key}
                            >
                              <div className="prep-allocation-heading">
                                {group.operation === "reviewIndividually" && (
                                  <strong>
                                    {text("Bước", "Step")}{" "}
                                    {number(allocation.taskIndex + 1)}
                                  </strong>
                                )}
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
                                  ? prepInstruction(
                                      allocation.task.text,
                                      allocation.meal,
                                    )
                                      .split(/\.\s+/)
                                      .slice(1)
                                      .join(". ")
                                  : allocationInstruction(allocation)}
                              </p>
                              {["sliceThin", "cutChicken"].includes(
                                group.operation,
                              ) && (
                                <details className="prep-original">
                                  <summary>
                                    {tr("prepOriginalInstruction")}
                                  </summary>
                                  <p>
                                    {prepInstruction(
                                      allocation.task.text,
                                      allocation.meal,
                                    )}
                                  </p>
                                </details>
                              )}
                              {movedFromOriginal(allocation.meal) && (
                                <p className="notice warning">
                                  {text(
                                    "Đã đổi lịch. Hướng dẫn bảo quản dưới đây thuộc lịch gốc; hãy kiểm tra thực tế trước khi dùng.",
                                    "Meal moved. Storage guidance below refers to the original schedule; review actual storage before use.",
                                  )}
                                </p>
                              )}
                              {allocationStorage(allocation, group) && (
                                <div className="prep-storage-inline">
                                  <Snowflake size={16} />
                                  <p>
                                    <strong>{tr("store")}</strong>{" "}
                                    {allocationStorage(allocation, group)}
                                  </p>
                                </div>
                              )}
                              <p className="caption">
                                <strong>
                                  {text("Nhãn phần", "Portion label")}:{" "}
                                </strong>
                                {allocation.task.label ||
                                  `${ct(allocation.meal.day)} · ${ct(allocation.meal.type)} · ${allocation.displayIngredients?.length ? allocation.displayIngredients.map(ct).join(", ") : name}`}
                              </p>
                              <label className="prep-row">
                                <input
                                  type="checkbox"
                                  aria-describedby="prep-completion-help"
                                  checked={
                                    !!preparationChecked(s, allocation.key)
                                  }
                                  aria-label={
                                    tr("prepTaskLabel", {
                                      day: ct(allocation.meal.day),
                                      type: ct(allocation.meal.type),
                                      count: allocation.taskIndex + 1,
                                    }) +
                                    (allocation.key.includes("::")
                                      ? ` · ${tr(category.title)}`
                                      : "")
                                  }
                                  onChange={(event) =>
                                    complete(
                                      [allocation.key],
                                      event.target.checked,
                                    )
                                  }
                                />
                                <span>
                                  {group.operation === "reviewIndividually"
                                    ? text(
                                        "Đã sơ chế và cất nguyên liệu cho bước này",
                                        "Prepared and stored the ingredients for this step",
                                      )
                                    : tr("prepPortionDone")}
                                </span>
                              </label>
                              {allocation.task.ingredients === undefined && (
                                <PreparationLinks
                                  meal={allocation.meal}
                                  task={allocation.task}
                                  onChange={(refs) =>
                                    command("prep.links", {
                                      id: allocation.meal.id,
                                      index: allocation.taskIndex,
                                      refs,
                                    })
                                  }
                                />
                              )}
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
