Purchase prices and receipt photos
=================================

In **Shopping → Record actual purchase**, enter the total paid for the quantity purchased, currency, date and shop. VND is the default; USD/EUR are also supported. Amounts are saved as integer minor units, and blank prices remain distinct from zero. Recorded ingredient names are retained after menus change.

**Shopping → Purchase history & receipts** supports searching items, shops and notes, filtering dates, correcting prices without adding stock again, linking purchases to receipts, and adding/editing receipt details. A receipt can hold its own total, notes and up to six photos. Take a photo with the phone's rear camera or choose existing images. Preview before saving; saved photos can be opened, zoomed and downloaded. Image decoding is browser-dependent; unsupported HEIC files must be converted or retaken as JPEG/PNG. Prices are entered manually; no OCR or AI service is used.

Prices and receipt metadata remain in the existing family state and follow its sync/conflict handling. Starting a new week retains them. Full JSON backups include metadata and photo IDs; they do not embed image bytes. Download photos separately for an independent offline copy. Images are available online to signed-in family members with the family code.

Image storage
-------------

Apply `source/cloudflare/migrations/0002_receipt_photos.sql` before deploying the Worker. This adds a separate D1 table and index; existing planner data is unchanged. No new paid service or storage bucket is required.

The browser decodes and re-encodes photos as JPEG, removing source metadata and reducing dimensions/quality to a maximum of 512 KiB per image. `/api/receipt-photos` shares the Worker's Cloudflare Access, family-code, same-origin and no-store protections. Photo data is fetched with an Authorization header, never a secret in an image URL. Server-side validation rejects unsupported formats, invalid IDs and oversized payloads. Upload IDs are idempotent, so a failed save can retry safely. Unsaved draft uploads can be discarded; photos referenced in the synced family state cannot be deleted through draft cleanup.

Atomic database checks allow six stored photos per invoice and a total of 200 MiB of raw image data. Base64 overhead remains within the existing free D1 database size; database-wide Cloudflare quotas still apply. Failed uploads leave the form and preview intact for retry. Photos stay outside planner JSON and its 1 MB sync payload limit.
