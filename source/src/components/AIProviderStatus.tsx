import { Button } from "src/modules/shared-main/components";
import { useI18n, useText } from "src/i18n";
import type {
  AIProvider,
  MenuAllowance,
  MenuJob,
  MenuProviders,
} from "src/ai/contracts";
const names: Record<AIProvider, string> = {
  gemini: "Gemini",
  cloudflare: "Cloudflare AI",
};
export default function AIProviderStatus({
  job,
  providers,
  quota,
  refreshAllowance,
  busy,
}: {
  job: MenuJob | null;
  providers?: MenuProviders;
  quota?: MenuAllowance;
  refreshAllowance?: () => void;
  busy?: boolean;
}) {
  const text = useText(),
    { language, content } = useI18n();
  const progress = job?.providerProgress;
  const generating = job?.status === "running" || job?.status === "queued";
  const configured = providers
    ? [
        providers.gemini.configured && "Gemini",
        providers.cloudflare.configured && "Cloudflare AI",
      ]
        .filter(Boolean)
        .join(" → ")
    : null;
  const title = generating
    ? progress
      ? text(
          `Đang dùng ${names[progress.provider]}`,
          `Using ${names[progress.provider]}`,
        )
      : text("Đang chờ hệ thống AI", "Waiting for an AI provider")
    : job?.status === "ready"
      ? job.providersUsed?.length
        ? text("Đã tạo bằng: ", "Generated with: ") +
          job.providersUsed.map((p) => names[p]).join(" + ")
        : text(
            "Menu cũ chưa ghi nhận hệ thống AI",
            "Provider was not recorded for this older menu",
          )
      : job?.status === "failed" && progress
        ? text("Lần thử cuối: ", "Last attempted: ") + names[progress.provider]
        : configured ||
          text("Kết nối để xem hệ thống AI", "Connect to view AI providers");
  const reset =
    quota && Number.isFinite(Date.parse(quota.resetsAt))
      ? new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(new Date(quota.resetsAt))
      : null;
  return (
    <section
      className="ai-provider-status"
      aria-label={text("Hệ thống AI và số lượt", "AI provider and allowance")}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="eyebrow">{text("Hệ thống AI", "AI provider")}</span>
      <strong>{title}</strong>
      {generating && progress && (
        <span>
          {progress.batch === "alternatives"
            ? text("Đang tạo 5 món thay thế", "Generating 5 alternatives")
            : text("Đang tạo bữa ", "Generating ") + content(progress.batch)}
        </span>
      )}
      {generating &&
        progress?.provider === "cloudflare" &&
        progress.fallbackReason && (
          <span className="caption">
            {progress.fallbackReason === "not_configured"
              ? text(
                  "Gemini chưa được bật; đang dùng Cloudflare AI.",
                  "Gemini is not configured; using Cloudflare AI.",
                )
              : progress.fallbackReason === "quota"
                ? text(
                    "Gemini đã hết hạn mức; tự động chuyển sang Cloudflare AI.",
                    "Gemini reached its quota; automatically switched to Cloudflare AI.",
                  )
                : text(
                    "Gemini chưa trả về kết quả hợp lệ; đã chuyển sang Cloudflare AI.",
                    "Gemini could not return a valid result; switched to Cloudflare AI.",
                  )}
          </span>
        )}
      {!generating &&
        providers?.gemini.configured &&
        providers.cloudflare.configured && (
          <span className="caption">
            {text(
              "Gemini là AI chính · Cloudflare AI tự động dự phòng",
              "Gemini is primary · Cloudflare AI is the automatic backup",
            )}
          </span>
        )}
      {quota && (
        <div className="ai-allowance">
          <span>
            {text(
              `Còn ${quota.remaining}/${quota.limit} lượt tạo menu hôm nay`,
              `${quota.remaining}/${quota.limit} family menu generations remaining today`,
            )}
          </span>
          <span>
            {text(
              "Lượt lỗi không bị tính. Hạn mức miễn phí của từng dịch vụ vẫn áp dụng.",
              "Failed attempts do not count. Each provider's free-tier limits still apply.",
            )}
          </span>
          {reset && (
            <span>
              {text("Đặt lại lúc: ", "Resets: ")}
              {reset}
            </span>
          )}
          {quota.remaining === 0 && refreshAllowance && (
            <Button
              className="small"
              disabled={busy}
              onClick={refreshAllowance}
            >
              {text("Kiểm tra lại số lượt", "Refresh allowance")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
