import AllergyWarnings from "src/modules/shared-main/components/AllergyWarnings";
import { useEffect, useState } from "react";
import { CALENDAR_DAYS, calendarDate } from "src/helpers/calendar";
import Stocktake from "src/containers/SettingsManagement/HouseholdSettings/Stocktake";
import CalendarMeals from "./CalendarMeals";
import { useI18n, useText } from "src/i18n";
import {
  CalendarDays,
  ShoppingBag,
  Utensils,
  ArrowRight,
  Check,
  Clock,
  Users,
  Sun,
  Pencil,
  CheckCircle2,
  Info,
  ChefHat,
  Leaf,
} from "lucide-react";
import { DAYS } from "src/types";
import { changePortions } from "src/helpers/scheduling";
import { isPrepared, mealPortions } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

import SavedFoodPanel from "./SavedFoodPanel";
import ScheduleControls from "./ScheduleControls";

interface IProps {}
const WeeklyMenu: React.FC<IProps> = () => {
  const { t: tr, content: ct, number: num, date: localizedDate } = useI18n();
  const {
    s,
    update,
    plan,
    doneCount,
    edit,
    navigate,
    cook,
    toggle,
    bought,
    needs,
    prepDone,
    prepTotal,
  } = useMealPlanner();
  const text = useText();
  const [calendarWeek, setCalendarWeek] = useState(s.weekStart);
  const [openingWeek, setOpeningWeek] = useState<string | null>(null);
  useEffect(() => setCalendarWeek(s.weekStart), [s.weekStart]);
  const archive = s.weekArchive?.[calendarWeek];
  const shownPlan = calendarWeek === s.weekStart ? plan : archive?.plan;
  const readOnly = calendarWeek !== s.weekStart;
  const activeMeals = plan.meals.filter((m) => mealPortions(s, m) > 0);
  const today = new Date();
  const todayDay = DAYS[today.getDay() - 1];
  const nextMeal =
    activeMeals.find((m) => m.day === todayDay && !s.progress.done[m.id]) ||
    activeMeals.find((m) => !s.progress.done[m.id]);
  const nextView =
    bought < needs.length ? "shop" : prepDone < prepTotal ? "prep" : "cook";
  return (
    <>
      <Heading
        eyebrow={tr("yourWeekdayKitchenSimplified")}
        title={tr("aLittlePlanningALotMoreEase")}
        description={text(
          "Lịch ăn linh hoạt: chỉnh số người, bỏ bữa hoặc đổi lịch. Danh sách mua và sơ chế cập nhật theo kế hoạch.",
          "A flexible meal plan: adjust diners, skip meals or swap dates. Shopping and preparation follow your plans.",
        )}
      >
        <Button
          onClick={() =>
            nextView === "cook" && nextMeal
              ? cook(nextMeal)
              : navigate(nextView)
          }
          primary
          disabled={!activeMeals.length}
        >
          <ShoppingBag size={17} />
          {nextView === "shop"
            ? tr("startShopping")
            : nextView === "prep"
              ? tr("prepGuide")
              : tr("startCooking")}
        </Button>
      </Heading>
      {nextMeal && (
        <section className="panel">
          <span className="eyebrow">
            {text("Bữa ăn tiếp theo", "Your next meal")}
          </span>
          <h2>
            {ct(nextMeal.day)} · {ct(nextMeal.type)} — {ct(nextMeal.main)}
          </h2>
          <p>{ct(nextMeal.side)}</p>
          <Button primary onClick={() => cook(nextMeal)}>
            {tr("cook")} <ArrowRight size={16} />
          </Button>
        </section>
      )}
      <SavedFoodPanel />
      <div className="metric-grid">
        <div>
          <span className="metric-icon">
            <CalendarDays size={20} />
          </span>
          <div>
            <strong>{tr("mealCount", { count: activeMeals.length })}</strong>
            <small>{tr("mondayThroughFriday")}</small>
          </div>
        </div>
        <div>
          <span className="metric-icon">
            <Users size={20} />
          </span>
          <div>
            <strong>{tr("peopleCount", { count: s.servings })}</strong>
            <small>{tr("atYourFamilyTable")}</small>
          </div>
        </div>
        <div>
          <span className="metric-icon">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <strong>
              {tr("enjoyedCount", {
                count: doneCount,
                total: activeMeals.length,
              })}
            </strong>
            <small>{tr("aLittleProgressEveryDay")}</small>
          </div>
        </div>
      </div>
      <div className="weekly-workspace">
        <section className="weekly-schedule" aria-label={tr("weeklyMealPlan")}>
          <div className="section-title">
            <div>
              <span className="eyebrow">{tr("whatSCooking")}</span>
              <h2>{tr("yourWeekAtAGlance")}</h2>
            </div>
            <span className="caption">
              {tr("lunchDinnerRiceHandledSeparately")}
            </span>
          </div>
          <div className="calendar-navigation actions">
            <Button
              onClick={() => setCalendarWeek((week) => calendarDate(week, -7))}
            >
              {text("Tuần trước", "Previous week")}
            </Button>
            <strong aria-live="polite">
              {calendarWeek} — {calendarDate(calendarWeek, 6)}
            </strong>
            <Button
              onClick={() => setCalendarWeek((week) => calendarDate(week, 7))}
            >
              {text("Tuần sau", "Next week")}
            </Button>
            {readOnly && (
              <>
                <Button onClick={() => setCalendarWeek(s.weekStart)}>
                  {text("Về tuần hiện tại", "Current week")}
                </Button>
                <Button onClick={() => setOpeningWeek(calendarWeek)}>
                  {text("Mở kế hoạch tuần này", "Start this week's plan")}
                </Button>
              </>
            )}
          </div>
          {readOnly && (
            <p className="notice">
              {text(
                "Đang xem lịch, không đặt lại dữ liệu tuần hiện tại. Tuần chưa lập kế hoạch chỉ hiển thị các bữa đã có ngày.",
                "Browsing does not reset the current week. Unplanned weeks show only meals already dated.",
              )}
            </p>
          )}
          {openingWeek && (
            <Stocktake week={openingWeek} close={() => setOpeningWeek(null)} />
          )}
          <div className="week-grid">
            {CALENDAR_DAYS.map((day, index) => (
              <section className="day-block" key={day}>
                <div className="day-title">
                  <span className="day-number">0{index + 1}</span>
                  <div>
                    <h3>{ct(day)}</h3>
                    <span>{calendarDate(calendarWeek, index)}</span>
                  </div>
                </div>
                {!readOnly && index < 5 && (
                  <div className="day-plan-actions">
                    <button
                      className="text-button"
                      disabled={plan.meals
                        .filter((m) => m.day === day && !s.progress.done[m.id])
                        .every((m) => mealPortions(s, m) === 0)}
                      onClick={() =>
                        update((state) => {
                          let next = state;
                          for (const m of state.plan.meals.filter(
                            (m) => m.day === day && !state.progress.done[m.id],
                          ))
                            next = changePortions(next, m.id, 0);
                          return next;
                        })
                      }
                    >
                      {text("Không ăn cả ngày", "Skip whole day")}: {ct(day)}
                    </button>
                    {plan.meals.some(
                      (m) => m.day === day && mealPortions(s, m) === 0,
                    ) && (
                      <button
                        className="text-button"
                        onClick={() =>
                          update((state) => {
                            let next = state;
                            for (const m of state.plan.meals.filter(
                              (m) =>
                                m.day === day &&
                                !state.progress.done[m.id] &&
                                mealPortions(state, m) === 0,
                            ))
                              next = changePortions(
                                next,
                                m.id,
                                Math.min(
                                  state.servings,
                                  state.lastMealServings?.[m.id] ||
                                    state.servings,
                                ),
                              );
                            return next;
                          })
                        }
                      >
                        {text("Khôi phục các bữa", "Restore meals")}: {ct(day)}
                      </button>
                    )}
                  </div>
                )}
                <div className="day-meals">
                  {(["Lunch", "Dinner"] as const).map((type) => {
                    const date = calendarDate(calendarWeek, index);
                    const m = shownPlan?.meals.find(
                      (x) => x.day === day && x.type === type,
                    );
                    if (!m)
                      return (
                        <article className="meal-card" key={type}>
                          <span className="card-meta">{ct(type)}</span>
                          <p>
                            {text("Chưa có bữa chính", "No main meal planned")}
                          </p>
                          <CalendarMeals date={date} type={type} />
                        </article>
                      );
                    const done = readOnly
                      ? archive?.done[m.id]
                      : s.progress.done[m.id];
                    const skipped = readOnly
                      ? (archive?.mealServings?.[m.id] ?? archive?.servings) ===
                        0
                      : mealPortions(s, m) === 0;
                    return (
                      <article
                        className={`meal-card ${done ? "complete" : ""} ${skipped ? "skipped" : ""}`}
                        key={m.id}
                      >
                        <div className="card-meta">
                          <span>
                            {type === "Lunch" ? (
                              <Sun size={14} />
                            ) : (
                              <Utensils size={14} />
                            )}{" "}
                            {ct(type)}
                          </span>
                          <span>
                            <Clock size={13} />
                            {tr("minutesCount", { count: m.minutes })}
                          </span>
                        </div>
                        <h3>{ct(m.main)}</h3>
                        <p>{ct(m.side)}</p>
                        <div className="card-bottom">
                          <span
                            className={`pill ${done || (isPrepared(s, m) && s.progress.ready[m.id]) ? "green" : "amber"}`}
                          >
                            {readOnly ? (
                              done ? (
                                tr("enjoyed")
                              ) : (
                                text("Lịch đã lưu", "Saved plan")
                              )
                            ) : skipped ? (
                              text("Không ăn tại nhà", "Not eating at home")
                            ) : done ? (
                              <>
                                <Check size={12} />
                                {tr("enjoyed")}
                              </>
                            ) : isPrepared(s, m) && s.progress.ready[m.id] ? (
                              tr("readyToCook")
                            ) : isPrepared(s, m) ? (
                              tr("checkThawing")
                            ) : (
                              tr("prepNeeded")
                            )}
                          </span>
                          <div className="actions">
                            <button
                              className="icon-button"
                              aria-label={tr("editMealLabel", {
                                day: ct(day),
                                type: ct(type),
                              })}
                              disabled={readOnly}
                              onClick={() => edit(m)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="text-button"
                              disabled={skipped || readOnly}
                              onClick={() => cook(m)}
                            >
                              {tr("cook")}
                              <ArrowRight size={16} />
                            </button>
                          </div>
                        </div>
                        {(readOnly
                          ? archive?.mealResults?.[m.id]
                          : s.mealResults?.[m.id]) &&
                          (() => {
                            const result = (
                              readOnly
                                ? archive?.mealResults?.[m.id]
                                : s.mealResults?.[m.id]
                            )!;
                            return (
                              <p className="caption">
                                {text("Đã nấu", "Cooked")}: {result.cooked} ·{" "}
                                {text("Đã ăn", "Eaten")}: {result.eaten} ·{" "}
                                {text("Còn lại", "Remaining")}:{" "}
                                {result.remaining}
                              </p>
                            );
                          })()}
                        <AllergyWarnings ingredients={m.ingredients} />
                        {!readOnly && <ScheduleControls meal={m} />}
                        <CalendarMeals date={date} type={type} />
                        {done && !readOnly && (
                          <button
                            className="undo caption"
                            onClick={() => toggle("done", m.id, false)}
                          >
                            {tr("undoCompletion")}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
        <aside className="week-companion" aria-label={tr("kitchenOverview")}>
          <section className="companion-progress">
            <span className="eyebrow">{tr("oneMealAtATime")}</span>
            <h2>{tr("aWeekWellSpent")}</h2>
            <div className="progress-total">
              <strong>{num(doneCount)}</strong>
              <span>
                {tr("enjoyedCount", {
                  count: doneCount,
                  total: activeMeals.length,
                })}
              </span>
            </div>
            <progress
              value={doneCount}
              max={activeMeals.length || 1}
              aria-label={tr("mealsEnjoyedThisWeek")}
            />
            <p>
              {activeMeals.length === 0
                ? text(
                    "Tuần này chưa có bữa ăn tại nhà. Anh có thể khôi phục bất kỳ bữa nào.",
                    "No meals at home this week. Restore any meal when your plans change.",
                  )
                : doneCount === activeMeals.length
                  ? tr("aFullWeekOfGoodFoodBeautifullyDone")
                  : tr("yourNextGoodMealStartsWithOneSmallStep")}
            </p>
          </section>
          <section className="kitchen-shortcuts">
            <span className="eyebrow">{tr("fromPlanToPlate")}</span>
            <h2>{tr("yourKitchenRhythm")}</h2>
            <button onClick={() => navigate("shop")}>
              <span className="shortcut-icon">
                <ShoppingBag size={20} />
              </span>
              <span>
                <strong>{tr("shoppingList")}</strong>
                <small>{tr("gatherYourIngredients")}</small>
              </span>
              <ArrowRight size={17} />
            </button>
            <button onClick={() => navigate("prep")}>
              <span className="shortcut-icon">
                <ChefHat size={20} />
              </span>
              <span>
                <strong>{tr("prepGuide")}</strong>
                <small>{tr("getReadyForTheWeek")}</small>
              </span>
              <ArrowRight size={17} />
            </button>
            <button onClick={() => navigate("cook")}>
              <span className="shortcut-icon">
                <Utensils size={20} />
              </span>
              <span>
                <strong>{tr("startCooking")}</strong>
                <small>{tr("followYourCookingSteps")}</small>
              </span>
              <ArrowRight size={17} />
            </button>
          </section>
          <div className="companion-note">
            <Leaf size={24} />
            <p>
              {tr("goodFood")}
              <br />
              {tr("aLittleLessHurry")}
            </p>
            <span>{tr("aLittlePlanningLeavesMoreRoomForBeingTogether")}</span>
          </div>
        </aside>
      </div>
      <div className="notice">
        <Info size={18} />
        <p>
          {tr(
            "cookingTimesAssumeThawedPreparedIngredientsAndTwoBurnersTheyReEstimates",
          )}
        </p>
      </div>
    </>
  );
};
export default WeeklyMenu;
