import { useI18n } from "src/i18n";
import { ShoppingBag, Printer, X, Search } from "lucide-react";

import { ingredientKey } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

interface IProps {}
const ShoppingList: React.FC<IProps> = () => {
  const { t: tr, content: ct, number: num, unit } = useI18n();
  const { s, needs, bought, shopping, toggle, search, setSearch } =
    useMealPlanner();
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
      <div className="shopping-grid">
        {[...new Set(shopping.map((i) => i.category))].map((category) => {
          const items = shopping.filter(
            (i) => i.category === category && matches(i.name),
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
                      {num(i.qty)} {unit(i.unit)}
                    </span>
                    <label className="pantry-check">
                      <input
                        type="checkbox"
                        checked={!!owned}
                        onChange={(e) => toggle("owned", k, e.target.checked)}
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
        <summary>{tr("buyingWholeVegetables")}</summary>
        <p>
          {tr("forTheDefaultTwoServingsBuyApproximately450500GWinterMelon")}
        </p>
      </details>
    </>
  );
};
export default ShoppingList;
