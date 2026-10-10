import { Check, Clock, Snowflake, ShieldCheck } from "lucide-react";

import { isPrepared } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

interface IProps {}
const PrepDay: React.FC<IProps> = () => {
  const { s, plan, prepTotal, prepDone, t, navigate, toggle } =
    useMealPlanner();
  return (
    <>
      <Heading
        eyebrow="SUNDAY PREP, WEEKDAY PEACE"
        title="A softer start to the week."
        description="Wash vegetables and prepare aromatics first. Then work on raw proteins, one cold batch at a time."
      >
        <Button onClick={() => navigate("safety")}>
          <ShieldCheck size={17} />
          Safety notes
        </Button>
      </Heading>
      <div className="progress-panel">
        <div>
          <strong>
            {prepDone} of {prepTotal} tasks prepared
          </strong>
          <span>Check each task as you finish</span>
        </div>
        <progress value={prepDone} max={prepTotal} />
      </div>
      <div className="notice warning">
        <Snowflake size={19} />
        <p>
          <strong>Keep cold food cold.</strong> Fridge ≤4°C, freezer ≤−18°C.
          Freeze Tuesday–Friday proteins promptly. Move next-day proteins and
          sauces to the fridge each morning. Never thaw on the counter.
        </p>
      </div>
      {plan.meals.map((m) => (
        <section className="panel prep-card" key={m.id}>
          <div className="section-title">
            <div>
              <div className="eyebrow">
                {m.day} · {m.type}
              </div>
              <h2>{m.main}</h2>
              <p>{m.side}</p>
            </div>
            <span className={`pill ${isPrepared(s, m) ? "green" : "amber"}`}>
              {isPrepared(s, m) ? (
                <>
                  <Check size={13} />
                  Prepared
                </>
              ) : (
                "To prepare"
              )}
            </span>
          </div>
          {m.prep.map((task, i) => (
            <label
              className={`prep-row ${s.progress.prep[m.id + ":" + i] ? "checked" : ""}`}
              key={i}
            >
              <input
                type="checkbox"
                aria-label={`${m.day} ${m.type} prep ${i + 1}`}
                checked={!!s.progress.prep[m.id + ":" + i]}
                onChange={(e) =>
                  toggle("prep", m.id + ":" + i, e.target.checked)
                }
              />
              <span>{t(task.text)}</span>
            </label>
          ))}
          <div className="storage-grid">
            <div>
              <Snowflake size={16} />
              <span>
                <strong>Store</strong>
                {m.storage}
              </span>
            </div>
            <div>
              <Clock size={16} />
              <span>
                <strong>Thaw</strong>
                {m.thaw}
              </span>
            </div>
          </div>
        </section>
      ))}
    </>
  );
};
export default PrepDay;
