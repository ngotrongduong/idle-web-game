/**
 * Sinh báo cáo dữ liệu game fworldgm (research/fworldgm/04-game-data.md) và file hằng số
 * đã chọn lọc (research/fworldgm/data/fworldgm-mechanics.json) từ:
 *   - raw/static/metro-exports.json  (pnpm dump-metro)
 *   - raw/static/formulas.json       (pnpm fworldgm:tabulate)
 * Mục đích: tham khảo thiết kế (cấu trúc, quy mô, nhịp số). KHÔNG sao chép nội dung/IP.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, mdTable, writeJson, writeText } from './lib/util.ts';

type Any = any; // dữ liệu dump động
const base = join(REPO_ROOT, 'research', 'fworldgm');
const dump = JSON.parse(readFileSync(join(base, 'raw', 'static', 'metro-exports.json'), 'utf8')) as Record<string, Record<string, Any>>;
const formulas = JSON.parse(readFileSync(join(base, 'raw', 'static', 'formulas.json'), 'utf8')) as Record<string, Any>;
const g = (key: string): Any => {
  for (const mod of Object.values(dump)) if (key in mod) return mod[key];
  throw new Error(`Không tìm thấy ${key}`);
};

const CLASSES: Any[] = g('CLASSES');
const DUNGEONS: Any[] = g('DUNGEONS');
const ITEMS: Any[] = [...g('ITEMS')];
const EXTRA_ITEMS: Any[] = g('EXTRA_ITEMS');
const MATERIALS: Any[] = g('CRAFTING_MATERIALS');
const SPECIAL: Any[] = g('SPECIAL_MATERIALS');
const FAMILY_MAP: Record<string, Any> = g('FAMILY_MAP');
const FORMATIONS: Any[] = g('FORMATIONS');
const PERSONALITIES: Any[] = g('PERSONALITIES');
const COLUMN_NAMES: Record<string, Any[]> = g('COLUMN_NAMES');
const QUALITY_INFO: Record<string, Any> = g('QUALITY_INFO');
const COUNTER: Record<string, string> = {
  kiem_si: 'sat_thu', sat_thu: 'phap_su', phap_su: 'trieu_hoi', trieu_hoi: 'cuong_bao',
  cuong_bao: 'cung_thu', cung_thu: 'dao_si', dao_si: 'saija', saija: 'kiem_si',
};
const counterChain = () => {
  const chain = ['kiem_si'];
  while (chain.length <= families.length) chain.push(COUNTER[chain[chain.length - 1]!]!);
  return chain.map((id) => `${id} (${CLASSES.find((c) => c.id === id)?.nameEn ?? id})`).join(' → ');
};
const STAT_KEYS = ['hp', 'atk', 'def', 'matk', 'mdef', 'spd', 'crit', 'critDmg'];
const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toString());
const pct = (n: number) => `${+(n * 100).toPrecision(4)}%`;
const families = Object.keys(COLUMN_NAMES);
const t1 = CLASSES.filter((c) => c.tier === 1);

const out: string[] = [];
const h = (s: string) => out.push('', s, '');
const p = (...s: string[]) => out.push(...s);

p(
  '# Dữ liệu game fworldgm (trích từ client bundle)',
  '',
  '> Sinh tự động bởi `tools/inspect/src/report-fworldgm-data.ts` từ module dữ liệu của bundle Expo (dump qua `__r(id)` trong trình duyệt).',
  '> Dữ liệu dùng để **tham khảo cấu trúc, quy mô và nhịp số**. Không tái sử dụng tên, mô tả, hình ảnh hay IP của game.',
);

// ---------------------------------------------------------------- Tổng quan
h('## 1. Quy mô nội dung');
const enemyIds = new Set<string>();
for (const fam of Object.values(FAMILY_MAP)) for (const t of ['normal', 'elite', 'leader', 'boss']) if (fam[t]?.id) enemyIds.add(fam[t].id);
p(
  mdTable(['Hạng mục', 'Số lượng', 'Ghi chú'], [
    ['Họ class (family)', families.length, 'mỗi họ 8 nhánh, mở dần theo tier'],
    ['Class (family × nhánh × tier)', CLASSES.length, '8 × (1+2+…+8) = 288'],
    ['Tier class', 8, 'level cap tier n = 5n (T7+ không giới hạn)'],
    ['Hầm ngục', DUNGEONS.length, `5 wave × 2 quái; Lv đề xuất ${DUNGEONS.map((d) => d.recommendedLevel).join('/')}`],
    ['Họ quái (family)', Object.keys(FAMILY_MAP).length, 'mỗi họ có 4 bậc: normal / elite / leader / boss'],
    ['Quái khác nhau', enemyIds.size, ''],
    ['Trang bị (ITEMS + EXTRA)', `${ITEMS.length} + ${EXTRA_ITEMS.length}`, '4 slot: weapon / helmet / armor / accessory'],
    ['Công thức chế tạo', g('RECIPES').length, ''],
    ['Nguyên liệu chế tạo', MATERIALS.length, 'tier 1–9 theo hầm ngục + đặc biệt'],
    ['Vật phẩm đặc biệt', SPECIAL.length, 'sách, đá, trứng, rương, bản nguyên…'],
    ['Đội hình (formation)', FORMATIONS.length, 'combo 2–4 class cụ thể → buff'],
    ['Tính cách (personality)', PERSONALITIES.length, '+15% một chỉ số, −5% các chỉ số khác'],
    ['Phẩm chất trang bị', Object.keys(QUALITY_INFO).length, 'normal → divine'],
    ['Rune', g('RUNE_MATERIALS').length, '4 loại × 4 bậc'],
  ]),
);

// ---------------------------------------------------------------- Class
h('## 2. Hệ class');
p('### 2.1 8 họ class gốc (tier 1)', '');
p(
  mdTable(['ID', 'Tên (VI / EN)', 'Đòn đánh', ...STAT_KEYS.map((k) => k.toUpperCase()), 'Growth/lv (HP/ATK/DEF/MATK)', 'Nội tại T1', 'Khắc chế →'], t1.map((c) => [
    c.id,
    `${c.name} / ${c.nameEn}`,
    `${c.attack.range}, ${c.attack.damageType}`,
    ...STAT_KEYS.map((k) => c.baseStats[k]),
    `${c.growth.hp}/${c.growth.atk}/${c.growth.def}/${c.growth.matk}`,
    c.passive?.descriptionEn ?? '',
    COUNTER[c.id] ?? '',
  ])),
  '',
  '**Vòng khắc chế** (A → B nghĩa là A gây ×1.25 sát thương lên B; chiều ngược lại ×0.85): ' + counterChain() + '.',
);
p('', '### 2.2 Cây nhánh (column) của mỗi họ', '', 'Nhánh thứ k (0-index) mở khóa từ tier k+1, nên tier n có n nhánh để chọn.', '');
p(mdTable(['Họ', ...Array.from({ length: 8 }, (_, i) => `Nhánh ${i} (từ T${i + 1})`)], families.map((f) => [f, ...COLUMN_NAMES[f]!.map((c: Any) => c.nameEn)])));
p('', '### 2.3 Tier và level cap', '');
const tierRows = Array.from({ length: 8 }, (_, i) => {
  const cs = CLASSES.filter((c) => c.tier === i + 1);
  const avg = (k: string) => Math.round(cs.reduce((s, c) => s + c.baseStats[k], 0) / cs.length);
  return [`T${i + 1}`, cs.length, cs[0].levelToAdvance ?? '∞', avg('hp'), avg('atk'), avg('def'), avg('spd')];
});
p(mdTable(['Tier', 'Số class', 'Level để thăng tier', 'HP gốc TB', 'ATK gốc TB', 'DEF gốc TB', 'SPD gốc TB'], tierRows));
const sword = CLASSES.filter((c) => c.id === 'kiem_si' || /^kiem_si_t\d_0$/.test(c.id)).sort((a, b) => a.tier - b.tier);
p('', 'Ví dụ tăng trưởng một nhánh (Kiếm Sĩ nhánh 0, T1→T8):', '');
p(mdTable(['Tier', ...STAT_KEYS, 'Nội tại'], sword.map((c) => [`T${c.tier}`, ...STAT_KEYS.map((k) => c.baseStats[k]), c.passive?.descriptionEn ?? ''])));

// ---------------------------------------------------------------- Dungeons & enemies
h('## 3. Hầm ngục và quái');
p(mdTable(['#', 'ID', 'Tên EN', 'Lv đề xuất', 'Wave (quái@level)', 'Vàng/quái (normal)', 'XP/quái (normal)'], DUNGEONS.map((d, i) => {
  const first = d.waves[0].enemies[0];
  return [i + 1, d.id, d.nameEn, d.recommendedLevel, d.waves.map((w: Any) => w.enemies.map((e: Any) => `${e.id}@${e.level}`).join('+')).join(' / '), first.goldReward.join('–'), first.xpReward.join('–')];
})));
p('', '### 3.1 Bậc quái (roll mỗi lần sinh quái)', '');
p(mdTable(['Bậc', 'Xác suất', 'Tỉ lệ rơi nguyên liệu', 'Số lượng mỗi lần rơi', 'Ghi chú'], [
  ['normal', '89%', '30% − 3.57% × (tier hầm − 1)', 1, 'tier hầm cao → rơi ít hơn'],
  ['elite', '10%', '100%', 1, ''],
  ['leader', '0.99%', '100%', 5, ''],
  ['boss', '0.01%', '100%', 10, 'boss luôn rơi scroll/mảnh hiếm'],
]));
const famRows = Object.entries(FAMILY_MAP).slice(0, 8).map(([id, f]) => [id, ...['normal', 'elite', 'leader', 'boss'].map((t) => (f[t] ? `${f[t].name} Lv${f[t].level} HP${f[t].stats.hp} ATK${f[t].stats.atk}` : ''))]);
p('', 'Ví dụ họ quái (8/32 họ đầu):', '', mdTable(['Họ', 'Normal', 'Elite', 'Leader', 'Boss'], famRows));

// ---------------------------------------------------------------- Items
h('## 4. Trang bị');
const allItems = [...ITEMS, ...EXTRA_ITEMS];
const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const slots = ['weapon', 'helmet', 'armor', 'accessory'];
p(mdTable(['Slot', ...rarities, 'Tổng'], slots.map((s) => [s, ...rarities.map((r) => allItems.filter((i) => i.slot === s && i.rarity === r).length), allItems.filter((i) => i.slot === s).length])));
p('', 'Khoảng chỉ số chính theo độ hiếm (min–max trên mọi item có chỉ số đó):', '');
p(mdTable(['Độ hiếm', 'ATK', 'MATK', 'DEF', 'HP', 'SPD', 'Giá trị bán'], rarities.map((r) => {
  const its = allItems.filter((i) => i.rarity === r);
  const rng = (k: string) => {
    const v = its.map((i) => i.stats[k]).filter((x) => typeof x === 'number');
    return v.length ? `${Math.min(...v)}–${Math.max(...v)}` : '';
  };
  const vals = its.map((i) => i.value);
  return [r, rng('atk'), rng('matk'), rng('def'), rng('hp'), rng('spd'), `${Math.min(...vals)}–${Math.max(...vals)}`];
})));
p('', '### 4.1 Phẩm chất khi chế tạo / rơi', '');
p(mdTable(['Phẩm chất', 'Tên', 'Xác suất', '+% chỉ số'], Object.entries(QUALITY_INFO).map(([k, q]) => [k, `${q.label} / ${q.labelEn}`, pct(q.chance), `+${q.statBonus}%`])));
p('', '### 4.2 Cường hóa (+1 → +9, roll phía server, thất bại có thể tụt cấp)', '');
const rates = formulas.upgradeSuccessRate as Record<string, number>;
p(mdTable(['Cấp', ...Object.keys(rates).map((k) => `+${k}`)], [['Tỉ lệ thành công', ...Object.values(rates).map((v) => `${v}%`)]]));
p('', `Đá cường hóa: \`${g('UPGRADE_STONE_ID')}\` · cấp tối đa: +${g('MAX_UPGRADE')} · trọng số lực chiến \`ITEM_POWER_WEIGHT\`: ${Object.entries(g('ITEM_POWER_WEIGHT')).map(([k, v]) => `${k}×${v}`).join(', ')}.`);

// ---------------------------------------------------------------- Materials / crafting
h('## 5. Nguyên liệu, chế tạo, thăng tier');
const matTiers: Record<string, number> = {};
for (const m of MATERIALS) matTiers[`${m.tier} (${m.source})`] = (matTiers[`${m.tier} (${m.source})`] ?? 0) + 1;
p(mdTable(['Tier (nguồn)', 'Số nguyên liệu'], Object.entries(matTiers)));
p(
  '',
  `- Mỗi công thức chế tạo dùng 2–3 loại nguyên liệu (VD: ${JSON.stringify(g('RECIPES')[0].materials)}).`,
  `- Sách thăng tier: gộp ${g('SCROLL_MERGE_COUNT')} sách tier n → 1 sách tier n+1 (tier 1 → 9).`,
  `- Bản nguyên (essence) cho T8: 100 × mỗi loại trong 5 nguyên liệu của một hầm + 1 \`mat_divinity\` (= 15 mảnh thần vị). Mỗi bản nguyên cho một nội tại mạnh:`,
  '',
  mdTable(['Bản nguyên', 'Nội tại'], Object.entries(g('ESSENCE_PASSIVES')).map(([k, v]: [string, Any]) => [k, `${v.nameEn}: ${v.descriptionEn}`])),
);
p('', 'Vật phẩm đặc biệt và nguồn:', '', mdTable(['ID', 'Nguồn'], SPECIAL.map((s) => [s.id, s.source])));

// ---------------------------------------------------------------- Runes
h('## 6. Rune (ấn ký khắc lên trang bị)');
p(
  mdTable(['Loại', 'Tên', 'Ý nghĩa'], g('RUNE_COLS').map((r: Any) => [r.key, `${r.name} / ${r.nameEn}`, ''])),
  '',
  `- 4 bậc: ${g('RUNE_TIER_LABELS_EN').join(' / ')}; giá trị ${g('RUNE_TIER_VALUE').join(' / ')}; độ hiếm ${g('RUNE_TIER_RARITY').join(' / ')}.`,
  `- Khoảng khắc (% một chỉ số ngẫu nhiên) theo bậc: ${JSON.stringify(g('RUNE_ENGRAVE_RANGE'))}.`,
  '- Bộ ấn: mặc 2 / 3 / 4 món khắc cùng loại cùng bậc để kích hoạt nội tại bộ.',
  `- Các chỉ số bộ ấn có thể cộng: ${Object.keys(g('RUNE_BONUS_ZERO')).join(', ')}.`,
);

// ---------------------------------------------------------------- Pets
h('## 7. Pet');
p(
  mdTable(['Loại pet', 'Tên', 'Cộng mỗi level', 'Trọng số khi nở trứng'], Object.entries(g('PET_STAT_META')).map(([k, v]: [string, Any]) => [k, v.nameEn, v.perLevel, (g('PET_EGG_ROLLS') as Any[]).find((r) => r.stat === k)?.weight ?? ''])),
  '',
  '- Trứng: mua 100⭐ ở Star Shop, hoặc rơi từ hầm 1–4. Pet có thể cho ăn (feed), nuốt pet khác (devour), thả (release).',
  '- Pet gắn vào ô 🐾 của hầm ngục để buff cả đội; pet mặc định cũng áp dụng cho world boss và PvP.',
);

// ---------------------------------------------------------------- Formations & personalities
h('## 8. Đội hình (formation) và tính cách');
p(mdTable(['ID', 'Tên EN', 'Thành viên (họ, nhánh)', 'Buff'], FORMATIONS.map((f) => [f.id, f.nameEn, f.members.map(([b, c]: [string, number]) => `${b}#${c}`).join(' + '), f.bonusTextEn])));
p('', mdTable(['Tính cách', 'Tên', 'Hiệu ứng'], PERSONALITIES.map((x) => [x.id, `${x.name} / ${x.nameEn}`, x.descriptionEn])));

// ---------------------------------------------------------------- Economy constants
h('## 9. Hằng số kinh tế và LiveOps');
p(mdTable(['Hằng số', 'Giá trị', 'Ý nghĩa'], [
  ['OFFLINE_GOLD_PER_SEC', g('OFFLINE_GOLD_PER_SEC'), 'vàng thụ động của guild khi offline (≈ 720/giờ)'],
  ['OFFLINE_EFFICIENCY', g('OFFLINE_EFFICIENCY'), 'hiệu suất farm offline so với online'],
  ['OFFLINE_WAVE_DURATION_SEC', g('OFFLINE_WAVE_DURATION_SEC'), 'mỗi wave offline quy ước 18 giây'],
  ['MIN_OFFLINE_SEC', g('MIN_OFFLINE_SEC'), 'chỉ tính offline khi vắng ≥ 2 phút'],
  ['REST_DURATION_MS', g('REST_DURATION_MS'), 'đội bị diệt phải nghỉ 5 phút'],
  ['MP_MAX / MP_ON_HIT', `${g('MP_MAX')} / ${g('MP_ON_HIT')}`, 'đầy 100 MP → tự tung ULT'],
  ['SAVE_VERSION', g('SAVE_VERSION'), 'phiên bản schema save'],
  ['FLIP_CARD_STAR_COST', g('FLIP_CARD_STAR_COST'), 'giá lật thẻ bằng sao'],
  ['WEEKLY_QUEST_REQ', g('WEEKLY_QUEST_REQ'), 'mỗi task tuần cần 10 lần'],
]));
p('', '### 9.1 Star Shop (giá bằng sao ⭐)', '', mdTable(['Vật phẩm', 'Giá ⭐'], g('STAR_SHOP_ITEMS').map((s: Any) => [s.scrollId, s.price])));
p('', '### 9.2 Quest ngày / tuần', '', `Task ngày: ${g('DAILY_QUEST_TASKS').join(', ')} (mỗi task 1 lần; tuần: 10 lần).`, '');
p(mdTable(['Mốc', 'Thưởng ngày', 'Thưởng tuần'], Object.keys(g('DAILY_QUEST_MILESTONES')).map((k) => [k, JSON.stringify(g('DAILY_QUEST_MILESTONES')[k]), JSON.stringify(g('WEEKLY_QUEST_MILESTONES')[k])])));
p('', '### 9.3 Mốc nạp tích lũy (theo ⭐ đã nạp)', '', mdTable(['Mốc ⭐', 'Thưởng'], g('TOPUP_MILESTONES').map((m: Any) => [m.threshold, Object.entries(m.mats).map(([k, v]) => `${k}×${v}`).join(', ')])));
p('', `Sự kiện lật thẻ: mốc nạp ${g('FLIP_TOPUP_MILESTONES').map((m: Any) => `${m.threshold}⭐→${m.cards} thẻ`).join(', ')}; các gói thưởng: ${Object.keys(g('FLIP_CARD_PACKS')).join(', ')}.`);

// ---------------------------------------------------------------- Formulas
h('## 10. Chi phí công trình và đường cong EXP (gọi trực tiếp hàm công thức)');
const lv = Array.from({ length: 10 }, (_, i) => String(i + 1));
p(mdTable(['Level', ...lv], [
  ['Guild: chi phí nâng (vàng)', ...lv.map((l) => fmt(formulas.guildUpgradeCost[l]))],
  ['Guild: số nhà thám hiểm tối đa', ...lv.map((l) => formulas.guildMaxAdventurers[l])],
  ['Tavern: chi phí nâng', ...lv.map((l) => fmt(formulas.tavernUpgradeCost[l]))],
  ['Tavern: số ứng viên', ...lv.map((l) => formulas.tavernMaxSlots[l])],
  ['Kho: chi phí nâng', ...lv.map((l) => fmt(formulas.inventoryUpgradeCost[l]))],
  ['Shop: chi phí nâng', ...lv.map((l) => fmt(formulas.shopUpgradeCost[l]))],
]));
p('', 'Chi phí: Guild ×4/cấp từ 500, Tavern/Kho ×4/cấp từ 100, Shop ×10/cấp từ 1.000.', '');
const xpLv = ['1', '5', '10', '15', '20', '25', '30', '35', '40', '50', '60'];
p(mdTable(['Level', ...xpLv], Object.entries(formulas.xpToNext).map(([t, v]: [string, Any]) => [`EXP lên cấp (${t})`, ...xpLv.map((l) => fmt(v[l]))])));
p(
  '',
  'Công thức (giải mã từ bundle): `base = L ≤ 40 ? 32 × 1.22^(L−1) : 74,676 × 1.08^(L−40)`; nhân hệ số theo dải level',
  '(0.97 / 2.55 / 2.67 / 3.56 / 4.56 / 5.88 / 7.8 cho các dải ≤9 / ≤14 / ≤19 / ≤24 / ≤29 / ≤34 / còn lại); rồi nhân `(30 + 6 × (tier − 1)) / 31`.',
);

writeText(join(base, '04-game-data.md'), out.join('\n') + '\n');

// ---------------------------------------------------------------- Curated JSON
writeJson(join(base, 'data', 'fworldgm-mechanics.json'), {
  source: 'https://fworldgm.com/ client bundle (index-93ffc551…js), trích ngày 2026-10-03',
  counts: { families: families.length, classes: CLASSES.length, dungeons: DUNGEONS.length, enemyFamilies: Object.keys(FAMILY_MAP).length, items: allItems.length, recipes: g('RECIPES').length, materials: MATERIALS.length, formations: FORMATIONS.length },
  counterWheel: COUNTER,
  counterMultipliers: { advantage: 1.25, disadvantage: 0.85 },
  enemyTierRoll: { boss: 0.0001, leader: 0.0099, elite: 0.1, normal: 0.89 },
  lootDropChance: { normal: '0.3 - 0.0357*(dungeonTier-1)', elite: 1, leader: 1, boss: 1 },
  lootCount: { normal: 1, elite: 1, leader: 5, boss: 10 },
  combat: {
    turnOrder: 'sort by (ultFirst && mp>=100) desc, then effective SPD desc',
    mp: { max: g('MP_MAX'), perTurn: 10, onHit: g('MP_ON_HIT') },
    dodge: 'base 10% + dodgeBonus; minus (accuracyBonus + max(0,(atkSPD-defSPD)/10))%; cap 50% vs boss',
    damage: 'atk>def ? atk-def : atk*(1 - def/(def+atk/5)); ×U(0.9,1.1); crit chance 10%+crit → ×(2+critDmg/100); block chance min(30%, 5%+0.1%×def) → ×0.5; ×(1+phys/magDmgBonus); ×(1+dmgTaken); ×counter; ×skillPower; min 1',
    maxTurns: 1000,
    rng: 'xorshift32 seeded (but target selection uses Math.random)',
    rewards: 'gold = sum U(goldReward); xp = floor(U(xpReward)/10)',
  },
  xpCurve: 'base = L<=40 ? 32*1.22^(L-1) : 74676*1.08^(L-40); × bandFactor(L); × (30+6*(tier-1))/31',
  levelCap: 'tier<7 ? 5*tier : Infinity',
  quality: QUALITY_INFO,
  upgradeSuccessRate: formulas.upgradeSuccessRate,
  facilities: {
    guildUpgradeCost: '500 × 4^(L-1)', guildMaxAdventurers: 'L + 1',
    tavernUpgradeCost: '100 × 4^(L-1)', tavernMaxSlots: 'L + 1',
    inventoryUpgradeCost: '100 × 4^(L-1)', shopUpgradeCost: '1000 × 10^(L-1)',
  },
  offline: { goldPerSec: g('OFFLINE_GOLD_PER_SEC'), efficiency: g('OFFLINE_EFFICIENCY'), waveDurationSec: g('OFFLINE_WAVE_DURATION_SEC'), minOfflineSec: g('MIN_OFFLINE_SEC'), restDurationMs: g('REST_DURATION_MS') },
  scrollMergeCount: g('SCROLL_MERGE_COUNT'),
  essenceMatCount: g('ESSENCE_MAT_COUNT'),
  starShop: g('STAR_SHOP_ITEMS'),
  topupMilestones: g('TOPUP_MILESTONES'),
  dailyQuest: { tasks: g('DAILY_QUEST_TASKS'), milestones: g('DAILY_QUEST_MILESTONES') },
  weeklyQuest: { req: g('WEEKLY_QUEST_REQ'), milestones: g('WEEKLY_QUEST_MILESTONES') },
  starPrice: { closedBeta: '1,000 VND = 10 stars', afterBeta: '1,000 VND = 5 stars' },
});
console.log('→ research/fworldgm/04-game-data.md, research/fworldgm/data/fworldgm-mechanics.json');
