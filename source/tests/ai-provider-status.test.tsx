import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AIProviderStatus from "../src/components/AIProviderStatus";
import { I18nProvider } from "../src/i18n";
import type { MenuJob } from "../src/ai/contracts";
import { aiInput } from "./ai-fixtures";
const base: MenuJob = {
  id: "test",
  status: "running",
  createdAt: new Date().toISOString(),
  input: aiInput,
  masterPrompt: "Test",
  recentMeals: [],
};
it("shows the active provider, automatic quota fallback, and both providers on the completed menu", () => {
  const { rerender } = render(
    <I18nProvider>
      <AIProviderStatus
        job={{
          ...base,
          providerProgress: {
            provider: "gemini",
            model: "gemini-model",
            batch: "Dinner",
          },
        }}
      />
    </I18nProvider>,
  );
  expect(screen.getByText("Using Gemini")).toBeTruthy();
  rerender(
    <I18nProvider>
      <AIProviderStatus
        job={{
          ...base,
          providerProgress: {
            provider: "cloudflare",
            model: "qwen",
            batch: "alternatives",
            fallbackReason: "quota",
          },
        }}
      />
    </I18nProvider>,
  );
  expect(screen.getByText("Using Cloudflare AI")).toBeTruthy();
  expect(screen.getByText(/Gemini reached its quota/)).toBeTruthy();
  expect(screen.getByText("Generating 5 alternatives")).toBeTruthy();
  rerender(
    <I18nProvider>
      <AIProviderStatus
        job={{
          ...base,
          status: "ready",
          providersUsed: ["gemini", "cloudflare"],
        }}
        quota={{
          limit: 10,
          used: 2,
          remaining: 8,
          resetsAt: "2026-11-01T00:00:00.000Z",
        }}
      />
    </I18nProvider>,
  );
  expect(
    screen.getByText("Generated with: Gemini + Cloudflare AI"),
  ).toBeTruthy();
  expect(
    screen.getByText("8/10 family menu generations remaining today"),
  ).toBeTruthy();
  expect(screen.queryByText("Using Cloudflare AI")).toBeNull();
});
