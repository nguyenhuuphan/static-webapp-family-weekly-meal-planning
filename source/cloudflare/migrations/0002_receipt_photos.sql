CREATE TABLE IF NOT EXISTS receipt_photos (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL,
  data TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 524288),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS receipt_photos_invoice ON receipt_photos(invoice_id);
