-- Sampled idle cycles (docs/04 §6). NULL keeps legacy runs on their single replay.
ALTER TABLE dungeon_runs ADD COLUMN IF NOT EXISTS cycle_samples jsonb;
