import { useI18n, useText } from "src/i18n";
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
import { isPrepared, round } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { fmt } from "src/utils/formatTime";

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
  return (
    <>
      <Heading
        eyebrow={tr("oneMealOneStepAtATime")}
        title={tr("letSMakeSomethingGood")}
        description={tr(
          "chooseYourMealCheckYourPortionsThenFollowThePreparedIngredientGuide",
        )}
      />
      <div className="cook-layout">
        <aside className="meal-picker">
          <span className="eyebrow">{tr("chooseYourMeal")}</span>
          {DAYS.map((d) => (
            <div key={d}>
              <h4>{ct(d)}</h4>
              {plan.meals
                .filter((m) => m.day === d)
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
              {tr("servingsCount", { count: s.servings })}
            </div>
            <h2>{ct(meal.main)}</h2>
            <p>{ct(meal.side)}</p>
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
                      <li key={index}>{t(task.text)}</li>
                    ) : null,
                  )}
                </ul>
              </div>
            )}
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
                <li key={`${meal.id}:${index}`} className={pos === index ? "current-instruction" : ""}>
                  <Button aria-pressed={pos === index} onClick={() => update((state) => ({ ...state, progress: { ...state.progress, cook: { ...state.progress.cook, [meal.id]: index } } }))}>
                    {pos === index ? text("Đang làm bước này", "Current step") : text("Đánh dấu đang làm", "Mark as current")}
                  </Button>
                  <div className="step-text">{t(step.text)}</div>
                  {step.minutes > 0 && (
                    <div className="step-timer">
                      <div>
                        <Clock size={20} />
                        <span>
                          <strong>
                            {s.timer?.mealId === meal.id &&
                            s.timer.step === index
                              ? fmt(seconds)
                              : `${step.minutes}:00`}
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
              {!ready && !s.progress.done[meal.id] && <p role="status">
                {!isPrepared(s, meal)
                  ? text("Còn phần chưa sơ chế. Hãy xem lại sơ chế trước khi hoàn thành bữa ăn.", "Some portions still need preparation. Review prep before finishing this meal.")
                  : text("Hãy xác nhận thực phẩm đã bảo quản đúng và rã đông ở đầu trang.", "Confirm safe storage and thawing at the top of this page.")}
                <Button onClick={() => !isPrepared(s, meal) ? navigate("prep") : document.querySelector<HTMLInputElement>(".readiness input")?.focus()}>
                  {text("Kiểm tra ngay", "Review now")}
                </Button>
              </p>}
              <Button
                primary
                disabled={!ready || !!s.progress.done[meal.id]}
                onClick={() => {
                  toggle("done", meal.id, true);
                  setToast(source("aGoodMealWellMadeEnjoy"));
                }}
              >
                <Check size={17} />
                {s.progress.done[meal.id]
                  ? tr("mealComplete")
                  : tr("finishMeal")}
              </Button>
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
