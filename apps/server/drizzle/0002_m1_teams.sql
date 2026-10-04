CREATE TABLE IF NOT EXISTS teams (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK (slot BETWEEN 1 AND 4),
  hero_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, slot)
);

CREATE INDEX IF NOT EXISTS teams_player_id_idx
  ON teams(player_id);
