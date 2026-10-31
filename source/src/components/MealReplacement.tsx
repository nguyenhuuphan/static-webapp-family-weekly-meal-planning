import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Check, Clock, X } from "lucide-react";
import type { Meal, Plan } from "src/types";
import { useI18n, useText } from "src/i18n";
import { createTranslator } from "src/i18n/translate";
import { COOKING_EQUIPMENT } from "src/ai/contracts";
import { Button } from "src/modules/shared-main/components";
import AllergyWarnings from "src/modules/shared-main/components/AllergyWarnings";

export default function MealReplacement({
  plan,
  meal,
  disabled,
  onReplace,
}: {
  plan: Plan;
  meal: Meal;
  disabled?: boolean;
  onReplace: (id: string) => boolean | Promise<boolean>;
}) {
  const text = useText(),
    { content } = useI18n();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!plan.alternatives?.length) return null;
  return (
    <>
      <button
        ref={trigger}
        className="text-button meal-replace-trigger"
        disabled={disabled}
        aria-label={text(
          `Đổi món: ${content(meal.day)} ${content(meal.type)}`,
          `Replace meal: ${content(meal.day)} ${content(meal.type)}`,
        )}
        onClick={() => setOpen(true)}
      >
        <ArrowLeftRight size={15} aria-hidden="true" />
        {text("Đổi món", "Replace meal")}
      </button>
      {open && (
        <ReplacementDialog
          plan={plan}
          meal={meal}
          onReplace={onReplace}
          close={() => {
            setOpen(false);
            requestAnimationFrame(() => trigger.current?.focus());
          }}
        />
      )}
    </>
  );
}
function ReplacementDialog({
  plan,
  meal,
  close,
  onReplace,
}: {
  plan: Plan;
  meal: Meal;
  close: () => void;
  onReplace: (id: string) => boolean | Promise<boolean>;
}) {
  const text = useText(),
    { language, content } = useI18n();
  const recipes = useMemo(
    () => createTranslator(language, false, plan.translations?.vi),
    [language, plan],
  );
  const [selected, select] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId(),
    radioName = useId();
  const busyRef = useRef(false);
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    const cancel = (event: Event) => {
      event.preventDefault();
      if (!busyRef.current) close();
    };
    node.addEventListener("cancel", cancel);
    return () => {
      node.removeEventListener("cancel", cancel);
      node.close();
    };
  }, []);
  const chosen = plan.alternatives?.find((m) => m.id === selected);
  async function apply() {
    if (!chosen || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(false);
    try {
      if (await onReplace(chosen.id)) close();
      else setError(true);
    } catch {
      setError(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="meal-replacement-dialog"
      aria-labelledby={titleId}
    >
      <div className="replacement-header">
        <div>
          <span className="eyebrow">
            {content(meal.day)} · {content(meal.type)}
          </span>
          <h2 id={titleId}>
            {text("Chọn món thay thế", "Choose a replacement")}
          </h2>
        </div>
        <Button
          disabled={busy}
          aria-label={text("Đóng", "Close replacement")}
          onClick={close}
        >
          <X size={20} />
        </Button>
      </div>
      <div className="replacement-current">
        <small>{text("Món hiện tại", "Currently planned")}</small>
        <strong>{recipes.content(meal.main)}</strong>
        <span>{recipes.content(meal.side)}</span>
      </div>
      <p>
        {text(
          "Chọn 1 món trong 5 gợi ý đã có. Không cần gọi lại AI. Món cũ sẽ trở thành một lựa chọn để bạn có thể đổi lại.",
          "Choose from five ready recipes. No new AI request. The current recipe becomes an alternative so you can swap it back.",
        )}
      </p>
      <fieldset className="replacement-options" disabled={busy}>
        <legend className="replacement-legend">
          {text("Món thay thế", "Alternative recipes")}
        </legend>
        {plan.alternatives?.map((option) => (
          <article
            className={`replacement-option ${selected === option.id ? "selected" : ""}`}
            key={option.id}
          >
            <label className="replacement-choice">
              <input
                type="radio"
                name={radioName}
                value={option.id}
                checked={selected === option.id}
                onChange={() => {
                  select(option.id);
                  setError(false);
                }}
              />
              <span>
                <strong>{recipes.content(option.main)}</strong>
                <span>{recipes.content(option.side)}</span>
              </span>
              {selected === option.id && <Check size={19} aria-hidden="true" />}
            </label>
            <div className="replacement-meta">
              <span>
                <Clock size={14} aria-hidden="true" />
                {option.minutes} {text("phút", "min")}
              </span>
              <span>
                {(option.equipment || [])
                  .map((e) => {
                    const item = COOKING_EQUIPMENT.find((v) => v[0] === e);
                    return item ? text(item[1], item[2]) : e;
                  })
                  .join(" · ")}
              </span>
            </div>
            <AllergyWarnings ingredients={option.ingredients} />
            <details>
              <summary>
                {text(
                  "Xem nguyên liệu và cách nấu",
                  "View ingredients and method",
                )}
              </summary>
              <p className="caption">
                {text("Định lượng cho", "Quantities for")} {plan.servings}{" "}
                {text("người", "people")}
              </p>
              <ul>
                {option.ingredients.map((i, n) => (
                  <li key={n}>
                    {recipes.content(i.name)}: {i.qty} {i.unit}
                  </li>
                ))}
              </ul>
              <h3>{text("Sơ chế", "Preparation")}</h3>
              <ol>
                {option.prep.map((s, n) => (
                  <li key={n}>{recipes.instruction(s.text, 1)}</li>
                ))}
              </ol>
              <h3>{text("Chế biến", "Cooking")}</h3>
              <ol>
                {option.steps.map((s, n) => (
                  <li key={n}>{recipes.instruction(s.text, 1)}</li>
                ))}
              </ol>
              <p>{recipes.content(option.storage)}</p>
              <p>{recipes.content(option.thaw)}</p>
            </details>
          </article>
        ))}
      </fieldset>
      <p className="caption">
        {text(
          "Chỉ bữa này được thay đổi. Danh sách mua sắm và sơ chế sẽ cập nhật; thực phẩm đang có vẫn được giữ.",
          "Only this meal changes. Shopping and preparation update; food you already have is retained.",
        )}
      </p>
      {error && (
        <p role="alert">
          {text(
            "Chưa lưu được. Hãy kiểm tra kết nối hoặc thay đổi từ thiết bị khác rồi thử lại.",
            "Could not save. Check your connection or changes from another device, then retry.",
          )}
        </p>
      )}
      <footer className="replacement-footer">
        <p role="status">
          {chosen
            ? recipes.content(chosen.main)
            : text("Chọn món để tiếp tục", "Select a recipe to continue")}
        </p>
        <div className="actions">
          <Button disabled={busy} onClick={close}>
            {text("Hủy", "Cancel")}
          </Button>
          <Button
            primary
            disabled={!chosen || busy}
            onClick={() => void apply()}
          >
            {busy
              ? text("Đang lưu…", "Saving…")
              : text("Thay bữa này", "Replace this meal")}
          </Button>
        </div>
      </footer>
    </dialog>
  );
}
