CREATE TABLE IF NOT EXISTS diary_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    entry_date TEXT,
    transcript TEXT NOT NULL,
    language TEXT,
    mood TEXT,
    illustration_prompt TEXT,
    image_key TEXT,
    audio_key TEXT,
    audio_duration REAL,
    audio_type TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diary_user_date ON diary_entries (user_id, entry_date);