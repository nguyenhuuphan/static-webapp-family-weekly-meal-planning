import { useI18n, useText } from "src/i18n";
import { usePersistentState } from "src/hooks/usePersistentState";
import { ShoppingBag, Printer, X, Search } from "lucide-react";

import { ingredientKey } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

interface IProps {}
const ShoppingList: React.FC<IProps> = () => {
  const text = useText();
  const [filter, setFilter] = usePersistentState(
    "planner:shopping-filter",
    "needed",
  );
  const { t: tr, content: ct, number: num, unit } = useI18n();
  const { s, needs, bought, shopping, toggle, search, setSearch, update } =
    useMealPlanner();
  const surplus = Object.entries(s.purchased || {}).flatMap(([key, item]) => {
    const required = shopping.find((i) => ingredientKey(i) === key)?.qty || 0;
    const extra = Math.max(
      0,
      Math.round(
        (item.qty - Math.max(0, required - (s.pantry?.[key] || 0))) * 100,
      ) / 100,
    );
    return extra > 0 ? [{ ...item, qty: extra }] : [];
  });
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase();
  const matches = (name: string) =>
    [name, ct(name)].some((value) =>
      normalize(value).includes(normalize(search)),
    );
  return (
    <>
      <Heading
        eyebrow={tr("oneTripEverythingCovered")}
        title={tr("aGoodWeekStartsHere")}
        description={tr(
          "usableQuantitiesNeatlyGatheredBuyBonelessMeatPeeledShrimpAndALittle",
        )}
      >
        <Button onClick={() => window.print()}>
          <Printer size={17} />
          {tr("printList")}
        </Button>
      </Heading>
      <div className="progress-panel">
        <div>
          <strong>
            {tr("shoppingProgress", { count: bought, total: needs.length })}
          </strong>
          <span>{tr("servingsPerMealCount", { count: s.servings })}</span>
        </div>
        <progress value={bought} max={needs.length || 1} />
      </div>
      {surplus.length > 0 && (
        <details className="panel">
          <summary>
            {text(
              "Đã mua ngoài nhu cầu hiện tại",
              "Purchased beyond current requirements",
            )}{" "}
            ({surplus.length})
          </summary>
          <p>
            {text(
              "Lượng này có thể đang nằm trong phần đã sơ chế cần sắp xếp. Đây là ghi nhận đã mua, không phải lượng tồn kho được kiểm kê.",
              "Some of this may be in prepared portions awaiting a meal. These are purchase records, not a stock count.",
            )}
          </p>
          <ul>
            {surplus.map((i) => (
              <li key={ingredientKey(i)}>
                {ct(i.name)} · {num(i.qty)} {unit(i.unit)}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="search-field">
        <Search size={17} />
        <input
          aria-label={tr("searchShoppingList")}
          placeholder={tr("findAnIngredient")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="icon-button"
            aria-label={tr("clearSearch")}
            onClick={() => setSearch("")}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div
        className="actions"
        role="group"
        aria-label={text("Lọc danh sách", "Filter shopping list")}
      >
        {[
          ["needed", text("Cần mua", "To buy")],
          ["bought", text("Đã mua", "Bought")],
          ["owned", text("Có sẵn", "At home")],
          ["all", text("Tất cả", "All")],
        ].map(([value, label]) => (
          <Button
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="shopping-grid">
        {[...new Set(shopping.map((i) => i.category))].map((category) => {
          const items = shopping.filter(
            (i) =>
              i.category === category &&
              matches(i.name) &&
              (filter === "all" ||
                (filter === "owned"
                  ? s.progress.owned[ingredientKey(i)]
                  : filter === "bought"
                    ? s.progress.shopping[ingredientKey(i)] &&
                      !s.progress.owned[ingredientKey(i)]
                    : !s.progress.owned[ingredientKey(i)] &&
                      !s.progress.shopping[ingredientKey(i)])),
          );
          if (!items.length) return null;
          return (
            <section className="panel" key={category}>
              <div className="section-title">
                <h2>{ct(category)}</h2>
                <span className="pill">
                  {tr("itemCount", { count: items.length })}
                </span>
              </div>
              {items.map((i) => {
                const k = ingredientKey(i),
                  owned = s.progress.owned[k],
                  checked = s.progress.shopping[k];
                return (
                  <div
                    className={`shopping-row ${owned || checked ? "checked" : ""}`}
                    key={k}
                  >
                    <label className="item-check">
                      <input
                        type="checkbox"
                        disabled={owned}
                        checked={!!checked}
                        onChange={(e) =>
                          toggle("shopping", k, e.target.checked)
                        }
                        aria-label={tr("boughtLabel", { name: ct(i.name) })}
                      />
                      <span>
                        <strong>{ct(i.name)}</strong>
                        <small>
                          {tr("mealCount", { count: i.meals.length })}
                        </small>
                      </span>
                    </label>
                    <span className="quantity">
                      {num(
                        owned
                          ? 0
                          : checked
                            ? (s.purchased?.[k]?.qty ?? i.toBuy)
                            : i.toBuy,
                      )}{" "}
                      {unit(i.unit)}
                      <small>
                        {text("Cần dùng", "Required")}: {num(i.qty)}{" "}
                        {unit(i.unit)}
                      </small>
                      {!owned && !checked && i.toBuy > 0 && (
                        <small>
                          {text("Gợi ý mua", "Suggested purchase")}:{" "}
                          {num(
                            i.unit === "each"
                              ? Math.ceil(i.toBuy)
                              : ["g", "ml"].includes(i.unit)
                                ? Math.ceil(i.toBuy / 50) * 50
                                : i.toBuy,
                          )}{" "}
                          {unit(i.unit)}
                        </small>
                      )}
                    </span>
                    <label className="pantry-amount">
                      {text("Lượng có sẵn", "Amount at home")} ({unit(i.unit)})
                      <input
                        type="number"
                        min="0"
                        step="any"
                        defaultValue={s.pantry?.[k] || 0}
                        aria-label={`${text("Lượng có sẵn", "Amount at home")}: ${ct(i.name)} (${unit(i.unit)})`}
                        key={`${k}:${s.pantry?.[k] || 0}`}
                        onBlur={(event) => {
                          const amount = Number(event.target.value);
                          if (!Number.isFinite(amount) || amount < 0) {
                            event.target.value = String(s.pantry?.[k] || 0);
                            return;
                          }
                          if (amount === (s.pantry?.[k] || 0)) return;
                          update((state) => ({
                            ...state,
                            pantry: { ...state.pantry, [k]: amount },
                            progress: {
                              ...state.progress,
                              owned: {
                                ...state.progress.owned,
                                [k]: amount >= i.qty,
                              },
                              shopping: {
                                ...state.progress.shopping,
                                [k]: false,
                              },
                            },
                          }));
                        }}
                      />
                    </label>
                    <label className="pantry-check">
                      <input
                        type="checkbox"
                        checked={!!owned}
                        onChange={(event) => {
                          const owned = event.target.checked;
                          update((state) => ({
                            ...state,
                            pantry: { ...state.pantry, [k]: owned ? i.qty : 0 },
                            progress: {
                              ...state.progress,
                              owned: { ...state.progress.owned, [k]: owned },
                            },
                          }));
                        }}
                      />
                      {tr("atHome")}
                    </label>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      {filter === "needed" && bought === needs.length && (
        <p role="status">
          {text("Đã đủ nguyên liệu cần mua.", "Your shopping is complete.")}
        </p>
      )}
      {!shopping.some((i) => matches(i.name)) && (
        <div className="panel empty">
          {tr("noSearchResults", { query: search })}
        </div>
      )}
      <div className="notice">
        <ShoppingBag size={20} />
        <p>
          <strong>{tr("donTForgetTheBasics")}</strong>{" "}
          {tr("riceAbout152KgForTwoAdultsCleanWaterFood")}
        </p>
      </div>
      <details className="panel">
        <p className="caption">
          {text(
            "Gợi ý mua làm tròn lên theo đơn vị hoặc 50 g/ml; chọn quy cách đóng gói phù hợp. Lượng cần dùng trong công thức không thay đổi.",
            "Purchase suggestions round up to whole items or 50 g/ml; choose a suitable package. Recipe quantities stay exact.",
          )}
        </p>
        <summary>{tr("buyingWholeVegetables")}</summary>
        <p>
          {tr("forTheDefaultTwoServingsBuyApproximately450500GWinterMelon")}
        </p>
      </details>
    </>
  );
};
export default ShoppingList;
