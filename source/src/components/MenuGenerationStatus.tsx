import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import type { MenuInput, MenuJob } from "src/ai/contracts";
import { useI18n, useText } from "src/i18n";
import { Button } from "src/modules/shared-main/components";

export default function MenuGenerationStatus({
  job,
  input,
  submitting,
  error,
  retry,
  edit,
  disabled,
}: {
  job: MenuJob | null;
  input: MenuInput;
  submitting: boolean;
  error: string;
  retry: () => void;
  edit: () => void;
  disabled: boolean;
}) {
  const text = useText(),
    { content } = useI18n();
  const running =
    submitting || job?.status === "queued" || job?.status === "running";
  const ready = job?.status === "ready";
  const progress = job?.providerProgress;
  const total = input.mealTypes.length + 1;
  const completed = Math.min(progress?.completedBatches || 0, total);
  const title = running
    ? submitting
      ? text("Đang gửi yêu cầu…", "Submitting your request…")
      : job?.status === "queued"
        ? text(
            "Đã nhận yêu cầu, đang chờ AI…",
            "Request received. Waiting for AI…",
          )
        : text("Đang tạo thực đơn…", "Creating your menu…")
    : ready
      ? text("Bản nháp đã sẵn sàng", "Your draft is ready")
      : text("Chưa tạo được thực đơn", "Could not complete your menu");
  const activity =
    progress?.activity === "repairing_translations"
      ? text(
          "Đang kiểm tra và sửa bản dịch Anh–Việt",
          "Checking and repairing English–Vietnamese translations",
        )
      : progress?.activity === "planning_alternatives"
        ? text(
            "Đang chọn 5 món thay thế khác nhau",
            "Choosing 5 distinct alternatives",
          )
        : progress?.activity === "validating"
          ? text(
              "Đang kiểm tra thực đơn và các yêu cầu của bạn",
              "Validating the menu against your requests",
            )
          : progress?.batch === "alternatives"
            ? text(
                "Đang viết công thức cho 5 món thay thế",
                "Writing recipes for 5 alternatives",
              )
            : progress
              ? text("Đang tạo: ", "Generating ") + content(progress.batch)
              : text(
                  "Đang kết nối hệ thống AI",
                  "Connecting to an AI provider",
                );
  return (
    <section
      className={`ai-generation-state ${running ? "is-running" : ready ? "is-ready" : "is-failed"}`}
      aria-label={text("Trạng thái tạo thực đơn", "Menu generation status")}
    >
      <div
        className="ai-generation-heading"
        role={running || ready ? "status" : "alert"}
        aria-live="polite"
        aria-atomic="true"
      >
        {running ? (
          <LoaderCircle className="ai-spinner" size={26} aria-hidden="true" />
        ) : ready ? (
          <CheckCircle2 size={26} aria-hidden="true" />
        ) : (
          <CircleAlert size={26} aria-hidden="true" />
        )}
        <div>
          <h4>{title}</h4>
          <p>
            {running
              ? activity
              : ready
                ? text(
                    "Xem lại các món bên dưới. Bấm Áp dụng để dùng thực đơn này.",
                    "Review the meals below, then choose Apply this menu to use them.",
                  )
                : error}
          </p>
        </div>
      </div>
      {running && (
        <>
          <progress
            className="ai-generation-progress"
            aria-label={text(
              "Tiến trình tạo thực đơn",
              "Menu generation progress",
            )}
            max={total}
            {...(completed ? { value: completed } : {})}
          />
          <ol
            className="ai-generation-batches"
            aria-label={text("Các nhóm thực đơn", "Menu batches")}
          >
            {[...input.mealTypes, "alternatives"].map((batch, index) => (
              <li
                key={batch}
                className={
                  index < completed
                    ? "complete"
                    : progress?.batch === batch
                      ? "active"
                      : ""
                }
                aria-current={index === completed ? "step" : undefined}
              >
                <span aria-hidden="true">
                  {index < completed ? "✓" : index + 1}
                </span>
                {batch === "alternatives"
                  ? text("5 món thay thế", "5 alternatives")
                  : content(batch)}
              </li>
            ))}
          </ol>
          <p className="caption">
            {text(
              "Có thể mất vài phút. Bạn có thể đóng popup và mở lại để tiếp tục theo dõi.",
              "This can take a few minutes. You can close this dialog and reopen it to check progress.",
            )}
          </p>
        </>
      )}
      <p className="caption">
        {ready
          ? text("Đã tạo ", "Created ") +
            `${job.plan?.meals.length || 0} ` +
            text("bữa ăn", "meals") +
            ` · ${job.plan?.alternatives?.length || 0} ` +
            text("món thay thế", "alternatives")
          : running
            ? `${input.days.length * input.mealTypes.length} ` +
              text("bữa ăn", "meals") +
              " + 5 " +
              text("món thay thế", "alternatives")
            : text(
                "Lần tạo bị lỗi không bị tính vào số lượt của gia đình. Hạn mức của dịch vụ AI vẫn áp dụng.",
                "Failed generations do not use your family menu allowance. AI provider limits still apply.",
              )}
      </p>
      <p className="caption">
        {text(
          "Thực đơn đang dùng được giữ nguyên cho đến khi bạn áp dụng bản nháp mới.",
          "Your current menu stays unchanged until you apply a new draft.",
        )}
      </p>
      {!running && !ready && (
        <div className="actions ai-retry-actions">
          <Button primary disabled={disabled} onClick={retry}>
            <RotateCcw size={16} aria-hidden="true" />
            {text("Thử tạo lại", "Retry generation")}
          </Button>
          <Button onClick={edit}>
            {text("Chỉnh sửa yêu cầu", "Edit request")}
          </Button>
        </div>
      )}
    </section>
  );
}
