CREATE TABLE IF NOT EXISTS kv (
  code TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated INTEGER NOT NULL,
  PRIMARY KEY (code, key)
);
CREATE INDEX IF NOT EXISTS idx_kv_code_updated ON kv (code, updated);
