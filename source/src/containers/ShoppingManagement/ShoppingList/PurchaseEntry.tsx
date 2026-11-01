import {
  CURRENCIES,
  formatMoney,
  localPurchaseDate,
  validPurchaseDate,
  parseMoney,
  type Money,
} from "src/helpers/purchaseHistory";
import { useState } from "react";
import type { Ingredient } from "src/types";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useText, useI18n } from "src/i18n";
import { recordPurchase } from "src/helpers/inventory";
import { ingredientKey } from "src/domain";
import { Button } from "src/modules/shared-main/components";
export default function PurchaseEntry({
  item,
  needed,
}: {
  item: Ingredient;
  needed: number;
}) {
  const text = useText(),
    { content: ct, unit, language } = useI18n(),
    { s, update, setToast } = useMealPlanner();
  const [size, setSize] = useState(
    String(item.unit === "each" ? Math.ceil(needed || 1) : needed || 1),
  );
  const [count, setCount] = useState("1"),
    [packaged, setPackaged] = useState(false),
    [location, setLocation] = useState("unknown");
  const [amount, setAmount] = useState(""),
    [currency, setCurrency] = useState<Money["currency"]>("VND"),
    [invoiceId, setInvoiceId] = useState(""),
    [shop, setShop] = useState(""),
    [date, setDate] = useState(localPurchaseDate),
    [saved, setSaved] = useState(false);
  let paid: Money | undefined,
    validPrice = true;
  try {
    paid = parseMoney(amount, currency);
  } catch {
    validPrice = false;
  }
  const qty = +size * (packaged ? +count : 1),
    valid =
      size !== "" &&
      qty > 0 &&
      qty <= 1000000 &&
      Number.isFinite(qty) &&
      (!packaged || (Number.isInteger(+count) && +count > 0));
  const receipts =
    s.purchaseReceipts?.filter((r) => r.key === ingredientKey(item)) || [];
  return (
    <details className="purchase-entry">
      <summary>
        {text("Ghi lượng mua thực tế", "Record actual purchase")}:{" "}
        {ct(item.name)}
      </summary>
      <label>
        <input
          type="checkbox"
          checked={packaged}
          onChange={(e) => setPackaged(e.target.checked)}
        />
        {text("Mua theo gói", "Buy in packages")}
      </label>
      {packaged && (
        <label>
          {text("Số gói", "Packages")}
          <input
            type="number"
            min={1}
            step={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </label>
      )}
      <label>
        {packaged
          ? text("Lượng mỗi gói", "Amount per package")
          : text("Lượng vừa mua", "Amount just purchased")}{" "}
        ({unit(item.unit)})
        <input
          type="number"
          min={0}
          step="any"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />
      </label>
      <label>
        {text("Cất phần dư ở đâu?", "Where will extra stock be stored?")}
        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="unknown">
            {text("Chưa ghi nhận", "Not recorded")}
          </option>
          <option value="pantry">{text("Kệ đồ khô", "Pantry")}</option>
          <option value="fridge">{text("Ngăn mát", "Refrigerator")}</option>
          <option value="freezer">{text("Ngăn đông", "Freezer")}</option>
        </select>
      </label>
      <div className="receipt-form-grid">
        <label>
          {text(
            "Tổng tiền đã trả cho lượng này (không bắt buộc)",
            "Total paid for this quantity (optional)",
          )}
          <input
            type="number"
            inputMode="decimal"
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
            onChange={(e) => setCurrency(e.target.value as Money["currency"])}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          {text("Cửa hàng / nơi mua", "Shop / place of purchase")}
          <input
            maxLength={160}
            value={shop}
            onChange={(e) => setShop(e.target.value)}
          />
        </label>
        <label>
          {text("Ngày mua", "Purchase date")}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          {text("Gắn hóa đơn", "Link receipt")}
          <select
            value={invoiceId}
            onChange={(e) => {
              setInvoiceId(e.target.value);
              const invoice = s.shoppingInvoices?.find(
                (i) => i.id === e.target.value,
              );
              if (invoice) {
                setDate(invoice.purchasedOn);
                setShop(invoice.shop);
              }
            }}
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
      {!validPrice && (
        <p role="alert">
          {text(
            "Kiểm tra giá: VND dùng số nguyên, USD/EUR tối đa 2 số thập phân.",
            "Check the price: whole VND or up to 2 decimal places for USD/EUR.",
          )}
        </p>
      )}
      <p className="caption">
        {text(
          "Chụp và lưu hóa đơn trong mục Lịch sử mua & hóa đơn, rồi gắn vào lần mua này.",
          "Save receipt photos under Purchase history & receipts, then link them to this purchase.",
        )}
      </p>
      <p>
        {text("Lượng mua thêm", "Additional purchase")}: {valid ? qty : "—"}{" "}
        {unit(item.unit)} ·{" "}
        {text("Ngoài nhu cầu hiện tại", "Beyond current need")}:{" "}
        {valid ? Math.max(0, Math.round((qty - needed) * 100) / 100) : "—"}
      </p>
      <Button
        disabled={!valid || !validPrice || !validPurchaseDate(date)}
        onClick={() => {
          const changed = update((s) =>
            recordPurchase(
              s,
              item,
              qty,
              location,
              packaged ? +count : undefined,
              packaged ? +size : undefined,
              {
                paid,
                invoiceId: invoiceId || undefined,
                shop: shop.trim() || undefined,
                purchasedOn: date,
              },
            ),
          );
          if (changed) {
            setSaved(true);
            setToast(
              text("Đã lưu lần mua và giá mua.", "Purchase and price saved."),
            );
            setAmount("");
          }
        }}
      >
        {text("Lưu lần mua này", "Save this purchase")}
      </Button>
      {saved && (
        <p role="status">
          {text(
            "Đã lưu lần mua. Xem lại trong Lịch sử mua & hóa đơn.",
            "Purchase saved. Find it under Purchase history & receipts.",
          )}
        </p>
      )}
      {!!receipts.length && (
        <ul>
          {receipts.map((r) => (
            <li key={r.id}>
              {new Date(r.at).toLocaleString()} · {r.qty} {unit(item.unit)} ·{" "}
              {r.location} {r.paid ? `· ${formatMoney(r.paid, language)}` : ""}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
