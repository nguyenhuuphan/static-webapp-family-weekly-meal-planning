import { useState } from "react";
import type { FoodStorage } from "src/types";
import { unknownStorage, recordStorage } from "src/helpers/foodStorage";
import { useText } from "src/i18n";
import { Button } from ".";

export default function FoodStorageEditor({
  value,
  onChange,
}: {
  value?: FoodStorage;
  onChange: (next: FoodStorage) => void;
}) {
  const text = useText(),
    current = value || unknownStorage();
  const [stage, setStage] = useState(current.stage),
    [place, setPlace] = useState(current.place);
  const [type, setType] =
    useState<FoodStorage["events"][number]["type"]>("checked");
  const [at, setAt] = useState(""),
    [error, setError] = useState("");
  const labels = {
    unknown: text("Chưa biết", "Unknown"),
    raw: text("Sống / mới sơ chế", "Raw / partly prepared"),
    cooked: text("Đã nấu", "Cooked"),
    fridge: text("Ngăn mát", "Refrigerator"),
    freezer: text("Ngăn đông", "Freezer"),
    room: text("Ngoài tủ lạnh", "Outside refrigeration"),
    prepared: text("Sơ chế", "Prepared"),
    frozen: text("Cấp đông", "Frozen"),
    thawing: text("Bắt đầu rã đông", "Thawing started"),
    thawed: text("Rã đông xong", "Thawed"),
    checked: text("Kiểm tra / đổi nơi bảo quản", "Checked / storage changed"),
  };
  return (
    <details className="storage-editor">
      <summary>
        {text("Bảo quản thực tế & lịch sử", "Actual storage & history")}:{" "}
        {labels[current.stage]} · {labels[current.place]}
      </summary>
      {(current.stage === "unknown" ||
        current.place === "unknown" ||
        !current.events.length) && (
        <p role="status">
          {text(
            "Cần kiểm tra trước khi sắp xếp. Chưa đủ thông tin để gợi ý thời hạn dùng.",
            "Review before scheduling. There is not enough information to suggest a storage deadline.",
          )}
        </p>
      )}
      <label>
        {text("Trạng thái thực phẩm", "Food state")}
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as typeof stage)}
        >
          {(["unknown", "raw", "cooked"] as const).map((v) => (
            <option key={v} value={v}>
              {labels[v]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {text("Nơi bảo quản", "Storage location")}
        <select
          value={place}
          onChange={(e) => setPlace(e.target.value as typeof place)}
        >
          {(["unknown", "fridge", "freezer", "room"] as const).map((v) => (
            <option key={v} value={v}>
              {labels[v]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {text("Ghi nhận sự kiện", "Storage event")}
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          {(
            [
              "checked",
              "prepared",
              "frozen",
              "thawing",
              "thawed",
              "cooked",
            ] as const
          ).map((v) => (
            <option key={v} value={v}>
              {labels[v]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {text(
          "Thời điểm thực tế (để trống = bây giờ)",
          "Actual time (blank = now)",
        )}
        <input
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
        />
      </label>
      <Button
        onClick={() => {
          try {
            const next = recordStorage(
              value,
              type,
              at ? new Date(at).toISOString() : new Date().toISOString(),
              stage,
              place,
            );
            onChange(next);
            setStage(next.stage);
            setPlace(next.place);
            setError("");
          } catch {
            setError(
              text(
                "Thời điểm không hợp lệ hoặc ở tương lai.",
                "Invalid time: use a valid time, not in the future.",
              ),
            );
          }
        }}
      >
        {text("Lưu ghi nhận bảo quản", "Save storage record")}
      </Button>
      {error && <p role="alert">{error}</p>}
      <ul>
        {current.events.map((e, i) => (
          <li key={i}>
            {labels[e.type]} · {new Date(e.at).toLocaleString()} ·{" "}
            {labels[e.stage]} · {labels[e.place]}
          </li>
        ))}
      </ul>
      <p className="caption">
        {text(
          "Đổi lịch không thay đổi lịch sử này. Bản ghi không xác nhận thực phẩm an toàn.",
          "Rescheduling does not change this history. Records do not certify food safety.",
        )}
      </p>
    </details>
  );
}
