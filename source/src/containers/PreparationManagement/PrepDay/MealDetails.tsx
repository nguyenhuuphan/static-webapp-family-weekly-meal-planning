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
  const { t, content, number, unit } = useI18n();
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = hovered || pinned || focused;
  const close = () => {
    setHovered(false);
    setPinned(false);
    setFocused(false);
  };
  return (
    <div
      className="prep-meal-details"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(event) => {
        if (event.target.matches(":focus-visible")) setFocused(true);
      }}
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
          setFocused(false);
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
