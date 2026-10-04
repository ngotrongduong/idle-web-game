-- Balance pass 2026-10-05: the Forge caps moved so that the full +5 arrives with dungeon 4
-- (+3 needs Forge level 4, +4 level 6, +5 level 8; `buildings.json` forge.maxEnhanceLevel).
-- One-shot: players who already own an item above their Forge's new cap get the level that cap
-- needs, so nobody loses access to an enhancement level they had reached (0014 used the old caps).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM data_migrations WHERE id = '0015_forge_caps_backfill') THEN
    UPDATE players p
    SET forge_level = GREATEST(
      p.forge_level,
      CASE m.max_level WHEN 3 THEN 4 WHEN 4 THEN 6 ELSE 8 END
    )
    FROM (
      SELECT player_id, max(enhance_level) AS max_level
      FROM player_items
      GROUP BY player_id
      HAVING max(enhance_level) >= 3
    ) m
    WHERE p.id = m.player_id;

    INSERT INTO data_migrations (id) VALUES ('0015_forge_caps_backfill');
  END IF;
END
$$;
