import { useI18n } from "src/i18n";
import { ArrowLeft } from "lucide-react";

import { parseBackup } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

interface IProps {}
const AdvancedJson: React.FC<IProps> = () => {
  const { t: tr, source, error: translateError } = useI18n();
  const { applyPlan, setAdvanced, json, setJson, jsonError, setJsonError } =
    useMealPlanner();
  return (
    <>
      <Heading
        eyebrow={tr("advancedEditor")}
        title={tr("oneSimpleJsonFile")}
        description={tr(
          "tenUniqueWeekdayLunchDinnerSlotsSavingReplacesThePlanAndResets",
        )}
      >
        <Button onClick={() => setAdvanced(false)}>
          <ArrowLeft size={16} />
          {tr("back")}
        </Button>
      </Heading>
      <section className="panel">
        <label>
          {tr("mealPlanJson")}
          <textarea
            className="json-editor"
            aria-label={tr("mealPlanJson")}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
          />
        </label>
        {jsonError && (
          <p className="error" role="alert">
            {translateError(jsonError)}
          </p>
        )}
        <Button
          primary
          onClick={() => {
            try {
              const p = parseBackup(JSON.parse(json));
              if (confirm(tr("replaceTheMenuAndResetProgress")))
                applyPlan(p.plan, p.servings);
            } catch (e) {
              setJsonError(
                e instanceof SyntaxError
                  ? source("invalidJson")
                  : (e as Error).message,
              );
            }
          }}
        >
          {tr("validateSave")}
        </Button>
      </section>
    </>
  );
};
export default AdvancedJson;
