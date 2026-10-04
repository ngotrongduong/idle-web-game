-- Dungeon unlocks (GDD §5.4): a dungeon opens once the previous dungeon's boss is beaten.
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS cleared_dungeon_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

-- One-shot backfill so existing players keep access to dungeons they already farm: every dungeon
-- before the furthest one they have run counts as cleared, plus any dungeon whose boss wave they won.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM data_migrations WHERE id = '0013_backfill_cleared_dungeons') THEN
    WITH chain(dungeon_id, position) AS (
      VALUES ('bamboo_grove', 1), ('misty_riverbank', 2), ('sunken_shrine', 3), ('ember_ridge', 4)
    ),
    furthest AS (
      SELECT r.player_id, max(c.position) AS position
      FROM dungeon_runs r
      JOIN chain c ON c.dungeon_id = r.dungeon_id
      GROUP BY r.player_id
    ),
    cleared AS (
      SELECT f.player_id, c.dungeon_id
      FROM furthest f
      JOIN chain c ON c.position < f.position
      UNION
      SELECT r.player_id, r.dungeon_id
      FROM dungeon_runs r
      WHERE jsonb_array_length(r.waves) = 6 AND r.waves -> 5 ->> 'result' = 'win'
    ),
    merged AS (
      SELECT p.id AS player_id,
             (SELECT coalesce(jsonb_agg(DISTINCT ids.dungeon_id), '[]'::jsonb)
              FROM (
                SELECT jsonb_array_elements_text(p.cleared_dungeon_ids) AS dungeon_id
                UNION
                SELECT c.dungeon_id FROM cleared c WHERE c.player_id = p.id
              ) ids) AS ids
      FROM players p
      WHERE EXISTS (SELECT 1 FROM cleared c WHERE c.player_id = p.id)
    )
    UPDATE players p SET cleared_dungeon_ids = m.ids FROM merged m WHERE p.id = m.player_id;

    INSERT INTO data_migrations (id) VALUES ('0013_backfill_cleared_dungeons');
  END IF;
END
$$;
