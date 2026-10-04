ALTER TABLE dungeon_runs
  ADD COLUMN IF NOT EXISTS last_accrued_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_cycles integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_gold integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_exp_per_hero integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_cycles integer NOT NULL DEFAULT 0;

UPDATE dungeon_runs
SET last_accrued_at = started_at
WHERE last_accrued_at IS NULL;

ALTER TABLE dungeon_runs
  ALTER COLUMN last_accrued_at SET NOT NULL;
