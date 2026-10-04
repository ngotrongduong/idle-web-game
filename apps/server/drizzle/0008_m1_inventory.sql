CREATE TABLE IF NOT EXISTS player_items (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  slot varchar(16) NOT NULL,
  quality_bps integer NOT NULL DEFAULT 10000,
  enhance_level integer NOT NULL DEFAULT 0,
  locked boolean NOT NULL DEFAULT false,
  equipped_hero_id uuid REFERENCES heroes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_items_player_id_idx
  ON player_items(player_id);

CREATE INDEX IF NOT EXISTS player_items_equipped_hero_id_idx
  ON player_items(equipped_hero_id);

CREATE UNIQUE INDEX IF NOT EXISTS player_items_unique_equipped_slot_idx
  ON player_items(player_id, equipped_hero_id, slot)
  WHERE equipped_hero_id IS NOT NULL;
