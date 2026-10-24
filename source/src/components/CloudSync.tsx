import { useEffect, useRef, useState } from "react";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useText } from "src/i18n";
import { hydrateState } from "src/domain";
import { cloudRequest, CloudError } from "src/services/cloudPlanService";
import { Button } from "src/modules/shared-main/components";

type Session = { code: string; revision: string | null; baseline: string };
export default function CloudSync() {
  const model = useMealPlanner();
  const text = useText();
  const [code, setCode] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<
    "local" | "busy" | "synced" | "error" | "conflict"
  >("local");
  const [busy, setBusy] = useState(false);
  const latest = useRef(model);
  latest.current = model;
  const generation = useRef(0);
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
      setCode("");
      setStatus("synced");
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
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout>;
    const sync = async () => {
      if (disposed) return;
      if (blocked()) {
        timeout = setTimeout(sync, 1000);
        return;
      }
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
        return;
      }
      timeout = setTimeout(sync, 2000);
    };
    timeout = setTimeout(sync, 800);
    return () => {
      disposed = true;
      clearTimeout(timeout);
    };
  }, [session]);
  function disconnect() {
    generation.current++;
    setSession(null);
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
  const messages = {
    local: text(
      "Đang lưu trên thiết bị này. Nhập mã gia đình để dùng dữ liệu chung.",
      "Saved on this device. Enter your family code to share data.",
    ),
    busy: text("Đang đồng bộ…", "Syncing…"),
    synced: text(
      "Đã đồng bộ. Các thiết bị dùng cùng mã sẽ nhận thay đổi khi đang mở ứng dụng.",
      "Synced. Devices using the same code receive changes while the app is open.",
    ),
    error: text(
      "Chưa đồng bộ được. Kiểm tra kết nối, mã gia đình và cấu hình Netlify. Bản trên thiết bị vẫn được giữ.",
      "Could not sync. Check your connection, family code and Netlify configuration. Your device copy is retained.",
    ),
    conflict: text(
      "Có bản khác đã lưu. Xuất backup trước, rồi ngắt kết nối và mở bản dùng chung. Không tự ghi đè.",
      "A different copy was saved. Export a backup, then disconnect and open the shared copy. Nothing was overwritten.",
    ),
  };
  return (
    <details
      className="panel"
      open={status === "error" || status === "conflict" || undefined}
    >
      <summary>{text("Đồng bộ gia đình", "Family sync")}</summary>
      <p role="status">{messages[displayStatus]}</p>
      {!session ? (
        <>
          <label>
            {text("Mã truy cập gia đình", "Family access code")}
            <input
              type="password"
              value={code}
              autoComplete="off"
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
              disabled={code.length < 16 || busy || blocked()}
              onClick={() => void connect(false)}
            >
              {text("Mở bản dùng chung", "Open shared data")}
            </Button>
            <Button
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
          <Button onClick={disconnect}>
            {text("Ngắt kết nối", "Disconnect")}
          </Button>
        </div>
      )}
      <Button onClick={model.exportJSON}>
        {text("Xuất backup", "Export backup")}
      </Button>
    </details>
  );
}
