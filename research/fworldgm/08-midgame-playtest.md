# 08: Chơi thử giữa game (tài khoản ~32 giờ tuổi, 2026-10-05)

Phiên chơi khoảng 40 phút bằng **tài khoản thật của chủ dự án** (tạo tối 03/10, lúc đo được ~32 giờ tuổi), điều khiển qua trình duyệt của chủ dự án. Mục tiêu: lấy **số liệu đo thực tế** ở giai đoạn giữa game mà đợt nghiên cứu đầu (tài khoản mới 20 phút + đọc bundle) chưa có. Không nạp tiền, không tiêu ⭐, không gửi chat, không đổi tên/mật khẩu. Tên người chơi khác không được ghi lại.

Nguồn số liệu: chữ hiển thị trên từng tab, bảng "Monsters" của từng hầm, và dữ liệu client tự lưu trong `localStorage` (save, nhật ký trận gần nhất, lịch sử rơi đồ). Bảng quái đầy đủ: [`data/monsters-ingame.csv`](data/monsters-ingame.csv) (128 dòng).

> Lưu ý: chủ dự án cũng chơi cùng lúc ở tab khác (đánh boss, đấu trường, leo tháp, thăng class), nên vài con số trong save thay đổi giữa các lần đọc. Các phép đo dưới đây lấy từ từng trận/từng báo cáo riêng lẻ nên không bị ảnh hưởng.

## 1. Tài khoản sau ~32 giờ (nhịp tiến triển thực tế)

| Mục | Giá trị |
|---|---|
| Guild | Lv7 (8/8 hero), nâng tiếp tốn **2.048.000** vàng (= 500 × 4⁶) |
| Tavern | Lv7 (8 ứng viên), nâng tiếp 409.600 vàng (= 100 × 4⁶); 12 lần refresh; 7/8 ứng viên là Swordfighter |
| Kho | Lv7 = **50 ô** (Lv1 = 20, +5 mỗi cấp) |
| Shop vàng | Lv4, nâng tiếp 1.000.000 vàng (= 1.000 × 10³); refresh 100 vàng, tự refresh 18 giờ |
| Hero | 7 hero **T4 Lv17–19** + 1 hero T2→T3 (đang kéo), tất cả mặc đồ chế tạo **T3** phẩm chất Thường/Trung/Tinh Anh, một món +1 |
| Vàng | ~232.000 |
| Nguyên liệu | T1–T3 mỗi loại 300–780; T4 mỗi loại 6–10 (đội chưa thắng nổi hầm 4) |
| Sách chuyển chức | T1 ×44, T2 ×14, T3 ×4 |
| Quest tuần | boss 23, arena 12, tavern 6, chế tạo 45, cường hóa 1 |
| Hầm đang farm | 3 đội: hầm 1 (2 hero), hầm 2 (3 hero), hầm 3 (3 hero); đội thứ 4 trống |

Ví dụ chỉ số (gốc + trang bị): tank Knight T4 Lv19 HP 1.643 · ATK 101+144 · DEF 88+227 · MDEF 51+79; pháp sư Pyromancer T4 Lv18 HP 832 · MATK 199+253 · DEF 35+326; xạ thủ Rifleman T4 Lv17 HP 973 · ATK 102+244 · SPD 106+7. EXP lên cấp khớp công thức ở [06 §3](06-mechanics.md): T4 Lv17 → 3.187, Lv18 → 3.888, Lv19 → 4.743; T3 Lv5 → 93; T2 Lv8 → 145.

**Tường độ khó**: đội T4 Lv17–19 đã thua 5 lần ở hầm 4 (Volcano Peak, quái Lv20–26), dù quét hầm 3 trong 4–6 lượt. Người chơi ở lại hầm 1–3 để farm vàng lên Guild Lv8.

## 2. Chiến đấu trong hầm (đo từ nhật ký trận)

### 2.1 Số quái và chỉ số quái

- Bảng "Monsters" trong game ghi: **1–5 quái mỗi wave (theo Lv đội) · Elite 10% · Leader 1% · Boss 0,01%**. Tài liệu cũ ghi "mỗi wave 2 quái" là thiếu: cả ba đội (kể cả đội 2 hero Lv17 + Lv9) đều gặp **4 quái**, mỗi họ quái của hầm một con.
- Chỉ số hiển thị = chỉ số gốc × **(1 + 0,1 × (Lv − 1))**. Kiểm chứng: Crystal Bat gốc HP 216, Lv10 → 410; Rock Golem gốc 420, Lv14 → 966; Wraith gốc 140, Lv7 → 224.
- Bậc quái: Elite = Lv+1, HP/ATK × 1,6; Leader = Lv+2, × 2,5; Boss = Lv+3, × 4 (rồi nhân tiếp hệ số cấp).
- Vàng theo bậc: × 1 / 1,4 / 2 / 3. EXP theo bậc: × 1 / 2 / 4 / 8.

| Hầm | Quái thường (Lv, HP) | Vàng mỗi con | EXP mỗi con |
|---|---|---|---|
| 1 Forest of Whispers | Lv1–7, HP 30–224 | 8–60 | 2–13 |
| 2 Crystal Caverns | Lv10–16, HP 410–966 | 30–85 | 4–10 |
| 3 Shadow Realm | Lv15–18, HP 1.050–1.862 | 60–130 | 5–10 |
| 4 Volcano Peak | Lv20–26, HP 1.916–4.019 | 90–200 | 5–12 |
| 5 Frozen Wastes | Lv25–28, HP 3.756–6.908 | 140–280 | 7–13 |
| 6 Ancient Ruins | Lv30–33, HP 7.644–14.034 | 200–400 | 9–15 |
| 7 Celestial Temple | Lv35–38, HP 10.735–19.053 | 300–560 | 10–18 |
| 8 Abyssal Void | Lv40–43, HP 14.545–22.904 | 400–840 | 11–21 |

Boss hiếm của hầm 8 (Abyssal Leviathan Lv45): HP 97.011 · ATK 5.270 · DEF 2.489, 1.500–2.400 vàng, 104–156 EXP.

### 2.2 Một wave thực tế

| Hầm | Đội | Số lượt | Thời gian wave | Vàng | EXP wave | EXP từng hero |
|---|---|---|---|---|---|---|
| 1 | Lv17 (T4) + Lv9 (T2) | 3 | 10,2–10,7 giây | 95–112 | 23–26 | 8–9 / 14–15 |
| 2 | 3 × Lv18 (T4) | 3–4 | 13,5–15,7 giây | 220–233 | 25–30 | 8–9 mỗi người |
| 3 | Lv19, Lv17–18, Lv17 (T4) | 4–6 | 18,7–24,7 giây | 365–387 | 29–30 | 12 / 13–14 / 14 |

- Thời gian wave phụ thuộc số lượt (khoảng 3,5–4,5 giây mỗi lượt), không cố định.
- Hero gây 200–1.100 sát thương mỗi đòn; quái đánh lại chỉ **1–24** (đòn vật lý vào DEF 300–500), riêng phép của Shadow Mage 84–142 (MDEF thấp). Đúng như nhận xét "DEF tạo tường" ở 06 §2.2.
- **EXP bị giảm khi hero vượt cấp hầm** (chưa có trong tài liệu cũ). Tỉ lệ EXP hero nhận / EXP wave: hầm 3 (Lv đề xuất 15): Lv17 → 47%, Lv18 → 45%, Lv19 → 40%; hầm 2 (Lv10): Lv18 → 30–32%; hầm 1 (Lv5): Lv17 → 35%, hero T3 Lv5 → 65%, hero T2 Lv8–9 → 54%. Giả thuyết: mỗi cấp vượt trừ khoảng 4–5%, có sàn quanh 30–35%; phần chia còn phụ thuộc số người trong đội. Cần đọc lại bundle để có công thức chính xác.
- Tốc độ lên cấp ở hầm 3: ~13 EXP/wave ≈ 2.100 EXP/giờ, tức Lv17 → 18 mất ~1,5 giờ, Lv19 → 20 mất ~2,4 giờ.

### 2.3 Offline

Báo cáo offline thực tế (vắng ~5,7 phút, "Idle: 5m · 45 fights"):

| Hầm | Thời gian | Wave | Giây/wave | Vàng | Rơi đồ |
|---|---|---|---|---|---|
| 1 (2 hero) | 335 giây | 29 | 11,6 | 3.035 | 51 nguyên liệu |
| 3 (3 hero) | 346 giây | 16 | 21,6 | 6.133 | 25 nguyên liệu |

Nhịp offline **bằng nhịp đánh thật của từng đội** (trường `runPace` trong save), không phải hằng số 18 giây × 0,8 như 06 §6 ghi. Offline gần như không bị phạt hiệu suất.

## 3. Rơi đồ thực tế

- Offline hầm 1: 51 món / 29 wave = **1,76 món mỗi wave** (4 quái). Hầm 3: 25 / 16 = 1,56. Khớp với "30% mỗi dòng loot ở hầm 1, giảm 3,57% mỗi tier hầm" cộng phần Elite rơi chắc.
- 100 lần rơi gần nhất mỗi hầm (lịch sử client lưu): mỗi hầm 5 loại nguyên liệu, phân bố khá đều (11–26 lần mỗi loại). Sách chuyển chức rơi lẫn trong đó: hầm 1 → sách T1 2/100, hầm 3 → sách T3 1/100. Không có lần nào rơi ×5 hay ×10 (Leader/Boss) trong 300 lần.
- Không có trang bị rơi trực tiếp, đúng như 06 §2.3.

## 4. Kinh tế

**Vàng/giờ đo được** (3 đội, 8 hero): hầm 1 ~33–36K, hầm 2 ~52–60K, hầm 3 ~62–64K, tổng **~150–160K vàng/giờ**. Vàng thụ động của guild (720/giờ) không đáng kể. Với nhịp này Guild Lv8 (2,05 triệu) cần ~14 giờ farm.

**Chế tạo rồi bán** (thử 46 món Oak Staff T1, mỗi món 4 Ghost Essence, không tốn vàng):

| Phẩm chất | Tỉ lệ ghi trong game | Ra thực tế (46) | Giá bán |
|---|---|---|---|
| Thường +0% | 50% | 23 | 80 |
| Trung +10% | 40% | 20 | 160 |
| Tinh Anh +20% | 9% | 3 | 240 |
| Cao Cấp +30% | 0,9% | 0 | – |
| Siêu Cấp +40% | 0,09% | 0 | – |
| Thần Cấp +60% | 0,009% | 0 | – |

- Giá bán nhân theo phẩm chất (×1 / ×2 / ×3). 184 nguyên liệu T1 → 5.760 vàng, tức **~31 vàng mỗi nguyên liệu T1**. Một wave hầm 1 cho ~105 vàng + ~1,76 nguyên liệu (~55 vàng nếu chế rồi bán): chế tạo là nguồn vàng phụ đáng kể.
- Tỉ lệ hai bậc cao nhất trong game (0,09% / 0,009%) cao gấp 10 và 90 lần con số đọc từ bundle cũ (0,009% / 0,0001%).
- Số lượng chế tối đa mỗi lần = số ô kho còn trống. Auto-sell không áp dụng cho đồ tự chế.
- Công thức T1: mỗi món 4–13 đơn vị của **một** loại nguyên liệu (vài món 2 loại).

**Bán nguyên liệu trực tiếp**: nguyên liệu T4 (Infernal Dragon Scale) bán 500 vàng/cái. EXP Orb (Lesser) 50 vàng, EXP Orb (Supreme) 400 vàng.

**Shop vàng Lv4** (9 ô, mỗi ô 1 nguyên liệu ngẫu nhiên tới tier 4): T1 9 vàng · T2 39–88 · T3 118–154 · T4 264–350. Giá mua T4 thấp hơn giá bán 500 của một nguyên liệu T4 khác; chưa kiểm tra được hai loại đã mua có bán lại cao hơn giá mua không. Chủ tài khoản từng refresh shop 52 lần trong một ngày, cho thấy shop là nguồn nguyên liệu tier cao khi chưa thắng được hầm.

## 5. World Boss

| Tier | Boss | HP tối đa (đời hiện tại) | Đời | Ghi chú |
|---|---|---|---|---|
| T1 | Ancient Treant | 164,4 triệu | 26 | HP tăng dần theo đời (03/10 là ~112 triệu) |
| T2 | Crystal Dragon Lord | 174,9 triệu | 12 | |
| T3 | Nightmare Fiend | 226,7 triệu | 4 | |
| T4 | Magma Archon | 450 triệu | 1 | chưa từng bị hạ |
| T5–T8 | Elder Frost Dragon … Void Sovereign | 1,2 tỉ / 3 tỉ / 7,5 tỉ / 18 tỉ | 1 | khóa tới khi boss trước bị hạ |

Một lượt đánh T1 (toàn bộ **8 hero** cùng vào, không chọn đội):

- Boss miễn khống chế, mỗi lượt **tự tăng ATK/MATK 20% (cộng dồn)**: lượt 14 ATK 1.618, lượt 15 ATK 1.942. Trận kết thúc khi cả đội chết, ở đây là **lượt 15**.
- Sát thương đội mỗi lượt 2.500–7.100, tổng **59.862**. Thưởng ngay: **2.993 vàng (= 5% sát thương)** + 1 Participation Chest.
- Bảng xếp hạng chu kỳ trước: top 1 boss T2 ~700K, T3 ~226K, T4 ~155K sát thương mỗi lượt. Một người chơi top gây chưa tới 0,5% HP boss mỗi chu kỳ 2 giờ, nên boss T4 trở lên là mục tiêu dài ngày của cả server.

## 6. Đấu trường (mùa 3)

- Mùa 7 ngày. Điểm khởi đầu 1.000; **thắng +10, thua −5**. 5 lượt, hồi 1 lượt mỗi 2 giờ. 10 đối thủ gợi ý quanh điểm của mình, có nút Refresh.
- Thưởng mùa: #1 50⭐ + 3 Boss Slayer Chest + 10 đá cường hóa · #2–3 30⭐ + 2 + 6 · #4–9 20⭐ + 1 + 4 · #10–25 10⭐ + 3 Participation Chest + 2 đá · #26–50 5⭐ + 2 + 1 · đánh ≥ 5 trận: 1 Participation Chest.
- Bảng xếp hạng chỉ có ~40 người có điểm; hạng 25 ở mức 990 điểm với 1 thắng 4 thua, tức ⭐ miễn phí khá dễ lấy.

## 7. Tháp Vô Tận (tính năng mới, chưa có trong tài liệu cũ)

- Tab thứ 7 ở thanh dưới. **Phòng 4 người chơi, mỗi người góp 1 hero**, leo tới khi cả đội chết; 2 lượt mỗi ngày. Có danh sách phòng mở, bảng xếp hạng, replay từng tầng.
- Một lượt thực tế (2 hero: Shieldbearer T4 Lv18 + hero Lv2 của người khác): tới **tầng 13**, chết ở tầng 14 (2 Crystal Bat, 35 lượt). Tầng 1 là 1 Slime Jr; quái mạnh dần theo thứ tự các hầm.
- Chiến lợi phẩm: 25 EXP Orb (Lesser) + 5 Greater + 1 Supreme, vài nguyên liệu T1, +215 EXP.
- **EXP Orb** là vật phẩm dùng lên một hero: Lesser +100 EXP, Supreme +5.000 EXP (Greater chưa xem).
- Gắn với nạp tiền: sự kiện "Endless Tower" tặng **Sky Tower Permit** theo mốc nạp (xem §8).

## 8. LiveOps và nạp tiền (chỉ xem, không nạp)

- **Mốc nạp tích lũy** (cập nhật): 1⭐ → 5 Sách làm mới tavern · 100⭐ → +5 đá cường hóa · 200⭐ → sách chuyển chức T2+T3+T4 · 500⭐ → 5 Mảnh Thần Vị + 5 + 5 · 1.000⭐ → thêm 1 **Heart of Baragos** · 2.000⭐ → 2 · 5.000⭐ → 10 Mảnh Thần Vị, 20 + 20, sách T3–T7, 3 Heart of Baragos.
- **Sự kiện Endless Tower** (tính nạp từ 04/10): 1⭐ → +10⭐ · 100 → +50 · 300 → +100 và 2 Sky Tower Permit · 500 → +100 và 2 · 1.000 / 1.500 / 2.500 → +250 và 2 mỗi mốc. Ví dụ trong game: nạp 300 nhận 460⭐.
- **Compensation** (cùng kỳ): 300 / 500 / 1.000 / 1.500 / 2.500⭐ → 1 / 2 / 3 / 4 / 5 Heart of Baragos (mốc cuối thêm 250⭐).
- **Lật thẻ** (từ 02/10): 100 / 250 / 500 / 1.000 / 2.000⭐ → 1 / 1 / 1 / 2 / 3 thẻ.
- Star Shop không đổi so với 07 (sách T4–T7 3/9/27/243⭐, đá cường hóa 5⭐, trứng 100⭐…).
- Quest ngày và tuần reset cùng một giờ; thưởng mốc như 06 §7.
- Không có thông báo mới sau 29/09, dù game đã thêm Tháp Vô Tận và EXP Orb: cập nhật không còn được ghi đầy đủ ở mục thông báo.

## 9. Điểm cần sửa trong tài liệu cũ

| Tài liệu cũ | Thực tế đo được |
|---|---|
| 06 §2: mỗi wave 2 quái | 1–5 quái theo Lv đội; đội Lv17+ gặp 4 |
| 04 §3: chỉ số quái là số gốc | chỉ số thật = gốc × (1 + 0,1 × (Lv − 1)) |
| 06 §2.3: mọi hero nhận cùng EXP | EXP giảm theo mức vượt cấp hầm |
| 06 §4: tỉ lệ Siêu Cấp / Thần Cấp 0,009% / 0,0001% | game ghi 0,09% / 0,009% |
| 06 §6: offline 18 giây/wave × 0,8 | offline chạy theo nhịp thật của từng đội |
| 06 §7: boss đánh "từ đầy máu tới chết" | đúng, nhưng do boss tự tăng 20% ATK mỗi lượt; cả 8 hero cùng đánh; vàng = 5% sát thương |
| 07: 9 tab | 10 tab (thêm Tháp Vô Tận) |

## 10. Bài học cho game của mình

- **Bảng quái minh bạch** ngay trong hầm (chỉ số, vàng, EXP, tỉ lệ bậc hiếm) rẻ để làm và giúp người chơi tự lên kế hoạch. Game mình đã có catalog, chỉ thiếu màn hiển thị.
- **Giảm EXP khi vượt cấp hầm** đẩy người chơi lên hầm khó hơn thay vì farm hầm dễ. Game mình hiện chưa có lực đẩy này ngoài việc mở khóa hầm.
- **Boss tự mạnh dần** là cách kết thúc trận boss không cần giới hạn lượt cứng, và thưởng theo sát thương luôn có ý nghĩa.
- **Tháp co-op mỗi người một hero** tạo tương tác xã hội rẻ (không cần realtime): đáng cân nhắc cho v1.1 thay vì chỉ có world boss.
- **Cẩn thận vòng lặp chế tạo → bán**: ở fworldgm nguyên liệu dư biến thành vàng với tỉ giá tốt và phẩm chất nhân giá bán ×2–×3. Game mình đã có auto-sell và phân rã; cần giữ giá bán đồ chế thấp hơn giá trị nguyên liệu.
- **Tường độ khó giữa hầm 3 và 4** (DEF kiểu trừ thẳng) khiến người chơi kẹt hàng chục giờ: xác nhận lại lựa chọn công thức `A × K/(K + D)` của mình.

## 11. Những gì đã làm trên tài khoản và chưa thử

Đã làm: đánh world boss T1 (và có thể T2) một lượt; chế 46 Oak Staff rồi bán hết (+5.760 vàng, −184 Ghost Essence); refresh shop vàng 1 lần (100 vàng) và mua 2 nguyên liệu T4 (614 vàng); vô tình bấm Start cho đội đang chờ ở hầm 2 (đội chạy farm bình thường).

Chưa thử: cường hóa, khắc rune, thăng class, pet (tài khoản chưa có), mở rương, tuyển hero (guild đang đầy), tự leo tháp, đánh arena (hết lượt). Công thức chính xác của số quái theo Lv đội và của mức giảm EXP cần đọc lại bundle mới.
