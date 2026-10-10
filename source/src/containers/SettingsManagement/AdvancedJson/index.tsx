import { ArrowLeft } from "lucide-react";

import { parseBackup } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

interface IProps {}
const AdvancedJson: React.FC<IProps> = () => {
  const { applyPlan, setAdvanced, json, setJson, jsonError, setJsonError } =
    useMealPlanner();
  return (
    <>
      <Heading
        eyebrow="ADVANCED EDITOR"
        title="One simple JSON file."
        description="Ten unique weekday lunch/dinner slots. Saving replaces the plan and resets progress."
      >
        <Button onClick={() => setAdvanced(false)}>
          <ArrowLeft size={16} />
          Back
        </Button>
      </Heading>
      <section className="panel">
        <label>
          Meal-plan JSON
          <textarea
            className="json-editor"
            aria-label="Meal-plan JSON"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
          />
        </label>
        {jsonError && (
          <p className="error" role="alert">
            {jsonError}
          </p>
        )}
        <Button
          primary
          onClick={() => {
            try {
              const p = parseBackup(JSON.parse(json));
              if (confirm("Replace the menu and reset progress?"))
                applyPlan(p.plan, p.servings);
            } catch (e) {
              setJsonError((e as Error).message);
            }
          }}
        >
          Validate & save
        </Button>
      </section>
    </>
  );
};
export default AdvancedJson;
