ALTER TABLE dungeon_runs
  ADD COLUMN IF NOT EXISTS pending_materials jsonb NOT NULL DEFAULT '[]'::jsonb;
