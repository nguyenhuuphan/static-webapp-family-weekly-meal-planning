import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Layers3,
  ShieldCheck,
  Snowflake,
} from "lucide-react";
import { useI18n } from "src/i18n";
import type { MessageKey } from "src/i18n/locales/en";
import { groupPreparation, type PrepOperation } from "src/helpers/preparation";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { t: tr, content: ct, number, unit } = useI18n();
  const { s, plan, factor, prepTotal, prepDone, t, navigate, toggle } =
    useMealPlanner();
  const groups = useMemo(
    () =>
      groupPreparation(plan, s.servings).filter(
        (group) => group.operation !== "prepareSauces",
      ),
    [plan, s.servings],
  );
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
      <div className="progress-panel">
        <div>
          <strong>
            {tr("prepProgress", { count: prepDone, total: prepTotal })}
          </strong>
          <span>{tr("prepBatchCount", { count: groups.length })}</span>
        </div>
        <progress value={prepDone} max={prepTotal} />
      </div>
      <div className="notice prep-batch-intro">
        <Layers3 size={20} />
        <p>{tr("prepBatchHelp")}</p>
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
          onClick={() =>
            setCollapsed(
              Object.fromEntries(categories.map(({ key }) => [key, true])),
            )
          }
        >
          <ChevronUp size={16} />
          {tr("prepCollapseAll")}
        </Button>
        <Button onClick={() => setCollapsed({})}>
          <ChevronDown size={16} />
          {tr("prepExpandAll")}
        </Button>
      </div>
      <div className="prep-batch-list">
        {categories.map((category) => {
          const categoryGroups = groups.filter((group) =>
            category.key === "Other"
              ? !["Produce", "Protein", "Pantry"].includes(group.category)
              : group.category === category.key,
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
                <Button
                  disabled={categoryGroups.every((group) =>
                    group.allocations.every(
                      (allocation) => s.progress.prep[allocation.key],
                    ),
                  )}
                  onClick={() =>
                    categoryGroups.forEach((group) =>
                      group.allocations.forEach((allocation) =>
                        toggle("prep", allocation.key, true),
                      ),
                    )
                  }
                >
                  <Check size={16} />
                  {tr("prepCompleteCategory", { category: tr(category.title) })}
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
                      <p className="prep-batch-operation">
                        {tr(operationKeys[group.operation])}
                      </p>
                      {group.operation === "reviewIndividually" && (
                        <p className="caption">{tr("prepUnknownHelp")}</p>
                      )}
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
                                factor={factor}
                              />
                            </div>
                            <label className="prep-row">
                              <input
                                type="checkbox"
                                checked={!!s.progress.prep[allocation.key]}
                                aria-label={tr("prepTaskLabel", {
                                  day: ct(allocation.meal.day),
                                  type: ct(allocation.meal.type),
                                  count: allocation.taskIndex + 1,
                                })}
                                onChange={(event) =>
                                  toggle(
                                    "prep",
                                    allocation.key,
                                    event.target.checked,
                                  )
                                }
                              />
                              <span>{t(allocation.task.text)}</span>
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
                              group.allocations.forEach((allocation) =>
                                toggle(
                                  "prep",
                                  allocation.key,
                                  event.target.checked,
                                ),
                              )
                            }
                          />
                          {tr("prepCompleteGroup")}
                        </label>
                      )}
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
