import { expect, it, vi } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import { fireEvent } from "./userEvents";
import MealEditor from "../src/containers/MealPlanning/MealEditor";
import { I18nProvider } from "../src/i18n";
import data from "../public/meal-plan.json";
import type { Plan } from "../src/types";
vi.mock("../src/hooks/useMealPlanner", () => ({
  useMealPlanner: () => ({ s: { avoidanceProfiles: [] } }),
}));

it("locks the pending draft and retains it when an asynchronous save fails", async () => {
  const plan = structuredClone(data) as Plan;
  const meal = plan.meals[0];
  let settle!: (value: boolean) => void;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    )
    .mockReturnValueOnce(true);
  render(
    <I18nProvider>
      <MealEditor
        confirmSave={false}
        plan={plan}
        meal={meal}
        onSave={save}
        onCancel={vi.fn()}
      />
    </I18nProvider>,
  );
  const main = screen.getByRole("textbox", { name: "Main dish" });
  await fireEvent.change(main, { target: { value: "Retained draft" } });
  await fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
  expect(main.matches(":disabled")).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await act(async () => settle(false));
  expect(main.matches(":disabled")).toBe(false);
  expect(screen.getByRole("alert").textContent).toContain(
    "Your draft is retained",
  );
  expect(sessionStorage.getItem(`meal-draft:${meal.id}`)).not.toBeNull();
  await fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
  await waitFor(() =>
    expect(sessionStorage.getItem(`meal-draft:${meal.id}`)).toBeNull(),
  );
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0].main).toBe("Retained draft");
});

it("keeps unconfirmed preparation selections with their step when an earlier step is removed", async () => {
  const plan = structuredClone(data) as Plan;
  const meal = plan.meals[0];
  meal.prep = meal.prep
    .slice(0, 2)
    .map((step) => ({ ...step, ingredients: undefined }));
  const { container } = render(
    <I18nProvider>
      <MealEditor plan={plan} meal={meal} onSave={vi.fn()} onCancel={vi.fn()} />
    </I18nProvider>,
  );
  const second = container.querySelectorAll(".edit-step")[1] as HTMLElement;
  await fireEvent.click(within(second).getAllByRole("checkbox")[0]);
  await fireEvent.click(
    screen.getByRole("button", { name: "Remove prep step 1" }),
  );
  const remaining = container.querySelector(".edit-step") as HTMLElement;
  expect(
    (within(remaining).getAllByRole("checkbox")[0] as HTMLInputElement).checked,
  ).toBe(true);
});

it("keeps allergen labels with their ingredient when another row is removed", async () => {
  const plan = structuredClone(data) as Plan;
  const meal = plan.meals[0];
  meal.ingredients[0].allergenTags = ["soy"];
  meal.ingredients[1].allergenTags = ["fish"];
  const { container } = render(
    <I18nProvider>
      <MealEditor plan={plan} meal={meal} onSave={vi.fn()} onCancel={vi.fn()} />
    </I18nProvider>,
  );
  await fireEvent.click(
    screen.getByRole("button", { name: "Remove ingredient 1" }),
  );
  const first = container.querySelector(".ingredient-row")!;
  expect(
    (first.querySelector(".ingredient-name input") as HTMLInputElement).value,
  ).toBe(meal.ingredients[1].name);
  expect(
    (first.querySelector(".ingredient-options input") as HTMLInputElement)
      .value,
  ).toBe("fish");
});

it("preserves field names on validation and inserts quantities after the step controls are separated", async () => {
  const plan = structuredClone(data) as Plan;
  const meal = plan.meals[0];
  const save = vi.fn();
  const { container } = render(
    <I18nProvider>
      <MealEditor
        embedded
        confirmSave={false}
        plan={plan}
        meal={meal}
        onSave={save}
        onCancel={vi.fn()}
      />
    </I18nProvider>,
  );
  const main = screen.getByRole("textbox", { name: "Main dish" });
  await fireEvent.change(main, { target: { value: "" } });
  await fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
  await waitFor(() => expect(document.activeElement).toBe(main));
  expect(screen.getByRole("textbox", { name: "Main dish" })).toBe(main);
  expect(main.getAttribute("aria-describedby")).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  await fireEvent.change(main, { target: { value: meal.main } });
  await waitFor(() =>
    expect(container.querySelector(".save-bar [role=alert]")).toBeNull(),
  );
  const step = container.querySelector(".edit-step")!;
  const area = within(step as HTMLElement).getByRole("textbox", {
    name: "prep step 1",
  }) as HTMLTextAreaElement;
  const initial = area.value;
  area.setSelectionRange(initial.length, initial.length);
  await fireEvent.change(
    within(step as HTMLElement).getByRole("combobox", {
      name: "Insert ingredient into step 1",
    }),
    { target: { value: "0" } },
  );
  const ingredient = meal.ingredients[0];
  expect(area.value).toBe(
    initial + `[${ingredient.qty} ${ingredient.unit}] ${ingredient.name}`,
  );
  await fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].prep[0].text).toBe(area.value);
});
