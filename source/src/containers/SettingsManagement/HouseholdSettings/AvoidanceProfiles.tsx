import { useState } from "react";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useText } from "src/i18n";
import { Button } from "src/modules/shared-main/components";
export default function AvoidanceProfiles() {
  const { s, update } = useMealPlanner(),
    text = useText();
  const [name, setName] = useState(""),
    [avoid, setAvoid] = useState("");
  return (
    <section className="panel">
      <h2>
        {text(
          "Dị ứng / nguyên liệu cần tránh",
          "Allergies / ingredients to avoid",
        )}
      </h2>
      <p>
        {text(
          "Tùy chọn, theo từng người. Nhập tên nguyên liệu hoặc nhóm cần tránh, cách nhau bằng dấu phẩy. Kiểm tra cả gia vị và nhãn sản phẩm khi chọn hoặc đổi món.",
          "Optional, per person. Enter ingredients or groups to avoid, separated by commas. Review seasonings and product labels when choosing or replacing recipes.",
        )}
      </p>
      <label>
        {text("Tên người", "Person name")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </label>
      <label>
        {text("Cần tránh", "Avoid")}
        <input
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
          placeholder={text(
            "tôm, đậu phộng, đậu nành…",
            "shrimp, peanut, soy…",
          )}
          maxLength={500}
        />
      </label>
      <Button
        disabled={!name.trim() || !avoid.split(",").some((s) => s.trim())}
        onClick={() => {
          update((s) => ({
            ...s,
            avoidanceProfiles: [
              ...(s.avoidanceProfiles || []),
              {
                id: crypto.randomUUID(),
                name: name.trim(),
                avoid: avoid
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              },
            ],
          }));
          setName("");
          setAvoid("");
        }}
      >
        {text("Thêm hồ sơ", "Add profile")}
      </Button>
      <ul>
        {s.avoidanceProfiles?.map((p) => (
          <li key={p.id}>
            {p.name}: {p.avoid.join(", ")}{" "}
            <Button
              onClick={() =>
                update((s) => ({
                  ...s,
                  avoidanceProfiles: s.avoidanceProfiles?.filter(
                    (person) => person.id !== p.id,
                  ),
                }))
              }
            >
              {text("Xóa hồ sơ", "Remove profile")}: {p.name}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
