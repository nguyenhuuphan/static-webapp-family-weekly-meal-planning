import { useState } from "react";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import type { Meal, Ingredient, Step, Unit } from "src/types";
import { validateMealDraft } from "./schema";
import type { Plan } from "src/types";
interface IProps {
  meal: Meal;
  plan: Plan;
  onSave: (m: Meal) => void;
  onCancel: () => void;
}
const MealEditor: React.FC<IProps> = ({ meal, plan, onSave, onCancel }) => {
  const [draft, setDraft] = useState<Meal>(structuredClone(meal)),
    [error, setError] = useState("");
  const field = (k: keyof Meal, v: unknown) =>
    setDraft((s) => ({ ...s, [k]: v }));
  function ingredient(index: number, k: keyof Ingredient, v: string | number) {
    setDraft((s) => ({
      ...s,
      ingredients: s.ingredients.map((i, n) =>
        n === index ? { ...i, [k]: v } : i,
      ),
    }));
  }
  function step(
    kind: "prep" | "steps",
    index: number,
    k: keyof Step,
    v: string | number,
  ) {
    setDraft((s) => ({
      ...s,
      [kind]: s[kind].map((i, n) => (n === index ? { ...i, [k]: v } : i)),
    }));
  }
  function save() {
    const errors = validateMealDraft(plan, meal.id, draft);
    if (errors.length) {
      setError(errors.join("\n"));
      return;
    }
    if (
      confirm(
        "Save changes? Shopping checks and this meal’s prep, readiness and completion will reset. Prepared food does not change automatically.",
      )
    )
      onSave(draft);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            Make it yours · {meal.day} {meal.type}
          </div>
          <h1>Edit your meal.</h1>
          <p>
            Amounts describe {plan.servings} base servings. Keep shopping,
            preparation and cooking instructions consistent.
          </p>
        </div>
        <button onClick={onCancel}>
          <ArrowLeft size={16} />
          Cancel
        </button>
      </div>
      <div className="panel">
        <div className="field-grid">
          <label>
            Main dish
            <input
              value={draft.main}
              onChange={(e) => field("main", e.target.value)}
            />
          </label>
          <label>
            Side or soup
            <input
              value={draft.side}
              onChange={(e) => field("side", e.target.value)}
            />
          </label>
          <label>
            Cooking estimate · minutes
            <input
              type="number"
              min="1"
              max="240"
              value={draft.minutes}
              onChange={(e) => field("minutes", Number(e.target.value))}
            />
          </label>
        </div>
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>Ingredients</h2>
          <button
            className="small"
            onClick={() =>
              field("ingredients", [
                ...draft.ingredients,
                { name: "", qty: 1, unit: "g", category: "Produce" },
              ])
            }
          >
            <Plus size={16} />
            Add ingredient
          </button>
        </div>
        <div className="ingredient-rows">
          {draft.ingredients.map((i, n) => (
            <div className="ingredient-row" key={n}>
              <label>
                Name
                <input
                  aria-label={`Ingredient ${n + 1} name`}
                  value={i.name}
                  onChange={(e) => ingredient(n, "name", e.target.value)}
                />
              </label>
              <label>
                Amount
                <input
                  aria-label={`Ingredient ${n + 1} quantity`}
                  type="number"
                  min="0.01"
                  step="any"
                  value={i.qty}
                  onChange={(e) => ingredient(n, "qty", Number(e.target.value))}
                />
              </label>
              <label>
                Unit
                <select
                  aria-label={`Ingredient ${n + 1} unit`}
                  value={i.unit}
                  onChange={(e) =>
                    ingredient(n, "unit", e.target.value as Unit)
                  }
                >
                  {["g", "ml", "each", "tsp", "tbsp"].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <select
                  value={i.category}
                  onChange={(e) => ingredient(n, "category", e.target.value)}
                >
                  {[
                    ...new Set(["Protein", "Produce", "Pantry", i.category]),
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <button
                className="icon-button danger"
                aria-label={`Remove ingredient ${n + 1}`}
                onClick={() =>
                  field(
                    "ingredients",
                    draft.ingredients.filter((_, j) => j !== n),
                  )
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      </section>
      {(["prep", "steps"] as const).map((kind) => (
        <section className="panel" key={kind}>
          <div className="section-title">
            <div>
              <h2>{kind === "prep" ? "Preparation" : "Cooking"} steps</h2>
              <p className="caption">
                Write [300 g] or [2 tsp] to scale amounts with household size.
                Zero minutes means no timer.
              </p>
            </div>
            <button
              className="small"
              onClick={() =>
                field(kind, [...draft[kind], { text: "", minutes: 0 }])
              }
            >
              <Plus size={16} />
              Add step
            </button>
          </div>
          {draft[kind].map((s, n) => (
            <div className="edit-step" key={n}>
              <span className="number">{n + 1}</span>
              <label>
                Instruction
                <textarea
                  aria-label={`${kind} step ${n + 1}`}
                  value={s.text}
                  onChange={(e) => step(kind, n, "text", e.target.value)}
                />
              </label>
              <label className="minutes-field">
                Timer · min
                <input
                  aria-label={`${kind} timer ${n + 1}`}
                  type="number"
                  min="0"
                  max="240"
                  value={s.minutes}
                  onChange={(e) =>
                    step(kind, n, "minutes", Number(e.target.value))
                  }
                />
              </label>
              <button
                className="icon-button danger"
                aria-label={`Remove ${kind} step ${n + 1}`}
                onClick={() =>
                  field(
                    kind,
                    draft[kind].filter((_, j) => j !== n),
                  )
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </section>
      ))}
      <section className="panel">
        <h2>Storage & thawing</h2>
        <div className="field-grid">
          <label>
            Storage instructions
            <textarea
              value={draft.storage}
              onChange={(e) => field("storage", e.target.value)}
            />
          </label>
          <label>
            Thawing instructions
            <textarea
              value={draft.thaw}
              onChange={(e) => field("thaw", e.target.value)}
            />
          </label>
        </div>
        <div className="notice warning">
          Edited recipes are user-entered. This app validates data structure,
          not food safety or cooking consistency.
        </div>
      </section>
      <div className="save-bar">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" onClick={save}>
          <Save size={17} />
          Save meal
        </button>
      </div>
    </>
  );
};
export default MealEditor;
