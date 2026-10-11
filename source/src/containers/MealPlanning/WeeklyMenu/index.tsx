import { useI18n } from "src/i18n";
import TableIllustration from "src/assets/TableIllustration";
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
import { isPrepared } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

interface IProps {}
const WeeklyMenu: React.FC<IProps> = () => {
  const { t: tr, content: ct, number: num, date: localizedDate } = useI18n();
  const { s, plan, doneCount, edit, navigate, cook, toggle } = useMealPlanner();
  return (
    <>
      <Heading
        eyebrow={tr("yourWeekdayKitchenSimplified")}
        title={tr("aLittlePlanningALotMoreEase")}
        description={tr(
          "tenComfortingMealsOneThoughtfulShoppingListACalmerRhythmForYour",
        )}
      >
        <Button onClick={() => navigate("shop")} primary>
          <ShoppingBag size={17} />
          {tr("startShopping")}
        </Button>
      </Heading>
      <section className="welcome">
        <div className="welcome-copy">
          <span className="pill">
            <Sun size={13} />
            {tr("yourFiveDayRhythm")}
          </span>
          <h2>
            {tr("lessDeciding")}
            <br />
            {tr("moreEnjoying")}
          </h2>
          <p>
            {tr("prepOnSundayCookThroughFriday")}
            <br />
            {tr("weLlKeepTheNextStepCloseAtHand")}
          </p>
          <button onClick={() => navigate("prep")}>
            {tr("openYourPrepGuide")} <ArrowRight size={17} />
          </button>
        </div>
        <TableIllustration />
      </section>
      <div className="metric-grid">
        <div>
          <span className="metric-icon">
            <CalendarDays size={20} />
          </span>
          <div>
            <strong>{tr("mealCount", { count: plan.meals.length })}</strong>
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
                total: plan.meals.length,
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
          <div className="week-grid">
            {DAYS.map((day, index) => (
              <section className="day-block" key={day}>
                <div className="day-title">
                  <span className="day-number">0{index + 1}</span>
                  <div>
                    <h3>{ct(day)}</h3>
                    <span>{localizedDate(s.weekStart, day)}</span>
                  </div>
                </div>
                <div className="day-meals">
                  {(["Lunch", "Dinner"] as const).map((type) => {
                    const m = plan.meals.find(
                      (x) => x.day === day && x.type === type,
                    )!;
                    const done = s.progress.done[m.id];
                    return (
                      <article
                        className={`meal-card ${done ? "complete" : ""}`}
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
                            {done ? (
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
                              onClick={() => edit(m)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="text-button"
                              onClick={() => cook(m)}
                            >
                              {tr("cook")}
                              <ArrowRight size={16} />
                            </button>
                          </div>
                        </div>
                        {done && (
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
              <span>{tr("of10MealsEnjoyed")}</span>
            </div>
            <progress
              value={doneCount}
              max={10}
              aria-label={tr("mealsEnjoyedThisWeek")}
            />
            <p>
              {doneCount === 10
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
