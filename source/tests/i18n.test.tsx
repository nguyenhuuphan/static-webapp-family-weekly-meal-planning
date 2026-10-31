import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../src/App";
import { I18nProvider, LanguageSwitcher, useI18n } from "../src/i18n";
import {
  languages,
  LANGUAGE_STORAGE_KEY,
  resolveLanguage,
} from "../src/i18n/catalog";
import { createTranslator } from "../src/i18n/translate";
import { en } from "../src/i18n/locales/en";
import { freshState, STORAGE_KEY } from "../src/domain";
import data from "../public/meal-plan.json";
import type { Plan, State } from "../src/types";

const plan = data as Plan;
const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
const amounts = (text: string) =>
  text.match(/\[[\d.]+ (?:g|ml|each|tsp|tbsp)\]/g) || [];
const navigation = (name: string) =>
  fireEvent.click(
    within(screen.getByRole("navigation")).getByRole("button", { name }),
  );
const switchLanguage = (code: string) =>
  fireEvent.change(
    screen.getByRole("combobox", { name: /Language|Ngôn ngữ/ }),
    { target: { value: code } },
  );

async function boot(state?: State) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => structuredClone(plan) })),
  );
  // These fixtures exercise Monday lunch independently of today's weekday.
  if (!localStorage.getItem("planner:selected"))
    localStorage.setItem("planner:selected", "mon-lunch");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
  if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const view = render(<App />);
  await screen.findByRole("navigation");
  return view;
}

describe("language architecture", () => {
  it("requires matching message keys and interpolation variables for every language", () => {
    for (const config of Object.values(languages)) {
      expect(Object.keys(config.messages).sort()).toEqual(
        Object.keys(en).sort(),
      );
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(config.messages[key].trim(), key).not.toBe("");
        expect(placeholders(config.messages[key]), key).toEqual(
          placeholders(en[key]),
        );
      }
    }
  });

  it("resolves regional preferences with an English fallback", () => {
    expect(resolveLanguage(["vi-VN", "en"])).toBe("vi");
    expect(resolveLanguage(["fr-FR", "en-US"])).toBe("en");
    expect(resolveLanguage(["fr-FR"])).toBe("en");
    expect(resolveLanguage([])).toBe("en");
  });

  it("formats plural messages, decimal numbers and dates using the selected locale", () => {
    const english = createTranslator("en"),
      vietnamese = createTranslator("vi");
    expect(english.t("mealCount", { count: 1 })).toBe("1 meal");
    expect(english.t("mealCount", { count: 2 })).toBe("2 meals");
    expect(vietnamese.t("mealCount", { count: 1 })).toBe("1 bữa ăn");
    expect(vietnamese.t("mealCount", { count: 2 })).toBe("2 bữa ăn");
    expect(vietnamese.number(1.5)).toBe("1,5");
    expect(vietnamese.date("2026-10-12", "Tuesday")).toBe(
      new Intl.DateTimeFormat("vi-VN", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date("2026-10-13T12:00:00Z")),
    );
  });

  it("translates all built-in recipe fields without changing quantities or custom content", () => {
    const translator = createTranslator("vi");
    for (const meal of plan.meals) {
      for (const field of [
        meal.main,
        meal.side,
        meal.storage,
        meal.thaw,
        ...meal.ingredients.map((i) => i.name),
        ...meal.prep.map((s) => s.text),
        ...meal.steps.map((s) => s.text),
      ]) {
        const translated = translator.content(field);
        expect(translated, field).not.toBe(field);
        expect(amounts(translated), field).toEqual(amounts(field));
      }
    }
    expect(translator.content("My own new recipe")).toBe("My own new recipe");
    expect(translator.instruction(plan.meals[0].prep[0].text, 1.5)).toContain(
      "450 g",
    );
    expect(translator.instruction(plan.meals[0].prep[0].text, 1.5)).toContain(
      "3 muỗng cà phê",
    );
    expect(translator.error("mon-lunch: main is required.")).toBe(
      "mon-lunch: cần nhập món chính.",
    );
  });

  it("switches even when local storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    function Probe() {
      const { t } = useI18n();
      return (
        <>
          <LanguageSwitcher />
          <p>{t("shoppingList")}</p>
        </>
      );
    }
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    switchLanguage("vi");
    expect(screen.getByText("Danh sách đi chợ")).toBeTruthy();
    expect(document.documentElement.lang).toBe("vi");
  });
});

describe("bilingual meal planner", () => {
  it("persists the language and keeps recipes, progress and active timers unchanged", async () => {
    const state = freshState(plan);
    state.progress.shopping["Shrimp, peeled|g"] = true;
    state.progress.prep["mon-lunch:0"] = true;
    state.timer = { mealId: "mon-lunch", step: 0, end: Date.now() + 600000 };
    const view = await boot(state);
    const before = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    switchLanguage("vi");
    expect(
      screen.getByRole("heading", { name: "Thịt heo rim tỏi nước mắm" }),
    ).toBeTruthy();
    expect(document.documentElement.lang).toBe("vi");
    expect(document.title).toContain("Lên thực đơn gia đình");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("vi");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(before);
    navigation("Đi chợ");
    fireEvent.click(screen.getByRole("button", { name: "Tất cả" }));
    const shrimp = screen.getByRole("checkbox", {
      name: "Đã mua Tôm đã bóc vỏ",
    }) as HTMLInputElement;
    expect(shrimp.checked).toBe(true);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Tìm trong danh sách đi chợ" }),
      { target: { value: "tom" } },
    );
    expect(screen.getByText("Tôm đã bóc vỏ")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    switchLanguage("en");
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Bought Shrimp, peeled",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    switchLanguage("vi");
    view.unmount();
    await boot();
    expect(
      within(screen.getByRole("navigation"))
        .getByRole("button", { name: "Đi chợ" })
        .getAttribute("aria-current"),
    ).toBe("page");
    navigation("Tuần này");
    expect(
      screen.getByRole("heading", { name: "Thịt heo rim tỏi nước mắm" }),
    ).toBeTruthy();
  });

  it("localizes prep and cooking while keeping edited recipe text across language switches", async () => {
    await boot();
    switchLanguage("vi");
    navigation("Sơ chế");
    fireEvent.click(screen.getByRole("button", { name: "Mở rộng tất cả" }));
    expect(screen.getAllByText(/Cắt 300 g thịt heo/)).toHaveLength(2);
    const task = screen.getByRole("checkbox", {
      name: "Sơ chế Bữa trưa Thứ Hai, việc 1",
    });
    fireEvent.click(task);
    switchLanguage("en");
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Monday Lunch prep 1",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    navigation("Cook");
    switchLanguage("vi");
    expect(
      screen.getByText(
        "Cho 600 ml nước vào nồi, đậy nắp và đun sôi ở lửa lớn.",
      ),
    ).toBeTruthy();
    navigation("Tuần này");
    fireEvent.click(
      screen.getByRole("button", { name: "Chỉnh sửa Bữa trưa Thứ Hai" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Món chính" }), {
      target: { value: "Món riêng của gia đình" },
    });
    switchLanguage("en");
    expect(
      (screen.getByRole("textbox", { name: "Main dish" }) as HTMLInputElement)
        .value,
    ).toBe("Món riêng của gia đình");
    fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
    expect(
      screen.getByRole("heading", { name: "Món riêng của gia đình" }),
    ).toBeTruthy();
    // This multi-screen journey also exercises both catalogues on shared CI CPUs.
  }, 10000);

  it("uses saved preferences before browser preferences and safely ignores an unsupported saved language", async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "vi");
    let view = await boot();
    expect(screen.getByRole("combobox", { name: "Ngôn ngữ" })).toBeTruthy();
    view.unmount();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "not-a-language");
    view = await boot();
    expect(screen.getByRole("combobox", { name: "Language" })).toBeTruthy();
    view.unmount();
  });
});
