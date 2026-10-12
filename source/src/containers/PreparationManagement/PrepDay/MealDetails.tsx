import FoodStorageEditor from "src/modules/shared-main/components/FoodStorageEditor";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useId, useState } from "react";
import { ChevronDown, Clock, Snowflake, X } from "lucide-react";
import { useI18n } from "src/i18n";
import type { Meal } from "src/types";

export default function MealDetails({
  meal,
  factor,
}: {
  meal: Meal;
  factor: number;
}) {
  const { s, update } = useMealPlanner();
  const { t, content, number, unit } = useI18n();
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const open = pinned;
  const close = () => {
    setPinned(false);
  };
  return (
    <div
      className="prep-meal-details"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        type="button"
        className="prep-meal-trigger"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t("prepMealDetailsLabel", { name: content(meal.main) })}
        onClick={() => {
          setPinned(!pinned);
        }}
      >
        <span>
          {content(meal.day)} · {content(meal.type)}
          <strong>{content(meal.main)}</strong>
        </span>
        <ChevronDown size={15} />
      </button>
      <div
        className="prep-meal-popover"
        id={id}
        hidden={!open}
        role="region"
        aria-label={t("prepMealDetailsLabel", { name: content(meal.main) })}
      >
        <div className="prep-meal-popover-header">
          <span className="eyebrow">
            {content(meal.day)} · {content(meal.type)}
          </span>
          <button
            className="icon-button"
            aria-label={t("prepCloseDetails")}
            onClick={close}
          >
            <X size={16} />
          </button>
        </div>
        <h3>{content(meal.main)}</h3>
        <p>{content(meal.side)}</p>
        <span className="pill">
          <Clock size={13} />
          {t("minutesCount", { count: meal.minutes })}
        </span>
        <h4>{t("ingredients")}</h4>
        <ul>
          {meal.ingredients.map((ingredient, index) => (
            <li key={index}>
              <span>{content(ingredient.name)}</span>
              <strong>
                {number(ingredient.qty * factor)} {unit(ingredient.unit)}
              </strong>
            </li>
          ))}
        </ul>
        <FoodStorageEditor
          value={s.mealStorage?.[meal.id]}
          onChange={(storage) =>
            update((s) => ({
              ...s,
              mealStorage: { ...s.mealStorage, [meal.id]: storage },
            }))
          }
        />
        <div className="prep-storage-note">
          <Snowflake size={15} />
          <p>
            <strong>{t("store")}</strong> {content(meal.storage)}
          </p>
        </div>
        <div className="prep-storage-note">
          <Clock size={15} />
          <p>
            <strong>{t("thaw")}</strong> {content(meal.thaw)}
          </p>
        </div>
      </div>
    </div>
  );
}
