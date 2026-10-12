import { mealPortions } from "src/utils";
import { useI18n } from "src/i18n";
import {
  CalendarDays,
  ShoppingBag,
  ChefHat,
  Utensils,
  Settings,
  Leaf,
  ShieldCheck,
} from "lucide-react";

import { useMealPlanner } from "src/hooks/useMealPlanner";

const ICONS = {
  week: CalendarDays,
  shop: ShoppingBag,
  prep: ChefHat,
  cook: Utensils,
  settings: Settings,
  safety: ShieldCheck,
};
const NAV = [
  ["week", "This Week"],
  ["shop", "Shopping"],
  ["prep", "Prep Day"],
  ["cook", "Cook"],
  ["settings", "Settings"],
] as const;
interface IProps {}
const Sidebar: React.FC<IProps> = () => {
  const { t: tr, content: ct } = useI18n();
  const { navigate, view, editId, advanced, plan, s } = useMealPlanner();
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          navigate("week");
        }}
      >
        <span>
          <Leaf size={24} strokeWidth={1.5} />
        </span>
        <div>
          {tr("weekdayTable")}
          <small>{tr("aFamilyKitchen")}</small>
        </div>
      </a>
      <div className="nav-label">{tr("yourWeek")}</div>
      <nav aria-label={tr("mainNavigation")}>
        {NAV.map(([id, label]) => {
          const Icon = ICONS[id];
          return (
            <button
              key={id}
              aria-label={ct(label)}
              className={view === id && !editId && !advanced ? "active" : ""}
              aria-current={
                view === id && !editId && !advanced ? "page" : undefined
              }
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{ct(label)}</span>
              {id === "week" && (
                <small>
                  {plan.meals.filter((m) => mealPortions(s, m) > 0).length}
                </small>
              )}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div>
          <Leaf size={17} />
          <p>
            {tr("aLittleCare")}
            <br />
            {tr("everyDay")}
          </p>
        </div>
        <button onClick={() => navigate("safety")}>
          <ShieldCheck size={15} />
          {tr("safetyStorage")}
        </button>
        <span>
          {tr("localToThisBrowser")}
          <br />
          {tr("noAccountNoAutomaticSync")}
        </span>
      </div>
    </aside>
  );
};
export default Sidebar;
