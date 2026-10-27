import { useEffect, useRef, useState } from "react";
import { useText } from "src/i18n";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { Button } from "src/modules/shared-main/components";
export default function OfflineStatus() {
  const text = useText(),
    { s, editing, advanced, storageError } = useMealPlanner();
  const [online, setOnline] = useState(navigator.onLine),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const refreshing = useRef(false);
  useEffect(() => {
    const change = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void registration?.update().catch(() => {});
    };
    const foreground = () => {
      if (document.visibilityState === "visible") change();
    };
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    let disposed = false,
      registration: ServiceWorkerRegistration | undefined;
    const inspect = () => {
      if (!disposed && registration) {
        setWaiting(registration.waiting);
        setReady(!!registration.active);
      }
    };
    const installed = () => {
      const worker = registration?.installing;
      worker?.addEventListener("statechange", inspect);
    };
    const activated = () => {
      inspect();
      if (refreshing.current) window.location.reload();
    };
    if (
      import.meta.env.PROD &&
      "serviceWorker" in navigator &&
      window.isSecureContext
    ) {
      navigator.serviceWorker.addEventListener("controllerchange", activated);
      navigator.serviceWorker
        .register(import.meta.env.BASE_URL + "sw.js", {
          updateViaCache: "none",
        })
        .then((value) => {
          if (disposed) return;
          registration = value;
          inspect();
          installed();
          value.addEventListener("updatefound", installed);
        })
        .catch(() => {
          if (!disposed) setFailed(true);
        });
    }
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", foreground);
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
      registration?.removeEventListener("updatefound", installed);
      if ("serviceWorker" in navigator)
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          activated,
        );
    };
  }, []);
  const busy =
    !!editing || advanced || !!storageError || !!s.timer || !!s.timers?.length;
  return (
    <div className="offline-status" role="status">
      {!online
        ? text(
            "Đang offline — dữ liệu lưu trên thiết bị này",
            "Offline — data stays on this device",
          )
        : ready
          ? text("Đã sẵn sàng dùng offline", "Ready for offline use")
          : failed
            ? text(
                "Chưa tải được bản offline. Kết nối mạng và mở lại app để thử lại.",
                "Offline setup failed. Reconnect and reopen to retry.",
              )
            : import.meta.env.PROD
              ? text(
                  "Bản offline cần HTTPS và trình duyệt hỗ trợ; chờ tải lần đầu hoàn tất.",
                  "Offline use needs HTTPS and browser support; allow the initial download to finish.",
                )
              : null}
      <span>
        {text("Phiên bản", "Version")} {import.meta.env.APP_BUILD}
      </span>
      {waiting && (
        <>
          <span>{text("Có phiên bản mới", "Update available")}</span>
          <Button
            disabled={busy}
            onClick={() => {
              refreshing.current = true;
              waiting.postMessage("ACTIVATE_UPDATE");
            }}
          >
            {text("Tải phiên bản mới", "Load new version")}
          </Button>
          {busy && (
            <span>
              {text(
                "Lưu chỉnh sửa và kết thúc mẻ/timer trước khi cập nhật.",
                "Save edits and finish cooking/timers before updating.",
              )}
            </span>
          )}
        </>
      )}
    </div>
  );
}
