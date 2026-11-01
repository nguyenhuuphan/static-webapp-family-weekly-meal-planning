import { useState } from "react";
import { Cloud, CheckCircle2, ChevronDown, LoaderCircle } from "lucide-react";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useFamilyAccess } from "src/hooks/useFamilyAccess";
import { useText } from "src/i18n";
import { Button } from "src/modules/shared-main/components";
import { signInUrl } from "src/services/signIn";
export default function CloudSync() {
  const model = useMealPlanner(),
    { accessCode, setAccessCode } = useFamilyAccess(),
    text = useText();
  const [expanded, setExpanded] = useState(!accessCode),
    [code, setCode] = useState(accessCode),
    [busy, setBusy] = useState(false);
  const ready = model.apiStatus === "synced",
    pending = model.apiBusy || model.apiStatus === "loading";
  async function connect() {
    if (busy) return;
    setBusy(true);
    if (await model.connectApi(code)) {
      setAccessCode(code);
      setExpanded(false);
    }
    setBusy(false);
  }
  return (
    <section
      className="panel sync-panel"
      data-status={model.apiStatus}
      aria-label={text("Đồng bộ gia đình", "Family sync")}
    >
      <h2>
        <button
          className="sync-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {ready ? (
            <CheckCircle2 size={20} />
          ) : pending ? (
            <LoaderCircle className="ai-spinner" size={20} />
          ) : (
            <Cloud size={20} />
          )}
          <span>{text("Dữ liệu gia đình", "Family data")}</span>
          <ChevronDown size={18} />
        </button>
      </h2>
      <p className="sync-status" role="status">
        {ready
          ? text(
              "Đã lưu trên máy chủ. Các thiết bị dùng chung dữ liệu.",
              "Saved on the server. Devices share the same data.",
            )
          : pending
            ? text("Đang xử lý qua API…", "Connecting / saving…")
            : model.apiStatus === "error"
              ? text(
                  "Chưa xác nhận được kết nối hoặc lần lưu. Dữ liệu đã lưu trên máy chủ vẫn được giữ.",
                  "The connection or save could not be confirmed. Previously saved server data is retained.",
                )
              : text(
                  "Kết nối mã gia đình để xem và lưu dữ liệu dùng chung.",
                  "Connect your family code to read and save your shared data.",
                )}
      </p>
      {(expanded || model.apiStatus === "error") && (
        <div className="sync-details">
          <label>
            {text("Mã truy cập gia đình", "Family access code")}
            <input
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length >= 16) void connect();
              }}
            />
          </label>
          <div className="actions">
            <Button
              primary
              disabled={busy || code.length < 16 || pending}
              onClick={() => void connect()}
            >
              {text("Kết nối dữ liệu gia đình", "Connect family data")}
            </Button>
            {model.apiStatus === "error" && (
              <Button
                disabled={busy || pending}
                onClick={() => void model.retryApi()}
              >
                {text("Thử lại kết nối / lần lưu", "Retry connection / save")}
              </Button>
            )}
            <Button
              disabled={pending || model.hasPendingSave}
              onClick={() => {
                model.disconnectApi();
                setAccessCode("");
                setCode("");
              }}
            >
              {text("Quên mã trên thiết bị này", "Forget code on this device")}
            </Button>
            <Button onClick={model.exportJSON}>
              {text("Xuất backup", "Export backup")}
            </Button>
          </div>
          <p className="caption">
            {text(
              "Bản trên trình duyệt dùng để xem khi mất mạng. Các thay đổi chỉ được xác nhận sau khi máy chủ lưu thành công.",
              "The browser copy is an offline read cache. Changes are confirmed only after the server saves successfully.",
            )}
          </p>
          {model.apiStatus === "error" && (
            <a href={signInUrl} target="_blank" rel="noopener noreferrer">
              {text("Đăng nhập lại trên tab mới", "Sign in again in a new tab")}
            </a>
          )}
        </div>
      )}
    </section>
  );
}
