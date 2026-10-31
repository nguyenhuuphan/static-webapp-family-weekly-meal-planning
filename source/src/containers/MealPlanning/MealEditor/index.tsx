import { createTranslator } from "src/i18n/translate";
import AllergyWarnings from "src/modules/shared-main/components/AllergyWarnings";
import PreparationLinks from "src/modules/shared-main/components/PreparationLinks";
import { useI18n, useText } from "src/i18n";
import { useEffect, useState, useRef, useMemo } from "react";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import type { Meal, Ingredient, Step, Unit } from "src/types";
import { validateMealDraft } from "./schema";
import type { Plan } from "src/types";
interface IProps {
  meal: Meal;
  plan: Plan;
  onSave: (m: Meal) => void | boolean | Promise<void | boolean>;
  confirmSave?: boolean;
  embedded?: boolean;
  onCancel: () => void;
  draftNamespace?: string;
}
const MealEditor: React.FC<IProps> = ({
  meal,
  plan,
  onSave,
  onCancel,
  draftNamespace = "meal-draft",
  confirmSave = true,
  embedded = false,
}) => {
  const text = useText();
  const Title = embedded ? "h4" : "h1";
  const SectionHeading = embedded ? "h5" : "h2";
  const editor = useRef<HTMLDivElement>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingGuard = useRef(false);
  const draftKey = `${draftNamespace}:${meal.id}`;
  const { t: tr, language, unit, error: translateError } = useI18n();
  // Keep input values stable while the user types; translate saved content only.
  const { content: ct } = useMemo(() => createTranslator(language), [language]);
  const [draft, setDraft] = useState<Meal>(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(draftKey) || "null");
        if (saved?.baseline === JSON.stringify(meal)) return saved.draft;
      } catch {
        /* Draft persistence is optional. */
      }
      return structuredClone(meal);
    }),
    [error, setError] = useState("");
  const stepKeys = useRef<Record<"prep" | "steps", string[]> | null>(null);
  if (!stepKeys.current)
    stepKeys.current = {
      prep: draft.prep.map(() => crypto.randomUUID()),
      steps: draft.steps.map(() => crypto.randomUUID()),
    };
  const dirty = JSON.stringify(draft) !== JSON.stringify(meal);
  useEffect(() => {
    const heading = editor.current?.querySelector<HTMLElement>(
      "[data-editor-heading]",
    );
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: "start" });
  }, []);
  useEffect(() => {
    if (!attempted || !editor.current) return;
    setError(validateMealDraft(plan, meal.id, draft).join("\n"));
    const messages: HTMLElement[] = [];
    editor.current
      .querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >("input, textarea, select")
      .forEach((control, index) => {
        const optional = control.hasAttribute("data-optional");
        const invalid =
          !optional && (!control.value.trim() || !control.validity.valid);
        control.setAttribute("aria-invalid", String(invalid));
        if (invalid) {
          const message = document.createElement("span");
          message.id = `editor-error-${index}`;
          message.className = "error field-error";
          message.textContent = text(
            "Nhập giá trị hợp lệ cho trường này.",
            "Enter a valid value for this field.",
          );
          control.setAttribute("aria-describedby", message.id);
          control.insertAdjacentElement("afterend", message);
          messages.push(message);
        } else control.removeAttribute("aria-describedby");
      });
    return () => messages.forEach((message) => message.remove());
  }, [attempted, draft, text, plan, meal.id]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ baseline: JSON.stringify(meal), draft }),
      );
    } catch {
      /* Keep editing in memory. */
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [draft, draftKey, dirty, meal]);
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
  async function save() {
    if (savingGuard.current) return;
    setAttempted(true);
    const errors = validateMealDraft(plan, meal.id, draft);
    if (errors.length) {
      setError(errors.join("\n"));
      setTimeout(() => {
        const first = editor.current?.querySelector<HTMLElement>(
          '[aria-invalid="true"]',
        );
        first?.focus();
        first?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      }, 0);
      return;
    }
    if (
      !confirmSave ||
      confirm(
        tr("saveChangesShoppingChecksAndThisMealSPrepReadinessAndCompletion"),
      )
    ) {
      savingGuard.current = true;
      setSaving(true);
      setError("");
      const failed = () =>
        setError(
          text(
            "Chưa lưu được thay đổi. Bản nháp vẫn được giữ; hãy kiểm tra kết nối và thử lưu lại.",
            "Could not save your changes. Your draft is retained; check the connection and try saving again.",
          ),
        );
      try {
        const result = onSave(draft);
        const resolved =
          result && typeof (result as Promise<unknown>).then === "function"
            ? await result
            : result;
        if (resolved === false) {
          failed();
          return;
        }
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          /* Optional draft storage. */
        }
      } catch {
        failed();
      } finally {
        savingGuard.current = false;
        setSaving(false);
      }
    }
  }
  return (
    <div
      ref={editor}
      className="meal-editor"
      data-embedded={embedded || undefined}
    >
      <div className="page-heading meal-editor-heading">
        <div>
          <div className="eyebrow">
            {tr("makeItYours")} {ct(meal.day)} {ct(meal.type)}
          </div>
          <Title data-editor-heading tabIndex={-1}>
            {tr("editYourMeal")}
          </Title>
          <p>{tr("baseServingsHelp", { count: plan.servings })}</p>
          <p className="caption">{tr("sourceRecipeHelp")}</p>
        </div>
      </div>
      <fieldset
        className="meal-editor-body"
        disabled={saving}
        aria-label={text("Nội dung bữa ăn", "Meal details")}
      >
        <div className="panel">
          {dirty && (
            <p role="status">
              {text(
                "Bản nháp được giữ trong phiên này khi chuyển trang.",
                "Your draft is kept in this session when you switch pages.",
              )}
            </p>
          )}
          <div className="field-grid meal-editor-fields">
            <label className="meal-main-field">
              {tr("mainDish")}
              <input
                aria-label={tr("mainDish")}
                value={ct(draft.main)}
                onChange={(e) => field("main", e.target.value)}
              />
            </label>
            <label>
              {tr("sideOrSoup")}
              <input
                aria-label={tr("sideOrSoup")}
                value={ct(draft.side)}
                onChange={(e) => field("side", e.target.value)}
              />
            </label>
            <label className="meal-time-field">
              {tr("cookingEstimateMinutes")}
              <input
                aria-label={tr("cookingEstimateMinutes")}
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
            <SectionHeading>{tr("ingredients")}</SectionHeading>
            <button
              className="small"
              onClick={() =>
                field("ingredients", [
                  ...draft.ingredients,
                  {
                    id: crypto.randomUUID(),
                    name: "",
                    qty: 1,
                    unit: "g",
                    category: "Produce",
                  },
                ])
              }
            >
              <Plus size={16} />
              {tr("addIngredient")}
            </button>
          </div>
          <div className="ingredient-rows">
            {draft.ingredients.map((i, n) => (
              <div className="ingredient-row" key={i.id || n}>
                <label className="ingredient-name">
                  {tr("name")}
                  <input
                    aria-label={tr("ingredientNameLabel", { count: n + 1 })}
                    value={ct(i.name)}
                    onChange={(e) => ingredient(n, "name", e.target.value)}
                  />
                </label>
                <label className="ingredient-quantity">
                  {tr("amount")}
                  <input
                    aria-label={tr("ingredientQuantityLabel", { count: n + 1 })}
                    type="number"
                    min="0.01"
                    step="any"
                    value={i.qty}
                    onChange={(e) =>
                      ingredient(n, "qty", Number(e.target.value))
                    }
                  />
                </label>
                <label className="ingredient-unit">
                  {tr("unit")}
                  <select
                    aria-label={tr("ingredientUnitLabel", { count: n + 1 })}
                    value={i.unit}
                    onChange={(e) =>
                      ingredient(n, "unit", e.target.value as Unit)
                    }
                  >
                    {["g", "ml", "each", "tsp", "tbsp"].map((u) => (
                      <option key={u} value={u}>
                        {unit(u)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ingredient-category">
                  {tr("category")}
                  <select
                    value={i.category}
                    onChange={(e) => ingredient(n, "category", e.target.value)}
                  >
                    {[
                      ...new Set(["Protein", "Produce", "Pantry", i.category]),
                    ].map((c) => (
                      <option key={c} value={c}>
                        {ct(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <details className="ingredient-options">
                  <summary>
                    {text("Dị ứng (tùy chọn)", "Allergens (optional)")}
                    {i.allergenTags?.length
                      ? ` · ${i.allergenTags.length}`
                      : ""}
                  </summary>
                  <label>
                    {text(
                      "Thành phần dị ứng từ nhãn (tùy chọn)",
                      "Allergen tags from label (optional)",
                    )}
                    <input
                      data-optional
                      defaultValue={(i.allergenTags || []).join(", ")}
                      onBlur={(e) =>
                        setDraft((s) => ({
                          ...s,
                          ingredients: s.ingredients.map((item, j) =>
                            j === n
                              ? {
                                  ...item,
                                  allergenTags: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }
                              : item,
                          ),
                        }))
                      }
                    />
                  </label>
                </details>
                <button
                  className="icon-button danger"
                  aria-label={tr("removeIngredientLabel", { count: n + 1 })}
                  onClick={() =>
                    setDraft((s) => ({
                      ...s,
                      ingredients: s.ingredients.filter((_, j) => j !== n),
                      prep: s.prep.map((p) => ({
                        ...p,
                        ingredients: p.ingredients?.filter(
                          (ref) => ref.ingredientId !== i.id,
                        ),
                      })),
                    }))
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        </section>
        <AllergyWarnings ingredients={draft.ingredients} />
        {(["prep", "steps"] as const).map((kind) => (
          <section className="panel" key={kind}>
            <div className="section-title">
              <div>
                <SectionHeading>
                  {tr(kind === "prep" ? "prepSteps" : "cookSteps")}
                </SectionHeading>
                <p className="caption">
                  {tr("write300GOr2TspToScaleAmountsWithHouseholdSize")}
                </p>
              </div>
              <button
                className="small"
                onClick={() => {
                  stepKeys.current![kind].push(crypto.randomUUID());
                  field(kind, [...draft[kind], { text: "", minutes: 0 }]);
                }}
              >
                <Plus size={16} />
                {tr("addStep")}
              </button>
            </div>
            {draft[kind].map((s, n) => (
              <div className="edit-step" key={stepKeys.current![kind][n]}>
                <div className="edit-step-heading">
                  <span className="number" aria-hidden="true">
                    {n + 1}
                  </span>
                  <strong>
                    {kind === "prep"
                      ? text("Sơ chế", "Preparation")
                      : text("Nấu ăn", "Cooking")}
                  </strong>
                  <button
                    className="icon-button danger"
                    aria-label={tr("removeStepLabel", {
                      kind: tr(
                        kind === "prep" ? "stepKindPrep" : "stepKindCook",
                      ),
                      count: n + 1,
                    })}
                    onClick={() => {
                      stepKeys.current![kind].splice(n, 1);
                      field(
                        kind,
                        draft[kind].filter((_, j) => j !== n),
                      );
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="edit-step-instruction">
                  <label>
                    {tr("instruction")}
                    <textarea
                      aria-label={tr("instructionLabel", {
                        kind: tr(
                          kind === "prep" ? "stepKindPrep" : "stepKindCook",
                        ),
                        count: n + 1,
                      })}
                      value={ct(s.text)}
                      onChange={(e) => step(kind, n, "text", e.target.value)}
                    />
                  </label>
                  <label className="ingredient-insert-label">
                    <span>
                      {text(
                        "Thêm định lượng vào hướng dẫn",
                        "Add an ingredient amount",
                      )}
                    </span>
                    <select
                      data-optional
                      aria-label={
                        text(
                          "Chèn nguyên liệu vào bước",
                          "Insert ingredient into step",
                        ) + ` ${n + 1}`
                      }
                      value=""
                      onChange={(event) => {
                        const item =
                          draft.ingredients[Number(event.target.value)];
                        if (!item) return;
                        const area = event.currentTarget
                          .closest(".edit-step")
                          ?.querySelector("textarea");
                        const current = ct(s.text);
                        const start = area?.selectionStart ?? current.length;
                        const end = area?.selectionEnd ?? start;
                        const insertion = `[${item.qty} ${item.unit}] ${ct(item.name)}`;
                        step(
                          kind,
                          n,
                          "text",
                          current.slice(0, start) +
                            insertion +
                            current.slice(end),
                        );
                        setTimeout(() => {
                          area?.focus();
                          area?.setSelectionRange(
                            start + insertion.length,
                            start + insertion.length,
                          );
                        }, 0);
                      }}
                    >
                      <option value="">
                        {text(
                          "+ Chèn nguyên liệu và định lượng",
                          "+ Insert ingredient and amount",
                        )}
                      </option>
                      {draft.ingredients.map((item, index) => (
                        <option key={index} value={index}>
                          {ct(item.name)} · {item.qty} {unit(item.unit)}
                        </option>
                      ))}
                    </select>
                    <small>
                      {text(
                        "Lượng được chèn sẽ tự đổi theo khẩu phần khi xem hướng dẫn.",
                        "Inserted amounts scale automatically with servings in the instructions.",
                      )}
                    </small>
                  </label>
                </div>
                <label className="minutes-field">
                  {tr("timerMin")}
                  <input
                    aria-label={tr("timerLabel", {
                      kind: tr(
                        kind === "prep" ? "stepKindPrep" : "stepKindCook",
                      ),
                      count: n + 1,
                    })}
                    type="number"
                    min="0"
                    max="240"
                    value={s.minutes}
                    onChange={(e) =>
                      step(kind, n, "minutes", Number(e.target.value))
                    }
                  />
                </label>
                {kind === "prep" && (
                  <PreparationLinks
                    meal={draft}
                    task={s}
                    onChange={(refs) =>
                      setDraft((d) => ({
                        ...d,
                        prep: d.prep.map((p, index) =>
                          index === n ? { ...p, ingredients: refs } : p,
                        ),
                      }))
                    }
                  />
                )}
                {kind === "prep" && (
                  <details className="prep-portion-options">
                    <summary>
                      {text(
                        "Nhãn hộp và bảo quản riêng (tùy chọn)",
                        "Container and portion storage (optional)",
                      )}
                    </summary>
                    <div className="field-grid">
                      <label>
                        {text(
                          "Nhãn hộp (tùy chọn)",
                          "Container label (optional)",
                        )}
                        <input
                          data-optional
                          value={s.label || ""}
                          onChange={(e) =>
                            step(kind, n, "label", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        {text(
                          "Bảo quản riêng phần này (tùy chọn)",
                          "Storage for this portion (optional)",
                        )}
                        <textarea
                          data-optional
                          value={s.storage || ""}
                          onChange={(e) =>
                            step(kind, n, "storage", e.target.value)
                          }
                        />
                      </label>
                    </div>
                  </details>
                )}
              </div>
            ))}
          </section>
        ))}
        <section className="panel">
          <SectionHeading>{tr("storageThawing")}</SectionHeading>
          <div className="field-grid">
            <label>
              {tr("storageInstructions")}
              <textarea
                aria-label={tr("storageInstructions")}
                value={ct(draft.storage)}
                onChange={(e) => field("storage", e.target.value)}
              />
            </label>
            <label>
              {tr("thawingInstructions")}
              <textarea
                aria-label={tr("thawingInstructions")}
                value={ct(draft.thaw)}
                onChange={(e) => field("thaw", e.target.value)}
              />
            </label>
          </div>
          <div className="notice warning">
            {tr(
              "editedRecipesAreUserEnteredThisAppValidatesDataStructureNotFood",
            )}
          </div>
        </section>
      </fieldset>
      <div className="save-bar" aria-busy={saving}>
        {error && (
          <p className="error" role="alert">
            {translateError(error)}
          </p>
        )}
        <button type="button" onClick={onCancel} disabled={saving}>
          <ArrowLeft size={16} />
          {tr("cancel")}
        </button>
        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={saving}
        >
          <Save size={17} />
          {saving ? text("Đang lưu…", "Saving…") : tr("saveMeal")}
        </button>
      </div>
    </div>
  );
};
export default MealEditor;
