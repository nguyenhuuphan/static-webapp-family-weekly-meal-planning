import { ShoppingBag, Printer, X, Search } from "lucide-react";

import { ingredientKey } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

interface IProps {}
const ShoppingList: React.FC<IProps> = () => {
  const { s, needs, bought, shopping, toggle, search, setSearch } =
    useMealPlanner();
  return (
    <>
      <Heading
        eyebrow="ONE TRIP, EVERYTHING COVERED"
        title="A good week starts here."
        description="Usable quantities, neatly gathered. Buy boneless meat, peeled shrimp and a little extra produce for trimming."
      >
        <Button onClick={() => window.print()}>
          <Printer size={17} />
          Print list
        </Button>
      </Heading>
      <div className="progress-panel">
        <div>
          <strong>
            {bought} of {needs.length} items picked up
          </strong>
          <span>{s.servings} servings per meal</span>
        </div>
        <progress value={bought} max={needs.length || 1} />
      </div>
      <div className="search-field">
        <Search size={17} />
        <input
          aria-label="Search shopping list"
          placeholder="Find an ingredient…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="icon-button"
            aria-label="Clear search"
            onClick={() => setSearch("")}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="shopping-grid">
        {[...new Set(shopping.map((i) => i.category))].map((category) => {
          const items = shopping.filter(
            (i) =>
              i.category === category &&
              i.name.toLowerCase().includes(search.toLowerCase()),
          );
          if (!items.length) return null;
          return (
            <section className="panel" key={category}>
              <div className="section-title">
                <h2>{category}</h2>
                <span className="pill">{items.length} items</span>
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
                        aria-label={`Bought ${i.name}`}
                      />
                      <span>
                        <strong>{i.name}</strong>
                        <small>
                          {i.meals.length} meal{i.meals.length === 1 ? "" : "s"}
                        </small>
                      </span>
                    </label>
                    <span className="quantity">
                      {i.qty} {i.unit}
                    </span>
                    <label className="pantry-check">
                      <input
                        type="checkbox"
                        checked={!!owned}
                        onChange={(e) => toggle("owned", k, e.target.checked)}
                      />
                      At home
                    </label>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      {!shopping.some((i) =>
        i.name.toLowerCase().includes(search.toLowerCase()),
      ) && <div className="panel empty">No ingredients match “{search}”.</div>}
      <div className="notice">
        <ShoppingBag size={20} />
        <p>
          <strong>Don’t forget the basics.</strong> Rice (about 1.5–2 kg for two
          adults), clean water, food-safe containers, labels and a thermometer.
          “At home” means the full listed quantity is available. Optional chili
          can be omitted.
        </p>
      </div>
      <details className="panel">
        <summary>Buying whole vegetables?</summary>
        <p>
          For the default two servings, buy approximately 450–500 g winter
          melon, 450–500 g pumpkin, 500–600 g chayote, 650–750 g cabbage, plus
          extra leafy greens for trimming. Ask for the listed edible fillet and
          peeled-shrimp weights. Weigh cleaned portions during prep.
        </p>
      </details>
    </>
  );
};
export default ShoppingList;
