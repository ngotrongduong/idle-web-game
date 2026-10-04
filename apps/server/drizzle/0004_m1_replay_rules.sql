ALTER TABLE dungeon_runs
  ADD COLUMN IF NOT EXISTS battle_rules jsonb;

UPDATE dungeon_runs
SET battle_rules = '{
  "maxTurns": 60,
  "defenseK": 100,
  "varianceMinBps": 9000,
  "varianceMaxBps": 11000,
  "defaultCritBps": 1000,
  "critMultiplierBps": 20000,
  "mpMax": 100,
  "mpPerAction": 10,
  "mpOnHit": 5,
  "familyAdvantage": {
    "ironbound": "dawn_warden",
    "windstrider": "ironbound",
    "ember_sage": "windstrider",
    "dawn_warden": "ember_sage"
  },
  "advantageMultiplierBps": 12000,
  "disadvantageMultiplierBps": 8500
}'::jsonb
WHERE battle_rules IS NULL;

ALTER TABLE dungeon_runs
  ALTER COLUMN battle_rules SET NOT NULL;
