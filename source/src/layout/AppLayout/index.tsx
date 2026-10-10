import { CalendarDays, Leaf, Clock, X, CheckCircle2 } from "lucide-react";

import { dateLabel, replaceMeal } from "src/domain";
import { Button } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { fmt } from "src/utils/formatTime";
import WeeklyMenu from "src/containers/MealPlanning/WeeklyMenu";
import ShoppingList from "src/containers/ShoppingManagement/ShoppingList";
import PrepDay from "src/containers/PreparationManagement/PrepDay";
import CookingSession from "src/containers/CookingManagement/CookingSession";
import HouseholdSettings from "src/containers/SettingsManagement/HouseholdSettings";
import SafetyGuide from "src/containers/SafetyManagement/SafetyGuide";
import AdvancedJson from "src/containers/SettingsManagement/AdvancedJson";
import Editor from "src/containers/MealPlanning/MealEditor";
import Sidebar from "src/layout/Sidebar";
interface IProps {}
const AppLayout: React.FC<IProps> = () => {
  const {
    s,
    plan,
    editing,
    seconds,
    update,
    view,
    setEditId,
    advanced,
    storageError,
    toast,
    setToast,
    swapId,
    setSwapId,
  } = useMealPlanner();
  return (
    <div className="app-shell">
      <Sidebar />
      <main>
        <header className="topbar">
          <span className="mobile-brand">
            <Leaf size={17} />
            Weekday Table
          </span>
          <span className="week-label">
            <CalendarDays size={14} />
            Week of {dateLabel(s.weekStart, "Monday")}
          </span>
          <span className="saved">
            <i />
            {storageError ? "Changes not saved" : "Saved on this device"}
          </span>
        </header>
        <div className="page-content">
          {storageError && (
            <div className="notice warning" role="alert">
              {storageError}
            </div>
          )}
          {editing ? (
            <>
              <Editor
                key={editing.id}
                meal={editing}
                plan={plan}
                onCancel={() => setEditId(null)}
                onSave={(m) => {
                  update((x) => replaceMeal(x, m.id, m));
                  setEditId(null);
                  setToast("Meal saved. Review your preparation and storage.");
                }}
              />
              <section className="panel">
                <h2>Use another recipe pair</h2>
                <p>
                  Copy a main dish and side into this slot. Review storage and
                  thawing for its new day.
                </p>
                <div className="actions">
                  <select
                    aria-label="Recipe pair to copy"
                    value={swapId}
                    onChange={(e) => setSwapId(e.target.value)}
                  >
                    <option value="">Choose a recipe pair…</option>
                    {plan.meals
                      .filter((m) => m.id !== editing.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.main} + {m.side}
                        </option>
                      ))}
                  </select>
                  <Button
                    disabled={!swapId}
                    onClick={() => {
                      const src = plan.meals.find((m) => m.id === swapId);
                      if (!src) return;
                      if (
                        confirm(
                          "Replace this recipe pair? Progress resets. Review storage for its new date; existing prepared food will not change.",
                        )
                      ) {
                        const copy = {
                          ...structuredClone(src),
                          id: editing.id,
                          day: editing.day,
                          type: editing.type,
                          storage:
                            "Review preparation-specific storage for this new day. Refrigerate Monday protein or freeze later-day protein promptly after prep. Frozen vegetables stay frozen until cooking.",
                          thaw: "Move frozen proteins and sauces to the fridge the morning before this meal. Confirm they are fully thawed before cooking.",
                        };
                        update((x) => replaceMeal(x, editing.id, copy));
                        setEditId(null);
                        setSwapId("");
                        setToast(
                          "Recipe replaced. Review storage and quantities.",
                        );
                      }
                    }}
                  >
                    Replace pair
                  </Button>
                </div>
              </section>
            </>
          ) : advanced ? (
            <AdvancedJson />
          ) : view === "week" ? (
            <WeeklyMenu />
          ) : view === "shop" ? (
            <ShoppingList />
          ) : view === "prep" ? (
            <PrepDay />
          ) : view === "cook" ? (
            <CookingSession />
          ) : view === "settings" ? (
            <HouseholdSettings />
          ) : (
            <SafetyGuide />
          )}
          <footer>
            <span>
              <Leaf size={13} />
              Weekday Table · Made for everyday life.
            </span>
            <span>1 tsp = 5 ml · 1 tbsp = 15 ml · rice time separate</span>
          </footer>
        </div>
      </main>
      {s.timer && (
        <div
          className={`floating-timer ${seconds === 0 ? "finished" : ""}`}
          role="status"
        >
          <Clock size={20} />
          <div>
            <strong>{seconds === 0 ? "Timer finished" : fmt(seconds)}</strong>
            <span>
              {plan.meals.find((m) => m.id === s.timer?.mealId)?.main} · step{" "}
              {s.timer.step + 1}
              {seconds === 0 ? " · check doneness" : ""}
            </span>
          </div>
          <button
            className="icon-button"
            aria-label="Dismiss timer"
            onClick={() => update((x) => ({ ...x, timer: null }))}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
export default AppLayout;
