CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  gold integer NOT NULL DEFAULT 1000 CHECK (gold >= 0),
  hall_level integer NOT NULL DEFAULT 1 CHECK (hall_level >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  session_hash varchar(64) PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_player_id_idx
  ON sessions(player_id);

CREATE TABLE IF NOT EXISTS command_outcomes (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  cmd_id text NOT NULL,
  status_code integer NOT NULL CHECK (status_code BETWEEN 100 AND 599),
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, cmd_id)
);

CREATE INDEX IF NOT EXISTS command_outcomes_created_at_idx
  ON command_outcomes(created_at);
