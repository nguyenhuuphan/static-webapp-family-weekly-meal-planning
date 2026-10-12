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
    { content: ct, unit } = useI18n(),
    { s, update } = useMealPlanner();
  const [size, setSize] = useState(
    String(item.unit === "each" ? Math.ceil(needed || 1) : needed || 1),
  );
  const [count, setCount] = useState("1"),
    [packaged, setPackaged] = useState(false),
    [location, setLocation] = useState("unknown");
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
      <p>
        {text("Lượng mua thêm", "Additional purchase")}: {valid ? qty : "—"}{" "}
        {unit(item.unit)} ·{" "}
        {text("Ngoài nhu cầu hiện tại", "Beyond current need")}:{" "}
        {valid ? Math.max(0, Math.round((qty - needed) * 100) / 100) : "—"}
      </p>
      <Button
        disabled={!valid}
        onClick={() =>
          update((s) =>
            recordPurchase(
              s,
              item,
              qty,
              location,
              packaged ? +count : undefined,
              packaged ? +size : undefined,
            ),
          )
        }
      >
        {text("Lưu lần mua này", "Save this purchase")}
      </Button>
      {!!receipts.length && (
        <ul>
          {receipts.map((r) => (
            <li key={r.id}>
              {new Date(r.at).toLocaleString()} · {r.qty} {unit(item.unit)} ·{" "}
              {r.location}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
