CREATE TABLE IF NOT EXISTS documents (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL CHECK (json_valid(value)),
  revision TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (namespace, key)
) WITHOUT ROWID;
