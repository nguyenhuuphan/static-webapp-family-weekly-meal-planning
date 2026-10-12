import { useEffect, useMemo, useState, useRef } from "react";
import { usePersistentState } from "./usePersistentState";
import { useTimerAlarm } from "./useTimerAlarm";
import { useI18n } from "src/i18n";
import { shoppingRequirements } from "src/helpers/shopping";
import { retainPrepared, startWeek } from "src/helpers/scheduling";
import { isCookingPreparation } from "src/helpers/preparation";
import type { Meal, Plan, State, View, Progress } from "src/types";
import {
  mealPortions,
  freshState,
  hydrateState,
  aggregate,
  ingredientKey,
  isPrepared,
  timerSeconds,
  freshProgress,
  parseBackup,
} from "src/domain";
import { queryMealPlan } from "src/queries";
import { storageService } from "src/services/storageService";
import { useAppDispatch, useAppSelector, useAppStore } from "src/redux/hooks";
import {
  initialized,
  stateChanged,
  progressToggled,
} from "src/redux/plannerSlice";
export function usePlannerController() {
  const hadRememberedMeal = useRef(
    (() => {
      try {
        return !!localStorage.getItem("planner:selected");
      } catch {
        return false;
      }
    })(),
  );
  const { t: tr, instruction, source } = useI18n();
  const { current: state, defaults } = useAppSelector((s) => s.planner);
  const dispatch = useAppDispatch(),
    store = useAppStore();
  const [view, setView] = usePersistentState<View>("planner:view", "week");
  const [selected, setSelected] = usePersistentState(
    "planner:selected",
    "mon-lunch",
  );
  const [editId, setEditId] = useState<string | null>(null),
    [advanced, setAdvanced] = useState(false),
    [json, setJson] = useState(""),
    [jsonError, setJsonError] = useState(""),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState(""),
    [toast, setToast] = useState(""),
    [now, setNow] = useState(Date.now()),
    [search, setSearch] = useState(""),
    [swapId, setSwapId] = useState("");
  const [pendingImport, setPendingImport] = useState<State | null>(null);
  const alarm = useTimerAlarm(
    [...(state?.timers || []), ...(state?.timer ? [state.timer] : [])],
    now,
  );
  useEffect(() => {
    let active = true;
    queryMealPlan()
      .then((p) => {
        if (!active) return;
        let initial = freshState(p);
        try {
          const saved = storageService.read();
          if (saved) initial = hydrateState(saved, p);
        } catch {
          setStorageError(
            "Saved data could not be read. The original menu is shown. Export changes to keep a backup.",
          );
        }
        setSelected((id) => {
          if (
            hadRememberedMeal.current &&
            initial.plan.meals.some((meal) => meal.id === id)
          )
            return id;
          const day = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ][new Date().getDay()];
          return (
            initial.plan.meals.find(
              (meal) =>
                meal.day === day &&
                mealPortions(initial, meal) > 0 &&
                !initial.progress.done[meal.id],
            )?.id || initial.plan.meals[0].id
          );
        });
        dispatch(initialized({ current: initial, defaults: p }));
      })
      .catch((e) => {
        if (active) setError(String(e.message));
      });
    return () => {
      active = false;
    };
  }, [dispatch]);
  useEffect(() => {
    if (!state) return;
    try {
      storageService.write(state);
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. Export a backup; changes are temporary.",
      );
    }
  }, [state]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  const shopping = useMemo(
    () =>
      state
        ? shoppingRequirements(state).map((item) => ({
            ...item,
            toBuy: Math.max(
              0,
              Math.round(
                (item.qty -
                  (state.pantry?.[ingredientKey(item)] || 0) -
                  (state.purchased?.[ingredientKey(item)]?.qty || 0)) *
                  100,
              ) / 100,
            ),
          }))
        : [],
    [state],
  );
  useEffect(() => {
    if (!state) return;
    const key = `planner:scroll:${view}:${selected}`;
    let saved = 0;
    try {
      saved = Number(localStorage.getItem(key)) || 0;
    } catch {
      /* Optional. */
    }
    const id = setTimeout(() => window.scrollTo(0, saved), 0);
    const remember = () => {
      try {
        localStorage.setItem(key, String(window.scrollY));
      } catch {
        /* Optional. */
      }
    };
    window.addEventListener("scroll", remember);
    return () => {
      clearTimeout(id);
      window.removeEventListener("scroll", remember);
    };
  }, [view, selected, !!state]);
  function navigate(v: View) {
    setView(v);
    setEditId(null);
    setAdvanced(false);
    window.scrollTo(0, 0);
  }
  function cook(m: Meal) {
    setSelected(m.id);
    navigate("cook");
  }
  function update(fn: (s: State) => State) {
    const current = store.getState().planner.current;
    if (current) dispatch(stateChanged(fn(current)));
  }
  function toggle(
    group: Exclude<keyof Progress, "cook">,
    key: string,
    value: boolean,
  ) {
    dispatch(progressToggled({ group, key, value }));
  }
  function resetProgress() {
    if (confirm(tr("resetConfirm"))) {
      update((s) => startWeek(s, s.weekStart));
      setToast("Fresh progress. Same favourite recipes.");
    }
  }
  function applyPlan(plan: Plan, servings: number) {
    update((s) => ({
      ...retainPrepared(s),
      mealServings: {},
      mealCredits: {},
      preparedTasks: {},
      purchased: {},
      plan,
      servings,
      progress: freshProgress(),
      timer: null,
      timers: [],
    }));
    setSelected(plan.meals[0].id);
    navigate("week");
    setToast("Plan updated. Checklists are fresh.");
  }
  function exportJSON() {
    if (!state) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ backupVersion: 2, ...state }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "weekday-table-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("Backup downloaded. Share it or keep it safe.");
  }
  async function importJSON(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 1000000)
        throw Error("Please choose a JSON file smaller than 1 MB.");
      const raw = JSON.parse(await file.text());
      const p = parseBackup(raw);
      setPendingImport(
        raw.progress
          ? hydrateState(raw, p.plan)
          : { ...freshState(p.plan), servings: p.servings },
      );
    } catch (e) {
      setToast(
        e instanceof SyntaxError ? source("invalidJson") : (e as Error).message,
      );
    }
  }
  if (!state || !defaults) return { error, model: null };
  const s = state,
    plan = s.plan,
    meal =
      plan.meals.find((m) => m.id === selected && mealPortions(s, m) > 0) ||
      plan.meals.find((m) => mealPortions(s, m) > 0) ||
      plan.meals[0],
    factor = mealPortions(s, meal) / plan.servings,
    editing = plan.meals.find((m) => m.id === editId),
    pos = Math.min(
      Math.max(0, s.progress.cook[meal.id] || 0),
      meal.steps.length - 1,
    ),
    step = meal.steps[pos],
    ready =
      mealPortions(s, meal) > 0 &&
      isPrepared(s, meal) &&
      s.progress.ready[meal.id],
    doneCount = plan.meals.filter(
      (m) => mealPortions(s, m) > 0 && s.progress.done[m.id],
    ).length,
    prepTotal = plan.meals.reduce(
      (n, m) =>
        n +
        (mealPortions(s, m) > 0
          ? m.prep.filter((_, i) => !isCookingPreparation(m, i)).length
          : 0),
      0,
    ),
    prepDone = plan.meals.reduce(
      (n, m) =>
        n +
        (mealPortions(s, m) > 0
          ? m.prep.filter(
              (_, i) =>
                !isCookingPreparation(m, i) && s.progress.prep[m.id + ":" + i],
            ).length
          : 0),
      0,
    ),
    needs = shopping.filter(
      (i) =>
        !s.progress.owned[ingredientKey(i)] &&
        i.qty > (s.pantry?.[ingredientKey(i)] || 0),
    ),
    bought = needs.filter((i) => s.progress.shopping[ingredientKey(i)]).length,
    seconds = timerSeconds(s.timer, now),
    t = (v: string) => instruction(v, factor);
  const startTimer = (stepIndex = pos) => {
    const existing = [...(s.timers || []), ...(s.timer ? [s.timer] : [])].find(
      (timer) => timer.mealId === meal.id && timer.step === stepIndex,
    );
    if (
      existing &&
      timerSeconds(existing, now) > 0 &&
      !confirm(tr("replaceTimerConfirm"))
    )
      return;
    update((x) => ({
      ...x,
      timers: [...(x.timers || []), ...(x.timer ? [x.timer] : [])].filter(
        (timer) => !(timer.mealId === meal.id && timer.step === stepIndex),
      ),
      timer: {
        mealId: meal.id,
        step: stepIndex,
        end: Date.now() + meal.steps[stepIndex].minutes * 60000,
      },
    }));
  };
  const edit = (m: Meal) => {
    setEditId(m.id);
    setAdvanced(false);
    window.scrollTo(0, 0);
  };
  return {
    error,
    model: {
      pendingImport,
      setPendingImport,
      restoreBackup: () => {
        if (!pendingImport) return;
        update(() => pendingImport);
        setSelected(pendingImport.plan.meals[0].id);
        setPendingImport(null);
        navigate("week");
        setToast(tr("backupRestored"));
      },
      ...alarm,
      s,
      plan,
      factor,
      meal,
      editing,
      pos,
      step,
      ready,
      doneCount,
      prepTotal,
      prepDone,
      needs,
      bought,
      seconds,
      t,
      startTimer,
      edit,
      shopping,
      navigate,
      cook,
      update,
      toggle,
      resetProgress,
      applyPlan,
      exportJSON,
      importJSON,
      defaults,
      view,
      selected,
      setSelected,
      editId,
      setEditId,
      advanced,
      setAdvanced,
      json,
      setJson,
      jsonError,
      setJsonError,
      storageError,
      toast,
      setToast,
      search,
      setSearch,
      swapId,
      setSwapId,
    },
  };
}
