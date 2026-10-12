import { useEffect, useRef, useState } from "react";
export function useScreenWakeLock() {
  const supported =
    window.isSecureContext && typeof navigator.wakeLock?.request === "function";
  const [enabled, setEnabled] = useState(false),
    [visible, setVisible] = useState(document.visibilityState === "visible"),
    [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<
    "off" | "requesting" | "active" | "released" | "error"
  >("off");
  const sentinel = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    const changed = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(() => {
    if (!enabled || !supported) {
      setStatus("off");
      return;
    }
    if (!visible) {
      setStatus("released");
      return;
    }
    let disposed = false,
      acquired: WakeLockSentinel | undefined;
    setStatus("requesting");
    navigator.wakeLock
      .request("screen")
      .then((lock) => {
        if (disposed) {
          void lock.release().catch(() => {});
          return;
        }
        acquired = lock;
        sentinel.current = lock;
        setStatus(lock.released ? "released" : "active");
        lock.addEventListener("release", () => {
          if (!disposed) {
            sentinel.current = null;
            setStatus("released");
          }
        });
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
      if (acquired) {
        if (sentinel.current === acquired) sentinel.current = null;
        void acquired.release().catch(() => {});
      }
    };
  }, [enabled, visible, supported, attempt]);
  return {
    supported,
    enabled,
    setEnabled,
    status,
    retry: () => setAttempt((value) => value + 1),
  };
}
