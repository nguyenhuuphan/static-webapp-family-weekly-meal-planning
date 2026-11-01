import { act, fireEvent as original } from "@testing-library/react";
// UI mutations await the server response; flush the resulting React updates.
const event =
  (fn: Function) =>
  (...args: any[]) =>
    act(async () => {
      fn(...args);
    });
export const fireEvent = Object.assign(
  event(original),
  Object.fromEntries(
    Object.entries(original).map(([name, fn]) => [name, event(fn)]),
  ),
) as unknown as {
  [K in keyof typeof original]: (
    ...args: Parameters<(typeof original)[K]>
  ) => Promise<void>;
};
