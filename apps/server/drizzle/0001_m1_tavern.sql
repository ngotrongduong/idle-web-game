CREATE TABLE IF NOT EXISTS tavern_states (
  player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  refreshes_since_rare_plus integer NOT NULL DEFAULT 0 CHECK (refreshes_since_rare_plus >= 0),
  refreshes_since_legendary integer NOT NULL DEFAULT 0 CHECK (refreshes_since_legendary >= 0),
  next_free_refresh_at timestamptz NOT NULL DEFAULT now(),
  offers jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS heroes (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  class_id text NOT NULL,
  rarity varchar(16) NOT NULL CHECK (rarity IN ('common', 'elite', 'rare', 'legendary')),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  exp integer NOT NULL DEFAULT 0 CHECK (exp >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS heroes_player_id_idx
  ON heroes(player_id);
