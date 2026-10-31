import { FamilyAccessProvider } from "src/hooks/useFamilyAccess";
import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { createPlannerStore } from "src/redux/store";
import { usePlannerController } from "src/hooks/usePlannerController";
import { MealPlannerContext } from "src/hooks/useMealPlanner";
import AppLayout from "src/layout/AppLayout";
import LoadingState from "src/components/LoadingState";
import { I18nProvider, useI18n } from "src/i18n";
const PlannerRoot: React.FC = () => {
  const { error, model } = usePlannerController();
  const { setContentTranslations } = useI18n();
  const currentPlan = model?.plan;
  const archivedPlans = model?.s.weekArchive;
  useEffect(() => {
    const maps = [
      ...Object.values(archivedPlans || {}).map(
        (entry) => entry.plan.translations?.vi || {},
      ),
      currentPlan?.translations?.vi || {},
    ];
    setContentTranslations(
      Object.fromEntries(maps.flatMap((map) => Object.entries(map))),
    );
  }, [currentPlan, archivedPlans, setContentTranslations]);
  if (error || !model) return <LoadingState error={error} />;
  return (
    <MealPlannerContext.Provider value={model}>
      <FamilyAccessProvider>
        <AppLayout />
      </FamilyAccessProvider>
    </MealPlannerContext.Provider>
  );
};
const App: React.FC = () => {
  const [store] = useState(createPlannerStore);
  return (
    <I18nProvider>
      <Provider store={store}>
        <PlannerRoot />
      </Provider>
    </I18nProvider>
  );
};
export default App;
