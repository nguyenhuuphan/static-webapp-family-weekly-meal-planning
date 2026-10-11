import { useI18n } from "src/i18n";
import { Check, Clock, Snowflake, ShieldCheck } from "lucide-react";

import { isPrepared } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

interface IProps {}
const PrepDay: React.FC<IProps> = () => {
  const { t: tr, content: ct } = useI18n();
  const { s, plan, prepTotal, prepDone, t, navigate, toggle } =
    useMealPlanner();
  return (
    <>
      <Heading
        eyebrow={tr("sundayPrepWeekdayPeace")}
        title={tr("aSofterStartToTheWeek")}
        description={tr(
          "washVegetablesAndPrepareAromaticsFirstThenWorkOnRawProteinsOne",
        )}
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
          <span>{tr("checkEachTaskAsYouFinish")}</span>
        </div>
        <progress value={prepDone} max={prepTotal} />
      </div>
      <div className="notice warning">
        <Snowflake size={19} />
        <p>
          <strong>{tr("keepColdFoodCold")}</strong>{" "}
          {tr("fridge4CFreezer18CFreezeTuesdayFridayProteinsPromptlyMove")}
        </p>
      </div>
      {plan.meals.map((m) => (
        <section className="panel prep-card" key={m.id}>
          <div className="section-title">
            <div>
              <div className="eyebrow">
                {ct(m.day)} · {ct(m.type)}
              </div>
              <h2>{ct(m.main)}</h2>
              <p>{ct(m.side)}</p>
            </div>
            <span className={`pill ${isPrepared(s, m) ? "green" : "amber"}`}>
              {isPrepared(s, m) ? (
                <>
                  <Check size={13} />
                  {tr("prepared")}
                </>
              ) : (
                tr("toPrepare")
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
                aria-label={tr("prepTaskLabel", {
                  day: ct(m.day),
                  type: ct(m.type),
                  count: i + 1,
                })}
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
                <strong>{tr("store")}</strong>
                {ct(m.storage)}
              </span>
            </div>
            <div>
              <Clock size={16} />
              <span>
                <strong>{tr("thaw")}</strong>
                {ct(m.thaw)}
              </span>
            </div>
          </div>
        </section>
      ))}
    </>
  );
};
export default PrepDay;
