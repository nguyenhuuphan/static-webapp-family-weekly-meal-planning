import AvoidanceProfiles from "./AvoidanceProfiles";
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

import { startWeek } from "src/helpers/scheduling";
import { isMonday } from "src/domain";
import { Button, Heading } from "src/modules/shared-main/components";
import { useMealPlanner } from "src/hooks/useMealPlanner";

import Stocktake from "./Stocktake";
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
    pendingImport,
    setPendingImport,
    restoreBackup,
  } = useMealPlanner();
  const text = useText();
  const [pendingWeek, setPendingWeek] = useState<string | null>(null);
  const [servingsDraft, setServingsDraft] = useState(String(s.servings));
  const validServings =
    Number.isInteger(Number(servingsDraft)) &&
    Number(servingsDraft) >= 1 &&
    Number(servingsDraft) <= 12;
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
        {tr("languageHelp")}{" "}
        {text(
          "Nội dung mới được gửi tới MyMemory để dịch tự động miễn phí. Bản dịch máy có thể sai; hãy kiểm tra nội dung gốc, đặc biệt hướng dẫn an toàn. Khi hết hạn mức hoặc không dịch được, nội dung gốc được giữ nguyên.",
          "New content is sent to MyMemory for free automatic translation. Machine translations may be inaccurate; check the original, especially safety instructions. When the quota is reached or translation is unavailable, original text is retained.",
        )}
      </p>
      {pendingWeek && (
        <Stocktake
          key={pendingWeek}
          week={pendingWeek}
          close={() => setPendingWeek(null)}
        />
      )}
      {!!s.corrections?.length && (
        <details className="panel">
          <summary>
            {text("Lịch sử sửa ghi nhận", "Correction history")} (
            {s.corrections.length})
          </summary>
          <ul>
            {s.corrections.map((entry, index) => (
              <li key={index}>
                {new Date(entry.at).toLocaleString()} ·{" "}
                {text(
                  "Đã sửa thao tác ghi nhận nhầm; lưu trạng thái trước khi sửa",
                  "Mistaken entry corrected; previous records retained",
                )}
                <details>
                  <summary>
                    {text(
                      "Xem ghi nhận trước khi sửa",
                      "View records before correction",
                    )}
                  </summary>
                  <ul>
                    {entry.food.map((food) => (
                      <li key={food.id}>
                        {ct(food.meal.main)} · {food.servings} · {food.status}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="caption">
        {text(
          "Dùng mục Đồng bộ gia đình để chia sẻ dữ liệu giữa các thiết bị.",
          "Use Family sync to share data between devices.",
        )}{" "}
        {!navigator.locks &&
          text(
            "Trình duyệt không hỗ trợ khóa ghi giữa các tab; chỉ chỉnh sửa ở một tab.",
            "Cross-tab write locks are unavailable; edit in one tab at a time.",
          )}
      </p>
      <AvoidanceProfiles />
      <div className="settings-grid">
        <section className="panel">
          <h2>{text("Thông báo hẹn giờ", "Timer alerts")}</h2>
          <label>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={async (event) => {
                if (!(await enableSound(event.target.checked)))
                  setToast(
                    text(
                      "Trình duyệt chưa hỗ trợ âm báo.",
                      "Audio alerts are unavailable in this browser.",
                    ),
                  );
              }}
            />
            {text("Bật âm báo trong phiên này", "Enable sound in this session")}
          </label>
          <p className="caption">
            {text(
              "Sau khi tải lại trang, hãy bật lại âm báo. Thông báo nền tùy thuộc trình duyệt.",
              "After reloading, re-enable sound. Background notifications depend on your browser.",
            )}
          </p>
          {typeof Notification !== "undefined" && (
            <Button
              onClick={async () => {
                const permission = await Notification.requestPermission();
                setToast(
                  permission === "granted"
                    ? text("Đã bật thông báo.", "Notifications enabled.")
                    : text(
                        "Chưa cấp quyền thông báo. Hẹn giờ vẫn hiển thị trong ứng dụng.",
                        "Notifications are not allowed. The timer remains visible in the app.",
                      ),
                );
              }}
            >
              {text("Cho phép thông báo hẹn giờ", "Allow timer notifications")}
            </Button>
          )}
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
          <p>
            {text(
              "Khẩu phần mới sẽ điều chỉnh lượng nguyên liệu và đặt lại tiến độ.",
              "Applying new servings adjusts quantities and resets progress.",
            )}
          </p>
          <Button
            disabled={!validServings || Number(servingsDraft) === s.servings}
            onClick={() => {
              if (
                confirm(
                  tr(
                    "changeServingsAllProgressResetsBecausePreparedQuantitiesMayNoLongerMatch",
                  ),
                )
              ) {
                update((x) => ({
                  ...startWeek(x, x.weekStart),
                  servings: Number(servingsDraft),
                }));
              }
            }}
          >
            {text("Áp dụng khẩu phần", "Apply servings")}
          </Button>
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
                if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
                const date = new Date(v + "T12:00:00");
                date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
                const monday = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                if (monday !== s.weekStart) setPendingWeek(monday);
              }}
            />
            <small>
              {text(
                "Chọn ngày bất kỳ; ứng dụng sẽ lấy thứ Hai của tuần đó.",
                "Choose any day; the app uses the Monday of that week.",
              )}
            </small>
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
            {text(
              "Dữ liệu được lưu trên thiết bị và đồng bộ khi kết nối bằng mã gia đình. Xuất backup để giữ bản riêng.",
              "Data is saved on this device and synced when connected with your family code. Export a backup to keep a separate copy.",
            )}
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
          {pendingImport && (
            <section
              className="notice"
              aria-label={text("Xem trước bản sao", "Backup preview")}
            >
              <div>
                <h3>
                  {text(
                    "Xem trước trước khi khôi phục",
                    "Review before restoring",
                  )}
                </h3>
                <p>
                  {pendingImport.plan.name} · {pendingImport.plan.meals.length}{" "}
                  {text("bữa", "meals")} · {pendingImport.servings}{" "}
                  {text("người", "people")}
                </p>
                <p>
                  {text("Tuần", "Week")}: {pendingImport.weekStart} ·{" "}
                  {
                    Object.values(pendingImport.progress.done).filter(Boolean)
                      .length
                  }{" "}
                  {text("bữa đã hoàn tất", "completed meals")}
                </p>
                <ul>
                  {pendingImport.plan.meals.map((meal) => (
                    <li key={meal.id}>
                      {ct(meal.day)} · {ct(meal.type)} · {ct(meal.main)}
                    </li>
                  ))}
                </ul>
                <p>
                  {text(
                    "Khôi phục sẽ thay thế kế hoạch và tiến độ hiện tại. Hãy tải bản sao hiện tại nếu cần giữ lại.",
                    "Restoring replaces your current plan and progress. Download your current backup first if needed.",
                  )}
                </p>
                <Button primary onClick={restoreBackup}>
                  {text("Khôi phục bản sao này", "Restore this backup")}
                </Button>
                <Button onClick={() => setPendingImport(null)}>
                  {tr("cancel")}
                </Button>
              </div>
            </section>
          )}
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
      <details className="app-details">
        <summary>{text("Thông tin ứng dụng", "About this app")}</summary>
        <p>
          {text("Phiên bản", "Version")} {import.meta.env.APP_BUILD}
        </p>
        <p>
          {text(
            "Dữ liệu được giữ trên thiết bị. Kết nối Đồng bộ gia đình để chia sẻ thay đổi; AI cần kết nối mạng.",
            "A device copy is retained. Connect Family sync to share changes; AI requires an internet connection.",
          )}
        </p>
      </details>
    </>
  );
};
export default HouseholdSettings;
