# 03: Kinh tế và cân bằng

> Các con số dưới đây là **điểm khởi đầu** được tính bằng script (sẽ chuyển thành `tools/sim` ở M0). Nguyên tắc: mọi hằng số nằm trong `packages/game-data`, không hard-code trong logic, để cân bằng lại mà không cần deploy code.

## 1. Tiền tệ

| Tiền tệ | Loại | Nguồn chính | Chỗ tiêu chính | Ghi chú |
|---|---|---|---|---|
| **Vàng** | mềm | wave, bán đồ, vàng thụ động của Sảnh | công trình, chế tạo, cường hóa, tuyển mộ | tăng theo cấp số nhân theo hầm |
| **Ngọc** (tạm gọi) | cứng (nạp) | nạp tiền; nhỏ giọt từ quest/thành tựu/world boss | thẻ chiêu mộ, tăng tốc, slot, gói tiện ích | **không** bán trực tiếp sức mạnh tuyệt đối |
| **Ngọc khóa** | cứng (không nạp) | quà sự kiện, quest | như Ngọc nhưng không dùng ở shop gói | tách để kiểm soát lạm phát quà tặng |
| **Bụi Rèn** | vật liệu | phân rã đồ, rương | cường hóa | sink cho đồ thừa |
| **Nguyên liệu hầm** (mỗi hầm 4–5 loại × tier) | vật liệu | rơi từ quái | chế tạo, thăng tier | giữ giá trị cho từng hầm |
| **Ấn Thăng Cấp** (theo tier) | vật liệu hiếm | boss hầm, elite | thăng tier | nút thắt tiến độ dài hạn |
| **Huy hiệu Arena / Điểm Boss** (v1.1) | token mùa | arena, world boss | shop mùa | reset hoặc chuyển đổi mỗi mùa |

**Quy tắc vàng**: mỗi nguồn phải có ít nhất một chỗ tiêu, và mỗi chỗ tiêu phải "đáng" tại thời điểm người chơi gặp nó. Theo dõi tỉ lệ `tổng nguồn / tổng tiêu` theo ngày tuổi tài khoản (dashboard ở 06 §6).

## 2. Công thức chỉ số

```
levelMult(L)  = 1 + 0.12·(L−1) + 0.004·(L−1)²          L1 ×1.00 · L10 ×2.40 · L20 ×4.72 · L30 ×7.84 · L40 ×11.76
heroStat      = classBase[stat] · rarityMult · levelMult(L) · (1 + personality%) · (1 + passive%)
              + potential (20% chỉ số trước lần thăng tier gần nhất)
              + Σ equip[stat] · (1 + quality%) · (1 + enhance%)
power (lực chiến) = HP·0.5 + (ATK+MATK)·2 + (DEF+MDEF)·1.5 + SPD·4 + CRIT%·8 + CRITDMG%·2
```

- So với fworldgm (× (1 + (L² + 19L)/200), tức L40 ×12.8): đầu game tăng nhanh hơn (L5 ×1.54 so với ×1.60), cuối game tương đương. Đường cong mượt hơn, không có bậc nhảy.
- `rarityMult` của ứng viên: Thường 1.00, Tinh anh 1.08, Hiếm 1.18, Huyền thoại 1.30.
- **Đã cài**: level reset về 1 khi thăng tier, nên `levelMult` dùng **cấp tổng** nối tiếp qua các tier: T1 Lv1–10 = L1–10, T2 Lv1–20 trải đều L10–20, T3 Lv1–30 trải đều L20–30 (T2 Lv1 ×2.40, T2 Lv20 ×4.72, T3 Lv30 ×7.84). Cấp tổng (1–30) cũng là `L_attacker` trong công thức sát thương và là thang cấp của quái (`recommended_level`). Chỉ số gốc class trong CSV giữ nguyên.

## 3. Công thức sát thương

```
mitigation = DEF / (DEF + K),  với K = 60 + 8 · L_attacker
dmg = ATK · skillPower · (1 − mitigation)
    · U(0.95, 1.05)                         dao động ±5%
    · (crit ? 1.5 + critDmg% : 1)           crit = 5% + CRIT%, cap 75%
    · elementMult (khắc hệ ×1.2 / ×0.85)
    · (1 + dmgBonus% − dmgReduce%)
dmg = max(1, round(dmg))
```

| ATK | DEF | Lv | Đề xuất (K/(K+DEF)) | fworldgm (A − D) |
|---|---|---|---|---|
| 20 | 10 | 1 | 17.4 | 10.0 |
| 20 | 40 | 1 | 12.6 | 1.8 |
| 80 | 160 | 10 | 37.3 | 7.3 |
| 400 | 1.200 | 40 | 96.2 | 25.0 |

DEF luôn có ích nhưng không tạo "bức tường" bất khả xâm phạm. K tăng theo level để tỉ lệ giảm sát thương ổn định qua các giai đoạn.

**Đã cài (công thức v2)**: hằng số nằm ở `packages/game-data/data/battle.json` (K = 60 + 8·L, dao động ±5%, crit gốc 5% (+5% họ tầm xa), crit ×1.5, cap 75%, làm tròn một lần ở cuối). Mỗi wave bắt đầu với 50% MP. Mỗi lượt chạy lưu kèm `formulaVersion`; lượt chạy cũ (không có version) vẫn replay bằng công thức v1 cũ để hash không đổi. Hệ số chỉ số quái theo từng hầm cũng nằm trong `battle.json` và được kiểm bằng test dải tỉ lệ thắng (`tools/sim/test/balance.test.ts`).

**Né / chính xác**: `dodge = clamp(5% + dodgeBonus − accuracyBonus − max(0, SPD_atk − SPD_def)/20 %, 0, 40%)`, boss tối đa 25%.

## 4. Nhịp tiến độ (pacing)

```
xpToNext(L, tier) = round((20 + 18 · L^1.7) · 1.6^(tier−1))
levelCap(tier)    = 10 · tier
waveXp(d, k)      = 8 · 2.1^(d−1) · (1 + 0.15·(k−1))        d = hầm, k = độ khó 1–10
waveGold(d, k)    = 12 · 2.3^(d−1) · (1 + 0.12·(k−1))
thời lượng wave   = 8 giây (online, tốc độ replay x1); offline hiệu suất 75%
```

| Tier | Level cap | EXP tích lũy tới cap | Hầm phù hợp (độ khó 3) | Thời gian farm online | Mục tiêu theo ngày tuổi |
|---|---|---|---|---|---|
| T1 | 10 | 3.083 | 1 | ~0,7 giờ (FTUE có quà EXP từ quest chính nên ~25 phút) | phút 20–30 |
| T2 | 20 | 33.035 | 2 | ~3,4 giờ | cuối D1 |
| T3 | 30 | 160.182 | 3 | ~7,8 giờ | D3 |
| T4 (v1.1) | 40 | 561.700 | 4 | ~13 giờ | D6–D7 |
| T5 (v1.1) | 50 | 1.649.993 | 5 | ~18 giờ | D12–D14 |

- Thời gian ở trên tính cho **một hero**. Cả đội 4 hero farm song song và nhiều đội chạy song song, nhưng nút thắt thực sự là **Ấn Thăng Cấp** (rơi từ boss hầm) và trang bị.
- Vàng/giờ online theo hầm (độ khó 1): 5,4K / 12,4K / 28,6K / 65,7K / 151K / 348K / 799K / 1,84M.
- **Cap offline 8 giờ**: người chơi 2 lần/ngày (sáng/tối) được ~16 giờ thu hoạch + 30–60 phút online.

**Mục tiêu nhịp mở khóa** (dùng để kiểm thử bằng sim):

| Mốc | Thời điểm |
|---|---|
| Đội 2 chạy song song | 6 phút |
| Chế tạo đồ đầu | 3 phút |
| Thăng T2 lần đầu | 20–30 phút |
| Hầm 2 | 30 phút |
| Đội 3 | D1 |
| Hầm 3 | D2 |
| Hầm 4 + cường hóa +5 | D4–D5 |
| Hết nội dung MVP (T3 cả đội, hầm 4 độ khó 5) | ~D10–D14, tức thời điểm phải có v1.1 |

## 5. Cường hóa trang bị

| Cấp | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 | +10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Tỉ lệ gốc | 100% | 95% | 90% | 80% | 70% | 60% | 50% | 45% | 40% | 35% |
| Bonus chỉ số | +6% | +12% | +19% | +27% | +36% | +46% | +57% | +69% | +82% | +100% |
| Thất bại | giữ cấp | giữ | giữ | giữ | giữ | −1 (không dưới +5) | −1 | −1 | −1 | −1 |

- **Pity**: mỗi lần thất bại +5% tỉ lệ cho lần sau, reset khi thành công. Hiển thị rõ "tỉ lệ hiện tại".
- Chi phí mỗi lần: `100 · 1.6^n` vàng + Bụi Rèn (+ Đá Rèn từ +6).
- **Đã cài (M1.7, số tạm cho closed beta)**: mỗi lần thử +1…+5 tốn thêm 1 / 2 / 3 / 4 / 5 Bụi Rèn, mất cả khi thất bại (giống vàng). Kỳ vọng tới +5: ~5,8 lần thử, ~1.969 vàng và ~18,3 Bụi Rèn. Bụi Rèn chỉ có từ **phân rã** trang bị: Thường 1 · Tinh xảo 2 · Hiếm 3 · Kiệt tác 5 mỗi món (không hoàn lại cấp cường hóa, không phân rã được đồ đang khóa hoặc đang mặc). Cấp Lò Rèn giới hạn mức cường hóa, xem §6.
- **Kỳ vọng số lần** (mô phỏng 20.000 lần): +5 ≈ 5,8 · +8 ≈ 17 · +10 ≈ **49**. So với fworldgm: +9 ≈ **3.621** (tỉ lệ 100 − 10n%, thất bại ≥ +6 về 0). Đây là khác biệt "công bằng" có thể dùng làm điểm marketing.

## 6. Công trình

| Lv → Lv+1 | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 | 7→8 | 8→9 | 9→10 |
|---|---|---|---|---|---|---|---|---|---|
| Sảnh Hội: vàng | 300 | 780 | 2.030 | 5.270 | 13.710 | 35.640 | 92.670 | 240.950 | 626.480 |
| Thời gian xây | 1 phút | 2 phút | 4 phút | 7 phút | 13 phút | 25 phút | 47 phút | 1,5 giờ | 2,8 giờ |

Công thức: `cost = 300 · 2.6^(L−1)`, `time = 60s · 1.9^(L−1)`. Quán/Kho/Lò Rèn dùng hệ số ×0.6 / ×0.5 / ×0.8 so với Sảnh, kèm nguyên liệu hầm tương ứng. Chỉ xây 1 công trình cùng lúc (thêm thợ xây thứ 2 qua thẻ tháng).

**Đã cài (M1.7)**: Sảnh Hội và Lò Rèn, bảng số nằm ở `packages/game-data/data/buildings.json`. Quán Rượu và Kho chưa có cấp.

| Lò Rèn Lv → Lv+1 | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 | 7→8 | 8→9 | 9→10 |
|---|---|---|---|---|---|---|---|---|---|
| Vàng (×0,8) | 240 | 624 | 1.624 | 4.216 | 10.968 | 28.512 | 74.136 | 192.760 | 501.184 |
| Thời gian (×0,8) | 48 giây | 1,5 phút | 3 phút | 5,5 phút | 10 phút | 20 phút | 38 phút | 1,2 giờ | 2,3 giờ |
| Nguyên liệu | 3 Đá Lửa | 8 Đá Lửa, 8 Vỏ Cây Gai | 10 Lõi Gỗ Đầm, 10 Sợi Cói Đầm Lầy | 20 Ngọc Ma Trơi, 20 Lõi Gỗ Đầm | 30 Bụi Mộ, 30 Mảnh Thánh Tích | 50 Tinh Thể Linh Hồn, 50 Lụa Liệm | 80 Quặng Đá Than, 80 Da Kỳ Nhông | 120 Thủy Tinh Rồng, 120 Mảnh Hắc Diện | 200 Mảnh Hắc Diện, 200 Thảo Dược Hoa Lửa |

| Cấp Lò Rèn | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Cường hóa tối đa | khóa | +2 | +3 | +4 | +5 | +5 | +5 | +5 | +5 | +5 |
| Chế tạo ra Thường | 70% | 67% | 64% | 61% | 58% | 55% | 52% | 49% | 46% | 43% |
| Tinh xảo | 25% | 27% | 29% | 31% | 33% | 35% | 37% | 39% | 41% | 43% |
| Hiếm | 4,5% | 5,3% | 6,1% | 6,9% | 7,7% | 8,5% | 9,3% | 10,1% | 10,9% | 11,7% |
| Kiệt tác | 0,5% | 0,7% | 0,9% | 1,1% | 1,3% | 1,5% | 1,7% | 1,9% | 2,1% | 2,3% |

- Vàng (và nguyên liệu của Lò Rèn) bị trừ ngay khi bấm nâng cấp; cấp mới chỉ có hiệu lực khi hết thời gian xây, tính theo đồng hồ server nên không cần mở tab. Sảnh Hội chỉ tốn vàng.
- Một thợ xây: đang xây công trình này thì chưa nâng được công trình khác.
- **Tăng tốc** bằng Đồng Hồ Cát Thợ Xây: mỗi cái bớt 5 phút, server không bao giờ dùng nhiều hơn số cần để xây xong. Nguồn tạm thời: boss của cả 4 hầm rơi 2% (≈9 cái sau một đêm 8 giờ với một đội hạ được boss, tức ~45 phút tăng tốc). Quest và sự kiện (M2) sẽ là nguồn chính.
- Tổng thời gian xây 1→10: Sảnh ~6 giờ, Lò Rèn ~4,8 giờ; lần dài nhất 2,8 giờ. Thứ chặn công trình vẫn là vàng (Sảnh ~1,02 triệu, Lò Rèn ~0,81 triệu), thời gian xây chỉ tạo nhịp quay lại.
- **Nhịp đội 2**: với 1.000 vàng khởi đầu và vàng thụ động hầm 1, Sảnh Lv3 (mở đội 2) xong sớm nhất ở phút ~3,1 nếu ưu tiên Sảnh (`sim:economy` → `buildings.teamTwo`), nằm trong mốc 6 phút ở §4. Vì vậy giữ nguyên mốc Lv1 / Lv3 / Lv6 / Lv9; quest chính (M2.1) cần dẫn người chơi nâng Sảnh hai lần trước.
- Cường hóa +5 cần Lò Rèn Lv5 (cộng dồn 6.704 vàng và ~11 phút xây), phù hợp mốc "cường hóa +5 ở D4–D5".

## 7. Tuyển mộ và gacha

| Độ hiếm ứng viên | Tỉ lệ | Pity |
|---|---|---|
| Thường | 70% | |
| Tinh anh | 25% | |
| Hiếm | 4,5% | bảo đảm sau 40 lượt refresh không ra Hiếm+ |
| Huyền thoại | 0,5% | bảo đảm sau 200 lượt; tỉ lệ tăng mềm từ lượt 150 |

- Refresh miễn phí mỗi 2 giờ (cấp quán giảm còn 1 giờ). Refresh thủ công bằng Thẻ Chiêu Mộ (quest/sự kiện/shop).
- Kỳ vọng không pity: 1 Hiếm+ / 20 lượt refresh. Chi phí quy đổi thẻ ↔ Ngọc định ở 06 §2.
- **Đã cài**: mỗi lượt refresh có 3 ứng viên; chỉ ứng viên 1 roll theo bảng trên kèm pity, ứng viên 2–3 chỉ ra Thường/Tinh anh (`tavern.json` `secondaryOfferRarityBps`). Có pity cứng ở lượt 40 nên tỉ lệ thực tế ≈ 1 Hiếm+ / 17,4 lượt (≈5,7%).
- Công bố tỉ lệ trong game (bắt buộc nếu lên App Store/Google Play; nên làm từ đầu).

## 8. Loot

| Bậc quái | Tỉ lệ xuất hiện | Rơi nguyên liệu | Ấn Thăng Cấp | Trang bị rơi thẳng |
|---|---|---|---|---|
| Thường | 85% | 35% × 1 | – | – |
| Tinh anh | 13% | 100% × 2 | 2% | – |
| Boss hầm (wave 6) | 100% mỗi 10 vòng | 100% × 5 | 25% | 3% (đồ hầm) |
| Boss hiếm (ngẫu nhiên) | 0,2% | 100% × 10 | 100% | 30% |

**Bảng đang cài (M1.4B, tạm thời cho closed beta)**: `packages/game-data/data/loot.json`. Tỉ lệ tính cho **mỗi lần hạ quái, cho từng loại nguyên liệu của hầm**, và boss có mặt ở mọi vòng:

| Bậc quái | Mỗi nguyên liệu của hầm | Ấn Thăng Cấp I (hầm 1–2) | Ấn Thăng Cấp II (hầm 3–4) |
|---|---|---|---|
| Thường (9 con mỗi vòng) | 2% × 1 | – | – |
| Tinh anh (1 con) | 15% × 1 | – | – |
| Boss (1 con) | 30% × 1–2 | 3% | 1,5% |

- Lý do lệch so với bảng thiết kế: bảng gốc cho ra quá nhiều nguyên liệu cho recipe hiện tại. Economy pass M1 cho thấy mức 0,5% / 5% / 10% khiến món craft đầu tiên mất ~9,8 phút thay vì mục tiêu 3 phút. Bảng đang cài dùng 2% / 15% / 30%, tương đương ~0,78 nguyên liệu mỗi loại mỗi vòng, ~351 mỗi loại sau cap offline 8 giờ và ~3,1 phút kỳ vọng để đủ nguyên liệu cho món craft đầu tiên.
- Ấn I hào phóng có chủ ý (~13 mỗi đêm khi đội đã hạ được boss), để level cap chứ không phải ấn là thứ chặn lần thăng T2 đầu tiên. Nút thắt ấn bắt đầu từ T2→T3.
- M1.7: boss của mọi hầm còn rơi **Đồng Hồ Cát Thợ Xây** 2% × 1 (vật phẩm tăng tốc xây, xem §6). Luật này nằm cuối bảng nên không làm đổi kết quả rơi của các nguyên liệu khác với cùng seed.
- Chỉ quái ở wave **thắng** mới rơi đồ, giống vàng và EXP. Mỗi vòng có seed riêng (`deriveCycleLootSeed`), nên chia nhỏ số lần nhận không làm đổi tổng.
- `tools/sim sim:economy` chạy trong CI để kiểm tra đồng thời gold/hour, nguyên liệu, ấn, thời gian craft và chi phí cường hóa. Economy pass M1 đã đưa gold/hour của 4 hầm về sát các target ở §4 và material rate về nhịp craft đầu ~3 phút.

Không giảm tỉ lệ rơi theo tier hầm như fworldgm (30% → 5%). Thay vào đó cân bằng bằng **giá trị nguyên liệu** và độ khó.

## 9. Idle/offline: giới hạn và chống lạm phát

- Cap 8 giờ, hiệu suất 75%. Vượt cap thì không cộng thêm (khuyến khích quay lại 2–3 lần/ngày).
- Phần thưởng offline tính bằng **giá trị kỳ vọng** từ tỉ lệ thắng mô phỏng mẫu (xem 04 §6), nên server không phải mô phỏng hàng nghìn wave.
- Theo dõi: vàng tồn kho trung vị theo ngày tuổi tài khoản. Nếu tăng quá nhanh thì thêm sink (công trình mới, cường hóa cao hơn, shop mùa).

## 10. Công cụ cân bằng (`tools/sim`, làm ở M0)

1. `sim battle`: chạy N trận giữa đội A và hầm B, xuất tỉ lệ thắng, số lượt, DPS từng hero (dùng chính `packages/game-core`).
2. `sim progression`: mô phỏng người chơi ảo (3 hồ sơ: casual 2 phiên/ngày, mid 4 phiên, hardcore 8 phiên) trong 30 ngày, xuất thời điểm đạt các mốc ở §4 và lượng tiền tệ tồn.
3. `sim upgrade` / `sim gacha`: Monte Carlo chi phí kỳ vọng và phân vị P50/P90/P99.
4. Chạy trong CI. Nếu mốc lệch > 20% so với mục tiêu thì cảnh báo (fail tùy chọn).
