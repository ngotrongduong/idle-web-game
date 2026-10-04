# 02: Game Design Document (GDD)

> Tên dự án tạm: **Project Guildhall**. Tên thương mại sẽ chọn sau khi tra trùng nhãn hiệu (xem [08 §2](08-legal-risks.md)).
> Phiên bản tài liệu 0.1. Mọi con số là **đề xuất ban đầu**, sẽ được cân bằng lại bằng công cụ mô phỏng (`tools/sim`) và dữ liệu closed beta.

## 1. Tầm nhìn

**Một câu**: *Làm chủ một hội quán mạo hiểm giả: chiêu mộ, huấn luyện và gửi các đội anh hùng chinh phục hầm ngục, kể cả khi bạn đang ngủ.*

| Trụ cột | Ý nghĩa | Kiểm chứng |
|---|---|---|
| **Quyết định của người quản lý** | Giá trị nằm ở xếp đội, chọn nhánh class, phân bổ tài nguyên, không phải ở bấm nhanh | Mỗi phiên 5 phút có ít nhất 1 quyết định có ý nghĩa |
| **Tiến triển luôn chạy** | Online hay offline đều có thu hoạch; quay lại luôn có thứ để nhận và nâng cấp | 100% phiên quay lại có "báo cáo vắng mặt" kèm phần thưởng |
| **Công bằng và minh bạch** | Công bố tỉ lệ, công thức; trả tiền để nhanh hơn chứ không phải để thắng tuyệt đối | Người không nạp vẫn top 30% arena nếu chơi đều |
| **Cộng đồng nhỏ mà ấm** | World boss chung, arena mùa ngắn, chat, bang hội | ≥ 30% DAU tham gia world boss mỗi ngày |

**Đối tượng**: người chơi Việt Nam 18–35 tuổi, chơi trên điện thoại trong giờ nghỉ hoặc trên đường đi (3–6 phiên/ngày × 3–10 phút), thích RPG/gacha nhưng chán P2W nặng; phụ: người chơi idle quốc tế (bản EN).

**Nền tảng**: Web mobile-first (PWA, cài được lên màn hình chính). Sau MVP có thể đóng gói Android/iOS bằng Capacitor.

**Khác biệt so với fworldgm**: xem [01 §4–6](01-teardown-fworldgm.md#4-nên-học-adopt). Tóm tắt: onboarding và quest chính tốt hơn, art thống nhất, cường hóa không "lừa", hiệu năng mobile, IP gốc, pháp lý sạch.

## 2. Bối cảnh và IP (gốc)

- **Đã chốt: high fantasy phương Tây.** Thế giới (tên tạm) là một vương quốc trung cổ với các dải hầm ngục xuất hiện sau một "vết nứt trời": rừng gai, đầm lầy sương mù, tu viện chìm, vách núi của rồng lửa.
- Quái và boss dùng các motif fantasy phổ biến thuộc phạm vi công cộng (goblin, người thằn lằn, phù thủy đầm lầy, lich, wyrm…), kết hợp class fantasy quen thuộc. Phải là thiết kế gốc, **không** dùng tên hay hình tượng thuộc IP của người khác.
- Nội dung MVP hiện có: Rừng Gai Thornwood, Đầm Lầy Sương Mù (Mistmoor), Tu Viện Chìm (Sunken Abbey), Vách Đá Lửa Rồng (Dragonfire Crags). Id trong dữ liệu (`bamboo_grove`, `sunken_shrine`…) là định danh nội bộ cũ, giữ lại để không vỡ replay, không bao giờ hiển thị cho người chơi.
- Giọng văn: hài hước nhẹ, ngắn gọn (idle game không cần cốt truyện dài). Mỗi hầm có 1 đoạn lore 2–3 câu, mỗi boss 1 câu thoại.

## 3. Core loop

```
        ┌───────────────────────────────────────────────────────────────┐
        ▼                                                               │
  [Tuyển mộ] ─► [Xếp đội 4 + pet] ─► [Gửi vào hầm] ─► (auto-battle, online/offline)
                                                        │
                                       vàng, EXP, nguyên liệu, sách class
                                                        ▼
  [Thăng tier / chọn nhánh] ◄─ [Lên cấp] ◄─ [Chế tạo, cường hóa, khắc rune] ◄─┘
        │
        └─► mở hầm khó hơn, đánh boss hầm, world boss, arena ──► phần thưởng hiếm
```

| Vòng | Thời lượng | Hành động |
|---|---|---|
| Vi mô | 10–60 giây | xem replay, nhận thưởng wave, bấm "nhận tất cả" |
| Phiên | 3–10 phút | nhận báo cáo vắng mặt → chế tạo/cường hóa → thăng tier → đổi đội/hầm → quest ngày → world boss |
| Ngày | 3–6 phiên | hoàn thành quest ngày, 1 lượt world boss mỗi chu kỳ, 5 lượt arena, refresh tavern |
| Tuần / mùa | 3–7 ngày | mùa arena, sự kiện, mốc tuần, bảng xếp hạng |
| Dài hạn | tuần–tháng | thăng tier cao, bộ rune, pet tiến hóa, hầm mới (LiveOps) |

## 4. Hệ thống: danh sách và phạm vi

| # | Hệ thống | MVP | v1.1 | Later | Ghi chú |
|---|---|:-:|:-:|:-:|---|
| 1 | Tài khoản (guest → liên kết email/Google; SĐT OTP khi thương mại hóa) | ✔ | | | guest login giảm ma sát |
| 2 | Guild + công trình (Sảnh, Quán, Kho, Lò rèn) | ✔ | | | 4 công trình MVP |
| 3 | Tuyển mộ (tavern) có pity | ✔ | | | |
| 4 | Hero: class, level, chỉ số, tính cách | ✔ | | | |
| 5 | Cây class: họ × nhánh × tier | 4 họ × T1–T3 | 6 họ × T1–T5 | 8 họ × T1–T8 | MVP 24 class |
| 6 | Đội hình combo (formation) + khắc hệ | 6 combo | 15 | 30+ | |
| 7 | Hầm ngục song song, 5 wave + wave boss | 4 hầm | 6 | 8–10 | |
| 8 | Engine chiến đấu deterministic + replay | ✔ | | | dùng chung client/server |
| 9 | Idle/offline + báo cáo vắng mặt (cap 8 giờ) | ✔ | | | |
| 10 | Trang bị 4 slot, chế tạo từ nguyên liệu, phẩm chất | ✔ | | | |
| 11 | Cường hóa +1…+10 có mốc an toàn và pity | +1…+5 | +10 | | |
| 12 | Kho, bán, tự động bán, khóa item | ✔ | | | |
| 13 | Quest chính (tutorial dài) + quest ngày/tuần | ✔ | | | |
| 14 | Hòm thư (mail) + quà hệ thống | ✔ | | | cần cho đền bù/sự kiện |
| 15 | Bảng xếp hạng (lực chiến, tiến độ hầm) | ✔ | | | |
| 16 | GM tool (admin riêng) | ✔ | | | gửi mail, tra người chơi, đổi config |
| 17 | World boss HP chung server | | ✔ | | |
| 18 | Arena bất đồng bộ theo mùa | | ✔ | | |
| 19 | Chat toàn server + báo cáo/khóa chat | | ✔ | | cần moderation |
| 20 | Pet | | ✔ | | |
| 21 | Thanh toán + cửa hàng (gói, thẻ tháng, pass) | | ✔ | | chỉ khi xong khung pháp lý (08) |
| 22 | Bang hội (guild of guilds), boss bang | | | ✔ | |
| 23 | Rune / bộ ấn | | | ✔ | |
| 24 | Sự kiện theo mùa, lật thẻ, đăng nhập 7 ngày | | ✔ | ✔ | |
| 25 | Gộp server / nhiều server | | | ✔ | MVP một "thế giới" |

## 5. Chi tiết hệ thống MVP

### 5.1 Guild và công trình

| Công trình | Tác dụng | Lv tối đa MVP |
|---|---|---|
| Sảnh Hội (Hall) | số hero tối đa (3 + Lv), số đội song song (1 → 4: mở ở Lv1 / Lv3 / Lv6 / Lv9) | 10 |
| Quán Rượu (Tavern) | số ứng viên, tỉ lệ ứng viên hiếm, giảm thời gian refresh | 10 |
| Kho (Storage) | số ô item; mở công thức tier cao | 10 |
| Lò Rèn (Forge) | mở cường hóa, tăng tỉ lệ phẩm chất khi chế tạo | 10 |

Nâng cấp tốn vàng + nguyên liệu, có **thời gian xây** ngắn ở cấp thấp (1–7 phút cho Lv1–5) và dài dần (~3 giờ ở Lv9→10, xem [03 §6](03-economy-balancing.md#6-công-trình)). Thời gian xây là lý do để quay lại, và có thể tăng tốc bằng vật phẩm.

**Đã cài (M1.7)**: Sảnh Hội và Lò Rèn (Quán Rượu và Kho chưa có cấp). Bảng số ở [03 §6](03-economy-balancing.md#6-công-trình).

- Bấm nâng cấp thì trả vàng (Lò Rèn thêm nguyên liệu hầm) ngay, cấp mới có hiệu lực khi hết thời gian xây. Đồng hồ chạy theo server, kể cả khi đóng tab.
- Chỉ có một thợ xây: mỗi lúc chỉ xây một công trình.
- Tăng tốc bằng **Đồng Hồ Cát Thợ Xây** (rơi từ boss hầm, sau này từ quest): mỗi cái bớt 5 phút.
- **Lò Rèn** Lv1 chỉ chế tạo; Lv2 mở cường hóa tới +2, Lv4 tới +3, Lv6 tới +4, Lv8 tới +5 (mỗi mức mới cần nguyên liệu của hầm kế tiếp). Mỗi cấp Lò Rèn giảm 3% tỉ lệ ra đồ Thường và chia cho Tinh xảo / Hiếm / Kiệt tác.

### 5.2 Hero

- Thuộc tính: `class` (họ, nhánh, tier), `level`, `exp`, `personality`, `equipment[4]`, `stars` (sao hero, Later), `status` (rảnh / trong hầm / nghỉ).
- 8 chỉ số: HP, ATK, MATK, DEF, MDEF, SPD, CRIT%, CRIT DMG%. Chỉ số phụ từ nội tại/đồ: né, chính xác, hút máu, hồi MP.
- **Tính cách** (8 loại): +12% một chỉ số, −4% hai chỉ số khác (nhẹ hơn fworldgm). Có thể reroll bằng vật phẩm.
- Hero thua trận thì **nghỉ** 3 phút (chỉ ở hầm đó), không mất EXP.

### 5.3 Cây class

- **MVP: 4 họ**: Chiến Binh (tank/melee vật lý), Xạ Thủ (DPS tầm xa vật lý), Pháp Sư (DPS phép AoE), Pháp Sư Trị Liệu/Đạo Sĩ (hỗ trợ: hồi máu, buff). Bản đầy đủ: 8 họ.
- Tier n có n nhánh để chọn (như fworldgm), cuối cùng mỗi họ có 8 nhánh. MVP T1–T3: mỗi họ 1 + 2 + 3 = 6 class, tổng 24 class.
- Mỗi class có: đòn đánh thường, **1 ULT** (đầy 100 MP), **1 nội tại**. Từ T4 thêm 1 kỹ năng chủ động thứ hai (Later).
- **Khắc hệ** vòng tròn giữa các họ: ×1.2 / ×0.85.
- **Thăng tier**: đạt level cap (10 × tier) + **Ấn Thăng Cấp** + vàng. Level reset về 1 nhưng giữ **20% chỉ số cũ** dạng "tiềm năng", để thăng tier không cảm giác bị yếu đi.
  - Đã chốt: hệ số cấp **nối tiếp qua các tier** (T2 Lv1 tính như T1 Lv10, T3 Lv1 như T2 Lv20; xem [03 §2](03-economy-balancing.md#2-công-thức-chỉ-số)), nên hero sau khi thăng luôn mạnh hơn hoặc bằng trước khi thăng.
  - Đã cài (M1.4B): T1→T2 cần 1 Ấn Thăng Cấp I + 500 vàng, Ấn I rơi từ boss hầm 1–2; T2→T3 cần 2 Ấn Thăng Cấp II + 3000 vàng, Ấn II rơi từ boss hầm 3–4. Chỉ được chọn class con trực tiếp, và hero không được đang ở trong một lượt chạy hầm.

### 5.4 Hầm ngục và chiến đấu

- Mỗi hầm: 5 wave thường (2–3 quái) + **wave 6 là boss hầm** (mỗi 10 vòng). Đội lặp lại liên tục.
  - Bản M1 hiện tại: boss xuất hiện ở wave 6 của **mọi** vòng, nên tỉ lệ rơi ở [03 §8](03-economy-balancing.md#8-loot) được tính cho từng vòng.
- **Đã chốt: mỗi wave bắt đầu với HP đầy và 50% MP**, không mang sát thương sang wave sau. Mỗi wave replay độc lập từ snapshot đầy đủ chỉ số; 50% MP giúp ULT (kể cả ULT hồi máu) dùng được giữa trận.
- **Đã chốt: mở khóa hầm theo tiến độ**: hầm N mở khi đã hạ boss hầm N−1 (ghi nhận lúc nhận thưởng). MVP 4 hầm (Lv đề xuất 1 / 10 / 20 / 30). Quest chính có thể thêm điều kiện sau.
- Một vòng chạy hầm dừng ở wave thua đầu tiên; thưởng idle là giá trị kỳ vọng của 30 vòng mẫu (xem [04 §6](04-technical-architecture.md#6-tính-toán-idle--offline)).
- **Độ khó hầm (Difficulty)** 1–10 trong mỗi hầm: tăng chỉ số quái và tỉ lệ rơi, tạo ngưỡng mục tiêu dài hạn với cùng một bộ asset.
- Chiến đấu: theo lượt, thứ tự theo SPD, MP +10/lượt và +5 khi trúng, ULT tự động khi đầy. Cap 60 lượt mỗi wave; quá cap thì **hòa** (rút lui, không cộng thưởng) thay vì "cả đội chết".
- Mục tiêu: ưu tiên theo vai trò (tank khiêu khích, sát thủ đánh máu thấp, pháp sư AoE), **mọi lựa chọn ngẫu nhiên đều dùng RNG có seed**.
- Người chơi có 2 công tắc chiến thuật cho mỗi đội: "Giữ ULT cho boss" và "Ưu tiên mục tiêu: máu thấp / mạnh nhất". Hai công tắc này là chiều sâu nhỏ mà fworldgm không có.

### 5.5 Idle và offline

- Thu hoạch tính theo **thời gian thật** kể từ lần nhận cuối, không phụ thuộc tab có mở hay không.
- **Cap offline 8 giờ** (12 giờ với thẻ tháng/pass). Hiệu suất offline 75% so với online.
- Khi quay lại: **báo cáo vắng mặt** (số wave thắng/thua, vàng, EXP, nguyên liệu, level lên) và nút "Nhận tất cả", kèm animation nhận thưởng.
- Cách tính chi tiết: [04 §6](04-technical-architecture.md#6-tính-toán-idle--offline).

### 5.6 Trang bị, chế tạo, cường hóa

- 4 slot: Vũ khí, Mũ, Giáp, Phụ kiện. Độ hiếm: Thường, Tốt, Hiếm, Sử thi, Huyền thoại (MVP 5 bậc). Phẩm chất phụ (+0–30% chỉ số) roll khi chế tạo.
- **Nguồn**: chế tạo từ nguyên liệu (nguồn chính) + rơi trực tiếp hiếm từ boss hầm (để có khoảnh khắc "rơi đồ xịn").
- Chế tạo: chọn công thức (2–3 nguyên liệu), có tỉ lệ roll phẩm chất. Lò rèn cấp cao tăng tỉ lệ.
- Cường hóa +1…+10 (MVP +5): xem [03 §5](03-economy-balancing.md#5-cường-hóa-trang-bị). Có **mốc an toàn +5** và **pity**.
- Phân rã đồ thừa thành bụi (Dust) để dùng cho cường hóa, thay vì chỉ bán lấy vàng.
  - Đã cài (M1.7): nút **Phân rã** cạnh nút Bán, trả 1–5 Bụi Rèn theo phẩm chất; mỗi lần cường hóa tốn vàng và Bụi Rèn ([03 §5](03-economy-balancing.md#5-cường-hóa-trang-bị)). Đồ đang khóa hoặc đang mặc không phân rã được.

### 5.7 Tuyển mộ (Tavern)

- Ứng viên refresh mỗi 2 giờ (giảm theo cấp quán), hoặc dùng **Thẻ Chiêu Mộ**.
- Độ hiếm ứng viên: Thường 70% / Tinh anh 25% / Hiếm 4.5% / Huyền thoại 0.5% (ảnh hưởng chỉ số gốc và tính cách). **Pity**: tối đa 40 lượt refresh bảo đảm có ứng viên Hiếm+.
- Công bố tỉ lệ trong game. Ứng viên Hiếm+ có ngoại hình riêng.

### 5.8 Quest

- **Quest chính** (~40 bước, 2–3 giờ đầu): dạy và mở khóa lần lượt Tavern → đội 2 → Chế tạo → hầm 2 → Cường hóa → Thăng tier → BXH. Mỗi bước có thưởng.
- **Quest ngày**: 6 nhiệm vụ (đăng nhập, nhận offline, chế tạo, cường hóa, refresh tavern, thắng 20 wave) + rương mốc điểm. Reset 05:00 giờ VN.
- **Quest tuần**: tích điểm từ quest ngày, kèm rương tuần.
- **Thành tựu**: dài hạn, cho danh hiệu và tiền cao cấp nhỏ giọt.

### 5.9 Hòm thư, bảng xếp hạng, GM tool

- Mail: hệ thống gửi quà (đền bù bảo trì, thưởng BXH, sự kiện). Có hạn 30 ngày, nhận tất cả.
- BXH: lực chiến guild, hầm cao nhất (độ khó), cập nhật mỗi 5 phút.
- GM tool (MVP): tìm người chơi, xem state, gửi mail cá nhân/toàn server, ban/mute, xem log giao dịch, bật/tắt tính năng, đẩy config mới.

## 6. Nội dung v1.1 (sau closed beta)

- **World boss**: 1 boss mỗi 4 giờ, HP chung server theo số người chơi hoạt động; mỗi người 3 lượt mỗi chu kỳ; thưởng theo % sát thương, đòn kết liễu, và mốc server cùng đạt.
- **Arena**: mùa 7 ngày, ELO/điểm, 5 vé/ngày, đánh đội phòng thủ (snapshot), thưởng mùa theo hạng; ghép đối thủ theo điểm ±10%.
- **Chat**: kênh thế giới + hệ thống, lọc từ cấm, báo cáo, mute, slow-mode.
- **Pet**: trứng → nở → cho ăn → tiến hóa 3 giai đoạn; pet gắn theo đội.
- **Thanh toán và shop** (xem 06).

## 7. Trải nghiệm 30 phút đầu (FTUE)

| Phút | Sự kiện | Cảm xúc mục tiêu |
|---|---|---|
| 0:00 | Vào game không cần đăng ký (guest). Cutscene 3 khung tranh: vết nứt trời, hội quán đổ nát | tò mò |
| 0:30 | Nhận 2 hero (1 Chiến Binh, 1 Pháp Sư), quest "Gửi đội vào Rừng Gai" | dễ hiểu |
| 1:00 | Trận đầu: thấy ULT đầu tiên ở wave 2, boss nhỏ ở wave 6 | "wow" |
| 3:00 | Lên Lv2–3, nhận nguyên liệu, quest "Chế tạo vũ khí đầu tiên", trang bị ngay | thấy mạnh lên |
| 6:00 | Mở Tavern, tuyển hero thứ 3 (bảo đảm Xạ Thủ), mở **đội thứ 2** chạy song song | fantasy quản lý |
| 10:00 | Nâng Sảnh Hội Lv2 (thời gian xây 1 phút), khắc hệ (gợi ý đổi đội) | có chiến thuật |
| 15:00 | Cường hóa +1, +2 (100%) | thỏa mãn |
| 20:00 | Hero đầu đạt Lv10, **thăng T2**, chọn 1 trong 2 nhánh, ngoại hình đổi | cột mốc |
| 30:00 | Mở hầm 2. Gợi ý "đội vẫn farm khi bạn rời đi, quay lại sau 1 giờ nhé" (opt-in thông báo PWA) | lý do quay lại |

## 8. UI/UX

- **Mobile portrait 360–430px**; desktop hiện khung giữa kèm panel phụ (log, chat) ở hai bên khi màn hình rộng.
- **Thanh điều hướng 5 tab có nhãn**: Hội Quán · Đội & Hầm · Rèn · Tuyển Mộ · Thêm (quest, BXH, mail, cài đặt). Tab mở dần theo quest chính.
- Header: vàng, tiền cao cấp, năng lượng sự kiện (nếu có), mail/thông báo.
- Nguyên tắc: một hành động chính mỗi màn; chấm đỏ chỉ khi có thể làm ngay; số lớn rút gọn (1,2K / 3,4M / 5,6B); animation nhận thưởng; haptic (Vibration API) khi thăng tier.
- **Accessibility**: tương phản AA, cỡ chữ điều chỉnh được, không dùng màu là tín hiệu duy nhất (độ hiếm có icon/viền), hỗ trợ `prefers-reduced-motion`.
- i18n: `vi` (mặc định) và `en`; mọi chuỗi qua key, không hard-code.
  - Đã cài (M1.8): nút **Tiếng Việt / English** ở đầu trang, đổi ngay không tải lại và không mất thao tác đang dở. Mọi người bắt đầu bằng tiếng Việt (không đoán theo ngôn ngữ trình duyệt); lựa chọn được nhớ trên thiết bị. Thông báo lỗi cũng theo ngôn ngữ đang chọn.

## 9. Âm thanh

- Nhạc nền: 1 theme hội quán, 1 theme hầm ngục, 1 theme boss (loop 1–2 phút). Hiệu ứng âm thanh: đánh, ULT, rơi đồ, cường hóa thành công/thất bại, thăng tier.
- Mặc định **tắt tiếng trên mobile** cho tới khi người chơi bật (thói quen chơi nơi công cộng).

## 10. Chỉ số thành công của MVP (closed beta)

| KPI | Mục tiêu closed beta | Ghi chú |
|---|---|---|
| Hoàn thành FTUE (thăng T2) | ≥ 60% người tạo tài khoản | đo funnel từng bước quest chính |
| Retention D1 / D7 / D30 | ≥ 40% / ≥ 18% / ≥ 8% | chuẩn idle mobile tốt: D1 40–50% |
| Phiên/ngày (DAU) | ≥ 4 | idle game thường có nhiều phiên ngắn |
| Thời gian chơi/ngày | 20–40 phút | |
| Crash/lỗi JS | < 1% phiên | Sentry |
| Thời gian tải lần đầu (4G) | < 3 giây tới màn chơi | Lighthouse |
