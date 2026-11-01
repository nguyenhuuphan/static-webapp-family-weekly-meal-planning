import { UUID } from "../../src/helpers/purchaseHistory";
import { json, readJSON } from "../http";
import type { Env } from "../types";
const MAX_BYTES = 512 * 1024;
const MAX_FAMILY_BYTES = 200 * 1024 * 1024;
/** Private route: Worker requires both Cloudflare Access and the family code. */
export async function receiptPhotos(
  request: Request,
  env: Env,
): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id");
  if (!["GET", "POST", "DELETE"].includes(request.method))
    return json({ error: "method_not_allowed" }, 405);
  if (request.method === "DELETE") {
    if (!id || !UUID.test(id)) return json({ error: "invalid_photo" }, 400);
    const saved = await env.DB.prepare(
      "SELECT value FROM documents WHERE namespace = 'planner' AND key = 'state.json'",
    ).first<{ value: string }>();
    const state = saved
      ? (JSON.parse(saved.value) as {
          shoppingInvoices?: { photos: string[] }[];
        })
      : null;
    if (state?.shoppingInvoices?.some((invoice) => invoice.photos.includes(id)))
      return json({ error: "photo_in_use" }, 409);
    await env.DB.prepare("DELETE FROM receipt_photos WHERE id = ?")
      .bind(id)
      .run();
    return json({ id });
  }
  if (request.method === "GET") {
    if (!id || !UUID.test(id)) return json({ error: "invalid_photo" }, 400);
    const row = await env.DB.prepare(
      "SELECT data FROM receipt_photos WHERE id = ?",
    )
      .bind(id)
      .first<{ data: string }>();
    return row
      ? json({ data: row.data })
      : json({ error: "photo_not_found" }, 404);
  }
  let body: { id: string; invoiceId: string; data: string };
  try {
    body = (await readJSON(request, 710000)) as typeof body;
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error && error.message === "too_large"
            ? "photo_too_large"
            : "invalid_photo",
      },
      error instanceof Error && error.message === "too_large" ? 413 : 400,
    );
  }
  if (
    !body ||
    typeof body.id !== "string" ||
    !UUID.test(body.id) ||
    typeof body.invoiceId !== "string" ||
    !UUID.test(body.invoiceId) ||
    typeof body.data !== "string" ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.data)
  )
    return json({ error: "invalid_photo" }, 400);
  let bytes: string;
  try {
    bytes = atob(body.data.slice("data:image/jpeg;base64,".length));
  } catch {
    return json({ error: "invalid_photo" }, 400);
  }
  if (bytes.length > MAX_BYTES) return json({ error: "photo_too_large" }, 413);
  if (
    bytes.length < 4 ||
    bytes.charCodeAt(0) !== 255 ||
    bytes.charCodeAt(1) !== 216 ||
    bytes.charCodeAt(2) !== 255 ||
    bytes.charCodeAt(bytes.length - 2) !== 255 ||
    bytes.charCodeAt(bytes.length - 1) !== 217
  )
    return json({ error: "invalid_photo" }, 400);
  const existing = await env.DB.prepare(
    "SELECT invoice_id, data FROM receipt_photos WHERE id = ?",
  )
    .bind(body.id)
    .first<{ invoice_id: string; data: string }>();
  if (existing)
    return existing.invoice_id === body.invoiceId && existing.data === body.data
      ? json({ id: body.id })
      : json({ error: "photo_conflict" }, 409);
  // Atomic limits bound storage on the free D1 database, including concurrent uploads.
  const result = await env.DB.prepare(
    `INSERT INTO receipt_photos(id, invoice_id, data, byte_size)
    SELECT ?, ?, ?, ? WHERE (SELECT COALESCE(SUM(byte_size), 0) FROM receipt_photos) + ? <= ?
    AND (SELECT COUNT(*) FROM receipt_photos WHERE invoice_id = ?) < 6
    ON CONFLICT(id) DO NOTHING`,
  )
    .bind(
      body.id,
      body.invoiceId,
      body.data,
      bytes.length,
      bytes.length,
      MAX_FAMILY_BYTES,
      body.invoiceId,
    )
    .run();
  if (!result.meta.changes) {
    const saved = await env.DB.prepare(
      "SELECT invoice_id, data FROM receipt_photos WHERE id = ?",
    )
      .bind(body.id)
      .first<{ invoice_id: string; data: string }>();
    if (saved?.invoice_id === body.invoiceId && saved.data === body.data)
      return json({ id: body.id });
    return json({ error: "photo_storage_full" }, 409);
  }
  return json({ id: body.id }, 201);
}
