import { useEffect, useRef, useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { useTimerAlarm } from "./useTimerAlarm";
import { useI18n } from "src/i18n";
import type { State, Plan, Meal, View, Progress } from "src/types";
import {
  freshState,
  hydrateState,
  parseBackup,
  mealPortions,
  timerSeconds,
} from "src/domain";
import { queryMealPlan } from "src/queries";
import { STORAGE_KEY } from "src/appConfig";
import { storageService } from "src/services/storageService";
import { readFamilyCode } from "./useFamilyAccess";
import {
  readPlanner,
  sendCommand,
  plannerRequest,
  PlannerApiError,
  type PlannerEnvelope,
} from "src/services/plannerApi";
import type { CommandName } from "../../api/commands";
import { useAppDispatch, useAppSelector, useAppStore } from "src/redux/hooks";
import { initialized, stateChanged } from "src/redux/plannerSlice";
type PendingCommand = {
  id: string;
  revision: number;
  name: CommandName;
  args: Record<string, any>;
};
const pendingKey = "planner:pending-command-v1";
function savedPending(): PendingCommand | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
    return value &&
      typeof value.id === "string" &&
      Number.isSafeInteger(value.revision) &&
      typeof value.name === "string" &&
      value.args
      ? value
      : null;
  } catch {
    return null;
  }
}
function rememberPending(value: PendingCommand | null) {
  try {
    if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value));
    else sessionStorage.removeItem(pendingKey);
  } catch {}
}
export function usePlannerController() {
  const { t: tr, instruction, source } = useI18n(),
    dispatch = useAppDispatch(),
    store = useAppStore();
  const { current: state, defaults } = useAppSelector((s) => s.planner);
  const [view, setView] = usePersistentState<View>("planner:view", "week"),
    [selected, setSelected] = usePersistentState(
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
  const [envelope, setEnvelope] = useState<PlannerEnvelope | null>(null),
    latest = useRef<PlannerEnvelope | null>(null);
  const [apiStatus, setApiStatus] = useState<
    "disconnected" | "loading" | "saving" | "synced" | "error"
  >("disconnected");
  const [apiBusy, setApiBusy] = useState(false),
    [ownRevision, setOwnRevision] = useState<number | null>(null);
  const code = useRef(readFamilyCode()),
    alive = useRef(true),
    flight = useRef(false),
    queue = useRef(Promise.resolve()),
    uncertain = useRef<PendingCommand | null>(savedPending());
  const [recoveryRaw, setRecoveryRaw] = useState<string | null>(null),
    [pendingImport, setPendingImport] = useState<State | null>(null);
  const [externalChange, setExternalChange] = useState<{
    raw: string | null;
  } | null>(null);
  const alarm = useTimerAlarm(
    [...(state?.timers || []), ...(state?.timer ? [state.timer] : [])],
    now,
  );
  function adopt(result: PlannerEnvelope) {
    if (
      !result?.state?.plan ||
      !Number.isSafeInteger(result.revision) ||
      !result.calculations
    )
      throw Error("Invalid API response.");
    latest.current = result;
    if (!alive.current) return;
    dispatch(stateChanged(result.state));
    setEnvelope(result);
    setStorageError("");
    setApiStatus("synced");
    // This is an offline read cache, never an authoritative write source.
    try {
      const previous = storageService.raw();
      if (previous && !localStorage.getItem(STORAGE_KEY + ":pre-api-backup"))
        localStorage.setItem(STORAGE_KEY + ":pre-api-backup", previous);
      storageService.write(result.state);
      setRecoveryRaw(null);
    } catch {
      /* Server saving must not depend on browser storage. */
    }
  }
  async function connectApi(value: string) {
    if (value.length < 16) return false;
    setApiStatus("loading");
    try {
      const result = await readPlanner(value);
      code.current = value;
      adopt(result);
      setExternalChange(null);
      if (uncertain.current) {
        setApiStatus("error");
        setStorageError(tr("apiPreviousPending"));
      }
      return true;
    } catch (e) {
      if (alive.current) {
        setApiStatus("error");
        setStorageError(
          e instanceof Error ? e.message : "Could not connect to the API.",
        );
      }
      return false;
    }
  }
  async function refreshApi() {
    if (!code.current || flight.current || uncertain.current) return false;
    try {
      const result = await readPlanner(code.current);
      if (latest.current?.revision !== result.revision) {
        adopt(result);
        setOwnRevision(null);
      } else {
        setApiStatus("synced");
        setStorageError("");
      }
      return true;
    } catch (e) {
      setApiStatus("error");
      setStorageError(
        e instanceof Error ? e.message : "Could not connect to the API.",
      );
      return false;
    }
  }
  useEffect(() => {
    alive.current = true;
    let active = true;
    queryMealPlan()
      .then(async (p) => {
        if (!active) return;
        let initial = freshState(p);
        try {
          const cached = storageService.read();
          if (cached) initial = hydrateState(cached, p);
        } catch {
          try {
            setRecoveryRaw(storageService.raw() || "");
          } catch {}
        }
        dispatch(initialized({ current: initial, defaults: p }));
        if (code.current) await connectApi(code.current);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      alive.current = false;
    };
  }, [dispatch]);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (ownRevision === null) return;
    const timer = setTimeout(() => setOwnRevision(null), 8000);
    return () => clearTimeout(timer);
  }, [ownRevision]);
  useEffect(() => {
    const changed = (event: Event) => {
      const value =
        event instanceof CustomEvent && typeof event.detail === "string"
          ? event.detail
          : readFamilyCode();
      if (!value) {
        code.current = "";
        setApiStatus("disconnected");
        latest.current = null;
        setEnvelope(null);
        return;
      }
      if (value !== code.current) void connectApi(value);
    };
    window.addEventListener("family-access-changed", changed);
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        code.current &&
        !flight.current &&
        !uncertain.current &&
        !editId &&
        !advanced &&
        !document.activeElement?.matches(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        void refreshApi();
    }, 5000);
    const focus = () => {
      if (!uncertain.current) void refreshApi();
    };
    window.addEventListener("online", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("family-access-changed", changed);
      window.removeEventListener("online", focus);
    };
  }, [editId, advanced]);
  useEffect(() => {
    if (apiStatus !== "synced" || !code.current) return;
    void plannerRequest(code.current, "events", {
      id: crypto.randomUUID(),
      kind: "view.open",
      view,
    }).catch(() => {});
  }, [view, !!envelope]);
  function command(
    name: CommandName,
    args: Record<string, any> = {},
  ): Promise<boolean> {
    if (!code.current || !latest.current) {
      setToast(tr("apiConnectRequired"));
      return Promise.resolve(false);
    }
    if (uncertain.current) {
      setToast(tr("apiPendingRequired"));
      return Promise.resolve(false);
    }
    const id = crypto.randomUUID();
    let resolve!: (ok: boolean) => void;
    const result = new Promise<boolean>((r) => {
      resolve = r;
    });
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (uncertain.current) {
          resolve(false);
          return;
        }
        flight.current = true;
        setApiBusy(true);
        setApiStatus("saving");
        const revision = latest.current!.revision;
        rememberPending({ id, revision, name, args });
        try {
          const saved = await sendCommand(code.current, id, revision, {
            name,
            args,
          });
          rememberPending(null);
          adopt(saved);
          setOwnRevision(saved.revision);
          resolve(true);
        } catch (e) {
          if (e instanceof PlannerApiError && e.status === 409) {
            rememberPending(null);
            setOwnRevision(null);
            await refreshConflict();
            setStorageError(tr("apiConflict"));
          } else if (
            !(e instanceof PlannerApiError) ||
            e.status >= 500 ||
            e.code === "network"
          ) {
            uncertain.current = { id, revision, name, args };
            setStorageError(tr("apiUnconfirmed"));
          } else {
            rememberPending(null);
            setStorageError(e.message);
          }
          setApiStatus("error");
          resolve(false);
        } finally {
          flight.current = false;
          setApiBusy(false);
        }
      });
    return result;
  }
  async function refreshConflict() {
    try {
      const remote = await readPlanner(code.current);
      const previous = store.getState().planner.current;
      setExternalChange({ raw: previous ? JSON.stringify(previous) : null });
      adopt(remote);
    } catch {}
  }
  async function retryApi() {
    const pending = uncertain.current;
    if (!pending) return refreshApi();
    if (flight.current) return false;
    flight.current = true;
    setApiBusy(true);
    setApiStatus("saving");
    try {
      const result = await sendCommand(
        code.current,
        pending.id,
        pending.revision,
        { name: pending.name, args: pending.args },
      );
      uncertain.current = null;
      rememberPending(null);
      adopt(result);
      setOwnRevision(result.revision);
      return true;
    } catch (e) {
      setApiStatus("error");
      if (e instanceof PlannerApiError && e.status === 409) {
        uncertain.current = null;
        rememberPending(null);
        await refreshConflict();
      }
      setStorageError(
        e instanceof Error ? e.message : "Could not confirm the save.",
      );
      return false;
    } finally {
      flight.current = false;
      setApiBusy(false);
    }
  }
  function navigate(v: View) {
    setView(v);
    setEditId(null);
    setAdvanced(false);
    window.scrollTo(0, 0);
  }
  function downloadRaw(raw: string, filename: string) {
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportJSON() {
    const current = store.getState().planner.current;
    if (current)
      downloadRaw(
        JSON.stringify({ backupVersion: 2, ...current }, null, 2),
        "weekday-table-backup.json",
      );
  }
  async function importJSON(file: File | undefined) {
    if (!file || !defaults) return;
    try {
      if (file.size > 1_750_000)
        throw Error("Choose a backup smaller than 1.75 MB.");
      const raw = JSON.parse(await file.text());
      const parsed = parseBackup(raw);
      setPendingImport(
        raw.progress
          ? hydrateState(raw, parsed.plan)
          : { ...freshState(parsed.plan), servings: parsed.servings },
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Invalid backup.");
    }
  }
  const restore = (next: State) => command("state.restore", { state: next });
  if (!state || !defaults) return { error, model: null };
  const s = state,
    plan = s.plan,
    meal =
      plan.meals.find((m) => m.id === selected && mealPortions(s, m) > 0) ||
      plan.meals.find((m) => mealPortions(s, m) > 0) ||
      plan.meals[0];
  const factor =
    (s.cookingBatches?.[meal.id]?.servings ?? mealPortions(s, meal)) /
    plan.servings;
  const pos = Math.min(
    Math.max(0, s.progress.cook[meal.id] || 0),
    meal.steps.length - 1,
  );
  return {
    error,
    model: {
      apiStatus,
      apiBusy,
      hasPendingSave: !!uncertain.current,
      apiRevision: envelope?.revision ?? null,
      connectApi,
      refreshApi,
      retryApi,
      command,
      disconnectApi: () => {
        code.current = "";
        setApiStatus("disconnected");
        latest.current = null;
        setEnvelope(null);
        uncertain.current = null;
        rememberPending(null);
      },
      externalChange,
      loadExternalCopy: () => {
        setExternalChange(null);
        void refreshApi();
      },
      keepLocalCopy: async () => {
        if (externalChange?.raw && confirm(tr("replaceExternalCopyConfirm"))) {
          if (
            await restore(
              hydrateState(JSON.parse(externalChange.raw), defaults),
            )
          )
            setExternalChange(null);
        }
      },
      downloadExternalCopy: () => {
        if (externalChange?.raw)
          downloadRaw(externalChange.raw, "weekday-table-before-conflict.json");
      },
      canUndo: ownRevision !== null && ownRevision === envelope?.revision,
      undoLastAction: () => {
        if (confirm(tr("undoPhysicalRecordConfirm")))
          void command("state.undo").then((ok) => {
            if (ok) setOwnRevision(null);
          });
      },
      dismissUndo: () => setOwnRevision(null),
      recoveryRaw,
      hasLastGood: (() => {
        try {
          return !!storageService.lastGood();
        } catch {
          return false;
        }
      })(),
      downloadRecovery: () =>
        downloadRaw(recoveryRaw || "", "weekday-table-recovery.json"),
      recoverLastGood: async () => {
        try {
          const raw = storageService.lastGood();
          if (raw && (await restore(hydrateState(JSON.parse(raw), defaults))))
            setRecoveryRaw(null);
        } catch (e) {
          setToast(String(e));
        }
      },
      createAfterRecovery: () =>
        restore(freshState(defaults)).then((ok) => {
          if (ok) setRecoveryRaw(null);
        }),
      pendingImport,
      setPendingImport,
      restoreBackup: async () => {
        if (pendingImport && (await restore(pendingImport))) {
          setPendingImport(null);
          setRecoveryRaw(null);
          navigate("week");
        }
      },
      ...alarm,
      s,
      plan,
      factor,
      meal,
      editing: plan.meals.find((m) => m.id === editId),
      pos,
      step: meal.steps[pos],
      ready: envelope?.calculations.meals[meal.id]?.ready || false,
      doneCount: envelope?.calculations.doneCount || 0,
      prepTotal: envelope?.calculations.prepTotal || 0,
      prepDone: envelope?.calculations.prepDone || 0,
      needs: envelope?.calculations.needs || [],
      bought: envelope?.calculations.bought || 0,
      shopping: envelope?.calculations.shopping || [],
      stocktakeCandidates: envelope?.calculations.stocktake || [],
      surplus: envelope?.calculations.surplus || [],
      preparationGroups: (envelope?.calculations.preparation || []).map(
        (group) => ({
          ...group,
          allocations: group.allocations.map((allocation) => {
            const meal = plan.meals.find((m) => m.id === allocation.mealId)!;
            return {
              ...allocation,
              meal,
              task: meal.prep[allocation.taskIndex],
            };
          }),
        }),
      ),
      seconds: timerSeconds(s.timer, now),
      t: (v: string) => instruction(v, factor),
      startTimer: (index = pos) => {
        const timer = [...(s.timers || []), ...(s.timer ? [s.timer] : [])].find(
          (t) => t.mealId === meal.id && t.step === index,
        );
        if (
          timer &&
          timerSeconds(timer, now) > 0 &&
          !confirm(tr("replaceTimerConfirm"))
        )
          return;
        void command("timer.start", { id: meal.id, index });
      },
      edit: (m: Meal) => {
        setEditId(m.id);
        setAdvanced(false);
        window.scrollTo(0, 0);
      },
      navigate,
      cook: (m: Meal) => {
        setSelected(m.id);
        navigate("cook");
      },
      toggle: (
        group: Exclude<keyof Progress, "cook">,
        key: string,
        value: boolean,
      ) => command("progress.set", { group, key, value }),
      resetProgress: () => {
        if (confirm(tr("resetConfirm")))
          void command("week.start", { weekStart: s.weekStart });
      },
      applyPlan: async (plan: Plan, servings: number) => {
        if (await command("menu.apply", { plan, servings })) {
          setSelected(plan.meals[0].id);
          navigate("week");
        }
      },
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
