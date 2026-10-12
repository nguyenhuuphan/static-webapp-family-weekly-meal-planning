import { useState } from "react";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useI18n, useText } from "src/i18n";
import { stocktakeCandidates } from "src/helpers/inventory";
import { retainPrepared, startWeek } from "src/helpers/scheduling";
import { Button } from "src/modules/shared-main/components";

export default function Stocktake({
  week,
  close,
}: {
  week: string;
  close: () => void;
}) {
  const { s, update } = useMealPlanner();
  const text = useText();
  const { content: ct, unit } = useI18n();
  const [candidates] = useState(() => stocktakeCandidates(retainPrepared(s)));
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(candidates.map((i) => [i.key, String(i.estimated)])),
  );
  const [checked, setChecked] = useState(false);
  const valid = Object.values(quantities).every(
    (v) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0,
  );
  return (
    <section
      className="panel"
      role="region"
      aria-label={text("Kiểm kê trước tuần mới", "Stocktake before new week")}
    >
      <h2>
        {text("Kiểm tra nguyên liệu còn lại", "Check remaining ingredients")}
      </h2>
      <p>
        {text(
          "Số bên dưới là ước tính. Chỉ ghi nguyên liệu rời còn dùng được; không tính lại đồ đã sơ chế đang được giữ riêng.",
          "Amounts below are estimates. Count usable loose ingredients only; exclude prepared food kept separately.",
        )}
      </p>
      <p>
        {text("Tuần mới", "New week")}: {week}
      </p>
      {candidates.map(({ key, item, estimated }) => (
        <label key={key}>
          {ct(item?.name || key.split("|")[0])} (
          {unit(item?.unit || key.split("|")[1])}) ·{" "}
          {text("ước tính", "estimated")}: {estimated}
          <input
            type="number"
            min="0"
            step="any"
            value={quantities[key]}
            onChange={(e) =>
              setQuantities((q) => ({ ...q, [key]: e.target.value }))
            }
          />
        </label>
      ))}
      {!candidates.length && (
        <p>
          {text(
            "Chưa có nguyên liệu được ghi nhận. Đồ đã chuẩn bị vẫn được giữ riêng.",
            "No ingredient stock recorded. Prepared food remains separate.",
          )}
        </p>
      )}
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        {text(
          "Tôi đã kiểm tra lượng còn lại thực tế",
          "I checked the actual remaining stock",
        )}
      </label>
      <div className="actions">
        <Button
          disabled={!checked || !valid}
          primary
          onClick={() => {
            update((s) =>
              startWeek(
                s,
                week,
                Object.fromEntries(
                  Object.entries(quantities).map(([k, v]) => [k, Number(v)]),
                ),
              ),
            );
            close();
          }}
        >
          {text(
            "Xác nhận kiểm kê và mở tuần",
            "Confirm stocktake and start week",
          )}
        </Button>
        <Button onClick={close}>{text("Hủy", "Cancel")}</Button>
      </div>
    </section>
  );
}
