-- One-shot data fixes are recorded here so re-running migrations never repeats them.
CREATE TABLE IF NOT EXISTS data_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- Craft quality now tops out at x1.30 (GDD §5.6 "+0–30%"): Rare 1.25 -> 1.20, Masterwork 1.50 -> 1.30.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM data_migrations WHERE id = '0011_quality_cap') THEN
    UPDATE player_items SET quality_bps = 13000 WHERE quality_bps = 15000;
    UPDATE player_items SET quality_bps = 12000 WHERE quality_bps = 12500;
    UPDATE inventory_settings SET max_quality_bps = 13000 WHERE max_quality_bps = 15000;
    UPDATE inventory_settings SET max_quality_bps = 12000 WHERE max_quality_bps = 12500;
    INSERT INTO data_migrations (id) VALUES ('0011_quality_cap');
  END IF;
END
$$;
