import { useI18n } from "src/i18n";
import { ArrowRight, Snowflake, ShieldCheck } from "lucide-react";

import { Heading } from "src/modules/shared-main/components";

interface IProps {}
const SafetyGuide: React.FC<IProps> = () => {
  const { t: tr } = useI18n();
  return (
    <>
      <Heading
        eyebrow={tr("aLittleCareGoesALongWay")}
        title={tr("aSafeThoughtfulKitchen")}
        description={tr(
          "manualPrepAndReadinessRecordsDonTCertifyYourFoodCheckActual",
        )}
      />
      <div className="settings-grid">
        <section className="panel">
          <Snowflake className="tile-icon" />
          <h2>{tr("storeThaw")}</h2>
          <ul>
            <li>{tr("fridge4CFreezer18C")}</li>
            <li>
              {tr(
                "keepMondayProteinsRefrigeratedPromptlyFreezeTuesdayFridayProteinsAfterSundayPrep",
              )}
            </li>
            <li>
              {tr("moveNextDayProteinsAndSaucesToTheFridgeEachMorningIn")}
            </li>
            <li>
              {tr(
                "keepFrozenVegetablesFrozenUntilCookingThickProteinPortionsMayNeedMore",
              )}
            </li>
            <li>
              {tr(
                "neverThawOnTheCounterFreezingDoesNotResetPriorRefrigerationTime",
              )}
            </li>
            <li>{tr("keepEggsIntactInTheirCartonInTheRefrigerator")}</li>
          </ul>
        </section>
        <section className="panel">
          <ShieldCheck className="tile-icon" />
          <h2>{tr("handleCook")}</h2>
          <ul>
            <li>
              {tr("washHandsAndUtensilsAfterRawFoodKeepRawProteinSeparateFrom")}
            </li>
            <li>
              {tr("doNotWashRawPoultryBeefOrPorkSplashesCanSpreadBacteria")}
            </li>
            <li>{tr("perishablesShouldNotBeOutLongerThan2HoursTotalOr1")}</li>
            <li>{tr("chicken74CGroundMeatAndEggDishes71CFish63")}</li>
            <li>
              {tr(
                "shrimpMustBeFullyOpaqueCheckMeatTemperatureInTheThickestPart",
              )}
            </li>
            <li>{tr("riceIsSeparateDoNotLeaveCookedRiceOnTheCounterFor")}</li>
          </ul>
        </section>
      </div>
      <section className="panel sources">
        <h2>{tr("referenceGuidance")}</h2>
        <a
          href="https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts"
          target="_blank"
          rel="noreferrer"
        >
          {tr("foodsafetyGovColdFoodStorage")}
          <ArrowRight size={14} />
        </a>
        <a
          href="https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures"
          target="_blank"
          rel="noreferrer"
        >
          {tr("foodsafetyGovCookingTemperatures")}
          <ArrowRight size={14} />
        </a>
        <a
          href="https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/big-thaw-safe-defrosting-methods"
          target="_blank"
          rel="noreferrer"
        >
          {tr("usdaSafeThawing")}
          <ArrowRight size={14} />
        </a>
        <p className="caption">
          {tr(
            "theseOrganisationsHaveNotReviewedThisAppOrUserEditsCheckAllergies",
          )}
        </p>
      </section>
    </>
  );
};
export default SafetyGuide;
