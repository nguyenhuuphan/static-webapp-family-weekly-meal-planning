import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const model = vi.hoisted(() => ({
  editing: null,
  advanced: false,
  storageError: "",
  s: {
    cookingBatches: { oldMeal: { finished: true } },
    timer: null,
    timers: [],
  },
}));
vi.mock("../src/hooks/useMealPlanner", () => ({ useMealPlanner: () => model }));
vi.mock("../src/i18n", () => ({
  useText: () => (_vi: string, en: string) => en,
}));
import OfflineStatus from "../src/components/OfflineStatus";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("allows a saved update despite historical cooking batches", async () => {
  vi.stubEnv("PROD", true);
  vi.stubGlobal("isSecureContext", true);
  const postMessage = vi.fn();
  vi.stubGlobal("navigator", {
    onLine: true,
    serviceWorker: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      register: vi
        .fn()
        .mockResolvedValue({
          waiting: { postMessage },
          active: {},
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
    },
  });
  render(<OfflineStatus />);
  const button = await screen.findByRole("button", {
    name: "Load new version",
  });
  expect((button as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(button);
  expect(postMessage).toHaveBeenCalledWith("ACTIVATE_UPDATE");
});
