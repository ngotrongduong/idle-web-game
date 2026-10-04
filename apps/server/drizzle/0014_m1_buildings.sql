-- M1.7 buildings (docs/03 §6): the Forge has a level, and one upgrade at a time runs on a timer.
-- `construction` holds {building, targetLevel, startedAt, completesAt} while the builder works.
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS forge_level integer NOT NULL DEFAULT 1 CHECK (forge_level >= 1);

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS construction jsonb;

-- One-shot backfill so players who enhanced items before the Forge gated enhancement keep the
-- level they already reached: Forge level 2 allows +2, then one more enhancement level per Forge
-- level up to +5.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM data_migrations WHERE id = '0014_backfill_forge_level') THEN
    UPDATE players p
    SET forge_level = GREATEST(p.forge_level, GREATEST(2, m.max_level))
    FROM (
      SELECT player_id, max(enhance_level) AS max_level
      FROM player_items
      GROUP BY player_id
      HAVING max(enhance_level) > 0
    ) m
    WHERE p.id = m.player_id;

    INSERT INTO data_migrations (id) VALUES ('0014_backfill_forge_level');
  END IF;
END
$$;
