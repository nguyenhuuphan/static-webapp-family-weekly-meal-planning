import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(() => {
  cleanup();
  if (typeof localStorage !== "undefined") localStorage.clear();
  if (typeof sessionStorage !== "undefined") sessionStorage.clear();
  vi.restoreAllMocks();
});

import {
  resetApiFixture,
  withPlannerApi,
  TEST_CODE,
} from "./plannerApiFixture";
const originalStub = vi.stubGlobal.bind(vi);
beforeEach(() => {
  resetApiFixture();
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("family-access-code-v1", TEST_CODE);
  vi.spyOn(vi, "stubGlobal").mockImplementation((name, value) =>
    originalStub(
      name,
      name === "fetch" ? withPlannerApi(value as typeof fetch) : value,
    ),
  );
});
