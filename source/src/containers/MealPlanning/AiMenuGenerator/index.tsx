import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useI18n, useText } from "src/i18n";
import { createTranslator } from "src/i18n/translate";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useFamilyAccess } from "src/hooks/useFamilyAccess";
import { Button } from "src/modules/shared-main/components";
import { DAYS, MEAL_TYPES, type Meal, type Plan } from "src/types";
import {
  COOKING_EQUIPMENT,
  DEFAULT_MASTER_PROMPT,
  validateMenuInput,
  validateMasterPrompt,
  type MenuInput,
  type MenuJob,
} from "src/ai/contracts";
import { MenuApiError, menuRequest } from "src/ai/client";
import { applyGeneratedMenu } from "src/ai/apply";
import { validatePlan } from "src/validations";
import MealEditor from "../MealEditor";

type Settings = {
  configured: boolean;
  masterPrompt: string;
  revision: string | null;
  latestJob: string | null;
};
const CUISINES = [
  ["Vietnamese", "Việt", "Vietnamese"],
  ["European", "Âu", "European"],
  ["Asian", "Châu Á", "Asian"],
  ["Mixed", "Kết hợp", "Mixed"],
] as const;
export default function AiMenuGenerator() {
  const model = useMealPlanner(),
    text = useText();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        primary
        disabled={!!model.editing || model.advanced}
        onClick={() => setOpen(true)}
      >
        <Sparkles size={17} />
        {text("Tạo thực đơn bằng AI", "Create menu with AI")}
      </Button>
      {open && <GeneratorDialog close={() => setOpen(false)} />}
    </>
  );
}
function GeneratorDialog({ close }: { close: () => void }) {
  const model = useMealPlanner(),
    text = useText(),
    { language, content: ct } = useI18n();
  const { accessCode, setAccessCode } = useFamilyAccess();
  const [code, setCode] = useState(accessCode);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [master, setMaster] = useState(DEFAULT_MASTER_PROMPT);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<MenuInput>({
    weekStart: model.s.weekStart,
    servings: model.s.servings,
    days: [...DAYS.slice(0, 5)],
    mealTypes: ["Lunch", "Dinner"],
    cuisines: ["Vietnamese"],
    equipment: [],
    diet: "Balanced",
    avoid: [
      ...new Set(model.s.avoidanceProfiles?.flatMap((p) => p.avoid) || []),
    ].join(", "),
    maxMinutes: 30,
    budget: "",
    pantry: Object.entries(model.s.pantry || {})
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => `${key}: ${qty}`)
      .join("\n")
      .slice(0, 2000),
    customPrompt: "",
  });
  const [otherCuisine, setOtherCuisine] = useState("");
  const [otherEquipment, setOtherEquipment] = useState("");
  const [job, setJob] = useState<MenuJob | null>(null);
  const [preview, setPreview] = useState<Plan | null>(null);
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    alive = useRef(true),
    inflight = useRef(false),
    submissionId = useRef<string | null>(null);
  const latest = useRef(model);
  latest.current = model;
  const baseline = useRef(JSON.stringify(model.s));
  const recipes = useMemo(
    () => createTranslator(language, false, preview?.translations?.vi),
    [language, preview],
  );
  const patch = <K extends keyof MenuInput>(key: K, value: MenuInput[K]) =>
    setInput((old) => ({ ...old, [key]: value }));
  const requestInput = () => ({
    ...input,
    equipment: [
      ...new Set([
        ...input.equipment,
        ...(otherEquipment.trim() ? [otherEquipment.trim()] : []),
      ]),
    ],
    cuisines: [
      ...new Set([
        ...input.cuisines,
        ...(otherCuisine.trim() ? [otherCuisine.trim()] : []),
      ]),
    ],
  });
  const receive = (next: MenuJob) => {
    if (
      !next ||
      !["queued", "running", "ready", "failed"].includes(next.status)
    )
      throw new MenuApiError("network");
    setError(
      next.status === "failed" ? next.errorCode || "provider_error" : "",
    );
    setJob(next);
    setStep(3);
    setInput(next.input);
    setOtherCuisine("");
    setOtherEquipment("");
    setMaster(next.masterPrompt);
    if (next.status === "ready") {
      if (!next.plan || validatePlan(next.plan).length)
        throw new MenuApiError("invalid_output");
      setPreview(next.plan);
    }
    if (next.status === "failed") setError(next.errorCode || "provider_error");
  };
  async function loadSettings() {
    if (inflight.current || code.length < 16) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await menuRequest<Settings>(code);
      if (!alive.current) return;
      if (
        typeof result.configured !== "boolean" ||
        typeof result.masterPrompt !== "string"
      )
        throw new MenuApiError("network");
      setSettings(result);
      setMaster(result.masterPrompt);
      setAccessCode(code);
      if (result.latestJob) {
        const previous = await menuRequest<MenuJob>(
          code,
          undefined,
          result.latestJob,
        );
        if (alive.current) {
          baseline.current = JSON.stringify(latest.current.s);
          receive(previous);
        }
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof MenuApiError ? e.code : "network");
    } finally {
      inflight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    if (node?.showModal && !node.open) node.showModal();
    else node?.setAttribute("open", "");
    if (accessCode) void loadSettings();
    return () => {
      alive.current = false;
      previouslyFocused?.focus();
    };
  }, []);
  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    let disposed = false,
      timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await menuRequest<MenuJob>(code, undefined, job.id);
        if (!disposed) receive(result);
      } catch (e) {
        if (!disposed) setError(e instanceof MenuApiError ? e.code : "network");
        if (e instanceof MenuApiError && e.code === "unauthorized") return;
      }
      if (!disposed) timeout = setTimeout(poll, 3000);
    };
    timeout = setTimeout(poll, 1500);
    return () => {
      disposed = true;
      clearTimeout(timeout);
    };
  }, [job?.id, job?.status, code]);
  async function generate() {
    if (inflight.current || !settings?.configured) return;
    let data;
    try {
      data = validateMenuInput(requestInput());
      validateMasterPrompt(master);
    } catch {
      setError("invalid_input");
      return;
    }
    inflight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    baseline.current = JSON.stringify(latest.current.s);
    submissionId.current ??= crypto.randomUUID();
    try {
      const recentMeals = [
        ...latest.current.plan.meals,
        ...Object.values(latest.current.s.weekArchive || {}).flatMap(
          (e) => e.plan.meals,
        ),
      ]
        .map((m) => m.main)
        .slice(0, 50);
      const result = await menuRequest<{ id: string }>(code, {
        action: "generate",
        id: submissionId.current,
        input: data,
        masterPrompt: master,
        recentMeals,
      });
      const created = await menuRequest<MenuJob>(code, undefined, result.id);
      if (alive.current) receive(created);
    } catch (e) {
      if (alive.current)
        setError(e instanceof MenuApiError ? e.code : "network");
    } finally {
      inflight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function saveMaster() {
    if (!settings || inflight.current) return;
    try {
      validateMasterPrompt(master);
    } catch {
      setError("invalid_input");
      return;
    }
    inflight.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = await menuRequest<{
        masterPrompt: string;
        revision: string;
      }>(code, {
        action: "settings",
        masterPrompt: master,
        revision: settings.revision,
      });
      if (alive.current) {
        setSettings({ ...settings, ...saved });
        setNotice(
          text(
            "Đã lưu master prompt cho gia đình.",
            "Master prompt saved for your family.",
          ),
        );
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof MenuApiError ? e.code : "network");
    } finally {
      inflight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function savePreview(next: Plan) {
    if (!job?.revision || inflight.current) return false;
    inflight.current = true;
    setBusy(true);
    setError("");
    try {
      const updated = await menuRequest<MenuJob>(code, {
        action: "draft",
        id: job.id,
        revision: job.revision,
        plan: next,
      });
      if (alive.current) {
        receive(updated);
        setEditMeal(null);
        setNotice(text("Đã lưu bản nháp chỉnh sửa.", "Edited draft saved."));
        return true;
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof MenuApiError ? e.code : "network");
    } finally {
      inflight.current = false;
      if (alive.current) setBusy(false);
    }
    return false;
  }
  const errors: Record<string, string> = {
    draft_conflict: text(
      "Bản nháp đã đổi trên thiết bị khác. Đóng và mở lại popup để tải bản mới.",
      "The draft changed on another device. Reopen this dialog to load the latest copy.",
    ),
    unavailable_equipment: text(
      "Menu yêu cầu dụng cụ chưa được chọn. Menu hiện tại vẫn được giữ; hãy điều chỉnh yêu cầu trước khi tạo lại.",
      "The menu requires an appliance you did not select. Your current menu is unchanged; revise the request before generating again.",
    ),
    restricted_ingredient: text(
      "Menu có nguyên liệu thuộc danh sách cần tránh nên đã bị từ chối.",
      "The generated menu included a restricted ingredient and was rejected.",
    ),
    not_configured: text(
      "AI chưa được bật. Quản trị viên cần thêm GEMINI_API_KEY vào Netlify Functions.",
      "AI is not configured. The site owner needs to add GEMINI_API_KEY to Netlify Functions.",
    ),
    unauthorized: text(
      "Mã gia đình không đúng hoặc Netlify đang yêu cầu đăng nhập.",
      "The family code is invalid, or Netlify requires sign-in.",
    ),
    daily_limit: text(
      "Đã hết số lượt tạo hôm nay. Menu hiện tại vẫn được giữ.",
      "Today’s generation limit has been reached. Your current menu is unchanged.",
    ),
    quota: text(
      "Đã hết hạn mức Gemini miễn phí. Hãy thử lại sau.",
      "Gemini’s free quota is exhausted. Try again later.",
    ),
    invalid_output: text(
      "AI trả về thực đơn chưa hợp lệ hoặc thiếu bản dịch. Chưa có dữ liệu nào được thay thế.",
      "The AI returned an invalid or incomplete menu. No existing data was replaced.",
    ),
    invalid_input: text(
      "Kiểm tra ngày, số người, số bữa và độ dài các yêu cầu.",
      "Check the date, people, meals and request lengths.",
    ),
    provider_access: text(
      "Gemini từ chối truy cập. Quản trị viên cần kiểm tra key, model và quyền dùng API.",
      "Gemini denied access. The site owner should check the key, model and API access.",
    ),
    dispatch_failed: text(
      "Chưa khởi động được AI. Kiểm tra Netlify SSO và Background Functions.",
      "Could not start generation. Check Netlify SSO and Background Functions.",
    ),
    conflict: text(
      "Master prompt đã đổi trên thiết bị khác. Đóng và mở lại popup để tải bản mới.",
      "The master prompt changed on another device. Reopen this dialog to load it.",
    ),
    local_changed: text(
      "Dữ liệu trên thiết bị đã đổi trong lúc tạo. Hãy xuất backup và mở lại bản nháp để xem trước lần nữa.",
      "This device’s data changed during generation. Export a backup and reopen this draft to review it again.",
    ),
    cooking: text(
      "Hãy kết thúc mẻ nấu và hẹn giờ trước khi áp dụng menu mới.",
      "Finish cooking batches and timers before applying a new menu.",
    ),
    timeout: text(
      "Tác vụ tạo menu đã quá thời gian chờ. Menu hiện tại không đổi.",
      "Generation timed out. Your current menu is unchanged.",
    ),
  };
  const running = !!job && ["queued", "running"].includes(job.status);
  const canApply =
    preview &&
    !running &&
    !busy &&
    !model.externalChange &&
    model.recoveryRaw === null &&
    !model.storageError &&
    !model.s.timer &&
    !model.s.timers?.length &&
    !Object.keys(model.s.cookingBatches || {}).length;
  function apply() {
    if (!preview || !canApply) return;
    if (JSON.stringify(latest.current.s) !== baseline.current) {
      setError("local_changed");
      return;
    }
    const changed = latest.current.update((s) =>
      applyGeneratedMenu(s, preview, input.weekStart),
    );
    if (!changed) return;
    latest.current.setSelected(preview.meals[0].id);
    latest.current.navigate("week");
    latest.current.setToast(
      text(
        "Đã áp dụng menu mới. Kết nối Đồng bộ gia đình để chia sẻ.",
        "New menu applied. Connect Family sync to share it.",
      ),
    );
    close();
  }
  return (
    <dialog
      ref={dialog}
      className="ai-menu-dialog"
      aria-labelledby="ai-menu-title"
      onCancel={close}
    >
      <div className="ai-dialog-header">
        <h2 id="ai-menu-title">
          {text("Tạo thực đơn tuần mới", "Create a new weekly menu")}
        </h2>
        <Button
          aria-label={text("Đóng popup", "Close menu dialog")}
          onClick={close}
        >
          <X size={18} />
        </Button>
      </div>
      <p className="caption">
        {text(
          "Gemini · chỉ tạo khi bạn bấm nút. Xem trước rồi mới thay menu.",
          "Gemini · generates only when you ask. Review before replacing your menu.",
        )}
      </p>
      <ol className="ai-steps" aria-label={text("Các bước", "Steps")}>
        {[
          text("Gia đình & lịch ăn", "Household & schedule"),
          text("Sở thích & yêu cầu", "Preferences & requests"),
          text("Xác nhận", "Review request"),
          text("Bản nháp", "Draft"),
        ].map((label, index) => (
          <li key={label} aria-current={step === index ? "step" : undefined}>
            {label}
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="notice warning">
          {errors[error] ||
            text(
              "Chưa kết nối được dịch vụ. Dữ liệu hiện tại được giữ nguyên.",
              "The service is unavailable. Your current data is retained.",
            )}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">{text("Đang xử lý…", "Working…")}</p>}
      {step < 3 && (
        <>
          {step === 0 && (
            <>
              {!settings && (
                <section className="panel">
                  <label>
                    {text("Mã truy cập gia đình", "Family code for AI")}
                    <input
                      type="password"
                      autoComplete="off"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </label>
                  <Button
                    disabled={code.length < 16 || busy}
                    onClick={() => void loadSettings()}
                  >
                    {text("Kết nối", "Connect AI settings")}
                  </Button>
                </section>
              )}
              {settings && !settings.configured && (
                <p role="status">{errors.not_configured}</p>
              )}
              <div className="ai-form-grid">
                <label>
                  {text("Tuần bắt đầu", "Week beginning")}
                  <input
                    type="date"
                    value={input.weekStart}
                    onChange={(e) => {
                      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return;
                      const d = new Date(e.target.value + "T12:00:00");
                      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
                      patch(
                        "weekStart",
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                      );
                    }}
                  />
                </label>
                <label>
                  {text("Số người", "Number of people")}
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={input.servings}
                    onChange={(e) => patch("servings", Number(e.target.value))}
                  />
                </label>
              </div>
              <fieldset>
                <legend>{text("Ngày cần tạo menu", "Days to plan")}</legend>
                <div className="ai-options">
                  {DAYS.map((day) => (
                    <label key={day}>
                      <input
                        type="checkbox"
                        checked={input.days.includes(day)}
                        onChange={(e) =>
                          patch(
                            "days",
                            e.target.checked
                              ? [...input.days, day]
                              : input.days.filter((d) => d !== day),
                          )
                        }
                      />
                      {ct(day)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>{text("Bữa ăn", "Meal times")}</legend>
                <div className="ai-options">
                  {MEAL_TYPES.map((type) => (
                    <label key={type}>
                      <input
                        type="checkbox"
                        checked={input.mealTypes.includes(type)}
                        onChange={(e) =>
                          patch(
                            "mealTypes",
                            e.target.checked
                              ? [...input.mealTypes, type]
                              : input.mealTypes.filter((t) => t !== type),
                          )
                        }
                      />
                      {ct(type)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <p>
                <strong>
                  {input.days.length * input.mealTypes.length}{" "}
                  {text("bữa ăn", "meals")}
                </strong>{" "}
                · {input.servings} {text("người", "people")}
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <fieldset>
                <legend>
                  {text(
                    "Dụng cụ nấu ăn đang có",
                    "Available cooking equipment",
                  )}
                </legend>
                <div className="ai-options">
                  {[
                    ...COOKING_EQUIPMENT,
                    ...input.equipment
                      .filter(
                        (value) =>
                          !COOKING_EQUIPMENT.some(
                            (option) => option[0] === value,
                          ),
                      )
                      .map((value) => [value, value, value] as const),
                  ].map(([value, vi, en]) => (
                    <label key={value}>
                      <input
                        type="checkbox"
                        checked={input.equipment.includes(value)}
                        onChange={(e) =>
                          patch(
                            "equipment",
                            e.target.checked
                              ? value === "No heating appliance"
                                ? [value]
                                : [
                                    ...input.equipment.filter(
                                      (v) => v !== "No heating appliance",
                                    ),
                                    value,
                                  ]
                              : input.equipment.filter((v) => v !== value),
                          )
                        }
                      />
                      {text(vi, en)}
                    </label>
                  ))}
                </div>
                <label>
                  {text("Dụng cụ khác", "Other cooking equipment")}
                  <input
                    maxLength={80}
                    value={otherEquipment}
                    onChange={(e) => setOtherEquipment(e.target.value)}
                  />
                </label>
                <p className="caption">
                  {text(
                    "Chọn ít nhất một mục. AI chỉ được yêu cầu dùng thiết bị đã chọn; dao, thớt và dụng cụ cơ bản được mặc định có.",
                    "Choose at least one option. AI may only require selected appliances; basic knives, boards and utensils are assumed.",
                  )}
                </p>
              </fieldset>
              <fieldset>
                <legend>{text("Phong cách món ăn", "Cuisines")}</legend>
                <div className="ai-options">
                  {[
                    ...CUISINES,
                    ...input.cuisines
                      .filter(
                        (value) =>
                          !CUISINES.some((option) => option[0] === value),
                      )
                      .map((value) => [value, value, value] as const),
                  ].map(([value, vi, en]) => (
                    <label key={value}>
                      <input
                        type="checkbox"
                        checked={input.cuisines.includes(value)}
                        onChange={(e) =>
                          patch(
                            "cuisines",
                            e.target.checked
                              ? [...input.cuisines, value]
                              : input.cuisines.filter((c) => c !== value),
                          )
                        }
                      />
                      {text(vi, en)}
                    </label>
                  ))}
                </div>
                <label>
                  {text("Ẩm thực khác", "Other cuisine")}
                  <input
                    maxLength={80}
                    value={otherCuisine}
                    onChange={(e) => setOtherCuisine(e.target.value)}
                  />
                </label>
              </fieldset>
              <div className="ai-form-grid">
                <label>
                  {text("Chế độ ăn", "Diet")}
                  <input
                    list="ai-diets"
                    maxLength={2000}
                    value={input.diet}
                    onChange={(e) => patch("diet", e.target.value)}
                  />
                  <datalist id="ai-diets">
                    <option value="Balanced" />
                    <option value="Vegetarian" />
                    <option value="Vegan" />
                    <option value="Low-carb" />
                  </datalist>
                </label>
                <label>
                  {text(
                    "Tối đa phút nấu mỗi bữa",
                    "Maximum cooking minutes per meal",
                  )}
                  <input
                    type="number"
                    min="5"
                    max="240"
                    value={input.maxMinutes}
                    onChange={(e) =>
                      patch("maxMinutes", Number(e.target.value))
                    }
                  />
                </label>
              </div>
              <label>
                {text(
                  "Dị ứng / nguyên liệu cần tránh",
                  "Allergies / ingredients to avoid",
                )}
                <textarea
                  maxLength={2000}
                  value={input.avoid}
                  onChange={(e) => patch("avoid", e.target.value)}
                />
              </label>
              <label>
                {text(
                  "Ngân sách dự kiến (không bắt buộc)",
                  "Budget preference (optional)",
                )}
                <input
                  maxLength={2000}
                  value={input.budget}
                  onChange={(e) => patch("budget", e.target.value)}
                />
              </label>
              <label>
                {text("Nguyên liệu đang có", "Ingredients on hand")}
                <textarea
                  maxLength={2000}
                  value={input.pantry}
                  onChange={(e) => patch("pantry", e.target.value)}
                />
              </label>
              <label>
                {text("Yêu cầu thêm", "Additional request")}
                <textarea
                  maxLength={2000}
                  value={input.customPrompt}
                  onChange={(e) => patch("customPrompt", e.target.value)}
                  placeholder={text(
                    "Ví dụ: ưu tiên cá và gà, tận dụng bắp cải…",
                    "For example: more fish and chicken; use up cabbage…",
                  )}
                />
              </label>
              <details>
                <summary>
                  {text("Master prompt dùng chung", "Shared master prompt")}
                </summary>
                <label>
                  {text(
                    "Hướng dẫn chung cho AI",
                    "General instructions for AI",
                  )}
                  <textarea
                    rows={7}
                    maxLength={6000}
                    value={master}
                    onChange={(e) => setMaster(e.target.value)}
                  />
                </label>
                <Button
                  disabled={!settings || busy}
                  onClick={() => void saveMaster()}
                >
                  {text("Lưu master prompt", "Save master prompt")}
                </Button>
              </details>
            </>
          )}
          {step === 2 && (
            <section className="panel">
              <h3>
                {text("Kiểm tra trước khi tạo", "Review before generating")}
              </h3>
              <p>
                {input.weekStart} · {input.servings} {text("người", "people")} ·{" "}
                {input.days.length * input.mealTypes.length}{" "}
                {text("bữa", "meals")}
              </p>
              <p>
                {input.days.map(ct).join(", ")} ·{" "}
                {input.mealTypes.map(ct).join(", ")}
              </p>
              <dl>
                {[
                  [
                    text("Dụng cụ", "Equipment"),
                    requestInput()
                      .equipment.map((e) => {
                        const option = COOKING_EQUIPMENT.find(
                          (v) => v[0] === e,
                        );
                        return option ? text(option[1], option[2]) : e;
                      })
                      .join(", "),
                  ],
                  [
                    text("Ẩm thực", "Cuisines"),
                    requestInput().cuisines.join(", "),
                  ],
                  [text("Chế độ ăn", "Diet"), input.diet],
                  [text("Cần tránh", "Avoid"), input.avoid],
                  [
                    text("Thời gian", "Time"),
                    `${input.maxMinutes} ${text("phút/bữa", "min/meal")}`,
                  ],
                  [text("Ngân sách", "Budget"), input.budget],
                  [text("Đang có", "On hand"), input.pantry],
                  [
                    text("Yêu cầu thêm", "Additional request"),
                    input.customPrompt,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="caption">
                {text(
                  "AI có thể sai. Kiểm tra dị ứng, lượng nguyên liệu và hướng dẫn an toàn trước khi áp dụng. Dữ liệu trong biểu mẫu được gửi tới Gemini; không gửi thông tin cá nhân không cần thiết.",
                  "AI can make mistakes. Review allergens, quantities and safety instructions before applying. Form contents are sent to Gemini; omit unnecessary personal information.",
                )}
              </p>
              {!settings?.configured && <p>{errors.not_configured}</p>}
            </section>
          )}
          <div className="actions ai-dialog-actions">
            {step > 0 && (
              <Button
                disabled={busy}
                onClick={() => {
                  setError("");
                  setStep(step - 1);
                }}
              >
                {text("Quay lại", "Back")}
              </Button>
            )}
            {step < 2 ? (
              <Button
                primary
                disabled={
                  busy ||
                  !input.days.length ||
                  !input.mealTypes.length ||
                  input.servings < 1 ||
                  input.servings > 12 ||
                  (step === 1 && !requestInput().equipment.length)
                }
                onClick={() => {
                  setError("");
                  setStep(step + 1);
                }}
              >
                {text("Tiếp tục", "Continue")}
              </Button>
            ) : (
              <Button
                primary
                disabled={busy || !settings?.configured}
                onClick={() => void generate()}
              >
                {text("Tạo thực đơn", "Generate menu")}
              </Button>
            )}
          </div>
        </>
      )}
      {step === 3 && (
        <>
          {running && (
            <div role="status">
              <h3>{text("Đang tạo menu…", "Creating your menu…")}</h3>
              <p>
                {text(
                  "Bạn có thể đóng popup và mở lại để xem tác vụ. Menu hiện tại chưa thay đổi.",
                  "You can close this dialog and reopen it to check the job. Your current menu is unchanged.",
                )}
              </p>
            </div>
          )}
          {job?.status === "failed" && (
            <Button
              disabled={busy}
              onClick={() => {
                setJob(null);
                setPreview(null);
                submissionId.current = null;
                setStep(0);
                setError("");
              }}
            >
              {text(
                "Sửa yêu cầu / tạo lại bằng lượt mới",
                "Edit request / start a new generation",
              )}
            </Button>
          )}
          {preview && (
            <>
              <h3>{recipes.content(preview.name)}</h3>
              <p>
                {input.weekStart} · {preview.meals.length}{" "}
                {text("bữa", "meals")} · {preview.servings}{" "}
                {text("người", "people")}
              </p>
              {editMeal ? (
                <MealEditor
                  key={`ai-${job?.id}-${editMeal.id}`}
                  draftNamespace={`ai-draft:${job?.id}`}
                  confirmSave={false}
                  meal={editMeal}
                  plan={preview}
                  onCancel={() => setEditMeal(null)}
                  onSave={(meal) => {
                    return savePreview({
                      ...preview,
                      meals: preview.meals.map((m) =>
                        m.id === meal.id ? meal : m,
                      ),
                    });
                  }}
                />
              ) : (
                <div className="ai-preview">
                  {preview.meals.map((meal) => (
                    <article className="panel" key={meal.id}>
                      <h4>
                        {ct(meal.day)} · {ct(meal.type)}
                      </h4>
                      <strong>{recipes.content(meal.main)}</strong>
                      <p>{recipes.content(meal.side)}</p>
                      <p>
                        {meal.minutes} {text("phút", "minutes")}
                      </p>
                      <p>
                        {text("Dụng cụ", "Equipment")}:{" "}
                        {(meal.equipment || [])
                          .map((e) => {
                            const option = COOKING_EQUIPMENT.find(
                              (v) => v[0] === e,
                            );
                            return option ? text(option[1], option[2]) : e;
                          })
                          .join(", ") ||
                          text("Dụng cụ cơ bản", "Basic utensils")}
                      </p>
                      <details>
                        <summary>
                          {text(
                            "Nguyên liệu và cách nấu",
                            "Ingredients and instructions",
                          )}
                        </summary>
                        <ul>
                          {meal.ingredients.map((i, index) => (
                            <li key={index}>
                              {recipes.content(i.name)}: {i.qty} {i.unit}
                            </li>
                          ))}
                        </ul>
                        <h5>{text("Sơ chế", "Preparation")}</h5>
                        <ol>
                          {meal.prep.map((s, index) => (
                            <li key={index}>
                              {recipes.instruction(s.text, 1)}
                            </li>
                          ))}
                        </ol>
                        <h5>{text("Nấu ăn", "Cooking")}</h5>
                        <ol>
                          {meal.steps.map((s, index) => (
                            <li key={index}>
                              {recipes.instruction(s.text, 1)}
                            </li>
                          ))}
                        </ol>
                        <p>{recipes.content(meal.storage)}</p>
                        <p>{recipes.content(meal.thaw)}</p>
                      </details>
                      <Button onClick={() => setEditMeal(meal)}>
                        {text("Chỉnh sửa bữa này", "Edit this meal")}
                      </Button>
                    </article>
                  ))}
                </div>
              )}
              <p className="notice">
                {text(
                  "Áp dụng sẽ lưu tuần hiện tại vào lịch sử, giữ thông tin thực phẩm đã chuẩn bị và bắt đầu tiến độ cho menu mới. Xuất backup nếu cần giữ bản riêng.",
                  "Applying archives the current week, retains prepared-food records and starts fresh progress for the new menu. Export a backup if you need a separate copy.",
                )}
              </p>
              <div className="actions">
                <Button
                  disabled={busy || !!editMeal}
                  onClick={() => {
                    setJob(null);
                    setPreview(null);
                    submissionId.current = null;
                    setStep(0);
                    setError("");
                    setNotice("");
                  }}
                >
                  {text(
                    "Đổi yêu cầu / tạo menu khác",
                    "Change request / create another menu",
                  )}
                </Button>
                <Button onClick={model.exportJSON}>
                  {text("Xuất backup hiện tại", "Export current backup")}
                </Button>
                <Button
                  primary
                  disabled={!canApply || !!editMeal}
                  onClick={apply}
                >
                  {text("Áp dụng menu này", "Apply this menu")}
                </Button>
              </div>
              {!canApply && <p>{errors.cooking}</p>}
            </>
          )}
        </>
      )}
    </dialog>
  );
}
