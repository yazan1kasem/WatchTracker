PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'))
);

CREATE TABLE IF NOT EXISTS tracked_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title TEXT NOT NULL,
  poster_path TEXT,
  release_date TEXT,
  total_runtime INTEGER,
  total_seasons INTEGER,
  total_episodes INTEGER,
  current_season INTEGER,
  current_episode INTEGER,
  progress INTEGER NOT NULL DEFAULT 0,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 10)),
  notes TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  last_watched_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE (user_id, media_type, tmdb_id)
);

CREATE INDEX IF NOT EXISTS idx_tracked_media_user_id
  ON tracked_media (user_id);

CREATE INDEX IF NOT EXISTS idx_tracked_media_public_profile
  ON tracked_media (user_id, is_public);
