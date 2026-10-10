import { ArrowRight, Snowflake, ShieldCheck } from "lucide-react";

import { Heading } from "src/modules/shared-main/components";

interface IProps {}
const SafetyGuide: React.FC<IProps> = () => {
  return (
    <>
      <Heading
        eyebrow="A LITTLE CARE GOES A LONG WAY"
        title="A safe, thoughtful kitchen."
        description="Manual prep and readiness records don’t certify your food. Check actual storage conditions and cooking temperatures."
      />
      <div className="settings-grid">
        <section className="panel">
          <Snowflake className="tile-icon" />
          <h2>Store & thaw</h2>
          <ul>
            <li>Fridge ≤4°C. Freezer ≤−18°C.</li>
            <li>
              Keep Monday proteins refrigerated; promptly freeze Tuesday–Friday
              proteins after Sunday prep.
            </li>
            <li>
              Move next-day proteins and sauces to the fridge each morning, in
              thin sealed portions on a leakproof tray.
            </li>
            <li>
              Keep frozen vegetables frozen until cooking. Thick protein
              portions may need more thawing time.
            </li>
            <li>
              Never thaw on the counter. Freezing does not reset prior
              refrigeration time or make spoiled food safe.
            </li>
            <li>Keep eggs intact in their carton in the refrigerator.</li>
          </ul>
        </section>
        <section className="panel">
          <ShieldCheck className="tile-icon" />
          <h2>Handle & cook</h2>
          <ul>
            <li>
              Wash hands and utensils after raw food. Keep raw protein separate
              from ready-to-eat cucumber.
            </li>
            <li>
              Do not wash raw poultry, beef or pork: splashes can spread
              bacteria.
            </li>
            <li>
              Perishables should not be out longer than 2 hours total, or 1 hour
              above 32°C.
            </li>
            <li>
              Chicken 74°C; ground meat and egg dishes 71°C; fish 63°C;
              whole-cut pork/beef 63°C + 3-minute rest.
            </li>
            <li>
              Shrimp must be fully opaque. Check meat temperature in the
              thickest part; time/colour are not guarantees.
            </li>
            <li>
              Rice is separate; do not leave cooked rice on the counter for
              hours.
            </li>
          </ul>
        </section>
      </div>
      <section className="panel sources">
        <h2>Reference guidance</h2>
        <a
          href="https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts"
          target="_blank"
          rel="noreferrer"
        >
          FoodSafety.gov · Cold food storage
          <ArrowRight size={14} />
        </a>
        <a
          href="https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures"
          target="_blank"
          rel="noreferrer"
        >
          FoodSafety.gov · Cooking temperatures
          <ArrowRight size={14} />
        </a>
        <a
          href="https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/big-thaw-safe-defrosting-methods"
          target="_blank"
          rel="noreferrer"
        >
          USDA · Safe thawing
          <ArrowRight size={14} />
        </a>
        <p className="caption">
          These organisations have not reviewed this app or user edits. Check
          allergies, package labels and your ingredients’ condition.
        </p>
      </section>
    </>
  );
};
export default SafetyGuide;
