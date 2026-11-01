import { useEffect, useRef, useState } from "react";
import { BarChart3, LoaderCircle, RefreshCw } from "lucide-react";
import { useText, useI18n } from "src/i18n";
import { useFamilyAccess } from "src/hooks/useFamilyAccess";
import { plannerRequest } from "src/services/plannerApi";
import { localPurchaseDate } from "src/helpers/purchaseHistory";
import { Heading, Button } from "src/modules/shared-main/components";
import type { ApiReport } from "../../../api/reports";
function money(amount: string, currency: string, language: string) {
  const scale = currency === "VND" ? 1 : 100;
  const value = BigInt(amount);
  if (value <= BigInt(Number.MAX_SAFE_INTEGER))
    return new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "VND" ? 0 : 2,
    }).format(Number(value) / scale);
  return `${(value / BigInt(scale)).toLocaleString(language === "vi" ? "vi-VN" : "en-US")}${scale === 100 ? "." + String(value % 100n).padStart(2, "0") : ""} ${currency}`;
}
export default function Reports() {
  const text = useText(),
    { language } = useI18n(),
    { accessCode } = useFamilyAccess();
  const [to, setTo] = useState(localPurchaseDate),
    [from, setFrom] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
    [report, setReport] = useState<ApiReport | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef(0);
  async function load() {
    const current = ++request.current;
    setBusy(true);
    setError("");
    try {
      const value = await plannerRequest<ApiReport>(
        accessCode,
        `reports?from=${from}&to=${to}&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
      );
      if (current === request.current) setReport(value);
    } catch {
      if (current === request.current)
        setError(
          text(
            "Chưa tải được báo cáo. Kiểm tra kết nối và mã gia đình rồi thử lại.",
            "Could not load the report. Check your connection and family code, then retry.",
          ),
        );
    } finally {
      if (current === request.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (accessCode) void load();
    else setReport(null);
    return () => {
      request.current++;
    };
  }, [accessCode]);
  const actionName = (kind: string) => {
    const labels: Record<string, [string, string]> = {
      "view.open": ["Xem màn hình", "View screen"],
      "purchase.record": ["Ghi lần mua", "Record purchase"],
      "purchase.update": ["Sửa giá mua", "Edit purchase price"],
      "invoice.save": ["Lưu hóa đơn", "Save receipt"],
      "prep.complete": ["Đánh dấu sơ chế", "Update preparation"],
      "prep.restore": ["Hoàn tác sơ chế", "Undo preparation"],
      "progress.set": ["Cập nhật tiến độ", "Update progress"],
      "meal.portions": ["Đổi số người ăn", "Change diners"],
      "menu.apply": ["Áp dụng thực đơn", "Apply menu"],
      "cooking.finish": ["Hoàn tất bữa ăn", "Finish meal"],
      "cooking.quick": ["Ghi bữa ăn đã nấu", "Record completed meal"],
      "cooking.begin": ["Bắt đầu nấu", "Begin cooking"],
      "cooking.cancel": ["Hủy lượt nấu", "Cancel cooking"],
      "cooking.step": ["Cập nhật bước nấu", "Update cooking step"],
      "timer.start": ["Bắt đầu hẹn giờ", "Start timer"],
      "timer.change": ["Điều chỉnh hẹn giờ", "Adjust timer"],
      "week.start": ["Bắt đầu tuần", "Start week"],
      "state.restore": ["Khôi phục dữ liệu", "Restore backup"],
      "state.undo": ["Hoàn tác", "Undo"],
      "migration.import": ["Chuyển dữ liệu cũ", "Import existing data"],
    };
    if (labels[kind]) return text(...labels[kind]);
    if (kind.startsWith("saved."))
      return text("Cập nhật thức ăn giữ lại", "Update saved food");
    if (kind.startsWith("avoidance."))
      return text("Cập nhật món cần tránh", "Update food preferences");
    return text("Cập nhật kế hoạch", "Update plan");
  };
  return (
    <>
      <Heading
        eyebrow={text(
          "Theo dõi chi tiêu & sinh hoạt",
          "Spending & household activity",
        )}
        title={text("Báo cáo gia đình", "Family reports")}
        description={text(
          "Tổng hợp từ các hóa đơn, giá mua và bữa ăn đã ghi nhận.",
          "Calculated from recorded receipts, purchases and meals.",
        )}
      />
      <section className="panel report-filters">
        <label>
          {text("Từ ngày", "From date")}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          {text("Đến ngày", "To date")}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <Button
          primary
          disabled={busy || !accessCode || !from || !to || from > to}
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
          {text("Xem báo cáo", "Load report")}
        </Button>
      </section>
      {busy && (
        <p role="status">
          <LoaderCircle className="ai-spinner" size={18} />
          {text("Đang tổng hợp báo cáo…", "Calculating report…")}
        </p>
      )}
      {error && (
        <p role="alert" className="notice warning">
          {error}
        </p>
      )}
      {!accessCode && (
        <p className="notice">
          {text(
            "Kết nối mã gia đình để xem báo cáo.",
            "Connect your family code to view reports.",
          )}
        </p>
      )}
      {report && (
        <>
          <p className="caption">
            {text("Khoảng báo cáo", "Reporting period")}: {report.from} →{" "}
            {report.to}
          </p>
          <div className="report-cards">
            {report.spending.map((value) => (
              <article className="panel" key={value.currency}>
                <span>
                  {text("Chi tiêu đã ghi", "Recorded spending")} ·{" "}
                  {value.currency}
                </span>
                <strong>
                  {money(value.amountMinor, value.currency, language)}
                </strong>
              </article>
            ))}
            {[
              [text("Hóa đơn", "Receipts"), report.invoices],
              [text("Lần mua", "Purchases"), report.purchases],
              [
                text("Bữa ăn đã ghi", "Recorded meals"),
                report.cooking.recordedMeals,
              ],
              [text("Phần đã ăn", "Portions eaten"), report.cooking.eaten],
              [
                text("Phần dư đã ghi", "Recorded leftovers"),
                report.cooking.leftovers,
              ],
            ].map(([label, value]) => (
              <article className="panel" key={String(label)}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <p className="caption">
            {text(
              "Tổng hóa đơn và các lần mua chưa nằm trong tổng hóa đơn được cộng riêng, không tính trùng. Các loại tiền tệ không cộng lẫn.",
              "Invoice totals and purchases not covered by an invoice total are counted once. Different currencies are never combined.",
            )}
          </p>
          {report.unpricedPurchases > 0 && (
            <p className="notice">
              {text(
                `Có ${report.unpricedPurchases} lần mua chưa ghi giá nên chưa nằm trong tổng chi tiêu.`,
                `${report.unpricedPurchases} purchases have no recorded price and are excluded from spending.`,
              )}
            </p>
          )}
          <section className="panel">
            <h2>
              <BarChart3 size={20} />{" "}
              {text("Chi tiêu theo ngày", "Daily spending")}
            </h2>
            {report.dailySpend.length ? (
              <div className="report-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{text("Ngày", "Date")}</th>
                      <th>{text("Tiền tệ", "Currency")}</th>
                      <th>{text("Tổng đã ghi", "Recorded total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.dailySpend.map((row) => (
                      <tr key={row.date + row.currency}>
                        <td>{row.date}</td>
                        <td>{row.currency}</td>
                        <td>
                          {money(row.amountMinor, row.currency, language)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                {text(
                  "Chưa có chi tiêu trong khoảng ngày này.",
                  "No spending recorded in this period.",
                )}
              </p>
            )}
          </section>
          <section className="panel">
            <h2>{text("Hoạt động sử dụng", "Usage activity")}</h2>
            <p>
              {text(
                `${report.activity.activeDevices} thiết bị hoạt động · ${report.activity.total} thao tác đã ghi`,
                `${report.activity.activeDevices} active devices · ${report.activity.total} recorded actions`,
              )}
            </p>
            <p className="caption">
              {text(
                "Nhật ký lưu tối đa 90 ngày, chỉ ghi loại thao tác và màn hình. Nội dung prompt, ảnh hóa đơn và thông tin đăng nhập không nằm trong nhật ký.",
                "Activity is retained for up to 90 days and includes only action types and screens. Prompt contents, receipt images and sign-in details are excluded.",
              )}
            </p>
            <div className="report-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{text("Loại thao tác", "Action")}</th>
                    <th>{text("Số lần", "Count")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.activity.actions.map((row) => (
                    <tr key={row.kind}>
                      <td>{actionName(row.kind)}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
