import {
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Check,
  Clock,
  ShieldCheck,
  Play,
  CheckCircle2,
  Flame,
  Info,
} from "lucide-react";
import { DAYS } from "src/types";
import { isPrepared, round } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { fmt } from "src/utils/formatTime";

interface IProps {}
const CookingSession: React.FC<IProps> = () => {
  const {
    s,
    plan,
    factor,
    meal,
    pos,
    step,
    ready,
    seconds,
    t,
    startTimer,
    navigate,
    update,
    toggle,
    setSelected,
    setToast,
  } = useMealPlanner();
  return (
    <>
      <Heading
        eyebrow="ONE MEAL, ONE STEP AT A TIME"
        title="Let’s make something good."
        description="Choose your meal, check your portions, then follow the prepared-ingredient guide."
      />
      <div className="cook-layout">
        <aside className="meal-picker">
          <span className="eyebrow">CHOOSE YOUR MEAL</span>
          {DAYS.map((d) => (
            <div key={d}>
              <h4>{d}</h4>
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
                      {m.type}
                      <small>{m.main}</small>
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
              {meal.day} · {meal.type} · {s.servings} servings
            </div>
            <h2>{meal.main}</h2>
            <p>{meal.side}</p>
            <details>
              <summary>
                <ShoppingBag size={15} />
                Containers & ingredients
              </summary>
              <div className="ingredient-chips">
                {meal.ingredients.map((i, n) => (
                  <span key={n}>
                    {round(i.qty * factor)} {i.unit} · {i.name}
                  </span>
                ))}
              </div>
              <p className="caption">{meal.thaw}</p>
            </details>
            <label className="readiness">
              <input
                type="checkbox"
                checked={!!s.progress.ready[meal.id]}
                onChange={(e) => toggle("ready", meal.id, e.target.checked)}
              />
              I checked: safely stored, fully thawed and ready to cook.
            </label>
            {!isPrepared(s, meal) && (
              <div className="notice warning">
                <Info size={18} />
                <p>
                  Preparation is not fully confirmed. You can read ahead, but
                  finish prep before marking the meal complete.{" "}
                  <button
                    className="text-button"
                    onClick={() => navigate("prep")}
                  >
                    Review prep
                    <ArrowRight size={13} />
                  </button>
                </p>
              </div>
            )}
            {factor !== 1 && (
              <div className="notice warning">
                Quantities are scaled, but time is not. Use batches if needed
                and check doneness.
              </div>
            )}
          </section>
          <section className="panel cooking-step">
            <div className="step-meta">
              <span className="eyebrow">
                STEP {pos + 1} OF {meal.steps.length}
              </span>
              <span>
                <Flame size={15} />
                Follow heat instructions
              </span>
            </div>
            <progress value={pos + 1} max={meal.steps.length} />
            <div className="step-text">{t(step.text)}</div>
            {step.minutes > 0 && (
              <div className="step-timer">
                <div>
                  <Clock size={20} />
                  <span>
                    <strong>
                      {s.timer?.mealId === meal.id && s.timer.step === pos
                        ? fmt(seconds)
                        : `${step.minutes}:00`}
                    </strong>
                    <small>Suggested timer · check doneness separately</small>
                  </span>
                </div>
                <Button onClick={startTimer}>
                  <Play size={14} />
                  Start timer
                </Button>
              </div>
            )}
            <div className="step-controls">
              <Button
                disabled={pos === 0}
                onClick={() =>
                  update((x) => ({
                    ...x,
                    progress: {
                      ...x.progress,
                      cook: { ...x.progress.cook, [meal.id]: pos - 1 },
                    },
                  }))
                }
              >
                <ArrowLeft size={16} />
                Back
              </Button>
              {pos < meal.steps.length - 1 ? (
                <Button
                  primary
                  onClick={() =>
                    update((x) => ({
                      ...x,
                      progress: {
                        ...x.progress,
                        cook: { ...x.progress.cook, [meal.id]: pos + 1 },
                      },
                    }))
                  }
                >
                  Next step
                  <ArrowRight size={16} />
                </Button>
              ) : (
                <Button
                  primary
                  disabled={!ready || s.progress.done[meal.id]}
                  onClick={() => {
                    toggle("done", meal.id, true);
                    setToast("A good meal, well made. Enjoy!");
                  }}
                >
                  <Check size={17} />
                  {s.progress.done[meal.id] ? "Meal complete" : "Finish meal"}
                </Button>
              )}
            </div>
            <div className="doneness">
              <ShieldCheck size={17} />
              <p>
                Chicken 74°C · ground meat/egg dishes 71°C · fish 63°C ·
                whole-cut pork/beef 63°C + 3-minute rest · shrimp fully opaque.
                A timer is not a safety check.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};
export default CookingSession;
