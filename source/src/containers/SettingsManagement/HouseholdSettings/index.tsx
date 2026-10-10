import {
  ArrowRight,
  Users,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Pencil,
} from "lucide-react";

import { freshProgress, isMonday } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

interface IProps {}
const HouseholdSettings: React.FC<IProps> = () => {
  const {
    s,
    plan,
    edit,
    navigate,
    update,
    resetProgress,
    applyPlan,
    exportJSON,
    importJSON,
    defaults,
    setAdvanced,
    setJson,
    setJsonError,
    setToast,
  } = useMealPlanner();
  return (
    <>
      <Heading
        eyebrow="YOUR KITCHEN, YOUR WAY"
        title="Make room for your favourites."
        description="Edit recipes, adjust your household and keep a backup. No account or backend needed."
      />
      <div className="settings-grid">
        <section className="panel">
          <span className="tile-icon">
            <Users size={22} />
          </span>
          <h2>Your household</h2>
          <label>
            People per meal
            <input
              aria-label="People per meal"
              type="number"
              min="1"
              max="12"
              value={s.servings}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isInteger(n) || n < 1 || n > 12) return;
                if (
                  n !== s.servings &&
                  confirm(
                    "Change servings? All progress resets because prepared quantities may no longer match.",
                  )
                )
                  update((x) => ({
                    ...x,
                    servings: n,
                    progress: freshProgress(),
                    timer: null,
                  }));
              }}
            />
          </label>
          <p className="caption">
            Ingredients and bracketed instruction amounts scale together. Egg
            counts may be fractional; round appropriately. Larger portions can
            take longer.
          </p>
          <label>
            Week beginning · Monday
            <input
              aria-label="Week beginning"
              type="date"
              value={s.weekStart}
              onChange={(e) => {
                const v = e.target.value;
                if (!isMonday(v)) {
                  setToast("Please choose a Monday.");
                  return;
                }
                if (
                  confirm(
                    "Start a new week with this menu and fresh checklists?",
                  )
                )
                  update((x) => ({
                    ...x,
                    weekStart: v,
                    progress: freshProgress(),
                    timer: null,
                  }));
              }}
            />
          </label>
          <Button onClick={resetProgress}>
            <RotateCcw size={15} />
            Reset weekly progress
          </Button>
        </section>
        <section className="panel">
          <span className="tile-icon">
            <Download size={22} />
          </span>
          <h2>Your data, kept simple.</h2>
          <p>
            Saved in this browser only. No automatic sync between devices.
            Export to back up or share with family.
          </p>
          <div className="actions">
            <Button primary onClick={exportJSON}>
              <Download size={16} />
              Export JSON
            </Button>
            <label className="file-button">
              <Upload size={16} />
              Import JSON
              <input
                aria-label="Import JSON"
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  void importJSON(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="caption">
            Backups include edited recipes and servings, not checklists or
            timers. Import replaces the current menu after confirmation.
          </p>
          <Button
            className="danger"
            onClick={() => {
              if (
                confirm(
                  "Restore the original ten meals? Your recipe edits and progress will be replaced.",
                )
              )
                applyPlan(structuredClone(defaults), defaults.servings);
            }}
          >
            <RotateCcw size={15} />
            Restore original menu
          </Button>
        </section>
      </div>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Edit your recipes</h2>
            <p>Names, ingredients and step-by-step guides. All in one place.</p>
          </div>
          <Button
            onClick={() => {
              setJson(JSON.stringify(plan, null, 2));
              setJsonError("");
              setAdvanced(true);
            }}
          >
            Advanced JSON
          </Button>
        </div>
        <div className="recipe-list">
          {plan.meals.map((m) => (
            <button key={m.id} onClick={() => edit(m)}>
              <span className="recipe-label">
                {m.day.slice(0, 3)}
                <small>{m.type}</small>
              </span>
              <span>
                <strong>{m.main}</strong>
                <small>{m.side}</small>
              </span>
              <Pencil size={16} />
            </button>
          ))}
        </div>
      </section>
      <div className="notice">
        <ShieldCheck size={19} />
        <p>
          Recipe edits reset affected progress. User-edited storage and cooking
          instructions are not verified safe.{" "}
          <button className="text-button" onClick={() => navigate("safety")}>
            Read safety notes
            <ArrowRight size={14} />
          </button>
        </p>
      </div>
    </>
  );
};
export default HouseholdSettings;
