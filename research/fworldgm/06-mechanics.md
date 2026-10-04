# 06: Cơ chế và công thức của fworldgm (giải mã từ bundle)

Nguồn: `raw/static/bundle.pretty.js` (đã giải mã chuỗi), kiểm chứng chéo bằng cách gọi trực tiếp hàm công thức (`formulas.json`) và đối chiếu số liệu thật trên tài khoản test. Ví dụ: Kiếm Sĩ Lv1 có HP 120 × 1.1 = 132, đúng với UI.

> **Cập nhật 2026-10-05**: phiên chơi thử giữa game ([08](08-midgame-playtest.md)) cho thấy vài điểm dưới đây đã lỗi thời hoặc thiếu: số quái mỗi wave (1–5 theo Lv đội, không cố định 2), chỉ số quái nhân theo cấp, EXP giảm khi hero vượt cấp hầm, nhịp offline theo nhịp thật của đội, tỉ lệ phẩm chất hai bậc cao nhất, cơ chế world boss tự mạnh dần. Xem bảng đối chiếu ở 08 §9.
>
> Đây là tài liệu tham khảo để hiểu **cách một idle guild RPG cân bằng số**. Game của mình sẽ tự thiết kế công thức (xem `docs/03-economy-balancing.md`).

## 1. Pipeline tính chỉ số một nhà thám hiểm (`effectiveStats`)

```
base   = class.baseStats                                  (theo class + tier)
base  *= 1 + t8BonusLevel/100                             (chỉ T8, trừ mp/crit/critDmg/int)
base  ← tính cách: +boostPercent% cho 1 chỉ số, −reducePercent% các chỉ số khác (crit/critDmg/int cộng thẳng)
base  ← nội tại class: +percent% theo từng stat
base  ← nội tại bản nguyên (essence, T8)
base  *= levelMult(L) = 1 + (L² + 19·L) / 200             (trừ mp/crit/critDmg/int)
equip  = Σ 4 slot: item.stats × (1 + quality%) × (1 + upgradeBonus(+N)%)   [+ engrave: ×(1+pct%) cho 1 stat]
final  = base + equip
final *= rune set bonuses (atkPct, matkPct, defPct, mdefPct, hpPct)
```

- `levelMult`: L1 = 1.10, L5 = 1.60, L10 = 2.45, L20 = 4.90, L30 = 8.35, L40 = 12.80. Chỉ số gốc tăng gần **bậc 2 theo level**. Trường `growth` trong dữ liệu class không còn được dùng trong pipeline này (dữ liệu thừa).
- `upgradeBonus(n) = 7n + n(n+1)/2` (%): +1 = 8%, +3 = 27%, +5 = 50%, +7 = 77%, +9 = 108%.
- Phẩm chất `quality`: normal +0%, medium +10%, fine +20%, high +30%, super +40%, divine +60%.
- Item mã hóa thành chuỗi: `itemId@quality@+N@tT@rCT…` (quality, cấp cường hóa, tier chế tạo, rune cột C bậc T).

## 2. Vòng lặp chiến đấu (`simulateWave`)

- Hai phe: tối đa 4 đồng minh, mỗi wave 2 quái (hầm ngục) hoặc boss (world boss).
- Đầu trận: kích hoạt **đội hình** (formation) nếu đủ combo class/nhánh, buff thành viên (+% stat, +MP đầu trận). Một số nội tại làm chậm địch ngay khi bắt đầu.
- **Mỗi lượt**: sắp xếp mọi đơn vị còn sống theo (a) ai có `ultFirst` và đầy MP thì đi trước, (b) **SPD hiệu dụng** giảm dần. Đơn vị bị đóng băng thì mất lượt.
- **MP**: tối đa 100, +10 mỗi lượt (thêm từ trang bị/tính cách/nội tại), +5 khi trúng đòn (`MP_ON_HIT`). Đầy 100 thì **tự tung ULT**.
- Buff/debuff có `duration` (lượt), giảm 1 sau mỗi lượt. Trong cùng một stat, lấy buff lớn nhất và debuff lớn nhất chứ không cộng dồn.
- **Giới hạn 1.000 lượt**: quá giới hạn thì cả đội bị coi là thua.
- Thua: đội "nghỉ" `REST_DURATION_MS` = 5 phút rồi tự hồi phục.

### 2.1 Chọn mục tiêu

- Mặc định: ngẫu nhiên một địch còn sống. Class có `focusLowestHp` (sát thủ) đánh địch ít HP nhất.
- AI quái: 30% đánh đồng minh có %HP thấp nhất, 70% ngẫu nhiên. Có cơ chế khiêu khích (taunt) và che chắn đồng đội (coverAlly).
- ⚠ Hàm chọn mục tiêu dùng `Math.random()` chứ không dùng RNG có seed của trận, nên **replay không tái tạo được** từ seed.

### 2.2 Công thức trúng đòn và sát thương (`computeHit`)

```
1. Né:      dodge = 10% + dodgeBonus% − (accuracyBonus + max(0, (SPD_atk − SPD_def)/10))%
            (vs boss: dodge ≤ 50%);   nếu rng < dodge → trượt
2. Khiên:   đòn phép hoặc tầm xa vào mục tiêu có rangedShield > 0 → chặn hoàn toàn, rangedShield −1
3. Gốc:     A = ATK (vật lý) hoặc MATK (phép);  D = DEF hoặc MDEF
            dmg = (bỏ qua giáp hoặc D ≤ 0) ? A
                : A > D ? A − D
                : A × (1 − D / (D + A/5))
4. Dao động: dmg ×= 0.9 + 0.2 × rng                        (±10%)
5. Chí mạng: P = 10% + CRIT%  (không giới hạn trên) → dmg ×= 2 + critDmg/100
6. Cuồng nộ: dmg ×= 1 + (%HP đã mất × rageDmg)/100          (nếu có rageDmg)
7. Đỡ đòn:   P = min(30%, 5% + 0.1% × D) → dmg ×= 0.5
8. Bonus:    × (1 + physDmgBonus% | magDmgBonus%) × (1 + dmgTakenPct% của mục tiêu)
9. Khắc hệ:  × 1.25 (mình khắc địch) | × 0.85 (bị khắc) | × 1
10. Kỹ năng: × power của đòn (đánh thường 1.0; ULT 1.2–1.5+, nhiều hit)
11. Kết quả: max(1, round(dmg))
```

Vòng khắc chế 8 họ: Kiếm Sĩ → Sát Thủ → Pháp Sư → Triệu Hồi → Cuồng Bạo → Cung Thủ → Đạo Sĩ → Saiya → Kiếm Sĩ.

Nhận xét: công thức "A − D nếu A > D, ngược lại giảm theo tỉ lệ" khiến **DEF cực mạnh ở giai đoạn đầu** và chênh lệch chỉ số tạo hiệu ứng "tường" (không gây được sát thương đáng kể). Thiết kế của mình nên dùng dạng `A × K/(K + D)` để mượt hơn.

### 2.3 Phần thưởng mỗi wave

- Vàng = Σ `randInt(goldReward[min], goldReward[max])` theo từng quái.
- XP (mỗi nhà thám hiểm) = Σ `floor(randInt(xpReward)/10)`.
- Rơi đồ: chỉ **nguyên liệu (`mat_*`) và sách class (`class_scroll_*`)** trong loot table của quái. Trang bị không rơi trực tiếp khi farm mà phải **chế tạo**.

| Bậc quái | Xác suất xuất hiện | Tỉ lệ rơi mỗi dòng loot | Số lượng |
|---|---|---|---|
| normal | 89% | 30% − 3.57% × (tier hầm − 1) (hầm 8: 5%) | 1 |
| elite | 10% | 100% | 1 |
| leader | 0.99% | 100% | 5 |
| boss | 0.01% | 100% | 10 |

## 3. Tiến triển nhân vật

- **EXP lên cấp**: `base = L ≤ 40 ? 32 × 1.22^(L−1) : 74.676 × 1.08^(L−40)` × hệ số dải level (0.97 / 2.55 / 2.67 / 3.56 / 4.56 / 5.88 / 7.8 cho ≤9 / ≤14 / ≤19 / ≤24 / ≤29 / ≤34 / ≥35) × `(30 + 6 × (tier − 1)) / 31`. Hệ số nhảy bậc ở L10/15/20… trùng với các mốc level cap.
- **Level cap** = 5 × tier (T1: 5, T2: 10, …, T6: 30); T7–T8 không giới hạn.
- **Thăng tier** (`change_class`): đạt level cap → chọn nhánh (tier n có n nhánh) → **level reset về 1**, cần sách chuyển chức đúng tier (gộp 4 sách tier n = 1 sách tier n+1). T8 cần thêm **bản nguyên** (100 × mỗi loại trong 5 nguyên liệu của một hầm + 1 Thần vị = 15 mảnh), thưởng một nội tại mạnh và vòng aura.
- **Tính cách** (8 loại): +15% một chỉ số, −5% các chỉ số khác. Có thể reroll.
- **Pet**: nở từ trứng (100⭐ hoặc rơi ở hầm 1–4), roll loại theo trọng số (DEF/MDEF 20, SPD 15, ATK/MATK/CRIT/CRITDMG 10, EXP 5). Cho ăn để lên level, mỗi level +1 chỉ số tương ứng (CRIT +0.5). Nuốt pet khác: pet giữ lại nhận 1.000 EXP + 90% tổng EXP của pet bị nuốt.

## 4. Trang bị: chế tạo và cường hóa

- **Chế tạo**: công thức cố định 2–3 loại nguyên liệu. Phẩm chất roll theo `QUALITY_INFO.chance`: 50% / 40% / 9% / 0.9% / 0.009% / 0.0001%. Tier chế tạo theo nguyên liệu (8 tier, mỗi tier thêm `TIER_RARITY_BONUS` 10–50%).
- **Cường hóa** +1…+9 bằng Đá cường hóa (Star Shop 5⭐):

| Cấp mục tiêu | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 |
|---|---|---|---|---|---|---|---|---|---|
| Tỉ lệ thành công | 90% | 80% | 70% | 60% | 50% | 40% | 30% | 20% | 10% |
| Bonus chỉ số | +8% | +17% | +27% | +38% | +50% | +63% | +77% | +92% | +108% |

  Khi thất bại (`upgradeFailLevel`): đang < +3 thì giữ nguyên; +3…+5 thì **tụt 1 cấp**; ≥ +6 thì **về +0**. Kỳ vọng số đá để từ +0 lên +9 rất lớn, là **sink chính cho tiền nạp**.
- **Rune** (4 loại × 4 bậc): khắc vĩnh viễn +% một chỉ số ngẫu nhiên (10–15% / 15–25% / 25–35% / 30–40% theo bậc). Mặc 2/3/4 món cùng loại cùng bậc để kích hoạt bộ.
- Auto-sell: mặc định bán item phẩm chất "normal".

## 5. Guild, tavern, shop

| Công trình | Hiệu ứng | Chi phí nâng từ cấp L |
|---|---|---|
| Guild | số nhà thám hiểm tối đa = L + 1 | 500 × 4^(L−1) vàng |
| Tavern | số ứng viên = L + 1; refresh tự động mỗi 2 giờ | 100 × 4^(L−1) |
| Kho (warehouse) | sức chứa item (Lv1 = 20 ô); kho lớn hơn mở công thức mạnh hơn | 100 × 4^(L−1) |
| Shop | cấp shop vàng (mặt hàng tốt hơn), refresh 100 vàng | 1.000 × 10^(L−1) |

- Recruit: phí khởi đầu 50 vàng. Ứng viên có class (8 họ T1), tính cách, chỉ số riêng. **Pity**: mỗi lần refresh tích điểm cho class hiếm; khi đã nhận class hiếm đó thì điểm chuyển sang các class hiếm còn lại (mỗi class chỉ một lần).
- Vàng thụ động của guild: 0,2 vàng/giây (~720/giờ), tính cả khi offline.

## 6. Idle / offline

- Mỗi đội gắn với một hầm ngục và chạy wave liên tục. Khi online, client gọi `run_dungeon` cho từng wave (~4–6 giây/wave). Khi offline, server tính theo `OFFLINE_WAVE_DURATION_SEC = 18` giây/wave × `OFFLINE_EFFICIENCY = 0.8`, chỉ khi vắng ≥ `MIN_OFFLINE_SEC = 120` giây.
- `runPace` và `lastClaimAt` lưu trong save để server ngoại suy số wave đã đánh. Phần thưởng gom vào `pendingRewardsByDungeon` và `offlineReports`, người chơi nhận bằng `claim_dungeon_rewards`.
- Thông báo hiển thị "farm XP/vàng/nguyên liệu kể cả khi offline". Không thấy giới hạn số giờ offline trong client, có thể nằm ở server.

## 7. Nội dung xã hội / cạnh tranh

- **World boss**: mỗi hầm ngục có một boss, HP chung toàn server (T1 ~112 triệu, T2 ~139 triệu, T3 ~194 triệu HP). Hồi sinh ở mốc 2 giờ kế tiếp, mỗi người **một lượt đánh tính hạng mỗi boss mỗi chu kỳ**. Người kết liễu nhận Kill Chest + sao; mọi người tham gia nhận Participation Chest (1–2⭐, 0–1 đá cường hóa, 50% một mảnh Thần vị); top sát thương có thưởng. ⚠ Guide trong game ghi "chu kỳ 12 giờ" nhưng UI ghi "2 giờ", tức là nội dung hướng dẫn đã lỗi thời.
- **Arena**: mùa ngắn (mùa 2 bắt đầu khoảng 2–3 ngày sau ngày mở game), điểm khởi đầu 1.000, 5 lượt tấn công (hồi theo thời gian), đối thủ gợi ý có điểm gần mình, trận đánh mô phỏng trên server với **đội phòng thủ** (4 người đầu hoặc đội PvP tự chọn) + pet PvP. Bảng xếp hạng hiện W/L tấn công và phòng thủ.
- **Quest**: 5 task ngày (chế tạo, cường hóa, đánh arena, đánh world boss, refresh tavern) mỗi task 1 lần; tuần là 10 lần. Mốc thưởng 1–5: sách T1, sách làm mới, đá cường hóa, 1⭐, sách làm mới (tuần ×3).
