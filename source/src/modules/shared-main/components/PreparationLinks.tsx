import { useEffect, useState } from "react";
import { validatePreparationLinks } from "src/validations";
import type { Meal, Step } from "src/types";
import { useI18n, useText } from "src/i18n";

export default function PreparationLinks({
  meal,
  task,
  onChange,
}: {
  meal: Meal;
  task: Step;
  onChange: (refs: NonNullable<Step["ingredients"]>) => void;
}) {
  const text = useText(),
    { content: ct, unit } = useI18n();
  const [refs, setRefs] = useState(task.ingredients || []);
  const [error, setError] = useState("");
  useEffect(() => setRefs(task.ingredients || []), [task.ingredients]);
  const save = () => {
    const updated = {
      ...meal,
      prep: meal.prep.map((p) =>
        p === task ? { ...p, ingredients: refs } : p,
      ),
    };
    const errors = validatePreparationLinks(updated);
    if (errors.length) {
      setError(
        text(
          "Lượng phân bổ không hợp lệ hoặc vượt lượng công thức. Mỗi lượng chỉ phân bổ một lần.",
          "Invalid allocation or recipe quantity exceeded. Allocate each quantity only once.",
        ),
      );
      return;
    }
    onChange(refs);
    setError("");
  };
  return (
    <details className="preparation-links">
      <summary>
        {text(
          "Phân bổ nguyên liệu để dùng cho bữa khác (tùy chọn)",
          "Allocate ingredients for another meal (optional)",
        )}
      </summary>
      <p className="caption">
        {text(
          "Chỉ cần khi để dành phần đã sơ chế cho bữa khác. Chọn nguyên liệu và lượng thực tế đã chuẩn bị, theo công thức gốc; mỗi lượng chỉ ghi một lần. Không cần thao tác này để hoàn tất bước sơ chế.",
          "Use this only when saving prepared ingredients for another meal. Record the actual prepared amount at the recipe base servings, once per quantity. This is not required to complete preparation.",
        )}
      </p>
      {meal.ingredients.map((i) => {
        const ref = refs.find((r) => r.ingredientId === i.id);
        return (
          <div key={i.id} className="ingredient-link-row">
            <label className="ingredient-link-choice">
              <input
                data-optional
                type="checkbox"
                checked={!!ref}
                onChange={(e) =>
                  setRefs(
                    e.target.checked
                      ? [...refs, { ingredientId: i.id!, qty: i.qty }]
                      : refs.filter((r) => r.ingredientId !== i.id),
                  )
                }
              />
              <span>{ct(i.name)}</span>
            </label>
            {ref && (
              <label className="ingredient-link-amount">
                {text("Lượng phân bổ", "Allocated amount")} ({unit(i.unit)})
                <input
                  aria-label={`${text("Lượng phân bổ cho", "Allocated amount for")} ${ct(i.name)} (${unit(i.unit)})`}
                  type="number"
                  min="0.001"
                  max={i.qty}
                  step="any"
                  value={ref.qty}
                  onChange={(e) =>
                    setRefs(
                      refs.map((r) =>
                        r.ingredientId === i.id
                          ? { ...r, qty: Number(e.target.value) }
                          : r,
                      ),
                    )
                  }
                />
              </label>
            )}
          </div>
        );
      })}
      <div className="preparation-link-actions">
        <button type="button" className="text-button" onClick={save}>
          {text(
            "Xác nhận phân bổ nguyên liệu",
            "Confirm ingredient allocations",
          )}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setRefs([]);
            onChange([]);
            setError("");
          }}
        >
          {text(
            "Xác nhận bước này không giữ thêm nguyên liệu",
            "Confirm this step holds no additional ingredients",
          )}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
