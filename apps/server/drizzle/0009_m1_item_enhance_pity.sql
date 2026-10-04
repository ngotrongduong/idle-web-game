ALTER TABLE player_items
  ADD COLUMN IF NOT EXISTS enhance_pity_failures integer NOT NULL DEFAULT 0;
