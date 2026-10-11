import { useEffect, useMemo, useState } from "react";
import { useI18n } from "src/i18n";
import type { Meal, Plan, State, View, Progress } from "src/types";
import {
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
  progressReset,
} from "src/redux/plannerSlice";
export function usePlannerController() {
  const { t: tr, instruction, source } = useI18n();
  const { current: state, defaults } = useAppSelector((s) => s.planner);
  const dispatch = useAppDispatch(),
    store = useAppStore();
  const [view, setView] = useState<View>("week"),
    [selected, setSelected] = useState("mon-lunch"),
    [editId, setEditId] = useState<string | null>(null),
    [advanced, setAdvanced] = useState(false),
    [json, setJson] = useState(""),
    [jsonError, setJsonError] = useState(""),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState(""),
    [toast, setToast] = useState(""),
    [now, setNow] = useState(Date.now()),
    [search, setSearch] = useState(""),
    [swapId, setSwapId] = useState("");
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
        setSelected(initial.plan.meals[0].id);
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
    () => (state ? aggregate(state.plan, state.servings) : []),
    [state?.plan, state?.servings],
  );
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
      dispatch(progressReset());
      setToast("Fresh progress. Same favourite recipes.");
    }
  }
  function applyPlan(plan: Plan, servings: number) {
    update((s) => ({
      ...s,
      plan,
      servings,
      progress: freshProgress(),
      timer: null,
    }));
    setSelected(plan.meals[0].id);
    navigate("week");
    setToast("Plan updated. Checklists are fresh.");
  }
  function exportJSON() {
    if (!state) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { plan: state.plan, servings: state.servings },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
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
      const p = parseBackup(JSON.parse(await file.text()));
      if (confirm(tr("importConfirm"))) applyPlan(p.plan, p.servings);
    } catch (e) {
      setToast(
        e instanceof SyntaxError ? source("invalidJson") : (e as Error).message,
      );
    }
  }
  if (!state || !defaults) return { error, model: null };
  const s = state,
    plan = s.plan,
    factor = s.servings / plan.servings,
    meal = plan.meals.find((m) => m.id === selected) || plan.meals[0],
    editing = plan.meals.find((m) => m.id === editId),
    pos = Math.min(
      Math.max(0, s.progress.cook[meal.id] || 0),
      meal.steps.length - 1,
    ),
    step = meal.steps[pos],
    ready = isPrepared(s, meal) && s.progress.ready[meal.id],
    doneCount = plan.meals.filter((m) => s.progress.done[m.id]).length,
    prepTotal = plan.meals.reduce((n, m) => n + m.prep.length, 0),
    prepDone = plan.meals.reduce(
      (n, m) =>
        n + m.prep.filter((_, i) => s.progress.prep[m.id + ":" + i]).length,
      0,
    ),
    needs = shopping.filter((i) => !s.progress.owned[ingredientKey(i)]),
    bought = needs.filter((i) => s.progress.shopping[ingredientKey(i)]).length,
    seconds = timerSeconds(s.timer, now),
    t = (v: string) => instruction(v, factor);
  const startTimer = () => {
    if (s.timer && seconds > 0 && !confirm(tr("replaceTimerConfirm"))) return;
    update((x) => ({
      ...x,
      timer: {
        mealId: meal.id,
        step: pos,
        end: Date.now() + step.minutes * 60000,
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
