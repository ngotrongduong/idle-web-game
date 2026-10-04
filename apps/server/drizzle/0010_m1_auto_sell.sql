CREATE TABLE IF NOT EXISTS inventory_settings (
  player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  auto_sell_enabled boolean NOT NULL DEFAULT false,
  max_quality_bps integer NOT NULL DEFAULT 10000 CHECK (max_quality_bps >= 10000 AND max_quality_bps <= 20000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
