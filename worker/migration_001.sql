ALTER TABLE diary_entries ADD COLUMN title TEXT;
ALTER TABLE diary_entries ADD COLUMN entry_date TEXT;
ALTER TABLE diary_entries ADD COLUMN mood TEXT;
ALTER TABLE diary_entries ADD COLUMN audio_key TEXT;
ALTER TABLE diary_entries ADD COLUMN audio_duration REAL;
ALTER TABLE diary_entries ADD COLUMN audio_type TEXT;
ALTER TABLE diary_entries ADD COLUMN updated_at TEXT;
CREATE INDEX IF NOT EXISTS idx_diary_user_date ON diary_entries (user_id, entry_date);
