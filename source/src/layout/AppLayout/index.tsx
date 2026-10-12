import { LanguageSwitcher, useI18n, useText } from "src/i18n";
import { useEffect, useRef } from "react";
import {
  CalendarDays,
  Leaf,
  Clock,
  X,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

import { replaceMeal } from "src/domain";
import { Button } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { timerSeconds } from "src/utils";
import type { Timer } from "src/types";
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
    t: tr,
    source,
    content: ct,
    date: localizedDate,
    error: translateError,
  } = useI18n();
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
    navigate,
  } = useMealPlanner();
  const text = useText();
  const previousScreen = useRef("");
  const screen = `${view}:${editing?.id || ""}:${advanced}`;
  useEffect(() => {
    if (previousScreen.current && previousScreen.current !== screen) {
      const heading = document.querySelector<HTMLElement>("main h1");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
    }
    previousScreen.current = screen;
  }, [screen]);
  const timers = [...(s.timers || []), ...(s.timer ? [s.timer] : [])];
  const changeTimer = (
    target: NonNullable<Timer>,
    transform: (timer: NonNullable<Timer>) => Timer,
  ) =>
    update((state) => ({
      ...state,
      timer:
        state.timer?.mealId === target.mealId &&
        state.timer.step === target.step
          ? transform(state.timer)
          : state.timer,
      timers: (state.timers || []).flatMap((timer) => {
        const next =
          timer.mealId === target.mealId && timer.step === target.step
            ? transform(timer)
            : timer;
        return next ? [next] : [];
      }),
    }));
  return (
    <div className={`app-shell ${timers.length ? "has-timers" : ""}`}>
      <a className="skip-link" href="#main-content">
        {text("Đến nội dung chính", "Skip to main content")}
      </a>
      <Sidebar />
      <main id="main-content" tabIndex={-1}>
        <header className="topbar">
          <span className="mobile-brand">
            <Leaf size={17} />
            {tr("weekdayTable")}
          </span>
          <span className="week-label">
            <CalendarDays size={14} />
            {tr("weekOf")} {localizedDate(s.weekStart, "Monday")}
          </span>
          <div className="topbar-tools">
            <button
              className="mobile-safety icon-button"
              aria-label={tr("safetyStorage")}
              onClick={() => navigate("safety")}
            >
              <ShieldCheck size={19} />
            </button>
            <LanguageSwitcher />
            <span className="saved">
              <i />
              {storageError ? tr("changesNotSaved") : tr("savedOnThisDevice")}
            </span>
          </div>
        </header>
        <div className="page-content">
          {storageError && (
            <div className="notice warning" role="alert">
              {ct(storageError)}
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
                  setToast(source("mealSavedReviewYourPreparationAndStorage"));
                }}
              />
              <section className="panel">
                <h2>{tr("useAnotherRecipePair")}</h2>
                <p>{tr("copyAMainDishAndSideIntoThisSlotReviewStorageAnd")}</p>
                <div className="actions">
                  <select
                    aria-label={tr("recipePairToCopy")}
                    value={swapId}
                    onChange={(e) => setSwapId(e.target.value)}
                  >
                    <option value="">{tr("chooseARecipePair")}</option>
                    {plan.meals
                      .filter((m) => m.id !== editing.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {ct(m.main)} + {ct(m.side)}
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
                          tr(
                            "replaceThisRecipePairProgressResetsReviewStorageForItsNewDate",
                          ),
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
                          source("recipeReplacedReviewStorageAndQuantities"),
                        );
                      }
                    }}
                  >
                    {tr("replacePair")}
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
              {tr("weekdayTableMadeForEverydayLife")}
            </span>
            <span>{tr("1Tsp5Ml1Tbsp15MlRiceTimeSeparate")}</span>
          </footer>
        </div>
      </main>
      {timers.length > 0 && (
        <div
          className="timer-stack"
          aria-label={text("Hẹn giờ đang chạy", "Cooking timers")}
        >
          {timers.map((timer) => {
            const remaining = timerSeconds(timer);
            return (
              <div
                className={`floating-timer ${remaining === 0 ? "finished" : ""}`}
                key={`${timer.mealId}:${timer.step}`}
              >
                <Clock size={20} />
                <div>
                  <strong role="timer">
                    {remaining === 0 ? tr("timerFinished") : fmt(remaining)}
                  </strong>
                  <span>
                    {ct(
                      plan.meals.find((meal) => meal.id === timer.mealId)
                        ?.main || "",
                    )}{" "}
                    · {tr("stepMessage")} {timer.step + 1}
                  </span>
                  {remaining === 0 && (
                    <span role="status">{tr("checkDoneness")}</span>
                  )}
                  <div className="actions">
                    <Button
                      onClick={() =>
                        changeTimer(timer, (value) =>
                          value.paused !== undefined
                            ? { ...value, paused: value.paused + 60 }
                            : {
                                ...value,
                                end: Math.max(Date.now(), value.end) + 60000,
                              },
                        )
                      }
                    >
                      +1 {text("phút", "min")}
                    </Button>
                    {remaining > 0 && (
                      <Button
                        onClick={() =>
                          changeTimer(timer, (value) =>
                            value.paused !== undefined
                              ? {
                                  ...value,
                                  end: Date.now() + value.paused * 1000,
                                  paused: undefined,
                                }
                              : { ...value, paused: remaining },
                          )
                        }
                      >
                        {timer.paused !== undefined
                          ? text("Tiếp tục", "Resume")
                          : text("Tạm dừng", "Pause")}
                      </Button>
                    )}
                  </div>
                </div>
                <button
                  className="icon-button"
                  aria-label={tr("dismissTimer")}
                  onClick={() => changeTimer(timer, () => null)}
                >
                  <X size={17} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{translateError(toast)}</span>
          <button
            className="icon-button"
            aria-label={tr("dismissNotification")}
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
