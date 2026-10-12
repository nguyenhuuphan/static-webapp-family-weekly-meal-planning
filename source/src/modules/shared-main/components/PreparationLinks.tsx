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
    <details
      className="preparation-links"
      open={task.ingredients === undefined}
    >
      <summary>
        {text(
          "Nguyên liệu được giữ trong bước này",
          "Ingredients held by this preparation step",
        )}
      </summary>
      {task.ingredients === undefined && (
        <p role="status">
          {text(
            "Chưa đối chiếu được. Xác nhận nguyên liệu để không mua lại phần đã sơ chế.",
            "Not yet matched. Confirm ingredients to avoid buying prepared quantities again.",
          )}
        </p>
      )}
      <p className="caption">
        {text(
          "Lượng theo công thức gốc. Phân bổ mỗi lượng nguyên liệu một lần; bước xử lý tiếp cùng phần không phân bổ lại.",
          "Amounts use the recipe base. Allocate each quantity once; later operations on the same portion should not allocate it again.",
        )}
      </p>
      {meal.ingredients.map((i) => {
        const ref = refs.find((r) => r.ingredientId === i.id);
        return (
          <div key={i.id} className="ingredient-link-row">
            <label>
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
              {ct(i.name)}
            </label>
            {ref && (
              <label>
                {text("Lượng phân bổ", "Allocated amount")} ({unit(i.unit)})
                <input
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
      <button type="button" className="text-button" onClick={save}>
        {text("Xác nhận phân bổ nguyên liệu", "Confirm ingredient allocations")}
      </button>
      {error && <p role="alert">{error}</p>}
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
    </details>
  );
}
