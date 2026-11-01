import { useMemo } from "react";
import {
  compileAdditionalRequest,
  foodLabel,
  requestViolations,
  slotId,
} from "src/ai/additionalRequest";
import { DAYS, MEAL_TYPES, type Plan } from "src/types";
import type { MenuInput } from "src/ai/contracts";
import { useI18n, useText } from "src/i18n";
export default function AdditionalRequestSummary({
  input,
  plan,
}: {
  input: MenuInput;
  plan?: Plan;
}) {
  const text = useText(),
    { language, content } = useI18n();
  const contract = useMemo(() => compileAdditionalRequest(input), [input]);
  if (!input.customPrompt.trim()) return null;
  const checks = plan ? requestViolations(plan, input) : [];
  return (
    <section
      className="request-summary"
      aria-label={text(
        "Cách áp dụng yêu cầu thêm",
        "How your additional request applies",
      )}
    >
      <h4>
        {text(
          "Cách áp dụng yêu cầu thêm",
          "How your additional request applies",
        )}
      </h4>
      {contract.rules.length > 0 && (
        <ul>
          {contract.rules.map((rule) => {
            const cuisine =
              rule.cuisine === "European"
                ? text("món Âu", "Western meal")
                : rule.cuisine === "Vietnamese"
                  ? text("món Việt", "Vietnamese meal")
                  : rule.cuisine === "Asian"
                    ? text("món Á", "Asian meal")
                    : text("bữa ăn", "meal");
            const slots = rule.slots
              .map(
                (id) =>
                  DAYS.flatMap((day) =>
                    MEAL_TYPES.map((type) => ({
                      id: slotId(day, type),
                      label: `${content(day)} · ${content(type)}`,
                    })),
                  ).find((slot) => slot.id === id)?.label,
              )
              .filter(Boolean)
              .join(", ");
            return (
              <li key={rule.id}>
                <strong>
                  {rule.countMode === "exact"
                    ? text("Đúng", "Exactly")
                    : text("Ít nhất", "At least")}{" "}
                  {rule.count} {cuisine}
                </strong>
                {rule.ingredients.length > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    {rule.ingredients
                      .map((food) => foodLabel(food, language))
                      .join(" + ")}
                  </>
                )}
                {!!rule.excludedIngredients.length && (
                  <>
                    {" "}
                    · {text("không có ", "without ")}
                    {rule.excludedIngredients
                      .map((food) => foodLabel(food, language))
                      .join(", ")}
                  </>
                )}
                {rule.cookingMethod && (
                  <>
                    {" "}
                    ·{" "}
                    {
                      {
                        fried: text("chiên/rán", "fried"),
                        baked: text("nướng lò", "baked/roasted"),
                        grilled: text("nướng", "grilled"),
                        steamed: text("hấp", "steamed"),
                        stewed: text("kho/hầm", "braised/stewed"),
                      }[rule.cookingMethod]
                    }
                  </>
                )}
                {slots && <> · {slots}</>}
              </li>
            );
          })}
        </ul>
      )}
      {!!contract.excludedIngredients.length && (
        <p>
          {text(
            "Tránh trong mọi món, kể cả món thay thế: ",
            "Avoid in every recipe, including alternatives: ",
          )}
          {contract.excludedIngredients
            .map((food) => foodLabel(food, language))
            .join(", ")}
        </p>
      )}
      {contract.rules.length > 0 ? (
        <p className="caption">
          {text(
            "Số lượng được tính trên toàn bộ lịch ăn. Yêu cầu cho bữa cụ thể không lặp lại ở cả 5 món thay thế.",
            "Counts apply across the whole scheduled menu. A request for one meal is not repeated across all five alternatives.",
          )}
        </p>
      ) : (
        <p className="caption">
          {text(
            "AI sẽ nhận toàn bộ yêu cầu. Để rõ hơn, hãy ghi số bữa, nguyên liệu, cách nấu và ngày/bữa nếu cần.",
            "The AI receives your full request. For precision, specify the meal count, ingredients, cooking method, and day/meal when needed.",
          )}
        </p>
      )}
      {!!contract.conflicts.length && (
        <p className="notice warning" role="alert">
          {text(
            "Yêu cầu mâu thuẫn với lịch ăn, chế độ ăn, dụng cụ hoặc nguyên liệu cần tránh. Điều chỉnh yêu cầu hoặc các lựa chọn trước khi tạo.",
            contract.conflicts.join(" "),
          )}
        </p>
      )}
      {plan && contract.rules.length > 0 && (
        <p className={checks.length ? "notice warning" : "caption"}>
          {checks.length
            ? text(
                "Bản nháp này cần kiểm tra lại theo yêu cầu ở trên.",
                "This draft needs review against the request above.",
              )
            : text(
                "Đã kiểm tra bữa, nguyên liệu, cách nấu và số lượng theo yêu cầu trên.",
                "Checked meal slots, ingredients, cooking method and counts against the requirements above.",
              )}
        </p>
      )}
    </section>
  );
}
