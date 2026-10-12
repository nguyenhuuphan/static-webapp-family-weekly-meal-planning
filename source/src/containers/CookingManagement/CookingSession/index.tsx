import AllergyWarnings from "src/modules/shared-main/components/AllergyWarnings";
import MealOutcome from "./MealOutcome";
import { beginCooking, cancelCooking } from "src/helpers/cooking";
import FoodStorageEditor from "src/modules/shared-main/components/FoodStorageEditor";
import { useI18n, useText } from "src/i18n";
import { currentMealLabel, movedFromOriginal } from "src/helpers/mealLabels";
import { isCookingPreparation } from "src/helpers/preparation";
import {
  ShoppingBag,
  ArrowRight,
  Check,
  Clock,
  ShieldCheck,
  Play,
  CheckCircle2,
  Info,
} from "lucide-react";
import { DAYS } from "src/types";
import { isPrepared, round, mealPortions } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { fmt } from "src/utils/formatTime";
import { timerSeconds } from "src/utils";

interface IProps {}
const CookingSession: React.FC<IProps> = () => {
  const text = useText();
  const { t: tr, source, content: ct, number: num, unit } = useI18n();
  const {
    s,
    plan,
    factor,
    meal,
    ready,
    pos,
    update,
    seconds,
    t,
    startTimer,
    navigate,
    toggle,
    setSelected,
    setToast,
  } = useMealPlanner();
  if (!plan.meals.some((m) => mealPortions(s, m) > 0))
    return (
      <section className="panel empty">
        <h1>{text("Chưa có bữa cần nấu", "No meals to cook")}</h1>
        <p>
          {text(
            "Các bữa đều đang không ăn tại nhà. Hãy khôi phục bữa trong lịch tuần hoặc sắp xếp đồ đã chuẩn bị.",
            "All meals are skipped. Restore a meal in your weekly plan or arrange your prepared food.",
          )}
        </p>
        <Button onClick={() => navigate("week")}>
          {text("Về lịch tuần", "Back to weekly plan")}
        </Button>
      </section>
    );
  return (
    <>
      <Heading
        eyebrow={tr("oneMealOneStepAtATime")}
        title={tr("letSMakeSomethingGood")}
        description={tr(
          "chooseYourMealCheckYourPortionsThenFollowThePreparedIngredientGuide",
        )}
      />
      <div className="mobile-meal-picker">
        <label>
          {tr("chooseYourMeal")}
          <select
            value={meal.id}
            onChange={(event) => setSelected(event.target.value)}
          >
            {plan.meals
              .filter((item) => mealPortions(s, item) > 0)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {ct(item.day)} · {ct(item.type)} · {ct(item.main)}
                </option>
              ))}
          </select>
        </label>
        <Button
          onClick={() => {
            const day = DAYS[new Date().getDay() - 1];
            const today =
              plan.meals.find(
                (item) =>
                  item.day === day &&
                  mealPortions(s, item) > 0 &&
                  !s.progress.done[item.id],
              ) ||
              plan.meals.find(
                (item) => item.day === day && mealPortions(s, item) > 0,
              );
            if (today) setSelected(today.id);
            else
              setToast(
                text(
                  "Cuối tuần chưa có bữa trong kế hoạch. Hãy chọn bữa muốn nấu.",
                  "There are no weekend meals in this plan. Choose any meal to cook.",
                ),
              );
          }}
        >
          {text("Bữa hôm nay", "Today's meal")}
        </Button>
      </div>
      <div className="cook-layout">
        <aside className="meal-picker">
          <span className="eyebrow">{tr("chooseYourMeal")}</span>
          {DAYS.map((d) => (
            <div key={d}>
              <h4>{ct(d)}</h4>
              {plan.meals
                .filter((m) => m.day === d && mealPortions(s, m) > 0)
                .sort((a, b) => (a.type === "Lunch" ? -1 : 1))
                .map((m) => (
                  <button
                    key={m.id}
                    className={m.id === meal.id ? "selected" : ""}
                    onClick={() => setSelected(m.id)}
                  >
                    <span>
                      {ct(m.type)}
                      <small>{ct(m.main)}</small>
                    </span>
                    {s.progress.done[m.id] ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <ArrowRight size={14} />
                    )}
                  </button>
                ))}
            </div>
          ))}
        </aside>
        <div>
          <section className="panel cook-header">
            <div className="eyebrow">
              {ct(meal.day)} · {ct(meal.type)} ·{" "}
              {tr("servingsCount", { count: mealPortions(s, meal) })}
            </div>
            <AllergyWarnings ingredients={meal.ingredients} />
            <h2>{ct(meal.main)}</h2>
            {!s.progress.done[meal.id] && (
              <div className="batch-status">
                {s.cookingBatches?.[meal.id] ? (
                  <div>
                    <p role="status">
                      {text("Mẻ đang nấu", "Cooking batch")}:{" "}
                      {s.cookingBatches[meal.id].servings}{" "}
                      {text(
                        "phần. Ghi số đã ăn khi hoàn tất.",
                        "portions. Record portions eaten when finishing.",
                      )}
                    </p>
                    <Button
                      onClick={() => {
                        if (
                          confirm(
                            text(
                              "Chỉ hủy nếu chưa nấu thực tế. Hủy trạng thái đang nấu và các timer của mẻ?",
                              "Cancel only if cooking has not actually begun. Clear this batch and its timers?",
                            ),
                          )
                        )
                          update((s) => cancelCooking(s, meal.id));
                      }}
                    >
                      {text("Chưa nấu: hủy mẻ", "Not cooked yet: cancel batch")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => update((s) => beginCooking(s, meal.id))}
                  >
                    {text("Bắt đầu nấu mẻ này", "Start this cooking batch")}
                  </Button>
                )}
              </div>
            )}

            <p>{ct(meal.side)}</p>
            {movedFromOriginal(meal) && (
              <p className="notice warning">
                {text(
                  "Đã đổi lịch. Hướng dẫn bảo quản và rã đông gốc không tự cập nhật theo ngày ăn mới. Hãy kiểm tra thực tế.",
                  "Meal moved. Original storage and thawing guidance does not automatically change with the new meal date. Review actual conditions.",
                )}
              </p>
            )}
            <details>
              <summary>
                <ShoppingBag size={15} />
                {tr("containersIngredients")}
              </summary>
              <div className="ingredient-chips">
                {meal.ingredients.map((i, n) => (
                  <span key={n}>
                    {num(round(i.qty * factor))} {unit(i.unit)} · {ct(i.name)}
                  </span>
                ))}
              </div>
              <p className="caption">{ct(meal.thaw)}</p>
            </details>
            {meal.prep.some((_, index) =>
              isCookingPreparation(meal, index),
            ) && (
              <div className="cook-seasonings">
                <h3>{tr("cookSeasoningsTitle")}</h3>
                <p className="caption">{tr("cookSeasoningsHelp")}</p>
                <ul>
                  {meal.prep.map((task, index) =>
                    isCookingPreparation(meal, index) ? (
                      <li key={index}>
                        {currentMealLabel(
                          t(task.text),
                          `${ct(meal.day)} · ${ct(meal.type)}`,
                        )}
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            )}
            <FoodStorageEditor
              key={meal.id}
              value={s.mealStorage?.[meal.id]}
              onChange={(storage) =>
                update((s) => ({
                  ...s,
                  mealStorage: { ...s.mealStorage, [meal.id]: storage },
                }))
              }
            />
            <label className="readiness">
              <input
                type="checkbox"
                checked={!!s.progress.ready[meal.id]}
                onChange={(e) => toggle("ready", meal.id, e.target.checked)}
              />
              {tr("iCheckedSafelyStoredFullyThawedAndReadyToCook")}
            </label>
            {!isPrepared(s, meal) && (
              <div className="notice warning">
                <Info size={18} />
                <p>
                  {tr(
                    "preparationIsNotFullyConfirmedYouCanReadAheadButFinishPrep",
                  )}{" "}
                  <button
                    className="text-button"
                    onClick={() => navigate("prep")}
                  >
                    {tr("reviewPrep")}
                    <ArrowRight size={13} />
                  </button>
                </p>
              </div>
            )}
            {factor !== 1 && (
              <div className="notice warning">
                {tr("quantitiesAreScaledButTimeIsNotUseBatchesIfNeededAnd")}
              </div>
            )}
          </section>
          <section className="panel cooking-step">
            <h3>{tr("prepCookingSteps")}</h3>
            <ol className="cooking-instructions">
              {meal.steps.map((step, index) => (
                <li
                  key={`${meal.id}:${index}`}
                  className={pos === index ? "current-instruction" : ""}
                >
                  <Button
                    aria-pressed={pos === index}
                    onClick={() =>
                      update((state) => ({
                        ...beginCooking(state, meal.id),
                        progress: {
                          ...state.progress,
                          cook: { ...state.progress.cook, [meal.id]: index },
                        },
                      }))
                    }
                  >
                    {pos === index
                      ? text("Đang làm bước này", "Current step")
                      : text("Đánh dấu đang làm", "Mark as current")}
                  </Button>
                  <div className="step-text">{t(step.text)}</div>
                  {step.minutes > 0 && (
                    <div className="step-timer">
                      <div>
                        <Clock size={20} />
                        <span>
                          <strong>
                            {(() => {
                              const timer = [
                                ...(s.timers || []),
                                ...(s.timer ? [s.timer] : []),
                              ].find(
                                (value) =>
                                  value.mealId === meal.id &&
                                  value.step === index,
                              );
                              return timer
                                ? fmt(timerSeconds(timer))
                                : `${step.minutes}:00`;
                            })()}
                          </strong>
                          <small>
                            {tr("suggestedTimerCheckDonenessSeparately")}
                          </small>
                        </span>
                      </div>
                      <Button
                        onClick={() => startTimer(index)}
                        aria-label={tr("cookTimerStep", { count: index + 1 })}
                      >
                        <Play size={14} />
                        {tr("startTimer")}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <div className="step-controls">
              {!ready && !s.progress.done[meal.id] && (
                <p role="status">
                  {!isPrepared(s, meal)
                    ? text(
                        "Còn phần chưa sơ chế. Hãy xem lại sơ chế trước khi hoàn thành bữa ăn.",
                        "Some portions still need preparation. Review prep before finishing this meal.",
                      )
                    : text(
                        "Hãy xác nhận thực phẩm đã bảo quản đúng và rã đông ở đầu trang.",
                        "Confirm safe storage and thawing at the top of this page.",
                      )}
                  <Button
                    onClick={() =>
                      !isPrepared(s, meal)
                        ? navigate("prep")
                        : document
                            .querySelector<HTMLInputElement>(".readiness input")
                            ?.focus()
                    }
                  >
                    {text("Kiểm tra ngay", "Review now")}
                  </Button>
                </p>
              )}
              <MealOutcome />
            </div>
            <div className="doneness">
              <ShieldCheck size={17} />
              <p>{tr("chicken74CGroundMeatEggDishes71CFish63C")}</p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};
export default CookingSession;
