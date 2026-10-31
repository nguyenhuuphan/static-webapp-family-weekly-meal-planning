import { afterEach, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App from "../src/App";
import data from "../public/meal-plan.json";
import { freshState, STORAGE_KEY } from "../src/domain";
import { DEFAULT_MASTER_PROMPT, type MenuJob } from "../src/ai/contracts";
import type { Plan } from "../src/types";
import { aiInput, aiPlan } from "./ai-fixtures";
const code = "test-only-family-access-code",
  id = "20000000-0000-4000-8000-000000000001";
afterEach(() => vi.unstubAllGlobals());
async function boot(configured = true, ready = false, savedPlan?: Plan) {
  const initial = freshState(data as Plan);
  initial.weekStart = "2026-10-26";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  let created: MenuJob | null = ready
    ? {
        id,
        revision: "v1",
        status: "ready",
        input: aiInput,
        masterPrompt: DEFAULT_MASTER_PROMPT,
        recentMeals: [],
        createdAt: new Date().toISOString(),
        plan: savedPlan || aiPlan(),
      }
    : null;
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (!url.includes("ai-menu")) return Response.json(data);
    if (init?.method === "POST") {
      const body = JSON.parse(init.body as string);
      if (body.action === "generate") {
        created = {
          id,
          revision: "v1",
          status: "ready",
          input: body.input,
          masterPrompt: body.masterPrompt,
          recentMeals: [],
          createdAt: new Date().toISOString(),
          plan: aiPlan(body.input),
        };
        return Response.json({ id }, { status: 202 });
      }
      if (body.action === "draft") {
        created = { ...created!, plan: body.plan, revision: "v2" };
        return Response.json(created);
      }
      return Response.json({
        masterPrompt: body.masterPrompt,
        revision: "settings-v2",
      });
    }
    return url.includes("?job=")
      ? Response.json(created)
      : Response.json({
          configured,
          masterPrompt: DEFAULT_MASTER_PROMPT,
          revision: null,
          latestJob: created?.id || null,
        });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  await screen.findByRole("navigation");
  fireEvent.click(screen.getByRole("button", { name: "Create menu with AI" }));
  const dialog = screen.getByRole("dialog");
  expect(
    (
      within(dialog).getByRole("button", {
        name: "Continue",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.change(within(dialog).getByLabelText("Family code for AI"), {
    target: { value: code },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Connect AI settings" }),
  );
  await waitFor(() =>
    expect(
      within(dialog).queryByRole("button", { name: "Connect AI settings" }),
    ).toBeNull(),
  );
  return { fetcher, dialog, initial };
}
it("collects equipment and custom preferences, previews and edits before applying a flexible week", async () => {
  const { fetcher, dialog, initial } = await boot();
  const ui = within(dialog);
  fireEvent.change(ui.getByLabelText("Week beginning"), {
    target: { value: "2026-11-02" },
  });
  fireEvent.change(ui.getByLabelText("Number of people"), {
    target: { value: "3" },
  });
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    fireEvent.click(ui.getByRole("checkbox", { name: day }));
  fireEvent.click(ui.getByRole("checkbox", { name: "Saturday" }));
  fireEvent.click(ui.getByRole("checkbox", { name: "Lunch" }));
  fireEvent.click(ui.getByRole("checkbox", { name: "Dinner" }));
  fireEvent.click(ui.getByRole("checkbox", { name: "Breakfast" }));
  fireEvent.click(ui.getByRole("button", { name: "Continue" }));
  expect(
    (ui.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(ui.getByRole("checkbox", { name: "Air fryer" }));
  fireEvent.change(ui.getByLabelText("Other cooking equipment"), {
    target: { value: "Toaster" },
  });
  fireEvent.change(ui.getByLabelText("Additional request"), {
    target: { value: "Use carrots and avoid beef" },
  });
  fireEvent.click(ui.getByRole("button", { name: "Continue" }));
  expect(ui.getByText("Air fryer, Toaster")).toBeTruthy();
  expect(
    fetcher.mock.calls.filter(
      ([, init]) =>
        init?.body && JSON.parse(init.body as string).action === "generate",
    ),
  ).toHaveLength(0);
  const before = localStorage.getItem(STORAGE_KEY);
  fireEvent.click(ui.getByRole("button", { name: "Generate menu" }));
  await ui.findByRole("button", { name: "Apply this menu" });
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  const sent = fetcher.mock.calls.find(
    ([, init]) =>
      init?.body && JSON.parse(init.body as string).action === "generate",
  )![1]!;
  expect(JSON.parse(sent.body as string).input).toMatchObject({
    days: ["Saturday"],
    mealTypes: ["Breakfast"],
    equipment: ["Air fryer", "Toaster"],
    customPrompt: "Use carrots and avoid beef",
    servings: 3,
  });
  fireEvent.click(ui.getByRole("button", { name: "Edit this meal" }));
  expect(
    (ui.getByRole("button", { name: "Apply this menu" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(ui.getByRole("textbox", { name: "Main dish" }), {
    target: { value: "My edited breakfast" },
  });
  fireEvent.click(ui.getByRole("button", { name: "Save meal" }));
  await ui.findByText("Edited draft saved.");
  fireEvent.click(ui.getByRole("button", { name: "Apply this menu" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  expect(saved.plan.schemaVersion).toBe(2);
  expect(saved.plan.meals).toHaveLength(1);
  expect(saved.plan.meals[0].main).toBe("My edited breakfast");
  expect(saved.weekArchive[initial.weekStart].plan).toEqual(initial.plan);
  expect(saved.weekStart).toBe("2026-11-02");
  expect(saved.servings).toBe(3);
});
it("keeps generation disabled without provider configuration and resumes shared drafts", async () => {
  const { dialog } = await boot(false);
  const ui = within(dialog);
  await ui.findByText(/AI is not configured/);
  fireEvent.click(ui.getByRole("button", { name: "Continue" }));
  fireEvent.click(ui.getByRole("checkbox", { name: "Gas stove" }));
  fireEvent.click(ui.getByRole("button", { name: "Continue" }));
  expect(
    (ui.getByRole("button", { name: "Generate menu" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(ui.getByRole("button", { name: "Close menu dialog" }));
});
it("reopens the latest draft and lets users start another week without calling AI immediately", async () => {
  const { dialog, fetcher } = await boot(true, true);
  const ui = within(dialog);
  await ui.findByRole("button", { name: "Apply this menu" });
  fireEvent.click(
    ui.getByRole("button", { name: "Change request / create another menu" }),
  );
  expect(ui.getByLabelText("Number of people")).toBeTruthy();
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(0);
});
it("supports day presets, validates each step and retains answers when changing the review", async () => {
  const { dialog, fetcher } = await boot();
  const ui = within(dialog);
  fireEvent.change(ui.getByLabelText("Week beginning"), {
    target: { value: "" },
  });
  expect(
    (ui.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(ui.getByLabelText("Week beginning"), {
    target: { value: "2026-11-02" },
  });
  fireEvent.click(ui.getByRole("button", { name: "All 7 days" }));
  expect(
    (ui.getByRole("checkbox", { name: "Sunday" }) as HTMLInputElement).checked,
  ).toBe(true);
  fireEvent.click(ui.getByRole("button", { name: "Weekdays" }));
  expect(
    (ui.getByRole("checkbox", { name: "Sunday" }) as HTMLInputElement).checked,
  ).toBe(false);
  fireEvent.click(ui.getByRole("button", { name: "Continue" }));
  expect(document.activeElement).toBe(
    ui.getByRole("heading", { name: "Preferences & requests", level: 3 }),
  );
  fireEvent.click(ui.getByRole("checkbox", { name: "Gas stove" }));
  fireEvent.change(ui.getByRole("combobox", { name: "Diet" }), {
    target: { value: "other" },
  });
  fireEvent.change(ui.getByLabelText("Other diet details (optional)"), {
    target: { value: "Pescatarian" },
  });
  fireEvent.change(ui.getByLabelText("Maximum cooking minutes per meal"), {
    target: { value: "2" },
  });
  expect(
    (ui.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(ui.getByLabelText("Maximum cooking minutes per meal"), {
    target: { value: "25" },
  });
  fireEvent.click(ui.getByRole("button", { name: "Continue" }));
  expect(ui.getByText("Pescatarian")).toBeTruthy();
  fireEvent.click(ui.getByRole("button", { name: "Change preferences" }));
  expect(
    (ui.getByRole("checkbox", { name: "Gas stove" }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    (ui.getByLabelText("Other diet details (optional)") as HTMLInputElement)
      .value,
  ).toBe("Pescatarian");
  expect(
    ui.getByLabelText("Allergies / ingredients to avoid").closest("details"),
  ).toBeNull();
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(0);
});
it("keeps prototype-like translation source keys after a generated menu is applied", async () => {
  const plan = aiPlan();
  plan.meals[0].main = "__proto__";
  Object.defineProperty(plan.translations!.vi, "__proto__", {
    value: "Món ăn được dịch đúng",
    enumerable: true,
  });
  const { dialog } = await boot(true, true, plan);
  fireEvent.click(
    await within(dialog).findByRole("button", { name: "Apply this menu" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
    target: { value: "vi" },
  });
  await waitFor(() =>
    expect(screen.getAllByText("Món ăn được dịch đúng").length).toBeGreaterThan(
      0,
    ),
  );
});
