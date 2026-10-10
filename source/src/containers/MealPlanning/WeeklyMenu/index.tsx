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
} from "lucide-react";
import { DAYS } from "src/types";
import { isPrepared, dateLabel } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

interface IProps {}
const WeeklyMenu: React.FC<IProps> = () => {
  const { s, plan, doneCount, edit, navigate, cook, toggle } = useMealPlanner();
  return (
    <>
      <Heading
        eyebrow="YOUR WEEKDAY KITCHEN, SIMPLIFIED"
        title="A little planning. A lot more ease."
        description="Ten comforting meals. One thoughtful shopping list. A calmer rhythm for your family."
      >
        <Button onClick={() => navigate("shop")} primary>
          <ShoppingBag size={17} />
          Start shopping
        </Button>
      </Heading>
      <section className="welcome">
        <div className="welcome-copy">
          <span className="pill">
            <Sun size={13} />
            Your five-day rhythm
          </span>
          <h2>
            Less deciding.
            <br />
            More enjoying.
          </h2>
          <p>
            Prep on Sunday, cook through Friday.
            <br />
            We’ll keep the next step close at hand.
          </p>
          <button onClick={() => navigate("prep")}>
            Open your prep guide <ArrowRight size={17} />
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
            <strong>10 meals</strong>
            <small>Monday through Friday</small>
          </div>
        </div>
        <div>
          <span className="metric-icon">
            <Users size={20} />
          </span>
          <div>
            <strong>{s.servings} people</strong>
            <small>At your family table</small>
          </div>
        </div>
        <div>
          <span className="metric-icon">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <strong>{doneCount} / 10 enjoyed</strong>
            <small>A little progress every day</small>
          </div>
        </div>
      </div>
      <div className="section-title">
        <div>
          <span className="eyebrow">WHAT’S COOKING</span>
          <h2>Your week, at a glance.</h2>
        </div>
        <span className="caption">
          Lunch + dinner · rice handled separately
        </span>
      </div>
      <div className="week-grid">
        {DAYS.map((day, index) => (
          <section className="day-block" key={day}>
            <div className="day-title">
              <span className="day-number">0{index + 1}</span>
              <div>
                <h3>{day}</h3>
                <span>{dateLabel(s.weekStart, day)}</span>
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
                        {type}
                      </span>
                      <span>
                        <Clock size={13} />
                        {m.minutes} min
                      </span>
                    </div>
                    <h3>{m.main}</h3>
                    <p>{m.side}</p>
                    <div className="card-bottom">
                      <span
                        className={`pill ${done || (isPrepared(s, m) && s.progress.ready[m.id]) ? "green" : "amber"}`}
                      >
                        {done ? (
                          <>
                            <Check size={12} />
                            Enjoyed
                          </>
                        ) : isPrepared(s, m) && s.progress.ready[m.id] ? (
                          "Ready to cook"
                        ) : isPrepared(s, m) ? (
                          "Check thawing"
                        ) : (
                          "Prep needed"
                        )}
                      </span>
                      <div className="actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${day} ${type}`}
                          onClick={() => edit(m)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button className="text-button" onClick={() => cook(m)}>
                          Cook
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                    {done && (
                      <button
                        className="undo caption"
                        onClick={() => toggle("done", m.id, false)}
                      >
                        Undo completion
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="notice">
        <Info size={18} />
        <p>
          Cooking times assume thawed, prepared ingredients and two burners.
          They’re estimates, not doneness checks. Saturdays and Sundays are
          yours to keep flexible.
        </p>
      </div>
    </>
  );
};
export default WeeklyMenu;
