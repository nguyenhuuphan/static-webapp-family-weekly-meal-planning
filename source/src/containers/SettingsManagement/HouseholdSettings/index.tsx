import { useState } from "react";
import { useText, useI18n } from "src/i18n";
import {
  ArrowRight,
  Users,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Pencil,
} from "lucide-react";

import { freshProgress, isMonday } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

interface IProps {}
const HouseholdSettings: React.FC<IProps> = () => {
  const { t: tr, source, content: ct } = useI18n();
  const {
    s,
    plan,
    edit,
    navigate,
    update,
    resetProgress,
    applyPlan,
    exportJSON,
    importJSON,
    defaults,
    setAdvanced,
    setJson,
    setJsonError,
    setToast,
    soundEnabled,
    enableSound,
  } = useMealPlanner();
  const text = useText();
  const [servingsDraft, setServingsDraft] = useState(String(s.servings));
  const validServings = Number.isInteger(Number(servingsDraft)) && Number(servingsDraft) >= 1 && Number(servingsDraft) <= 12;
  return (
    <>
      <Heading
        eyebrow={tr("yourKitchenYourWay")}
        title={tr("makeRoomForYourFavourites")}
        description={tr(
          "editRecipesAdjustYourHouseholdAndKeepABackupNoAccountOr",
        )}
      />
      <p className="caption">
        {tr("languageHelp")} {tr("sourceRecipeHelp")}
      </p>
      <div className="settings-grid">
        <section className="panel">
          <h2>{text("Thông báo hẹn giờ", "Timer alerts")}</h2>
          <label><input type="checkbox" checked={soundEnabled} onChange={async (event) => {
            if (!await enableSound(event.target.checked)) setToast(text("Trình duyệt chưa hỗ trợ âm báo.", "Audio alerts are unavailable in this browser."));
          }} />{text("Bật âm báo trong phiên này", "Enable sound in this session")}</label>
          <p className="caption">{text("Sau khi tải lại trang, hãy bật lại âm báo. Thông báo nền tùy thuộc trình duyệt.", "After reloading, re-enable sound. Background notifications depend on your browser.")}</p>
          {typeof Notification !== "undefined" && <Button onClick={async () => {
            const permission = await Notification.requestPermission();
            setToast(permission === "granted" ? text("Đã bật thông báo.", "Notifications enabled.") : text("Chưa cấp quyền thông báo. Hẹn giờ vẫn hiển thị trong ứng dụng.", "Notifications are not allowed. The timer remains visible in the app."));
          }}>{text("Cho phép thông báo hẹn giờ", "Allow timer notifications")}</Button>}
        </section>
        <section className="panel">
          <span className="tile-icon">
            <Users size={22} />
          </span>
          <h2>{tr("yourHousehold")}</h2>
          <label>
            {tr("peoplePerMeal")}
            <input
              aria-label={tr("peoplePerMeal")}
              type="number"
              min="1"
              max="12"
              value={servingsDraft}
              onChange={(e) => setServingsDraft(e.target.value)}
              aria-invalid={!validServings}
            />
          </label>
          <p>{text("Khẩu phần mới sẽ điều chỉnh lượng nguyên liệu và đặt lại tiến độ.", "Applying new servings adjusts quantities and resets progress.")}</p>
          <Button disabled={!validServings || Number(servingsDraft) === s.servings} onClick={() => {
            if (confirm(tr("changeServingsAllProgressResetsBecausePreparedQuantitiesMayNoLongerMatch"))) {
              update((x) => ({ ...x, servings: Number(servingsDraft), progress: freshProgress(), timer: null, timers: [] }));
            }
          }}>{text("Áp dụng khẩu phần", "Apply servings")}</Button>
          <p className="caption">
            {tr(
              "ingredientsAndBracketedInstructionAmountsScaleTogetherEggCountsMayBeFractional",
            )}
          </p>
          <label>
            {tr("weekBeginningMonday")}
            <input
              aria-label={tr("weekBeginning")}
              type="date"
              value={s.weekStart}
              onChange={(e) => {
                const v = e.target.value;
                if (!isMonday(v)) {
                  setToast(source("pleaseChooseAMonday"));
                  return;
                }
                if (confirm(tr("startANewWeekWithThisMenuAndFreshChecklists")))
                  update((x) => ({
                    ...x,
                    weekStart: v,
                    progress: freshProgress(),
                    timer: null,
                  }));
              }}
            />
          </label>
          <Button onClick={resetProgress}>
            <RotateCcw size={15} />
            {tr("resetWeeklyProgress")}
          </Button>
        </section>
        <section className="panel">
          <span className="tile-icon">
            <Download size={22} />
          </span>
          <h2>{tr("yourDataKeptSimple")}</h2>
          <p>
            {tr("savedInThisBrowserOnlyNoAutomaticSyncBetweenDevicesExportTo")}
          </p>
          <div className="actions">
            <Button primary onClick={exportJSON}>
              <Download size={16} />
              {tr("exportJson")}
            </Button>
            <label className="file-button">
              <Upload size={16} />
              {tr("importJson")}
              <input
                aria-label={tr("importJson")}
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  void importJSON(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="caption">
            {tr(
              "backupsIncludeEditedRecipesAndServingsNotChecklistsOrTimersImportReplaces",
            )}
          </p>
          <Button
            className="danger"
            onClick={() => {
              if (
                confirm(
                  tr(
                    "restoreTheOriginalTenMealsYourRecipeEditsAndProgressWillBe",
                  ),
                )
              )
                applyPlan(structuredClone(defaults), defaults.servings);
            }}
          >
            <RotateCcw size={15} />
            {tr("restoreOriginalMenu")}
          </Button>
        </section>
      </div>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>{tr("editYourRecipes")}</h2>
            <p>{tr("namesIngredientsAndStepByStepGuidesAllInOnePlace")}</p>
          </div>
          <Button
            onClick={() => {
              setJson(JSON.stringify(plan, null, 2));
              setJsonError("");
              setAdvanced(true);
            }}
          >
            {tr("advancedJson")}
          </Button>
        </div>
        <div className="recipe-list">
          {plan.meals.map((m) => (
            <button key={m.id} onClick={() => edit(m)}>
              <span className="recipe-label">
                {ct(m.day)}
                <small>{ct(m.type)}</small>
              </span>
              <span>
                <strong>{ct(m.main)}</strong>
                <small>{ct(m.side)}</small>
              </span>
              <Pencil size={16} />
            </button>
          ))}
        </div>
      </section>
      <div className="notice">
        <ShieldCheck size={19} />
        <p>
          {tr(
            "recipeEditsResetAffectedProgressUserEditedStorageAndCookingInstructionsAre",
          )}{" "}
          <button className="text-button" onClick={() => navigate("safety")}>
            {tr("readSafetyNotes")}
            <ArrowRight size={14} />
          </button>
        </p>
      </div>
    </>
  );
};
export default HouseholdSettings;
