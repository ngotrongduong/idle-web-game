# Dữ liệu game fworldgm (trích từ client bundle)

> Sinh tự động bởi `tools/inspect/src/report-fworldgm-data.ts` từ module dữ liệu của bundle Expo (dump qua `__r(id)` trong trình duyệt).
> Dữ liệu dùng để **tham khảo cấu trúc, quy mô và nhịp số**. Không tái sử dụng tên, mô tả, hình ảnh hay IP của game.

## 1. Quy mô nội dung

| Hạng mục | Số lượng | Ghi chú |
| --- | --- | --- |
| Họ class (family) | 8 | mỗi họ 8 nhánh, mở dần theo tier |
| Class (family × nhánh × tier) | 288 | 8 × (1+2+…+8) = 288 |
| Tier class | 8 | level cap tier n = 5n (T7+ không giới hạn) |
| Hầm ngục | 8 | 5 wave × 2 quái; Lv đề xuất 5/10/15/20/25/30/35/40 |
| Họ quái (family) | 32 | mỗi họ có 4 bậc: normal / elite / leader / boss |
| Quái khác nhau | 128 |  |
| Trang bị (ITEMS + EXTRA) | 323 + 179 | 4 slot: weapon / helmet / armor / accessory |
| Công thức chế tạo | 340 |  |
| Nguyên liệu chế tạo | 95 | tier 1–9 theo hầm ngục + đặc biệt |
| Vật phẩm đặc biệt | 30 | sách, đá, trứng, rương, bản nguyên… |
| Đội hình (formation) | 31 | combo 2–4 class cụ thể → buff |
| Tính cách (personality) | 8 | +15% một chỉ số, −5% các chỉ số khác |
| Phẩm chất trang bị | 6 | normal → divine |
| Rune | 16 | 4 loại × 4 bậc |

## 2. Hệ class

### 2.1 8 họ class gốc (tier 1)

| ID | Tên (VI / EN) | Đòn đánh | HP | ATK | DEF | MATK | MDEF | SPD | CRIT | CRITDMG | Growth/lv (HP/ATK/DEF/MATK) | Nội tại T1 | Khắc chế → |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| kiem_si | Kiếm Sĩ / Swordfighter | melee, physical | 120 | 14 | 10 | 6 | 7 | 8 | 5 | 50 | 18/3/2/1 | +10% physical damage | sat_thu |
| cung_thu | Cung Thủ / Archer | ranged, physical | 90 | 16 | 6 | 6 | 6 | 12 | 12 | 60 | 13/4/1/1 | +6.25% physical damage, +10% accuracy, +4.38% SPD | dao_si |
| sat_thu | Sát Thủ / Assassin | melee, physical | 85 | 15 | 5 | 6 | 5 | 14 | 18 | 70 | 11/3/1/1 | +5% physical damage, +5% dodge, Prioritizes attacking the lowest-HP enemy | phap_su |
| phap_su | Pháp Sư / Mage | ranged, magical | 80 | 6 | 5 | 18 | 8 | 9 | 8 | 60 | 12/1/1/5 | +10% MATK, +8 MP at battle start | trieu_hoi |
| cuong_bao | Cuồng Bạo / Berserker | melee, physical | 140 | 22 | 8 | 6 | 6 | 10 | 10 | 60 | 22/5/2/1 | +20% HP | cung_thu |
| trieu_hoi | Triệu Hồi / Summoner | ranged, magical | 75 | 5 | 5 | 20 | 10 | 8 | 8 | 60 | 10/1/1/6 | +5% MP regen, +5% magic double attack chance, +3 MP at battle start, +2 MP per turn, +30 MP after using ultimate | cuong_bao |
| dao_si | Đạo Sĩ / Taoist | melee, magical | 95 | 7 | 7 | 15 | 12 | 7 | 5 | 50 | 14/1/1/4 | +10% MATK, +3 MP per turn | saija |
| saija | Saiya / Saiyan | melee, physical | 160 | 13 | 14 | 12 | 12 | 7 | 5 | 50 | 26/3/3/2 | +10% HP, +5% ATK, +5% MATK, +10% dodge | kiem_si |

**Vòng khắc chế** (A → B nghĩa là A gây ×1.25 sát thương lên B; chiều ngược lại ×0.85): kiem_si (Swordfighter) → sat_thu (Assassin) → phap_su (Mage) → trieu_hoi (Summoner) → cuong_bao (Berserker) → cung_thu (Archer) → dao_si (Taoist) → saija (Saiyan) → kiem_si (Swordfighter).

### 2.2 Cây nhánh (column) của mỗi họ

Nhánh thứ k (0-index) mở khóa từ tier k+1, nên tier n có n nhánh để chọn.

| Họ | Nhánh 0 (từ T1) | Nhánh 1 (từ T2) | Nhánh 2 (từ T3) | Nhánh 3 (từ T4) | Nhánh 4 (từ T5) | Nhánh 5 (từ T6) | Nhánh 6 (từ T7) | Nhánh 7 (từ T8) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| kiem_si | Swordsman | Knight | Shieldbearer | Dark Swordsman | Storm Swordsman | Golden Swordsman | Paladin | Sword God |
| cung_thu | Archer | Crossbowman | Gunslinger | Rifleman | Sniper | Heavy Gunner | War Engineer | Space Trooper |
| sat_thu | Assassin | Blademaster | Venom Shade | Wraith | Dark Shade | Blood Shade | Void Shade | Shadow Demon |
| phap_su | Mage | Pyromancer | Cryomancer | Geomancer | Light Mage | Dark Mage | Void Mage | Archmage |
| cuong_bao | Savage | Berserker | Dual-Axe Berserker | Juggernaut | Mauler | Rune Berserker | Demon Berserker | Fire Demon God |
| trieu_hoi | Wolf Caller | Bear Caller | Tiger Caller | Phoenix Caller | Dragon Caller | Demon-Dragon Caller | Deity Caller | Grand Summoner |
| dao_si | Sword Cultivator | Talisman Cultivator | Fire Cultivator | Yin-Yang Cultivator | Demonic Cultivator | Ghost Cultivator | Heavenly Cultivator | Cosmic Cultivator |
| saija | Saiyan | Super Saiyan | Super Saiyan 2 | Super Saiyan 3 | Super Saiyan 4 | Super Saiyan God | Super Saiyan Blue | Ultra Instinct |

### 2.3 Tier và level cap

| Tier | Số class | Level để thăng tier | HP gốc TB | ATK gốc TB | DEF gốc TB | SPD gốc TB |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | 8 | 5 | 106 | 12 | 8 | 9 |
| T2 | 16 | 10 | 127 | 16 | 9 | 12 |
| T3 | 24 | 15 | 153 | 17 | 11 | 14 |
| T4 | 32 | 20 | 173 | 20 | 12 | 15 |
| T5 | 40 | 25 | 194 | 22 | 14 | 17 |
| T6 | 48 | 30 | 215 | 25 | 15 | 19 |
| T7 | 56 | 35 | 236 | 27 | 17 | 21 |
| T8 | 64 | ∞ | 257 | 30 | 18 | 23 |

Ví dụ tăng trưởng một nhánh (Kiếm Sĩ nhánh 0, T1→T8):

| Tier | hp | atk | def | matk | mdef | spd | crit | critDmg | Nội tại |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | 120 | 14 | 10 | 6 | 7 | 8 | 5 | 50 | +10% physical damage |
| T2 | 144 | 19 | 11 | 8 | 8 | 11 | 7 | 60 | +20% physical damage |
| T3 | 168 | 22 | 13 | 9 | 10 | 12 | 8 | 70 | +30% physical damage |
| T4 | 192 | 24 | 15 | 11 | 10 | 14 | 9 | 80 | +40% physical damage |
| T5 | 216 | 28 | 17 | 12 | 12 | 15 | 10 | 90 | +50% physical damage |
| T6 | 240 | 31 | 19 | 13 | 13 | 18 | 11 | 100 | +60% physical damage |
| T7 | 264 | 34 | 21 | 14 | 14 | 20 | 12 | 110 | +70% physical damage |
| T8 | 288 | 37 | 23 | 15 | 16 | 21 | 13 | 120 | +80% physical damage |

## 3. Hầm ngục và quái

| # | ID | Tên EN | Lv đề xuất | Wave (quái@level) | Vàng/quái (normal) | XP/quái (normal) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | forest_of_whispers | Forest of Whispers | 5 | slime_jr@1+cave_bat@2 / cave_bat@2+slime_jr@1 / giant_worm@5+cave_bat@2 / wraith@7+giant_worm@5 / wraith@7+slime_jr@1 | 8–14 | 20–32 |
| 2 | crystal_caverns | Crystal Caverns | 10 | crystal_bat@10+gem_spider@12 / rock_golem@14+crystal_bat@10 / gem_spider@12+crystal_wraith@16 / rock_golem@14+gem_spider@12 / rock_golem@14+crystal_wraith@16 | 30–50 | 42–64 |
| 3 | shadow_realm | Shadow Realm | 15 | shadow_wolf@15+void_bat@16 / dark_knight@17+shadow_wolf@15 / shadow_mage@18+void_bat@16 / dark_knight@17+shadow_mage@18 / dark_knight@17+shadow_wolf@15 | 60–100 | 54–79 |
| 4 | volcano_peak | Volcano Peak | 20 | lava_slime@20+fire_imp@22 / magma_golem@24+lava_slime@20 / flame_wraith@26+fire_imp@22 / magma_golem@24+flame_wraith@26 / flame_wraith@26+magma_golem@24 | 100–160 | 68–103 |
| 5 | frozen_wastes | Frozen Wastes | 25 | ice_wolf@25+snow_goblin@26 / frost_skeleton@27+ice_wolf@25 / ice_witch@28+snow_goblin@26 / frost_skeleton@27+ice_witch@28 / ice_witch@28+frost_skeleton@27 | 150–240 | 81–120 |
| 6 | ancient_ruins | Ancient Ruins | 30 | undead_knight@30+bone_archer@31 / cursed_mummy@32+undead_knight@30 / necromancer@33+bone_archer@31 / cursed_mummy@32+necromancer@33 / necromancer@33+undead_knight@30 | 220–360 | 95–143 |
| 7 | celestial_temple | Celestial Temple | 35 | fallen_cherub@35+dark_seraph@36 / corrupted_paladin@37+fallen_cherub@35 / void_priest@38+dark_seraph@36 / corrupted_paladin@37+void_priest@38 / dark_seraph@36+corrupted_paladin@37 | 300–500 | 105–158 |
| 8 | abyssal_void | Abyssal Void | 40 | void_wraith@40+star_eater@41 / abyssal_horror@42+void_wraith@40 / cosmic_tentacle@43+star_eater@41 / abyssal_horror@42+cosmic_tentacle@43 / cosmic_tentacle@43+abyssal_horror@42 | 400–640 | 110–170 |

### 3.1 Bậc quái (roll mỗi lần sinh quái)

| Bậc | Xác suất | Tỉ lệ rơi nguyên liệu | Số lượng mỗi lần rơi | Ghi chú |
| --- | --- | --- | --- | --- |
| normal | 89% | 30% − 3.57% × (tier hầm − 1) | 1 | tier hầm cao → rơi ít hơn |
| elite | 10% | 100% | 1 |  |
| leader | 0.99% | 100% | 5 |  |
| boss | 0.01% | 100% | 10 | boss luôn rơi scroll/mảnh hiếm |

Ví dụ họ quái (8/32 họ đầu):

| Họ | Normal | Elite | Leader | Boss |
| --- | --- | --- | --- | --- |
| slime_jr | Slime Jr Lv1 HP30 ATK7 | Venom Slime Lv2 HP48 ATK11 | Slime King Lv3 HP75 ATK18 | Slime Emperor Lv4 HP120 ATK28 |
| cave_bat | Cave Bat Lv2 HP45 ATK10 | Vampire Bat Lv3 HP72 ATK16 | Bat Swarm Lord Lv4 HP113 ATK25 | Bat Queen Lv5 HP180 ATK40 |
| giant_worm | Giant Worm Lv5 HP90 ATK16 | Sand Worm Lv6 HP144 ATK26 | Death Worm Lv7 HP225 ATK40 | Devourer Worm Lv8 HP360 ATK64 |
| wraith | Wraith Lv7 HP140 ATK20 | Wraith Knight Lv8 HP224 ATK32 | Wraith Lord Lv9 HP350 ATK50 | Wraith King Lv10 HP560 ATK80 |
| crystal_bat | Crystal Bat Lv10 HP216 ATK30 | Crystal Vampire Bat Lv11 HP346 ATK48 | Crystal Bat Lord Lv12 HP540 ATK76 | Crystal Bat Empress Lv13 HP864 ATK120 |
| gem_spider | Gem Spider Lv12 HP264 ATK36 | Crystal Spider Queen Lv13 HP422 ATK58 | Gem Spider Matriarch Lv14 HP660 ATK90 | Crystal Spider Empress Lv15 HP1056 ATK144 |
| rock_golem | Rock Golem Lv14 HP420 ATK42 | Crystal Golem Brute Lv15 HP672 ATK67 | Stone Titan Lv16 HP1050 ATK106 | Crystal Golem Boss Lv17 HP1680 ATK168 |
| crystal_wraith | Crystal Wraith Lv16 HP336 ATK34 | Crystal Wraith Lord Lv17 HP538 ATK54 | Crystal Wraith King Lv18 HP840 ATK84 | Crystal Wraith Emperor Lv19 HP1344 ATK134 |

## 4. Trang bị

| Slot | common | uncommon | rare | epic | legendary | mythic | Tổng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| weapon | 27 | 26 | 22 | 26 | 19 | 12 | 132 |
| helmet | 15 | 19 | 23 | 38 | 12 | 15 | 122 |
| armor | 9 | 18 | 20 | 38 | 24 | 15 | 124 |
| accessory | 12 | 10 | 23 | 36 | 27 | 16 | 124 |

Khoảng chỉ số chính theo độ hiếm (min–max trên mọi item có chỉ số đó):

| Độ hiếm | ATK | MATK | DEF | HP | SPD | Giá trị bán |
| --- | --- | --- | --- | --- | --- | --- |
| common | 5–208 | 0–233 | 9–192 | 7–232 | -2–4 | 5–45 |
| uncommon | 5–321 | 10–276 | 2–327 | 4–321 | -6–8 | 30–120 |
| rare | 28–506 | 48–351 | 2–506 | 2–777 | -5–7 | 70–350 |
| epic | 18–766 | 48–946 | 5–716 | 11–799 | -8–13 | 170–380 |
| legendary | 36–833 | 22–1222 | -5–615 | 4–1164 | -15–19 | 250–500 |
| mythic | 34–1215 | 96–624 | 51–738 | 92–1190 | -15–18 | 440–600 |

### 4.1 Phẩm chất khi chế tạo / rơi

| Phẩm chất | Tên | Xác suất | +% chỉ số |
| --- | --- | --- | --- |
| normal | Thường / Normal | 50% | +0% |
| medium | Trung / Medium | 40% | +10% |
| fine | Tinh Anh / Fine | 9% | +20% |
| high | Cao Cấp / High | 0.9% | +30% |
| super | Siêu Cấp / Super | 0.009% | +40% |
| divine | Thần Cấp / Divine | 0.0001% | +60% |

### 4.2 Cường hóa (+1 → +9, roll phía server, thất bại có thể tụt cấp)

| Cấp | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tỉ lệ thành công | 90% | 80% | 70% | 60% | 50% | 40% | 30% | 20% | 10% |

Đá cường hóa: `mat_equip_upgrade_stone` · cấp tối đa: +9 · trọng số lực chiến `ITEM_POWER_WEIGHT`: hp×1, atk×2, matk×2, def×2, mdef×2, spd×5, crit×10, critDmg×5, int×100, mpPerTurn×200.

## 5. Nguyên liệu, chế tạo, thăng tier

| Tier (nguồn) | Số nguyên liệu |
| --- | --- |
| 1 (dungeon_1) | 7 |
| 2 (dungeon_2) | 7 |
| 3 (dungeon_3) | 7 |
| 4 (dungeon_4) | 7 |
| 5 (dungeon_5) | 6 |
| 6 (dungeon_6) | 6 |
| 7 (dungeon_7) | 6 |
| 8 (dungeon_8) | 6 |
| 9 (dungeon_9) | 1 |
| 0 (star_shop) | 10 |
| 0 (craft) | 1 |
| 0 (world_boss) | 2 |
| 0 (flip_event) | 1 |
| 0 (event) | 4 |
| 0 (special) | 24 |

- Mỗi công thức chế tạo dùng 2–3 loại nguyên liệu (VD: [{"materialId":"mat_gem_spider_silk","count":3},{"materialId":"mat_slime_gel","count":1},{"materialId":"mat_whispering_core","count":1}]).
- Sách thăng tier: gộp 4 sách tier n → 1 sách tier n+1 (tier 1 → 9).
- Bản nguyên (essence) cho T8: 100 × mỗi loại trong 5 nguyên liệu của một hầm + 1 `mat_divinity` (= 15 mảnh thần vị). Mỗi bản nguyên cho một nội tại mạnh:

| Bản nguyên | Nội tại |
| --- | --- |
| mat_ban_nguyen_sinh_menh | Primal Vitality: Heals 15% of max HP each turn. |
| mat_ban_nguyen_nang_luong | Energy Flow: Restores 15 MP each turn. |
| mat_ban_nguyen_bong_toi | Shadow Drain: Heals for 15% of damage dealt. |
| mat_ban_nguyen_hoa | Primal Flame: +15% damage dealt and immune to freeze. |
| mat_ban_nguyen_bang | Primal Chill: On battle start: each enemy has a 20% chance to lose 30% SPD. |
| mat_ban_nguyen_dai_dia | Earthen Skin: -15% damage taken. |
| mat_ban_nguyen_anh_sang | Primal Radiance: +20% healing done and +15% damage dealt. |
| mat_ban_nguyen_hon_don | Primal Chaos: +30% damage dealt, +10% damage taken. |

Vật phẩm đặc biệt và nguồn:

| ID | Nguồn |
| --- | --- |
| mat_tavern_refresh_book | star_shop |
| mat_heart_of_baragos | star_shop |
| mat_rename_card | star_shop |
| mat_player_rename_card | star_shop |
| mat_divinity_shard | star_shop |
| mat_divinity | craft |
| mat_chest_boss_kill | world_boss |
| mat_chest_participation | world_boss |
| mat_divinity_gem | star_shop |
| mat_revive_stone | star_shop |
| mat_pet_egg | star_shop |
| mat_x2_exp_24h | flip_event |
| mat_exp_orb_t1 | event |
| mat_exp_orb_t2 | event |
| mat_exp_orb_t3 | event |
| mat_flip_card | star_shop |
| mat_chest_lucky_mat | event |
| mat_equip_upgrade_stone | star_shop |
| mat_egg_forest_whispers | dungeon_1 |
| mat_egg_crystal_caverns | dungeon_2 |
| mat_egg_shadow_realm | dungeon_3 |
| mat_egg_volcano_peak | dungeon_4 |
| mat_ban_nguyen_sinh_menh | special |
| mat_ban_nguyen_nang_luong | special |
| mat_ban_nguyen_bong_toi | special |
| mat_ban_nguyen_hoa | special |
| mat_ban_nguyen_bang | special |
| mat_ban_nguyen_dai_dia | special |
| mat_ban_nguyen_anh_sang | special |
| mat_ban_nguyen_hon_don | special |

## 6. Rune (ấn ký khắc lên trang bị)

| Loại | Tên | Ý nghĩa |
| --- | --- | --- |
| mana | Hoạt Linh / Animus |  |
| power | Phá Lục / Rend |  |
| hp | Đại Lực / Titan |  |
| exp | Tụ Linh / Conflux |  |

- 4 bậc: Low / Mid / High / Ultra; giá trị 50 / 150 / 400 / 1000; độ hiếm uncommon / rare / epic / legendary.
- Khoảng khắc (% một chỉ số ngẫu nhiên) theo bậc: [[0,0],[10,15],[15,25],[25,35],[30,40]].
- Bộ ấn: mặc 2 / 3 / 4 món khắc cùng loại cùng bậc để kích hoạt nội tại bộ.
- Các chỉ số bộ ấn có thể cộng: startMp, mpPerTurn, atkPct, matkPct, dmgDealtPct, defPct, mdefPct, hpPct, dmgReducePct, expPct, goldPct.

## 7. Pet

| Loại pet | Tên | Cộng mỗi level | Trọng số khi nở trứng |
| --- | --- | --- | --- |
| atk | ATK Pet | 1 | 10 |
| matk | MATK Pet | 1 | 10 |
| def | DEF Pet | 1 | 20 |
| mdef | MDEF Pet | 1 | 20 |
| spd | SPD Pet | 1 | 15 |
| crit | CRIT Pet | 0.5 | 10 |
| critdmg | CRIT DMG Pet | 1 | 10 |
| exp | EXP Pet | 1 | 5 |

- Trứng: mua 100⭐ ở Star Shop, hoặc rơi từ hầm 1–4. Pet có thể cho ăn (feed), nuốt pet khác (devour), thả (release).
- Pet gắn vào ô 🐾 của hầm ngục để buff cả đội; pet mặc định cũng áp dụng cho world boss và PvP.

## 8. Đội hình (formation) và tính cách

| ID | Tên EN | Thành viên (họ, nhánh) | Buff |
| --- | --- | --- | --- |
| du_kich | Guerrilla | cung_thu#0 + sat_thu#0 | +8% SPD for formation members · +10 MP at battle start |
| san_dau_nguoi | Headhunters | cung_thu#4 + sat_thu#2 | +10% CRIT for formation members · +10 MP at battle start |
| thanh_ho | Holy Ward | kiem_si#6 + phap_su#4 | +10% MDEF for formation members · +10 MP at battle start |
| hoa_lien | Fire Lotus | phap_su#1 + dao_si#2 | +10% MATK for formation members · +10 MP at battle start |
| long_ho | Dragon & Tiger | trieu_hoi#4 + trieu_hoi#2 | +10% HP for formation members · +10 MP at battle start |
| thiet_ve | Iron Guard | kiem_si#2 + trieu_hoi#1 | +10% DEF for formation members · +10 MP at battle start |
| song_anh | Twin Shades | sat_thu#4 + sat_thu#6 | +8% dodge for formation members · +10 MP at battle start |
| song_tu_than | Twin Gods | saija#5 + saija#6 | +12% ATK for formation members · +10 MP at battle start |
| song_khien | Twin Shields | kiem_si#2 + kiem_si#2 | Restore 60 MP at battle start for formation members |
| hac_kim | Black Gold | kiem_si#3 + kiem_si#5 | +10% ATK · +10% crit damage for formation members · +10 MP at battle start |
| tho_san_hoang | Wild Hunters | cung_thu#1 + cuong_bao#0 | +8% ATK · +8% SPD for formation members · +10 MP at battle start |
| toc_xa | Rapid Fire | cung_thu#2 + cung_thu#3 | +10% SPD · +8% CRIT for formation members · +10 MP at battle start |
| hoa_luc | Firepower | cung_thu#5 + cung_thu#6 | +12% ATK for formation members · +10 MP at battle start |
| cuong_dao | Mad Blades | sat_thu#1 + cuong_bao#1 | +10% ATK · +8% lifesteal for formation members · +10 MP at battle start |
| son_ha | Mountains & Rivers | phap_su#2 + phap_su#3 | +10% DEF · +10% MDEF for formation members · +10 MP at battle start |
| hu_khong_hon_don | Void & Chaos | phap_su#6 + dao_si#7 | +12% MATK for formation members · +10 MP at battle start |
| ma_van | Demon Runes | cuong_bao#5 + trieu_hoi#5 | +10% ATK · +10% MATK for formation members · +10 MP at battle start |
| vuot_gioi | Beyond Limits | saija#3 + saija#4 | +12% ATK · +10% crit damage for formation members · +10 MP at battle start |
| tam_quoc | Three Kingdoms | kiem_si#0 + cung_thu#0 + phap_su#0 | +5% ATK · +5% MATK · +5% DEF for formation members · +10 MP at battle start |
| u_minh | Netherworld | sat_thu#3 + dao_si#5 + phap_su#5 | +12% SPD for formation members · +10 MP at battle start |
| thiet_bich | Iron Wall | kiem_si#2 + cuong_bao#3 + kiem_si#1 | +12% DEF · +6% HP for formation members · +10 MP at battle start |
| tam_tien | Three Immortals | dao_si#0 + dao_si#1 + dao_si#6 | +12% MATK for formation members · +10 MP at battle start |
| liep_hon | Soul Hunt | sat_thu#2 + sat_thu#5 + trieu_hoi#0 | +10% lifesteal for formation members · +10 MP at battle start |
| am_duong | Yin-Yang | dao_si#3 + phap_su#4 + phap_su#5 | +8% MATK · +8% MDEF for formation members · +10 MP at battle start |
| toc_sat | Swift Kill | kiem_si#4 + sat_thu#4 + cung_thu#7 | +10% SPD · +5% CRIT for formation members · +10 MP at battle start |
| tam_cuong | Triple Rage | cuong_bao#2 + cuong_bao#4 + cuong_bao#6 | +12% ATK · +10% lifesteal for formation members · +10 MP at battle start |
| chua_te_van_linh | Lord of All Spirits | trieu_hoi#5 + trieu_hoi#6 + trieu_hoi#7 | +15% MATK · +10% HP for formation members · +10 MP at battle start |
| tien_hoa | Evolution | saija#0 + saija#1 + saija#2 | +10% ATK · +10% SPD for formation members · +10 MP at battle start |
| tu_thanh_thu | Four Sacred Beasts | trieu_hoi#0 + trieu_hoi#2 + trieu_hoi#3 + trieu_hoi#4 | +15% HP · +10% MATK for formation members · +10 MP at battle start |
| ma_quan | Demon Legion | sat_thu#7 + dao_si#4 + cuong_bao#7 + phap_su#7 | +15% ATK · +15% MATK for formation members · +10 MP at battle start |
| thien_dinh | Celestial Court | kiem_si#7 + trieu_hoi#6 + dao_si#6 + saija#7 | +12% ATK · +12% MATK · +10% HP for formation members · +10 MP at battle start |

| Tính cách | Tên | Hiệu ứng |
| --- | --- | --- |
| dung_cam | Dũng Cảm / Brave | Increases HP by 15%, reduces all other stats by 5%. |
| manh_me | Mạnh Mẽ / Mighty | Increases ATK by 15%, reduces all other stats by 5%. |
| kien_cuong | Kiên Cường / Steadfast | Increases DEF by 15%, reduces all other stats by 5%. |
| phap_thuat | Pháp Thuật / Arcane | Increases MATK by 15%, reduces all other stats by 5%. |
| bi_an | Bí Ản / Mystic | Increases MDEF by 15%, reduces all other stats by 5%. |
| nhan_nhen | Nhanh Nhẹn / Swift | Increases SPD by 15%, reduces all other stats by 5%. |
| sac_ben | Sắc Bén / Sharp | Increases CRIT by 15%, reduces all other stats by 5%. |
| tri_tue | Trí Tuệ / Genius | Reduces all other stats by 5%, regenerates 10 MP each turn. |

## 9. Hằng số kinh tế và LiveOps

| Hằng số | Giá trị | Ý nghĩa |
| --- | --- | --- |
| OFFLINE_GOLD_PER_SEC | 0.2 | vàng thụ động của guild khi offline (≈ 720/giờ) |
| OFFLINE_EFFICIENCY | 0.8 | hiệu suất farm offline so với online |
| OFFLINE_WAVE_DURATION_SEC | 18 | mỗi wave offline quy ước 18 giây |
| MIN_OFFLINE_SEC | 120 | chỉ tính offline khi vắng ≥ 2 phút |
| REST_DURATION_MS | 300000 | đội bị diệt phải nghỉ 5 phút |
| MP_MAX / MP_ON_HIT | 100 / 5 | đầy 100 MP → tự tung ULT |
| SAVE_VERSION | 4 | phiên bản schema save |
| FLIP_CARD_STAR_COST | 150 | giá lật thẻ bằng sao |
| WEEKLY_QUEST_REQ | 10 | mỗi task tuần cần 10 lần |

### 9.1 Star Shop (giá bằng sao ⭐)

| Vật phẩm | Giá ⭐ |
| --- | --- |
| class_scroll_t4 | 3 |
| class_scroll_t5 | 9 |
| class_scroll_t6 | 27 |
| class_scroll_t7 | 243 |
| mat_tavern_refresh_book | 2 |
| mat_rename_card | 10 |
| mat_player_rename_card | 200 |
| mat_equip_upgrade_stone | 5 |
| mat_revive_stone | 100 |
| mat_pet_egg | 100 |

### 9.2 Quest ngày / tuần

Task ngày: craft, upgrade, arena, boss, tavern (mỗi task 1 lần; tuần: 10 lần).

| Mốc | Thưởng ngày | Thưởng tuần |
| --- | --- | --- |
| 1 | {"mats":{"class_scroll_t1":1}} | {"mats":{"class_scroll_t1":3}} |
| 2 | {"mats":{"mat_tavern_refresh_book":1}} | {"mats":{"mat_tavern_refresh_book":3}} |
| 3 | {"mats":{"mat_equip_upgrade_stone":1}} | {"mats":{"mat_equip_upgrade_stone":3}} |
| 4 | {"stars":1} | {"stars":3} |
| 5 | {"mats":{"mat_tavern_refresh_book":1}} | {"mats":{"mat_tavern_refresh_book":3}} |

### 9.3 Mốc nạp tích lũy (theo ⭐ đã nạp)

| Mốc ⭐ | Thưởng |
| --- | --- |
| 1 | mat_tavern_refresh_book×5 |
| 100 | mat_tavern_refresh_book×5, mat_equip_upgrade_stone×5 |
| 200 | class_scroll_t2×1, class_scroll_t3×1, class_scroll_t4×1 |
| 500 | mat_divinity_shard×5, mat_tavern_refresh_book×5, mat_equip_upgrade_stone×5 |
| 1000 | mat_divinity_shard×5, mat_tavern_refresh_book×10, mat_equip_upgrade_stone×10, mat_heart_of_baragos×1 |
| 2000 | mat_divinity_shard×5, mat_tavern_refresh_book×15, mat_equip_upgrade_stone×15, mat_heart_of_baragos×2 |
| 5000 | mat_divinity_shard×10, mat_tavern_refresh_book×20, mat_equip_upgrade_stone×20, class_scroll_t3×1, class_scroll_t4×1, class_scroll_t5×1, class_scroll_t6×1, class_scroll_t7×1, mat_heart_of_baragos×3 |

Sự kiện lật thẻ: mốc nạp 100⭐→1 thẻ, 250⭐→1 thẻ, 500⭐→1 thẻ, 1000⭐→2 thẻ, 2000⭐→3 thẻ; các gói thưởng: stones5, egg1, stars100, bosschest5, books50, stars200, luckychest10, heart2, heart5.

## 10. Chi phí công trình và đường cong EXP (gọi trực tiếp hàm công thức)

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Guild: chi phí nâng (vàng) | 500 | 2,000 | 8,000 | 32,000 | 128,000 | 512,000 | 2,048,000 | 8,192,000 | 32,768,000 | 131,072,000 |
| Guild: số nhà thám hiểm tối đa | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
| Tavern: chi phí nâng | 100 | 400 | 1,600 | 6,400 | 25,600 | 102,400 | 409,600 | 1,638,400 | 6,553,600 | 26,214,400 |
| Tavern: số ứng viên | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
| Kho: chi phí nâng | 100 | 400 | 1,600 | 6,400 | 25,600 | 102,400 | 409,600 | 1,638,400 | 6,553,600 | 26,214,400 |
| Shop: chi phí nâng | 1,000 | 10,000 | 100,000 | 1,000,000 | 10,000,000 | 100,000,000 | 1,000,000,000 | 10,000,000,000 | 100,000,000,000 | 1,000,000,000,000 |

Chi phí: Guild ×4/cấp từ 500, Tavern/Kho ×4/cấp từ 100, Shop ×10/cấp từ 1.000.

| Level | 1 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 50 | 60 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EXP lên cấp (tier1) | 30 | 67 | 473 | 1,338 | 4,821 | 16,692 | 58,173 | 208,564 | 563,686 | 1,216,950 | 2,627,304 |
| EXP lên cấp (tier2) | 36 | 80 | 568 | 1,606 | 5,786 | 20,030 | 69,807 | 250,277 | 676,424 | 1,460,340 | 3,152,765 |
| EXP lên cấp (tier4) | 48 | 107 | 757 | 2,141 | 7,714 | 26,707 | 93,077 | 333,702 | 901,898 | 1,947,120 | 4,203,687 |
| EXP lên cấp (tier8) | 72 | 160 | 1,136 | 3,212 | 11,571 | 40,060 | 139,615 | 500,553 | 1,352,847 | 2,920,680 | 6,305,530 |

Công thức (giải mã từ bundle): `base = L ≤ 40 ? 32 × 1.22^(L−1) : 74,676 × 1.08^(L−40)`; nhân hệ số theo dải level
(0.97 / 2.55 / 2.67 / 3.56 / 4.56 / 5.88 / 7.8 cho các dải ≤9 / ≤14 / ≤19 / ≤24 / ≤29 / ≤34 / còn lại); rồi nhân `(30 + 6 × (tier − 1)) / 31`.
