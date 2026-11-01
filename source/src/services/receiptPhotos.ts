import { apiEndpoint } from "./apiEndpoint";
export type ReceiptPhotoDraft = { id: string; data: string };
/** Decode and re-encode on this device: normalize orientation and discard EXIF metadata. */
export async function prepareReceiptPhoto(
  file: File,
): Promise<ReceiptPhotoDraft> {
  if (
    !file.type.startsWith("image/") ||
    file.size > 20 * 1024 * 1024 ||
    !file.size
  )
    throw Error("invalid_photo");
  const url = URL.createObjectURL(file),
    image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(Error("unsupported_photo"));
      image.src = url;
    });
    let scale = Math.min(
      1,
      3000 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("unsupported_photo");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL(
        "image/jpeg",
        Math.max(0.65, 0.88 - attempt * 0.05),
      );
      const encoded = data.split(",")[1];
      const bytes =
        (encoded.length * 3) / 4 -
        (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
      if (bytes <= 512 * 1024 && data.startsWith("data:image/jpeg;base64,"))
        return { id: crypto.randomUUID(), data };
      scale *= 0.8;
    }
    throw Error("photo_too_large");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function receiptPhotoRequest(
  code: string,
  id: string,
  body?: { invoiceId: string; data: string },
  method?: "DELETE",
) {
  const response = await fetch(
    apiEndpoint("receipt-photos") +
      (body ? "" : "?id=" + encodeURIComponent(id)),
    {
      method: method || (body ? "POST" : "GET"),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${code}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify({ id, ...body }) } : {}),
      signal: AbortSignal.timeout(45000),
    },
  );
  let value;
  try {
    value = await response.json();
  } catch {
    throw Error("network");
  }
  if (!response.ok)
    throw Error(
      [401, 403].includes(response.status)
        ? "photo_unauthorized"
        : value.error || "network",
    );
  if (
    !body &&
    !method &&
    (typeof value.data !== "string" ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.data) ||
      value.data.length > 710000)
  )
    throw Error("invalid_photo");
  return value as { id?: string; data?: string };
}
