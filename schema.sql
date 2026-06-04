-- D1 (SQLite) schema — source of truth for the data model

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  description TEXT,
  description_approved INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'reported',
  hidden INTEGER NOT NULL DEFAULT 0,
  reviewed_at TEXT,
  merged_into TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_bbox ON reports(lat, lng);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_review ON reports(reviewed_at, created_at);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id),
  r2_key TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_report ON photos(report_id);
