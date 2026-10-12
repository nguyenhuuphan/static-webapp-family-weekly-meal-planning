import type { Ingredient } from "src/types";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useText, useI18n } from "src/i18n";
import { ingredientWarnings } from "src/helpers/allergies";
export default function AllergyWarnings({
  ingredients,
}: {
  ingredients: Ingredient[];
}) {
  const { s } = useMealPlanner(),
    text = useText(),
    { content: ct } = useI18n();
  if (!s.avoidanceProfiles?.length) return null;
  const warnings = ingredientWarnings(ingredients, s.avoidanceProfiles, ct);
  return (
    <details
      className="notice warning allergy-warnings"
      open={warnings.length > 0}
    >
      <summary>
        {warnings.length
          ? text(
              "Có thành phần cần tránh / cần kiểm tra",
              "Ingredients to avoid / review",
            )
          : text(
              "Kiểm tra thành phần và nhãn thực phẩm",
              "Review ingredients and food labels",
            )}
      </summary>
      {!!warnings.length && (
        <ul>
          {warnings.map((w, i) => (
            <li key={i}>
              {w.person}: {ct(w.ingredient)} · {w.terms.join(", ")}
            </li>
          ))}
        </ul>
      )}
      <p>
        {text(
          "Cảnh báo gợi ý dựa trên tên, nhãn đã nhập và hồ sơ cả nhà. Gia vị, thành phần chưa khai và nhiễm chéo vẫn cần kiểm tra trực tiếp; không có cảnh báo không có nghĩa là an toàn dị ứng.",
          "Hints use names, entered tags and all household profiles. Review actual labels, seasonings, undeclared ingredients and cross-contact. No warning does not mean allergy-safe.",
        )}
      </p>
      <a
        href="https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know"
        target="_blank"
        rel="noreferrer"
      >
        {text("FDA: dị ứng và đọc nhãn", "FDA: allergies and reading labels")}
      </a>
    </details>
  );
}
