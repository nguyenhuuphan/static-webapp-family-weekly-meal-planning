import { signInUrl } from "src/services/signIn";
import { useFamilyAccess } from "src/hooks/useFamilyAccess";
import { useEffect, useId, useRef, useState } from "react";
import { Cloud, CheckCircle2, ChevronDown } from "lucide-react";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useText } from "src/i18n";
import { hydrateState } from "src/domain";
import { cloudRequest, CloudError } from "src/services/cloudPlanService";
import { Button } from "src/modules/shared-main/components";

type Session = { code: string; revision: string | null; baseline: string };
export default function CloudSync() {
  const model = useMealPlanner();
  const { setAccessCode } = useFamilyAccess();
  const text = useText();
  const [code, setCode] = useState("");
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<
    "local" | "busy" | "synced" | "error" | "conflict"
  >("local");
  const [busy, setBusy] = useState(false);
  const latest = useRef(model);
  latest.current = model;
  const generation = useRef(0);
  const wakeSync = useRef<() => void>(() => {});
  const blocked = () =>
    !!latest.current.externalChange ||
    latest.current.recoveryRaw !== null ||
    !!latest.current.storageError;
  const apply = (raw: unknown) => {
    const m = latest.current;
    const next = hydrateState(raw, m.defaults);
    if (!m.update(() => next)) throw Error("Local conflict");
    m.setEditId(null);
    m.setAdvanced(false);
    return JSON.stringify(next);
  };
  async function connect(create: boolean) {
    if (busy || blocked()) return;
    const id = ++generation.current;
    setBusy(true);
    setStatus("busy");
    try {
      const local = JSON.stringify(latest.current.s);
      const result = create
        ? await cloudRequest(code, latest.current.s, null)
        : await cloudRequest(code);
      if (generation.current !== id) return;
      if (JSON.stringify(latest.current.s) !== local || blocked())
        throw new CloudError(409);
      if (!create && !result.state) throw Error("No shared plan");
      const baseline = create ? local : apply(result.state);
      setSession({ code, revision: result.revision, baseline });
      setAccessCode(code);
      setCode("");
      setStatus("synced");
      setExpanded(false);
    } catch (error) {
      if (generation.current === id)
        setStatus(
          error instanceof CloudError && error.status === 409
            ? "conflict"
            : "error",
        );
    } finally {
      if (generation.current === id) setBusy(false);
    }
  }
  useEffect(() => {
    if (!session) return;
    let disposed = false,
      paused = false,
      inFlight = false,
      requested = false;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = (delay: number) => {
      clearTimeout(timeout);
      timeout = setTimeout(sync, delay);
    };
    const sync = async (): Promise<void> => {
      if (disposed || paused || inFlight) return;
      if (document.visibilityState === "hidden" || !navigator.onLine) {
        schedule(5000);
        return;
      }
      if (blocked()) {
        schedule(1000);
        return;
      }
      inFlight = true;
      requested = false;
      // Do not replace a draft the user is editing.
      const m = latest.current;
      const raw = JSON.stringify(m.s);
      try {
        if (raw !== session.baseline) {
          setStatus("busy");
          const saved = await cloudRequest(session.code, m.s, session.revision);
          if (disposed) return;
          session.revision = saved.revision;
          session.baseline = raw;
          setStatus("synced");
        } else if (!m.editId && !m.advanced) {
          const result = await cloudRequest(session.code);
          if (disposed) return;
          if (result.revision !== session.revision) {
            if (
              !result.state ||
              blocked() ||
              JSON.stringify(latest.current.s) !== raw ||
              latest.current.editId ||
              latest.current.advanced
            )
              throw new CloudError(409);
            session.baseline = apply(result.state);
            session.revision = result.revision;
          }
          setStatus("synced");
        }
      } catch (error) {
        if (disposed) return;
        setStatus(
          error instanceof CloudError && error.status === 409
            ? "conflict"
            : "error",
        );
        // Pause on any error. Retrying is explicit, with local changes retained.
        paused = true;
        return;
      } finally {
        inFlight = false;
        if (!disposed && !paused) schedule(requested ? 400 : 5000);
      }
    };
    const wake = (delay = 400) => {
      if (disposed || paused) return;
      requested = true;
      if (!inFlight) schedule(delay);
    };
    const requestSync = () => wake();
    const foreground = () => {
      if (document.visibilityState !== "hidden" && navigator.onLine) wake(0);
    };
    wakeSync.current = requestSync;
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("online", foreground);
    schedule(800);
    return () => {
      disposed = true;
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", foreground);
      window.removeEventListener("online", foreground);
      if (wakeSync.current === requestSync) wakeSync.current = () => {};
    };
  }, [session]);
  useEffect(() => {
    if (session && JSON.stringify(model.s) !== session.baseline)
      wakeSync.current();
  }, [model.s, session]);
  function disconnect() {
    generation.current++;
    setSession(null);
    setAccessCode("");
    setCode("");
    setBusy(false);
    setStatus("local");
  }
  const displayStatus =
    status === "synced" &&
    session &&
    JSON.stringify(model.s) !== session.baseline
      ? "busy"
      : status;
  useEffect(() => {
    if (status === "error" || status === "conflict") setExpanded(true);
  }, [status]);
  const messages = {
    local: text(
      "Đang lưu trên thiết bị này. Nhập mã gia đình để dùng dữ liệu chung.",
      "Saved on this device. Enter your family code to share data.",
    ),
    busy: text("Đang đồng bộ…", "Syncing…"),
    synced: text(
      "Đã đồng bộ. Các thiết bị dùng cùng mã sẽ nhận thay đổi khi đang xem ứng dụng.",
      "Synced. Devices using the same code receive changes while the app is visible.",
    ),
    error: text(
      "Chưa đồng bộ được. Kiểm tra kết nối, mã gia đình và cấu hình dịch vụ. Bản trên thiết bị vẫn được giữ.",
      "Could not sync. Check your connection, family code and service configuration. Your device copy is retained.",
    ),
    conflict: text(
      "Có bản khác đã lưu. Xuất backup trước, rồi ngắt kết nối và mở bản dùng chung. Không tự ghi đè.",
      "A different copy was saved. Export a backup, then disconnect and open the shared copy. Nothing was overwritten.",
    ),
  };
  return (
    <section
      className="panel sync-panel"
      data-status={displayStatus}
      aria-label={text("Đồng bộ gia đình", "Family sync")}
    >
      <h2>
        <button
          type="button"
          className="sync-toggle"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded(!expanded)}
        >
          {displayStatus === "synced" ? (
            <CheckCircle2 size={20} aria-hidden="true" />
          ) : (
            <Cloud size={20} aria-hidden="true" />
          )}
          <span>{text("Đồng bộ gia đình", "Family sync")}</span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </h2>
      <p
        className="sync-status"
        role={status === "error" || status === "conflict" ? "alert" : "status"}
      >
        {!expanded && displayStatus === "local"
          ? text(
              "Chưa kết nối · Lưu trên thiết bị này",
              "Not connected · Saved on this device",
            )
          : !expanded && displayStatus === "synced"
            ? text("Đã đồng bộ.", "Synced.")
            : messages[displayStatus]}
      </p>
      <div id={detailsId} className="sync-details" hidden={!expanded}>
        {status === "error" && (
          <p>
            <a href={signInUrl} target="_blank" rel="noopener noreferrer">
              {text("Đăng nhập lại trên tab mới", "Sign in again in a new tab")}
            </a>
          </p>
        )}
        {!session ? (
          <>
            <label>
              {text("Mã truy cập gia đình", "Family access code")}
              <input
                type="password"
                value={code}
                autoComplete="off"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    code.length >= 16 &&
                    !busy &&
                    !blocked()
                  ) {
                    event.preventDefault();
                    void connect(false);
                  }
                }}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <p className="caption">
              {text(
                "Mở bản dùng chung sẽ thay thế bản trên thiết bị. Xuất backup trước nếu cần giữ bản này. Lần đầu, chọn chia sẻ bản hiện tại.",
                "Opening shared data replaces this device's copy. Export a backup first if needed. For first-time setup, share the current copy.",
              )}
            </p>
            <div className="actions">
              <Button
                primary
                disabled={code.length < 16 || busy || blocked()}
                onClick={() => void connect(false)}
              >
                {text("Mở bản dùng chung", "Open shared data")}
              </Button>
              <Button
                className="small"
                disabled={code.length < 16 || busy || blocked()}
                onClick={() => void connect(true)}
              >
                {text(
                  "Chia sẻ bản hiện tại lần đầu",
                  "Share current copy for the first time",
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="actions">
            {status === "error" && (
              <Button onClick={() => setSession({ ...session })}>
                {text("Thử đồng bộ lại", "Retry sync")}
              </Button>
            )}
            <Button className="small" onClick={disconnect}>
              {text("Ngắt kết nối", "Disconnect")}
            </Button>
          </div>
        )}
        <Button className="small sync-backup" onClick={model.exportJSON}>
          {text("Xuất backup", "Export backup")}
        </Button>
      </div>
    </section>
  );
}
