# 01: Teardown fworldgm và bài học cho game của mình

> Tổng hợp từ [`research/fworldgm/`](../research/fworldgm/README.md). Mỗi nhận định có dẫn nguồn tới file bằng chứng tương ứng.

## 1. fworldgm là gì

**FWORLD GM — "Fantasy World: Guild Master"** là web game **idle guild-management RPG** do một dev Việt Nam độc lập vận hành, mở closed beta ngày **27/09/2026** ([07 §4](../research/fworldgm/07-gameplay-walkthrough.md#4-liveops-quan-sát-được)).

Người chơi làm chủ một guild:

1. **Chiêu mộ** nhà thám hiểm ở Tavern (class, tính cách, chỉ số ngẫu nhiên; refresh 2 giờ hoặc tốn ⭐; có pity cho class hiếm).
2. **Ghép đội 4 người + 1 pet** gửi vào một trong 8 **hầm ngục**. Đội auto-battle qua 5 wave lặp lại liên tục, nhiều hầm chạy song song, vẫn farm khi offline.
3. Dùng vàng và nguyên liệu để **chế tạo / cường hóa / khắc rune** trang bị.
4. Đạt level cap thì **thăng tier class** (8 tier, 8 họ, 288 class), level reset về 1, cần sách chuyển chức.
5. Cạnh tranh: **world boss** HP chung server (chu kỳ 2 giờ), **arena** PvP bất đồng bộ theo mùa ngắn, chat toàn server.
6. Trả tiền bằng **Sao ⭐** để mua sách chuyển chức tier cao, đá cường hóa, sách làm mới, trứng pet.

## 2. Bản đồ hệ thống

```
                   ┌──────────── Tavern (recruit, pity) ◄── ⭐ Sách làm mới
                   ▼
  Guild (sức chứa) ─► Nhà thám hiểm ──► Đội (4 + pet) ──► Hầm ngục (8 × 5 wave, song song, offline)
     ▲   class/tier/nhánh, tính cách        │                       │
     │   formation, khắc chế                │                       ├─► Vàng, EXP
     │                                      │                       └─► Nguyên liệu, sách class (elite/leader/boss)
     │                                      ▼
     │                          Kho ◄── Chế tạo (340 công thức) ── phẩm chất ngẫu nhiên
     │                           │
     │                           ├─► Cường hóa +1…+9 (90% → 10%, rớt cấp) ◄── ⭐ Đá cường hóa
     │                           └─► Rune (4 loại × 4 bậc, bộ 2/3/4)
     │
     ├─ Thăng tier (level cap = 5 × tier) ◄── sách chuyển chức (gộp 4:1) ◄── ⭐ Star Shop (T4–T7)
     │        └─ T8: bản nguyên = 500 nguyên liệu + Thần vị
     │
     ├─ World boss (HP chung, 1 lượt / boss / 2 giờ) ──► rương, ⭐, mảnh Thần vị
     ├─ Arena (mùa ngắn, 5 lượt, đội phòng thủ) ──► thưởng mùa
     └─ Quest ngày/tuần, mốc nạp tích lũy, sự kiện lật thẻ ──► vật phẩm, ⭐
```

## 3. Thông số nhanh (quick reference)

| Hạng mục | Giá trị | Nguồn |
|---|---|---|
| Nội dung | 8 họ class × 36 = 288 class; 8 hầm × 5 wave × 2 quái; 32 họ quái × 4 bậc; 502 trang bị; 340 công thức; 95 nguyên liệu; 31 đội hình; 8 tính cách | [04 §1](../research/fworldgm/04-game-data.md) |
| Level cap | 5 × tier (T7+ không giới hạn); thăng tier reset Lv1 | [06 §3](../research/fworldgm/06-mechanics.md) |
| Chỉ số theo level | × (1 + (L² + 19L)/200): L10 ×2.45, L40 ×12.8 | [06 §1](../research/fworldgm/06-mechanics.md) |
| Sát thương | A > D ? A − D : A·(1 − D/(D + A/5)); ×0.9–1.1; crit ×(2 + critDmg%); khắc hệ ×1.25/×0.85 | [06 §2.2](../research/fworldgm/06-mechanics.md) |
| Thứ tự lượt | SPD giảm dần; MP +10/lượt, +5 khi trúng; đầy 100 tự ULT; cap 1.000 lượt | [06 §2](../research/fworldgm/06-mechanics.md) |
| Bậc quái | normal 89% / elite 10% / leader ~1% / boss 0,01%; rơi ×1/×1/×5/×10 | [06 §2.3](../research/fworldgm/06-mechanics.md) |
| Offline | 18 giây/wave × hiệu suất 80%; tối thiểu vắng 2 phút; vàng guild 0,2/giây | [06 §6](../research/fworldgm/06-mechanics.md) |
| Cường hóa | thành công 100 − 10n %; thất bại: +3…+5 tụt 1, ≥ +6 về 0; kỳ vọng **~3.600 đá** từ +0 lên +9 | [06 §4](../research/fworldgm/06-mechanics.md) |
| Công trình | Guild 500·4^(L−1); Tavern/Kho 100·4^(L−1); Shop 1.000·10^(L−1) | [04 §10](../research/fworldgm/04-game-data.md) |
| Giá ⭐ | beta 1.000đ = 10⭐; sau beta 1.000đ = 5⭐ | [07 §5](../research/fworldgm/07-gameplay-walkthrough.md) |
| Kỹ thuật | Expo/React Native Web (bundle 4 MB, obfuscated) + PHP 8.3 `api.php?action=` + Socket.IO; Hostinger | [01](../research/fworldgm/01-static-recon.md), [05](../research/fworldgm/05-api-architecture.md) |

## 4. Nên học (adopt)

| # | Điều fworldgm làm tốt | Áp dụng thế nào |
|---|---|---|
| A1 | Fantasy "quản lý guild": nhiều đội, nhiều hầm chạy song song, quyết định nằm ở **xếp đội và phân bổ** chứ không phải bấm | Giữ làm trụ cột core loop (GDD §3) |
| A2 | Chiều sâu build bằng tổ hợp: họ × nhánh × tier, khắc chế vòng tròn, đội hình combo, tính cách | Giữ cấu trúc nhưng thu nhỏ cho MVP (4 họ × 3 tier) rồi mở rộng theo LiveOps |
| A3 | Thăng tier reset level, tạo vòng lặp "prestige mềm" theo từng nhân vật | Giữ, kèm phần thưởng rõ ràng mỗi lần thăng (chiêu mới, ngoại hình, nội tại) |
| A4 | Trang bị **chỉ có từ chế tạo** (farm ra nguyên liệu), khiến nguyên liệu của từng hầm luôn có giá trị | Giữ, thêm thị trường NPC thu mua để tránh nguyên liệu thừa vô dụng |
| A5 | World boss HP chung server, chu kỳ ngắn: nội dung xã hội rẻ, tạo "sự kiện" vài giờ một lần | Đưa vào v1.1 |
| A6 | Arena bất đồng bộ (đánh đội phòng thủ của người khác), mùa ngắn | Đưa vào v1.1 |
| A7 | Replay trận chi tiết, guide minh bạch công thức | Giữ và làm tốt hơn (replay từ seed, nhẹ) |
| A8 | Song ngữ VI/EN từ ngày đầu | Giữ: i18n ngay từ M0 |
| A9 | Pity cho tuyển mộ class hiếm | Giữ, công bố tỉ lệ |
| A10 | Mô phỏng chiến đấu trên server (server-authoritative) | Giữ, nhưng dùng engine deterministic dùng chung client/server |

## 5. Nên làm tốt hơn (improve)

| # | Điểm yếu của fworldgm | Cách mình làm |
|---|---|---|
| I1 | Onboarding chỉ 30 giây rồi bỏ mặc; không có quest chính | Chuỗi **quest chính 2–3 giờ đầu** mở khóa tính năng từng bước (GDD §7) |
| I2 | Đầu game chậm ("luyện cấp rất chậm"), chỉ số tăng bậc 2 theo level, EXP nhảy bậc ở mốc cap | Đường cong mượt hơn, mục tiêu D1: thăng T2 trong ~2 giờ (Economy §4) |
| I3 | Công thức "A − D" tạo hiệu ứng tường | Dùng `ATK · K/(K + DEF)` với K theo level (Economy §3) |
| I4 | Cường hóa rớt về +0 khi ≥ +6, kỳ vọng ~3.600 đá cho +9, dễ gây cảm giác "lừa đảo" | Mốc an toàn, tỉ lệ cao hơn, pity tích lũy; ~80 đá cho +10 (Economy §5) |
| I5 | 9 tab chỉ có icon, mật độ thông tin cao | 5 tab có nhãn chữ + hub, mở dần theo tiến trình |
| I6 | Request mỗi wave (~40 KB log + snapshot), polling chat 29 KB / 15–30 giây | Một request "bắt đầu trận" trả seed; client tự mô phỏng để xem; server cộng thưởng khi claim; realtime qua một kênh WebSocket (Architecture §4) |
| I7 | Save là một blob JSON, có `reconcile` nhận save từ client | Lệnh theo intent, state chuẩn hóa trong Postgres, khóa theo người chơi (Architecture §5) |
| I8 | Bundle 4 MB, không PWA | Code-splitting, mục tiêu < 300 KB gzip cho lần tải đầu; PWA (cài lên màn hình chính, push) |
| I9 | Art lẫn lộn (pixel + anime AI) | Một art direction thống nhất (Content §1) |
| I10 | Guide lỗi thời so với game (12 giờ vs 2 giờ) | Guide sinh từ cùng file config với game |

## 6. Tuyệt đối tránh (avoid)

| # | Vấn đề | Lý do |
|---|---|---|
| X1 | Dùng IP của người khác (họ class "Saiya / Super Saiyan / Ultra Instinct" của Dragon Ball) | Vi phạm bản quyền/nhãn hiệu, có thể bị gỡ |
| X2 | Thu tiền vào tài khoản ngân hàng cá nhân, không có pháp nhân/giấy phép | Rủi ro pháp lý và thuế; không mở được cổng thanh toán chính thức |
| X3 | Không xác thực SĐT, mật khẩu 4 ký tự | Không đáp ứng NĐ 147/2024 cho game G1; tài khoản yếu |
| X4 | API key hard-code trong client, token trong body, panel admin trong bundle công khai | Bề mặt tấn công không cần thiết |
| X5 | Lộ số tiền nạp (⭐) của người khác qua chat API; gọi geo-IP bên thứ ba không thông báo | Quyền riêng tư (Luật BVDLCN 2025) |
| X6 | Sao chép dữ liệu/tên/mô tả từ fworldgm | Chỉ học **cấu trúc và nhịp số**. Toàn bộ nội dung phải tự viết |

## 7. Bối cảnh cạnh tranh (tham khảo)

| Game | Điểm giống | Điểm khác / bài học |
|---|---|---|
| fworldgm | cùng thể loại, cùng thị trường VN | đối thủ trực tiếp nhỏ; khoảng trống về chất lượng UX/art/pháp lý |
| Melvor Idle, IdleMMO, Idlescape | idle RPG trên web, nhiều hệ thống | phương Tây, skill-based; cộng đồng trung thành nhờ minh bạch và không P2W nặng |
| Firestone Idle RPG | idle party RPG, guild, có web/Steam | LiveOps rất mạnh, nhiều lớp prestige |
| AFK Arena / AFK Journey | auto-battle + gacha hero + AFK reward | chuẩn mực mobile về onboarding, AFK chest, monetization (thẻ tháng, pass) |
| Game H5 "treo máy" Trung Quốc tại VN | idle + VIP + nạp | P2W nặng, chất lượng thấp; người chơi VN đã quen thanh toán qua ví/ngân hàng |

**Định vị đề xuất**: *"Idle guild RPG Việt Nam chất lượng cao, công bằng, minh bạch"*. Mạnh hơn fworldgm ở onboarding, art thống nhất, hiệu năng mobile và pháp lý sạch; ít P2W hơn game H5 Trung Quốc.
