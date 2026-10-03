import type { Combatant } from "@idle/game-core";

export const SAMPLE_TEAM: Combatant[] = [
  {
    id: "vanguard",
    hp: 220,
    attack: 44,
    defense: 34,
    speed: 10,
    critBps: 800,
  },
  {
    id: "ranger",
    hp: 135,
    attack: 58,
    defense: 14,
    speed: 16,
    critBps: 1600,
  },
  {
    id: "arcanist",
    hp: 120,
    attack: 64,
    defense: 12,
    speed: 14,
    critBps: 1400,
  },
  {
    id: "warden",
    hp: 155,
    attack: 38,
    defense: 22,
    speed: 12,
    critBps: 700,
  },
];

export const SAMPLE_ENCOUNTERS: {
  id: string;
  label: string;
  enemies: Combatant[];
}[] = [
  {
    id: "dungeon_1",
    label: "Bamboo Grove sample",
    enemies: [
      { id: "sprout_1", hp: 100, attack: 28, defense: 10, speed: 8 },
      { id: "sprout_2", hp: 110, attack: 30, defense: 12, speed: 9 },
      { id: "sprout_3", hp: 95, attack: 32, defense: 9, speed: 11 },
    ],
  },
  {
    id: "dungeon_2",
    label: "Misty Riverbank sample",
    enemies: [
      { id: "mist_1", hp: 150, attack: 40, defense: 18, speed: 11 },
      { id: "mist_2", hp: 165, attack: 42, defense: 20, speed: 10 },
      { id: "mist_3", hp: 125, attack: 48, defense: 14, speed: 15 },
    ],
  },
  {
    id: "dungeon_3",
    label: "Sunken Shrine sample",
    enemies: [
      { id: "shrine_1", hp: 215, attack: 53, defense: 28, speed: 12 },
      { id: "shrine_2", hp: 185, attack: 62, defense: 21, speed: 15 },
      { id: "shrine_3", hp: 240, attack: 47, defense: 34, speed: 9 },
    ],
  },
  {
    id: "dungeon_4",
    label: "Ember Ridge sample",
    enemies: [
      { id: "ember_1", hp: 280, attack: 68, defense: 35, speed: 14 },
      { id: "ember_2", hp: 230, attack: 78, defense: 27, speed: 17 },
      { id: "ember_3", hp: 310, attack: 61, defense: 42, speed: 11 },
    ],
  },
];
