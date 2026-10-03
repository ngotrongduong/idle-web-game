# 06: Monetization, LiveOps và analytics

> Chỉ bật thanh toán khi đã có khung pháp lý (pháp nhân, cổng thanh toán chính thức, lộ trình giấy phép G1 hoặc đối tác phát hành; xem [08](08-legal-risks.md)). Closed beta **không thu tiền**.

## 1. Triết lý

- **"Trả tiền để tiện và nhanh hơn, không phải để thắng tuyệt đối."** Người chơi miễn phí chăm chỉ vẫn cạnh tranh được (top 30% arena).
- Minh bạch: công bố tỉ lệ, không dùng dark pattern (đếm ngược giả, giá mập mờ), giới hạn nạp và cảnh báo thời gian chơi cho người dưới 18 theo luật.
- Doanh thu chính đến từ **thẻ tháng + battle pass** (đều đặn, ít gây ức chế), sau đó mới tới gói một lần.

## 2. Tiền tệ cứng và bảng giá đề xuất

Tỉ lệ cơ sở **1.000đ = 10 Ngọc** (giá trị dễ nhẩm, giống mức beta của fworldgm).

| Gói | Giá | Ngọc | Thưởng lần đầu | Ghi chú |
|---|---|---|---|---|
| Gói khởi đầu (1 lần) | 20.000đ | 200 | – | + hero Hiếm chọn họ + 5 Thẻ Chiêu Mộ |
| Nhỏ | 20.000đ | 200 | x2 lần đầu | |
| Vừa | 50.000đ | 520 | x2 | +4% |
| Lớn | 100.000đ | 1.080 | x2 | +8% |
| Rất lớn | 200.000đ | 2.200 | x2 | +10% |
| Khổng lồ | 500.000đ | 5.750 | x2 | +15% |
| Thẻ tháng | 49.000đ / 30 ngày | 300 ngay + 100/ngày (tổng 3.300) | – | + cap offline 12 giờ, thợ xây thứ 2, tự nhận thưởng hầm |
| Battle pass (mùa 28 ngày) | 99.000đ | – | – | đường thưởng cao cấp: thẻ chiêu mộ, Ấn Thăng Cấp, trang phục |

**Chỗ tiêu Ngọc** (không bán thẳng chỉ số vĩnh viễn):

| Hạng mục | Giá |
|---|---|
| Thẻ Chiêu Mộ | 30 Ngọc |
| Tăng tốc xây dựng | 1 Ngọc / phút còn lại (giảm dần theo thời lượng) |
| Mở thêm slot đội thứ 5–6, ô kho | 200–500 Ngọc |
| Reroll tính cách | 50 Ngọc |
| Đá Rèn (cường hóa +6 trở lên) | 20 Ngọc (giới hạn mua mỗi ngày) |
| Trang phục / skin hero, khung avatar | 300–1.500 Ngọc (thuần cosmetic) |
| Gói sự kiện có giới hạn mua | theo sự kiện |

## 3. Kênh thanh toán tại Việt Nam

| Kênh | Phù hợp | Yêu cầu | Phí (tham khảo) |
|---|---|---|---|
| **Chuyển khoản VietQR + webhook** (SePay, Casso, PayOS…) | indie, closed/open beta | tài khoản ngân hàng **doanh nghiệp/hộ kinh doanh**, webhook đối soát tự động | thấp (phí dịch vụ tháng hoặc ~0%) |
| Ví điện tử (MoMo, ZaloPay, ShopeePay) | đại chúng | đăng ký merchant (cần pháp nhân, hồ sơ ngành nghề) | ~1,5–3% |
| Cổng VNPay (thẻ ATM/Visa/QR) | đại chúng | merchant, pháp nhân | ~1–3% |
| Thẻ cào điện thoại (qua đơn vị trung gian) | người chơi trẻ, không có ngân hàng | đối tác trung gian | **cao (~15–30%)**, rủi ro gian lận. Không khuyến nghị lúc đầu |
| Google Play / App Store (nếu có app) | quốc tế | tài khoản dev | 15–30% |
| Stripe / Paddle (bản quốc tế) | người chơi nước ngoài | pháp nhân phù hợp | ~3–5% |

Kỹ thuật: mọi cộng Ngọc **chỉ qua webhook có xác thực chữ ký** → bảng `transactions` (idempotent theo `provider_ref`) → cộng Ngọc + gửi mail biên nhận. Có trang lịch sử nạp trong game. Hằng ngày đối soát với sao kê/cổng.

## 4. Lịch LiveOps (mẫu)

| Chu kỳ | Hoạt động |
|---|---|
| Hằng ngày 05:00 (giờ VN) | reset quest ngày, refresh shop, lượt arena |
| Mỗi 4 giờ (v1.1) | chu kỳ world boss |
| Hằng tuần (thứ Hai) | reset quest tuần; mùa arena 7 ngày kết thúc Chủ nhật 22:00 (gửi thưởng qua mail) |
| 2 tuần / lần | sự kiện nhỏ (x2 rơi một hầm, "tuần lễ rèn": cường hóa giảm giá) |
| Hằng tháng | battle pass mùa mới; sự kiện chủ đề (lễ, Tết) với hầm/boss tạm thời; thêm 1 họ class hoặc 1 hầm theo roadmap |
| Quý | bản cập nhật lớn (tier mới, hệ thống mới như bang hội, rune) |

Công cụ cần có trước khi chạy LiveOps: hòm thư toàn server, lịch sự kiện từ config (bật/tắt theo thời gian), banner thông báo trong game, gift code, công cụ đền bù hàng loạt.

## 5. Cộng đồng

- Kênh chính: **Facebook Page + Group**, **Discord** (người chơi hardcore), Zalo group (giống fworldgm, phổ biến ở VN), TikTok để đăng clip thăng tier/boss.
- Chương trình closed beta: 100–300 người, thưởng danh hiệu "Người Tiên Phong" khi ra mắt (không hứa hoàn tiền vì beta không thu tiền).
- Kênh phản hồi trong game (feedback có kèm log/phiên bản), changelog công khai.

## 6. Analytics và KPI

**Sự kiện tối thiểu** (gửi vào `event_log`, tổng hợp bằng SQL/Metabase; sau này mới cần PostHog/BigQuery):

| Nhóm | Sự kiện |
|---|---|
| Acquisition | `install_or_first_open` (kèm UTM/referrer), `account_created` (guest/linked) |
| FTUE | `tutorial_step` (step_id), `first_dungeon_start`, `first_craft`, `first_promote` |
| Core | `session_start/end`, `offline_claim` (thời lượng, giá trị), `dungeon_start/stop`, `wave_result` (gộp), `craft`, `enhance` (cấp, thành/bại), `recruit` (độ hiếm, pity), `promote` (tier, nhánh) |
| Economy | `currency_change` (loại, nguồn/tiêu, số lượng, số dư) |
| Social (v1.1) | `boss_attack`, `arena_battle`, `chat_message` (đếm, không lưu nội dung vào analytics) |
| Monetization | `shop_view`, `purchase_start`, `purchase_complete` (gói, VND), `purchase_fail` |

**Dashboard**: funnel FTUE theo bước; retention D1/D7/D30 theo cohort; DAU/MAU; phiên/ngày; tiền tệ tồn trung vị theo ngày tuổi; tỉ lệ thắng theo hầm/độ khó (phát hiện tường khó); doanh thu, ARPDAU, tỉ lệ người trả tiền, ARPPU; phân bố class/nhánh (phát hiện class quá mạnh/yếu).

| KPI (mục tiêu sau open beta) | Giá trị tham chiếu idle mobile |
|---|---|
| D1 / D7 / D30 | 40% / 18% / 8% |
| Tỉ lệ người trả tiền | 2–5% |
| ARPDAU | 1.000–3.000đ |
| Chi phí server / DAU | < 50đ |
