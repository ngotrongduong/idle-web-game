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
- **Kỳ vọng số lần** (mô phỏng 20.000 lần): +5 ≈ 5,8 · +8 ≈ 17 · +10 ≈ **49**. So với fworldgm: +9 ≈ **3.621** (tỉ lệ 100 − 10n%, thất bại ≥ +6 về 0). Đây là khác biệt "công bằng" có thể dùng làm điểm marketing.

## 6. Công trình

| Lv → Lv+1 | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 | 7→8 | 8→9 | 9→10 |
|---|---|---|---|---|---|---|---|---|---|
| Sảnh Hội: vàng | 300 | 780 | 2.030 | 5.270 | 13.710 | 35.640 | 92.670 | 240.950 | 626.480 |
| Thời gian xây | 1 phút | 2 phút | 4 phút | 7 phút | 13 phút | 25 phút | 47 phút | 1,5 giờ | 2,8 giờ |

Công thức: `cost = 300 · 2.6^(L−1)`, `time = 60s · 1.9^(L−1)`. Quán/Kho/Lò Rèn dùng hệ số ×0.6 / ×0.5 / ×0.8 so với Sảnh, kèm nguyên liệu hầm tương ứng. Chỉ xây 1 công trình cùng lúc (thêm thợ xây thứ 2 qua thẻ tháng).

## 7. Tuyển mộ và gacha

| Độ hiếm ứng viên | Tỉ lệ | Pity |
|---|---|---|
| Thường | 70% | |
| Tinh anh | 25% | |
| Hiếm | 4,5% | bảo đảm sau 40 lượt refresh không ra Hiếm+ |
| Huyền thoại | 0,5% | bảo đảm sau 200 lượt; tỉ lệ tăng mềm từ lượt 150 |

- Refresh miễn phí mỗi 2 giờ (cấp quán giảm còn 1 giờ). Refresh thủ công bằng Thẻ Chiêu Mộ (quest/sự kiện/shop).
- Kỳ vọng không pity: 1 Hiếm+ / 20 lượt refresh. Chi phí quy đổi thẻ ↔ Ngọc định ở 06 §2.
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
| Thường (9 con mỗi vòng) | 0,5% × 1 | – | – |
| Tinh anh (1 con) | 5% × 1 | – | – |
| Boss (1 con) | 10% × 1–2 | 3% | 1,5% |

- Lý do lệch so với bảng thiết kế: bảng gốc cho ra ~5–6 nguyên liệu mỗi vòng (~1.700 mỗi loại sau một đêm 8 giờ), trong khi công thức hiện có chỉ cần 3–6 nguyên liệu. Bảng đang cài cho ~110 mỗi loại sau một đêm.
- Ấn I hào phóng có chủ ý (~13 mỗi đêm khi đội đã hạ được boss), để level cap chứ không phải ấn là thứ chặn lần thăng T2 đầu tiên. Nút thắt ấn bắt đầu từ T2→T3.
- Chỉ quái ở wave **thắng** mới rơi đồ, giống vàng và EXP. Mỗi vòng có seed riêng (`deriveCycleLootSeed`), nên chia nhỏ số lần nhận không làm đổi tổng.
- Cần một lượt cân bằng bằng `tools/sim` cho vàng, nguyên liệu và ấn cùng lúc trước khi mở chế tạo (M1.5).

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
