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
  const { navigate, view, editId, advanced } = useMealPlanner();
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
          Weekday Table<small>A FAMILY KITCHEN</small>
        </div>
      </a>
      <div className="nav-label">YOUR WEEK</div>
      <nav aria-label="Main navigation">
        {NAV.map(([id, label]) => {
          const Icon = ICONS[id];
          return (
            <button
              key={id}
              className={view === id && !editId && !advanced ? "active" : ""}
              aria-current={
                view === id && !editId && !advanced ? "page" : undefined
              }
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "week" && <small>10</small>}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div>
          <Leaf size={17} />
          <p>
            A little care,
            <br />
            every day.
          </p>
        </div>
        <button onClick={() => navigate("safety")}>
          <ShieldCheck size={15} />
          Safety & storage
        </button>
        <span>
          Local to this browser.
          <br />
          No account. No automatic sync.
        </span>
      </div>
    </aside>
  );
};
export default Sidebar;
