// Opt-in deployment diagnostic. Runs inside Netlify; never exports the API key.
if (process.env.AI_RUN_LIVE_SMOKE !== "true") process.exit(0);
if (!process.env.GEMINI_API_KEY)
  throw Error("GEMINI_API_KEY missing in build scope for live verification");
const { createServer } = await import("vite");
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (
    String(args[0]).startsWith("https://generativelanguage.googleapis.com/") &&
    !response.ok
  ) {
    const details = await response
      .clone()
      .json()
      .catch(() => ({}));
    const message = String(details.error?.message || "")
      .replaceAll(process.env.GEMINI_API_KEY, "[redacted]")
      .slice(0, 1200);
    console.log(
      "AI_SMOKE_PROVIDER " +
        JSON.stringify({
          httpStatus: response.status,
          status: details.error?.status,
          message,
        }),
    );
  }
  return response;
};
try {
  const { generateMenu, GEMINI_MODEL } = await server.ssrLoadModule(
    "/netlify/ai/gemini.ts",
  );
  const { DEFAULT_MASTER_PROMPT } = await server.ssrLoadModule(
    "/src/ai/contracts.ts",
  );
  const input = {
    weekStart: "2026-11-02",
    servings: 2,
    days: ["Monday"],
    mealTypes: ["Breakfast"],
    cuisines: ["Vietnamese"],
    equipment: ["Gas stove"],
    diet: "Vegetarian",
    avoid: "",
    maxMinutes: 20,
    budget: "",
    pantry: "",
    customPrompt:
      "A simple tomato and egg breakfast. Keep instructions concise; include a small vegetable side.",
  };
  const plan = await generateMenu(input, DEFAULT_MASTER_PROMPT, []);
  console.log(
    "AI_SMOKE_RESULT " +
      JSON.stringify({
        status: "passed",
        model: GEMINI_MODEL,
        meals: plan.meals.length,
        translations: Object.keys(plan.translations?.vi || {}).length,
      }),
  );
} catch (error) {
  console.log(
    "AI_SMOKE_RESULT " +
      JSON.stringify({ status: "failed", code: error.code || "runtime_error" }),
  );
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  await server.close();
}
