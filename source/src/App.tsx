import { useState } from "react";
import { Provider } from "react-redux";
import { createPlannerStore } from "src/redux/store";
import { usePlannerController } from "src/hooks/usePlannerController";
import { MealPlannerContext } from "src/hooks/useMealPlanner";
import AppLayout from "src/layout/AppLayout";
import LoadingState from "src/components/LoadingState";
import { I18nProvider } from "src/i18n";
const PlannerRoot: React.FC = () => {
  const { error, model } = usePlannerController();
  if (error || !model) return <LoadingState error={error} />;
  return (
    <MealPlannerContext.Provider value={model}>
      <AppLayout />
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
