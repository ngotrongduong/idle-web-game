ALTER TABLE heroes
  ADD COLUMN IF NOT EXISTS potential jsonb
  NOT NULL DEFAULT '{"hp":0,"attack":0,"defense":0,"speed":0}'::jsonb;

CREATE TABLE IF NOT EXISTS player_materials (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  material_id text NOT NULL,
  qty integer NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, material_id)
);

CREATE INDEX IF NOT EXISTS player_materials_player_id_idx
  ON player_materials(player_id);
