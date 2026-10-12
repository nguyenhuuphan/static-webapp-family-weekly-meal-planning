import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useScreenWakeLock } from "../src/hooks/useScreenWakeLock";
it("opts in, reacquires on visibility and releases on exit", async () => {
  vi.stubGlobal("isSecureContext", true);
  const release = vi.fn().mockResolvedValue(undefined),
    request = vi
      .fn()
      .mockImplementation(async () => ({
        released: false,
        release,
        addEventListener: vi.fn(),
      }));
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  const { result, unmount } = renderHook(useScreenWakeLock);
  expect(request).not.toHaveBeenCalled();
  act(() => result.current.setEnabled(true));
  await waitFor(() => expect(result.current.status).toBe("active"));
  act(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(release).toHaveBeenCalledOnce();
  expect(result.current.status).toBe("released");
  act(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  unmount();
  expect(release).toHaveBeenCalledTimes(2);
  delete (navigator as any).wakeLock;
  vi.unstubAllGlobals();
});
it("reports request failure rather than claiming the screen is awake", async () => {
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  const { result } = renderHook(useScreenWakeLock);
  act(() => result.current.setEnabled(true));
  await waitFor(() => expect(result.current.status).toBe("error"));
  delete (navigator as any).wakeLock;
  vi.unstubAllGlobals();
});
