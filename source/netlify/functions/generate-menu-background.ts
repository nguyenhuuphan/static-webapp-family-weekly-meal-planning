import { authorize, json } from "../shared";
import { aiStore } from "../ai/store";
import { generateMenu, GenerationError } from "../ai/gemini";
import { isJobId, type MenuJob } from "../../src/ai/contracts";
export default async function handler(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  if (request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);
  let id;
  try {
    const raw = await request.text();
    if (raw.length > 1000) throw Error();
    id = JSON.parse(raw).id;
    if (!isJobId(id)) throw Error();
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
  const store = aiStore();
  const job = (await store.get("jobs/" + id, {
    type: "json",
  })) as MenuJob | null;
  if (!job || job.status !== "queued") return json({});
  // Only one invocation may generate for a given submission, even if Netlify retries.
  const claimed = await store.setJSON(
    "claims/" + id,
    { at: new Date().toISOString() },
    { onlyIfNew: true },
  );
  if (!claimed.modified) return json({});
  await store.setJSON("jobs/" + id, { ...job, status: "running" });
  try {
    const plan = await generateMenu(
      job.input,
      job.masterPrompt,
      job.recentMeals,
    );
    await store.setJSON("jobs/" + id, { ...job, status: "ready", plan });
  } catch (error) {
    await store.setJSON("jobs/" + id, {
      ...job,
      status: "failed",
      errorCode:
        error instanceof GenerationError ? error.code : "provider_error",
    });
  }
  return json({});
}
