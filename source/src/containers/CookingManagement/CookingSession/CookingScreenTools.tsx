import { useScreenWakeLock } from "src/hooks/useScreenWakeLock";
import { useText } from "src/i18n";
import { Button } from "src/modules/shared-main/components";
export default function CookingScreenTools() {
  const text = useText(),
    lock = useScreenWakeLock();
  const labels = {
    off: text("Đang tắt", "Off"),
    requesting: text("Đang yêu cầu giữ sáng…", "Requesting screen lock…"),
    active: text("Đang giữ màn hình sáng", "Keeping the screen awake"),
    released: text(
      "Hệ thống đã thả khóa hoặc app đang ở nền",
      "Screen lock released or app is in the background",
    ),
    error: text(
      "Không giữ sáng được; hệ thống có thể từ chối khi pin yếu hoặc tiết kiệm pin",
      "Screen lock unavailable; low battery or power saving may prevent it",
    ),
  };
  return (
    <section
      className="panel cooking-screen-tools"
      aria-label={text("Màn hình khi nấu", "Cooking screen tools")}
    >
      <label>
        <input
          type="checkbox"
          disabled={!lock.supported}
          checked={lock.enabled}
          onChange={(e) => lock.setEnabled(e.target.checked)}
        />
        {text("Giữ màn hình sáng", "Keep screen awake")}
      </label>
      <p role="status">
        {lock.supported
          ? labels[lock.status]
          : text(
              "Trình duyệt này chưa hỗ trợ giữ sáng, hoặc app chưa chạy qua HTTPS.",
              "Screen wake lock needs browser support and HTTPS.",
            )}
      </p>
      {lock.enabled && ["error", "released"].includes(lock.status) && (
        <Button onClick={lock.retry}>
          {text("Thử giữ sáng lại", "Retry screen lock")}
        </Button>
      )}
      <p className="caption">
        {text(
          "Giữ sáng chỉ có tác dụng khi app đang mở và hiển thị. Nếu cần báo giờ khi khóa máy hoặc đóng app, hãy đặt thêm timer của điện thoại; âm báo web có thể bị hệ điều hành tạm dừng.",
          "Screen lock works while this app is visible. For an alarm with the phone locked or app closed, also set a phone timer; the operating system may suspend web alerts.",
        )}
      </p>
    </section>
  );
}
