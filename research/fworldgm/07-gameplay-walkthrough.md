# 07: Chơi thử fworldgm (tài khoản test, 2026-10-03)

Tài khoản test tạo mới (username/mật khẩu ngẫu nhiên, lưu trong `raw/`, gitignored). Phiên chơi khoảng 20 phút: đăng ký → tutorial → gửi đội vào hầm ngục đầu → xem cả 9 tab và menu. Không nạp tiền, không tấn công arena/world boss, không gửi chat. Ảnh trong [`screenshots/walkthrough/`](screenshots/walkthrough/); username người chơi khác đã làm mờ.

## 1. Onboarding

| Bước | Màn hình | Ghi chú |
|---|---|---|
| 1 | Đăng nhập / đăng ký ([ảnh](screenshots/desktop-03-t30s.jpg)) | logo "Fantasy World – Guild Master", nền art anime. Chỉ cần username (3–30 ký tự chữ/số) + mật khẩu (≥ 4 ký tự). Nút đổi ngôn ngữ EN/VI. Không email/SĐT/captcha |
| 2 | Vào thẳng tab Guild ([ảnh](screenshots/walkthrough/01-after-register.jpg)) | bắt đầu với **2 nhà thám hiểm Lv1 cùng class Kiếm Sĩ** (tên ngẫu nhiên kiểu phương Tây), 100 vàng, 0⭐, guild cấp 1 (sức chứa 2/2) |
| 3 | Popup "Quick Tutorial" (~30 giây, 5 bước) | Start/Skip. Hướng dẫn: mở tab Dungeon → bấm ô "+" ở hầm đầu → chọn hero → Start ([ảnh](screenshots/walkthrough/03-tutorial-1.jpg), [ảnh](screenshots/walkthrough/04-dungeon-tab.jpg), [ảnh](screenshots/walkthrough/05-pick-hero.jpg)) |
| 4 | Hầm ngục chạy ("● ACTIVE", "Fighting") ([ảnh](screenshots/walkthrough/09-dungeon-running.jpg)) | XP/vàng tăng theo từng wave; "Battle Details" mở replay trận với HP/MP từng đơn vị, log, bảng khắc chế ([ảnh](screenshots/walkthrough/dungeon-battle-details.jpg)) |

Sau khoảng 3 phút: 2 hero lên Lv2, vàng từ 100 lên ~530 (gồm vàng thụ động ~0,2/giây), nhặt được nguyên liệu Slime Gel. "Time-to-first-reward" rất ngắn, nhưng **không có mục tiêu rõ ràng tiếp theo** sau tutorial: không có chuỗi nhiệm vụ dẫn dắt, và tính năng bị khóa vì thiếu vàng/sao.

## 2. Bố cục UI

- Khung dọc ~400px ở giữa màn hình (mobile-first, desktop để trống hai bên), theme tối, icon Material Design.
- **Header**: menu ☰, ⭐ sao, 💰 vàng (tăng realtime), 📣 thông báo (chấm đỏ), EN/VI, tên người chơi ▼ (đổi mật khẩu, đăng xuất).
- **Bottom bar 9 tab** (chỉ có icon, không có nhãn chữ, nên người mới khó nhận ra): Guild · Quest · Tavern · Dungeon · World Boss · Arena · Kho · Shop · Pet. Chấm đỏ báo có việc cần làm.
- **Nút nổi**: rương quà/sự kiện (góc phải), chat toàn server (bong bóng xanh).
- **Menu ☰**: Classes (cây class, bảng khắc chế, đội hình), Guide, Feedback, Gift Code ([ảnh](screenshots/walkthrough/menu.jpg)).

## 3. Các tab

| Tab | Nội dung chính | Ảnh |
|---|---|---|
| **Guild** | sức chứa + nút nâng (500 vàng); đội PvP (4 ô); thẻ từng hero: class, Lv, MP, XP, HP bar, 4 ô trang bị, 8 chỉ số (ATK, DEF, MATK, MDEF, SPD, CRIT, CRIT DMG, DODGE), đòn đánh, ULT, nội tại, nút Change (đổi class) / Release | [tab-1](screenshots/walkthrough/tab-1-guild.jpg) |
| **Quest** | 3 tab con: Quests (ngày 5 task, tuần 10×5, mốc thưởng 1–5), **Top-up** (mốc nạp tích lũy 1/100/200/500/1000/2000/5000⭐), **Card Flip Event** (mốc nạp → thẻ lật, từ 02/10/2026) | [tab-2](screenshots/walkthrough/tab-2-quests.jpg), [topup](screenshots/walkthrough/quests-topup.jpg), [flip](screenshots/walkthrough/quests-flip.jpg) |
| **Tavern** | sức chứa guild/tavern, ứng viên (class · tính cách · chỉ số), nút Upgrade (100 vàng), Refresh (dùng Sách làm mới), refresh tự động sau 2 giờ, chú thích cơ chế pity | [tab-3](screenshots/walkthrough/tab-3-tavern.jpg) |
| **Dungeon** | 8 hầm (ảnh nền riêng, Lv đề xuất 5→40, 5 wave), mỗi hầm 4 ô hero + 1 ô pet, đồng hồ đếm ngược world boss của hầm, lịch sử, thông tin; Start / End Dungeon / Battle Details | [tab-4](screenshots/walkthrough/tab-4-dungeon.jpg) |
| **World Boss** | 8 boss (T1–T8, T5+ đang khóa), thanh HP chung, đời (generation), số lần bị hạ, người kết liễu, top sát thương chu kỳ này và chu kỳ trước, nút Attack | [tab-5](screenshots/walkthrough/tab-5-worldboss.jpg) |
| **Arena** | mùa giải + thời gian còn lại, 5 lượt tấn công, hạng/điểm, W–L tấn công và phòng thủ, pet PvP, đội PvP, 5–6 đối thủ gợi ý (điểm, số hero, level), leaderboard top 50 | [tab-6](screenshots/walkthrough/tab-6-pvp.jpg) |
| **Kho** | Warehouse Lv1 (20 ô, nâng 100 vàng), auto-sell rules, bán hàng loạt, danh sách item, nguyên liệu (bấm để chế tạo) | [tab-7](screenshots/walkthrough/tab-7-inventory.jpg) |
| **Shop** | Shop vàng (cấp 1, nâng 1.000 vàng, refresh 100 vàng / 18 giờ) và **Star Shop** (sách chuyển chức T4–T7: 3/9/27/243⭐, Sách làm mới 2⭐, Đá cường hóa 5⭐, Đá hồi sinh 100⭐, Trứng 100⭐, thẻ đổi tên 10/200⭐) | [tab-8](screenshots/walkthrough/tab-8-shop.jpg), [star](screenshots/walkthrough/shop-star.jpg) |
| **Pet** | danh sách pet. Người mới chưa có, phải mua trứng 100⭐ | [tab-9](screenshots/walkthrough/tab-9-pets.jpg) |

**Guide trong game** ([ảnh](screenshots/walkthrough/menu-guide.jpg)) chia các mục Basics / Combat / Heroes / Items / Pets / Misc, giải thích công thức cốt lõi (SPD → độ chính xác, CRIT = 10% + chỉ số, cap né 50% vs boss, tỉ lệ cường hóa 90% → 10%, thăng tier reset Lv1). Đây là thực hành tốt: minh bạch công thức giúp người chơi hardcore tối ưu.

**Classes** ([ảnh](screenshots/walkthrough/menu-classes.jpg)): cây tiến hóa theo họ (T1 → T8, nhánh mở dần), tab Counter (bảng khắc chế), tab Formations (31 đội hình).

## 4. LiveOps quan sát được

| Ngày | Thông báo (tóm tắt) |
|---|---|
| 27/09/2026 06:00 | Mở game ("game luyện cấp rất chậm nên ae mới cứ thoải mái") |
| 28/09 | Thêm cơ chế tích may mắn (pity) khi làm mới tavern; thanh toán online trực tiếp (SePay) |
| 29/09 | Thẻ đổi tên người chơi; tag tên `@user` trong chat |
| 02/10 | Sự kiện lật thẻ theo mốc nạp |
| (đang diễn ra) | Arena mùa 2 (kết thúc 05/10 00:00 giờ VN); world boss chu kỳ 2 giờ |

Nhịp cập nhật rất dày (gần như mỗi ngày). Dev nhỏ (có vẻ 1 người: tài khoản Buy-Me-a-Coffee cá nhân, chuyển khoản vào tài khoản cá nhân) phản hồi cộng đồng qua nhóm Zalo và chat trong game. Lúc kiểm tra (tối thứ Bảy) có **23 người online**, leaderboard arena có 50 người với ~40–60 trận, tức cộng đồng nhỏ nhưng tích cực.

## 5. Monetization quan sát được

- Tiền cao cấp duy nhất: **Sao ⭐**. Tỉ lệ: closed beta **1.000đ = 10⭐**, sau closed beta **1.000đ = 5⭐**. Hứa hoàn 100% sao đã nạp khi ra mắt chính thức.
- Kênh: SePay (QR chuyển khoản ngân hàng, tự xác nhận qua `sepay_check`), MoMo, chuyển khoản tay vào tài khoản cá nhân, Buy Me a Coffee.
- Chỗ tiêu sao: Star Shop (sách chuyển chức tier cao, đá cường hóa, sách làm mới tavern, trứng pet, đá hồi sinh, đổi tên), lật thẻ (150⭐/lượt).
- Ưu đãi nạp: mốc nạp tích lũy (1⭐ đến 5.000⭐ = 500.000đ–1.000.000đ), sự kiện lật thẻ theo mốc nạp. Chưa thấy VIP, thẻ tháng hay battle pass.
- Áp lực trả tiền lớn nhất: **cường hóa** (tỉ lệ giảm, rớt cấp khi thất bại), **sách chuyển chức T7** (243⭐ ≈ 24.300đ–48.600đ mỗi cuốn), **tavern reroll** để săn class hiếm.

## 6. Ấn tượng tổng thể

**Làm tốt**

- Vòng lặp cốt lõi rõ: gửi đội → farm → chế tạo/cường hóa → thăng tier → hầm khó hơn. Nhiều hầm chạy song song tạo cảm giác "quản lý guild".
- Chiều sâu build lớn: 288 class, 31 đội hình, khắc chế, tính cách, rune, pet, bản nguyên T8.
- Nội dung chung server (world boss HP chung, arena mùa ngắn, chat) tạo cảm giác "có người khác" dù cộng đồng nhỏ.
- Song ngữ ngay từ đầu, guide minh bạch công thức, replay trận chi tiết.

**Chưa tốt (cơ hội cho game của mình)**

- UI chỉ có icon, mật độ thông tin cao, art không đồng nhất (pixel sprite + art anime AI).
- Onboarding dừng sau 30 giây, không có chuỗi mục tiêu dài hạn (quest chính, mốc mở khóa).
- Đầu game rất chậm, đúng như dev tự thừa nhận "luyện cấp rất chậm". Thiếu "mốc vui" (unlock tính năng mới theo thời gian).
- IP vay mượn (họ class "Saiya / Super Saiyan / Ultra Instinct" lấy từ Dragon Ball) là rủi ro pháp lý.
- Thanh toán vào tài khoản cá nhân, không xác thực SĐT, không thấy giấy phép G1, nên không bền vững về pháp lý.
- Polling HTTP nặng và bundle 4 MB khiến hiệu năng kém trên mạng di động yếu.
