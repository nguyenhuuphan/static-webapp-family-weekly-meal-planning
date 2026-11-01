import { useState } from "react";
import { Receipt, Search, Plus, Image as ImageIcon } from "lucide-react";
import { useI18n, useText } from "src/i18n";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { Button } from "src/modules/shared-main/components";
import {
  CURRENCIES,
  formatMoney,
  moneyInput,
  parseMoney,
  purchaseName,
  validatePurchaseHistory,
  type Money,
  type ShoppingInvoice,
} from "src/helpers/purchaseHistory";
import InvoiceEditor from "./InvoiceEditor";
import PhotoViewer from "./PhotoViewer";
import type { State } from "src/types";
const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
export default function PurchaseHistory() {
  const text = useText(),
    { content, language, unit } = useI18n(),
    { s } = useMealPlanner();
  const [query, setQuery] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [editing, setEditing] = useState<ShoppingInvoice | "new" | null>(null),
    [photo, setPhoto] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const purchases = s.purchaseReceipts || [],
    invoices = s.shoppingInvoices || [];
  const withinDates = (date: string) =>
    (!from || date >= from) && (!to || date <= to);
  const matches = (values: string[]) =>
    values.some((v) => normalized(v).includes(normalized(query.trim())));
  const history = [...purchases]
    .filter(
      (r) =>
        withinDates(r.purchasedOn || r.at.slice(0, 10)) &&
        matches([
          purchaseName(s, r),
          content(purchaseName(s, r)),
          r.shop || "",
          invoices.find((i) => i.id === r.invoiceId)?.shop || "",
        ]),
    )
    .sort((a, b) =>
      (b.purchasedOn || b.at).localeCompare(a.purchasedOn || a.at),
    );
  const filteredInvoices = [...invoices]
    .filter(
      (i) =>
        withinDates(i.purchasedOn) &&
        matches([
          i.shop,
          i.note,
          ...purchases
            .filter((r) => r.invoiceId === i.id)
            .flatMap((r) => [purchaseName(s, r), content(purchaseName(s, r))]),
        ]),
    )
    .sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn));
  return (
    <section
      className="purchase-history"
      aria-label={text(
        "Lịch sử mua và hóa đơn",
        "Purchase history and receipts",
      )}
    >
      <div className="receipt-section-heading">
        <div>
          <h2>{text("Tra cứu mua sắm", "Find purchases & receipts")}</h2>
          <p>
            {text(
              "Lưu giá đã trả và ảnh hóa đơn để tra cứu qua các tuần.",
              "Keep paid prices and receipt photos to look up across weeks.",
            )}
          </p>
        </div>
        <Button
          primary
          disabled={!!editing}
          onClick={() => {
            setEditing("new");
            setNotice("");
          }}
        >
          <Plus aria-hidden="true" size={17} />
          {text("Thêm hóa đơn", "Add receipt")}
        </Button>
      </div>
      {editing && (
        <InvoiceEditor
          key={editing === "new" ? "new" : editing.id}
          invoice={editing === "new" ? undefined : editing}
          done={(saved) => {
            if (saved) {
              setNotice(text("Đã lưu hóa đơn.", "Receipt saved."));
              if (editing === "new") {
                setQuery("");
                setFrom("");
                setTo("");
              }
            }
            setEditing(null);
          }}
        />
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="receipt-search-grid">
        <label>
          {text(
            "Tìm tên hàng, cửa hàng, ghi chú",
            "Search items, shops or notes",
          )}
          <span className="receipt-search-input">
            <Search aria-hidden="true" size={17} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={text(
                "Ví dụ: cá hồi, siêu thị…",
                "For example: salmon, supermarket…",
              )}
            />
          </span>
        </label>
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
      </div>
      {from && to && from > to && (
        <p role="alert">
          {text(
            "Ngày kết thúc phải từ ngày bắt đầu trở đi.",
            "The end date must be on or after the start date.",
          )}
        </p>
      )}
      <h3>
        <Receipt aria-hidden="true" size={18} />{" "}
        {text("Hóa đơn đã lưu", "Saved receipts")} ({filteredInvoices.length})
      </h3>
      <div className="receipt-invoice-list">
        {filteredInvoices.map((i) => {
          const linked = purchases.filter((r) => r.invoiceId === i.id);
          return (
            <article className="panel receipt-card" key={i.id}>
              <div className="receipt-card-heading">
                <div>
                  <h4>
                    {i.shop || text("Chưa ghi nơi mua", "Shop not recorded")}
                  </h4>
                  <p>{i.purchasedOn}</p>
                </div>
                <strong>
                  {i.total
                    ? formatMoney(i.total, language)
                    : text("Chưa ghi tổng tiền", "Total not recorded")}
                </strong>
              </div>
              {i.note && <p className="receipt-note">{i.note}</p>}
              {!!linked.length && (
                <ul>
                  {linked.map((r) => (
                    <li key={r.id}>
                      {content(purchaseName(s, r))} · {r.qty}{" "}
                      {unit(r.unit as "g")}{" "}
                      {r.paid ? `· ${formatMoney(r.paid, language)}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              <div className="actions">
                {i.photos.map((id, index) => (
                  <Button key={id} onClick={() => setPhoto(id)}>
                    <ImageIcon aria-hidden="true" size={16} />
                    {text("Xem ảnh", "View photo")} {index + 1}
                  </Button>
                ))}
                <Button disabled={!!editing} onClick={() => setEditing(i)}>
                  {text("Sửa hóa đơn", "Edit receipt")}
                </Button>
              </div>
              {!i.photos.length && (
                <p className="caption">
                  {text("Chưa có ảnh hóa đơn.", "No receipt photos yet.")}
                </p>
              )}
            </article>
          );
        })}
      </div>
      {!filteredInvoices.length && (
        <p className="panel empty">
          {invoices.length
            ? text("Không tìm thấy hóa đơn phù hợp.", "No matching receipts.")
            : text(
                "Chưa có hóa đơn. Thêm hóa đơn rồi chụp ảnh hoặc chọn từ thư viện.",
                "No receipts yet. Add a receipt and take a photo or choose from your library.",
              )}
        </p>
      )}
      <h3>
        {text("Giá các lần mua", "Purchase prices")} ({history.length})
      </h3>
      <div className="purchase-record-list">
        {history.map((r) => (
          <PurchaseRecord
            key={r.id}
            receipt={r}
            onSaved={() =>
              setNotice(text("Đã lưu giá mua.", "Purchase price saved."))
            }
          />
        ))}
      </div>
      {!history.length && (
        <p className="panel empty">
          {purchases.length
            ? text("Không tìm thấy lần mua phù hợp.", "No matching purchases.")
            : text(
                "Trong danh sách mua sắm, chọn “Ghi lượng mua thực tế” để ghi lượng, giá và gắn hóa đơn.",
                "Choose “Record actual purchase” in the shopping list to save quantities, prices and link a receipt.",
              )}
        </p>
      )}
      <p className="caption">
        {text(
          "Giá mua và thông tin hóa đơn đi cùng Đồng bộ gia đình. Ảnh cần kết nối Internet và mã gia đình để lưu/xem trên thiết bị khác.",
          "Prices and receipt details use Family sync. Saving or viewing photos across devices requires Internet and the family code.",
        )}
      </p>
      {photo && <PhotoViewer id={photo} close={() => setPhoto(null)} />}
    </section>
  );
}
function PurchaseRecord({
  receipt: r,
  onSaved,
}: {
  receipt: NonNullable<State["purchaseReceipts"]>[number];
  onSaved: () => void;
}) {
  const text = useText(),
    { content, language, unit } = useI18n(),
    { s, command, apiBusy } = useMealPlanner();
  const [editing, setEditing] = useState(false),
    [amount, setAmount] = useState(moneyInput(r.paid)),
    [currency, setCurrency] = useState<Money["currency"]>(
      r.paid?.currency || "VND",
    ),
    [invoiceId, setInvoiceId] = useState(r.invoiceId || ""),
    [error, setError] = useState(false);
  async function save() {
    try {
      const paid = parseMoney(amount, currency);
      const updated = await command("purchase.update", {
        id: r.id,
        paid,
        invoiceId: invoiceId || undefined,
      });
      if (updated) {
        setEditing(false);
        setError(false);
        onSaved();
      }
    } catch {
      setError(true);
    }
  }
  const per = r.paid
    ? {
        ...r.paid,
        amount: Math.round(
          (r.paid.amount / r.qty) * (["g", "ml"].includes(r.unit) ? 1000 : 1),
        ),
      }
    : null;
  return (
    <article className="panel purchase-record">
      <div className="receipt-card-heading">
        <div>
          <h4>{content(purchaseName(s, r))}</h4>
          <p>
            {r.purchasedOn || new Date(r.at).toLocaleDateString()} · {r.qty}{" "}
            {unit(r.unit as "g")} {r.shop ? `· ${r.shop}` : ""}
          </p>
        </div>
        <div>
          <strong>
            {r.paid
              ? formatMoney(r.paid, language)
              : text("Chưa ghi giá", "Price not recorded")}
          </strong>
          {per && (
            <small>
              {formatMoney(per, language)} /{" "}
              {r.unit === "g"
                ? "kg"
                : r.unit === "ml"
                  ? "L"
                  : unit(r.unit as "g")}
            </small>
          )}
        </div>
      </div>
      {r.invoiceId && (
        <p className="caption">
          {text("Hóa đơn", "Receipt")}:{" "}
          {s.shoppingInvoices?.find((i) => i.id === r.invoiceId)?.shop ||
            text("Đã liên kết", "Linked")}
        </p>
      )}
      {!editing ? (
        <Button
          onClick={() => {
            setAmount(moneyInput(r.paid));
            setCurrency(r.paid?.currency || "VND");
            setInvoiceId(r.invoiceId || "");
            setEditing(true);
          }}
        >
          {text("Ghi / sửa giá mua", "Record / edit price")}
        </Button>
      ) : (
        <div>
          <div className="receipt-form-grid">
            <label>
              {text(
                "Tổng tiền đã trả cho lượng này",
                "Total paid for this quantity",
              )}
              <input
                type="number"
                min="0"
                step={currency === "VND" ? "1" : "0.01"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              {text("Tiền tệ", "Currency")}
              <select
                value={currency}
                onChange={(e) =>
                  setCurrency(e.target.value as Money["currency"])
                }
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              {text("Gắn hóa đơn", "Link receipt")}
              <select
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              >
                <option value="">
                  {text("Không gắn hóa đơn", "No linked receipt")}
                </option>
                {s.shoppingInvoices?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.purchasedOn} · {i.shop || text("Hóa đơn", "Receipt")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <p role="alert">
              {text("Kiểm tra lại giá mua.", "Check the purchase price.")}
            </p>
          )}
          <div className="actions">
            <Button onClick={() => setEditing(false)}>
              {text("Hủy", "Cancel")}
            </Button>
            <Button primary disabled={apiBusy} onClick={() => void save()}>
              {text("Lưu giá mua", "Save purchase price")}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
