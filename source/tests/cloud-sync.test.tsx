import { expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { fireEvent } from "./userEvents";
import { boot, nav, freshState, plan, readState } from "./uxSupport";
import { apiFixture, fixtureEnvelope, TEST_CODE } from "./plannerApiFixture";
import { STORAGE_KEY } from "../src/domain";
import App from "../src/App";
it("opens shared server data and submits named commands with an expected revision", async () => {
  const state = freshState(structuredClone(plan));
  state.servings = 5;
  apiFixture.state = state;
  await boot();
  await waitFor(() => expect(readState().servings).toBe(5));
  await nav("Settings");
  await fireEvent.change(
    screen.getByRole("spinbutton", { name: "People per meal" }),
    { target: { value: "6" } },
  );
  await fireEvent.click(screen.getByRole("button", { name: "Apply servings" }));
  expect(readState().servings).toBe(6);
  const sent = apiFixture.requests.find((r) => r.url.includes("/commands"));
  expect(JSON.parse(sent.body)).toMatchObject({
    revision: 1,
    command: { name: "household.servings", args: { servings: 6 } },
  });
  expect(sent.headers.Authorization).toBe(`Bearer ${TEST_CODE}`);
  expect(apiFixture.requests.some((r) => r.method === "PUT")).toBe(false);
});
it("loads later device changes while idle without uploading a whole browser copy", async () => {
  await boot();
  apiFixture.state = { ...apiFixture.state!, servings: 7 };
  apiFixture.revision++;
  await waitFor(() => expect(readState().servings).toBe(7), { timeout: 7000 });
  expect(apiFixture.requests.some((r) => r.method === "PUT")).toBe(false);
});
it("connects using Enter and remembers the code for later reloads", async () => {
  localStorage.removeItem("family-access-code-v1");
  await boot();
  const field = screen.getByLabelText("Family access code");
  await fireEvent.change(field, { target: { value: TEST_CODE } });
  await fireEvent.keyDown(field, { key: "Enter" });
  await screen.findByText("Saved on the server. Devices share the same data.");
  expect(localStorage.getItem("family-access-code-v1")).toBe(TEST_CODE);
  cleanup();
  render(<App />);
  await screen.findByText("Saved on the server. Devices share the same data.");
  await fireEvent.click(screen.getByRole("button", { name: "Family data" }));
  await fireEvent.click(
    screen.getByRole("button", { name: "Forget code on this device" }),
  );
  expect(localStorage.getItem("family-access-code-v1")).toBeNull();
});
it("uses the server copy after reload and preserves the original browser cache as a backup", async () => {
  const local = freshState(structuredClone(plan));
  local.servings = 8;
  const server = freshState(structuredClone(plan));
  server.servings = 3;
  apiFixture.state = server;
  await boot(local);
  await waitFor(() => expect(readState().servings).toBe(3));
  expect(
    JSON.parse(localStorage.getItem(STORAGE_KEY + ":pre-api-backup")!).servings,
  ).toBe(8);
  expect(
    apiFixture.requests.filter((r) => r.url.includes("/commands")),
  ).toHaveLength(0);
});
it("retries an uncertain purchase using the same request ID after a lost response", async () => {
  await boot();
  let lost = true;
  apiFixture.handler = async (url, init) => {
    if (url.includes("/commands") && lost) {
      lost = false;
      throw Error("Connection lost");
    }
    return null;
  };
  await fireEvent.change(screen.getByLabelText("Diners: Monday · Lunch"), {
    target: { value: "1" },
  });
  await screen.findByText(
    "The save could not be confirmed. Retry safely; your request will not be duplicated.",
  );
  const first = JSON.parse(
    apiFixture.requests.find((r) => r.url.includes("/commands")).body,
  );
  await fireEvent.click(
    screen.getByRole("button", { name: "Retry connection / save" }),
  );
  expect(readState().mealServings?.["mon-lunch"]).toBe(1);
  const attempts = apiFixture.requests
    .filter((r) => r.url.includes("/commands"))
    .map((r) => JSON.parse(r.body));
  expect(attempts[1].id).toBe(first.id);
  expect(sessionStorage.getItem("planner:pending-command-v1")).toBeNull();
});
it("reconciles a revision conflict without overwriting another device", async () => {
  await boot();
  apiFixture.state = { ...apiFixture.state!, mealServings: { "mon-lunch": 1 } };
  apiFixture.revision++;
  await fireEvent.change(screen.getByLabelText("Diners: Monday · Lunch"), {
    target: { value: "0" },
  });
  await screen.findByRole("heading", {
    name: "Data changed on another device",
  });
  expect(readState().mealServings?.["mon-lunch"]).toBe(1);
  expect(apiFixture.revision).toBe(2);
  expect(
    screen.getByRole("button", { name: "Download copy before conflict" }),
  ).toBeTruthy();
});
it("does not claim that offline changes were saved", async () => {
  await boot();
  apiFixture.handler = async () => {
    throw Error("offline");
  };
  const before = readState();
  await fireEvent.change(screen.getByLabelText("Diners: Monday · Lunch"), {
    target: { value: "0" },
  });
  expect(readState().mealServings).toEqual(before.mealServings);
  expect(
    screen.queryByText("Saved on the server. Devices share the same data."),
  ).toBeNull();
});

it("keeps a working in-memory family connection when browser storage is unavailable", async () => {
  localStorage.removeItem("family-access-code-v1");
  await boot();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("Browser storage unavailable");
  });
  await fireEvent.change(screen.getByLabelText("Family access code"), {
    target: { value: TEST_CODE },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: "Connect family data" }),
  );
  await screen.findByText("Saved on the server. Devices share the same data.");
  await fireEvent.change(screen.getByLabelText("Diners: Monday · Lunch"), {
    target: { value: "1" },
  });
  expect(apiFixture.state?.mealServings?.["mon-lunch"]).toBe(1);
  expect(
    screen.getByText("Saved on the server. Devices share the same data."),
  ).toBeTruthy();
});
