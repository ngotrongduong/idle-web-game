CREATE TABLE IF NOT EXISTS dungeon_runs (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  dungeon_id text NOT NULL,
  team_slot integer NOT NULL CHECK (team_slot BETWEEN 1 AND 4),
  seed bigint NOT NULL CHECK (seed BETWEEN 0 AND 4294967295),
  status varchar(16) NOT NULL CHECK (status IN ('active', 'stopped')),
  waves jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  stopped_at timestamptz
);

CREATE INDEX IF NOT EXISTS dungeon_runs_player_id_idx
  ON dungeon_runs(player_id);

CREATE UNIQUE INDEX IF NOT EXISTS dungeon_runs_active_team_idx
  ON dungeon_runs(player_id, team_slot)
  WHERE status = 'active';
