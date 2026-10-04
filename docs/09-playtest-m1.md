# 09: Chơi thử mốc M1 (tài khoản mới, 30 phút, 2026-10-05)

Mốc M1 trong [07](07-roadmap-mvp.md): "người thử chơi được 30 phút liên tục với placeholder art, không bị kẹt". Buổi này chơi **đúng 30 phút thời gian thật** từ một guest mới, trên bản chạy máy cục bộ (server lưu trong bộ nhớ), màn hình 375 px, tiếng Việt. Người chơi là Claude điều khiển qua trình duyệt; số liệu đọc từ API của chính game sau mỗi thao tác.

## Kết luận

- **Không bị kẹt**: mọi tính năng M1 đã thử đều chạy và phản hồi ngay (tuyển, xếp đội, chạy hầm, nhận thưởng, nâng Sảnh 2 lần, nâng Lò Rèn, chế 4 món, mặc đồ, phân rã 2 món, cường hóa +1 và +2, thử hầm 2, đổi ngôn ngữ). Không gặp lỗi nào.
- **Chưa đạt về nhịp và độ dễ hiểu**: 3 trong 6 mốc nhịp lệch mục tiêu, có 14 phút cuối không có gì để làm, và người mới không được dẫn dắt. Danh sách ở §3–§4.
- Đợt cân bằng đi kèm buổi này chỉ sửa **mức cường hóa theo cấp Lò Rèn** (§5). Các mục còn lại cần quyết hướng.

## 1. Diễn biến

| Phút | Việc xảy ra | Ghi chú |
|---|---|---|
| 0:00 | Vào game, tab Tuyển Mộ, 0/4 anh hùng, 1.000 vàng | không có hướng dẫn bước đầu |
| 0:30 | Làm mới Tavern → 3 ứng viên (1 Tinh anh trị liệu, 2 Thường), tuyển cả 3 | Tavern sau đó trống 2 giờ |
| 1:30 | Xếp đội 3 người, vào Rừng Gai | đội Lv1: thắng 5 wave, thua boss; boss thắng 9/30 vòng mẫu; 51 vàng + 74 EXP mỗi vòng 64 giây |
| 1:50 | Nâng Sảnh 1 → 2 (300 vàng, 1 phút) | xong đúng 2:50, tự cập nhật không tải lại |
| 6:09 | Nhận thưởng lần đầu (4 vòng): +198 vàng, cả đội Lv4 | **hầm 2 đã mở** vì vòng thứ 2 hạ được boss |
| 6:30 | Chế món đầu tiên (kiếm, Thường) | |
| 6:39 | Nâng Sảnh 2 → 3 (780 vàng, 1:54) | xong 8:35, mở đội 2 |
| 9:10 | Dừng hầm để mặc kiếm cho cung thủ | phải dừng mới mặc được |
| 10:14 | Thử hầm 2 với đội Lv5 | thua ngay wave 1 ở cả 30 vòng mẫu, 1 vàng mỗi vòng; quay lại hầm 1 |
| 10:45 | Nâng Lò Rèn 1 → 2 (240 vàng + 3 Đá Lửa, 48 giây); đội Lv5 có kiếm thắng boss 30/30 | 72 vàng + 98 EXP mỗi vòng |
| 15:00 | Nhận thưởng: Lv6, đã có 2 Ấn Thăng Cấp I | |
| 15:30 | Chế 3 món (Hiếm, Thường, Tinh xảo), phân rã 2 món lấy 3 Bụi Rèn, cường hóa kiếm +1 rồi +2 | tốn 260 vàng; kiếm 12 Công lên 13 |
| 16:00–30:00 | Không còn gì để làm ngoài chờ (còn 32 vàng) | |
| 30:37 | Nhận 14 vòng: +1.008 vàng, cả đội Lv8 (568/637) | thăng T2 ước tính ở phút ~40 |

Cuối buổi: 1.040 vàng · Sảnh Lv3 · Lò Rèn Lv2 · 3 anh hùng Lv8 · kiếm +2 và một giáp Hiếm · 2 Ấn I · 28 nguyên liệu.

## 2. Nhịp so với mục tiêu ([02 §7](02-game-design-document.md), [03 §4](03-economy-balancing.md))

| Mốc | Mục tiêu | Thực tế | Đánh giá |
|---|---|---|---|
| Chế đồ đầu | 3 phút | 6:30 | chậm gấp đôi |
| Đội 2 chạy song song | 6 phút | 8:35 mở khóa, nhưng không có anh hùng thứ 4 | chưa dùng được |
| Cường hóa +1, +2 | 15 phút | 15:50 | đạt |
| Thăng T2 lần đầu | 20–30 phút | ~40 phút (ước tính) | chậm |
| Mở hầm 2 | 30 phút | **6 phút** mở khóa, ~40 phút mới đánh nổi | lệch cả hai phía |
| Sảnh Lv2 | 10 phút | 2:50 | sớm (vì vàng khởi đầu) |

## 3. Vấn đề về nhịp và cân bằng

1. **Hầm 2 mở ở phút 6 nhưng chưa đánh được.** Chỉ cần một lần hạ boss hầm 1 là mở, mà đội Lv1 có 30% cơ hội mỗi vòng. Vào hầm 2 lúc Lv5 thì gần như không nhận được gì, và game không cảnh báo. Khoảnh khắc "mở hầm mới" bị phí.
2. **Thăng T2 ở phút ~40.** Mục tiêu 20–30 phút tính cả quà EXP từ quest chính, mà quest chưa có (M2.1).
3. **Chế đồ đầu ở phút 6.** `sim:economy` tính theo nhịp online 48 giây và thắng mọi wave; server trả theo nhịp thụ động 64 giây và đội Lv1 thua boss.
4. **Tavern trống sau khi tuyển 3 người.** Nâng Sảnh tăng sức chứa và mở đội 2, nhưng 2 giờ sau mới có ứng viên mới. Hai phần thưởng đầu game vì thế chưa có tác dụng.
5. **Khoảng chết phút 16–30.** Hết vàng, mục tiêu gần nhất là Lò Rèn Lv3 (624 vàng + 16 nguyên liệu) và Sảnh Lv4 (2.030 vàng ≈ 28 phút thu nhập).
6. **Cường hóa đầu game không có cảm giác mạnh lên.** +2 trên kiếm 12 Công chỉ thêm 1 Công, đổi lại 260 vàng và hai món đồ.
7. **+5 đạt quá sớm.** Đã sửa, xem §5.

## 4. Vấn đề về giao diện

1. **Không có dẫn dắt** cho 5 thao tác đầu (làm mới Tavern → tuyển → xếp đội → lưu → bắt đầu).
2. **Màn Đội & Hầm**: luôn hiện 4 thẻ đội dù chỉ dùng được 1–2; phải bấm Lưu rồi mới Bắt đầu; nút Bắt đầu bị khóa mà không ghi lý do.
3. **Mặc đồ phải dừng hầm**, và màn hình không nói điều đó trước khi bấm.
4. **Màn Rèn**: 30 công thức xếp một danh sách phẳng, không ghi chỉ số, không nhóm theo hầm, không đánh dấu món đủ nguyên liệu; kho đồ nằm tận cuối trang.
5. **Chữ kỹ thuật lộ ra với người chơi**: "deterministic", "seed", "replay client đã khớp server", "snapshot", "cycle", "wave", "Run".
6. **Chọn hầm không ghi cấp đề xuất**, nên không biết hầm 2 cần Lv10.
7. **Giờ làm mới Tavern** hiện dạng giờ đồng hồ ("11:04") thay vì đếm ngược.

Chạy tốt: đếm ngược xây và cấp mới tự cập nhật, thông báo "Vừa nhận", đổi ngôn ngữ tại chỗ, lý do khóa ở nút nâng cấp công trình và nút cường hóa.

## 5. Đợt cân bằng đi kèm

**Mức cường hóa theo cấp Lò Rèn** (`buildings.json`): trước đây Lv2 → +2, Lv3 → +3, Lv4 → +4, Lv5 → +5, nên +5 đạt được ngay ngày đầu. Nay:

| Cấp Lò Rèn | 2–3 | 4–5 | 6–7 | 8–10 |
|---|---|---|---|---|
| Cường hóa tối đa | +2 | +3 | +4 | +5 |
| Nâng tới cấp này cần nguyên liệu | hầm 1 | hầm 2 | hầm 3 | hầm 4 |

+5 cần Lò Rèn Lv8: cộng dồn 120.320 vàng, ~79 phút xây và 80 + 80 nguyên liệu hầm 4. Mốc "hầm 4 + cường hóa +5 ở D4–D5" của 03 §4 giờ đúng theo cấu trúc. Mốc +1/+2 ở phút 15 giữ nguyên. Giá vàng và Bụi Rèn mỗi lần thử không đổi. Migration `0015` nâng cấp Lò Rèn cho tài khoản cũ đã có đồ vượt mức mới.

## 6. Đề xuất việc tiếp theo

Theo thứ tự tôi đề xuất, mỗi mục là một quyết định về hướng:

1. **Sửa chữ và gợi ý trên giao diện** (§4 mục 2, 3, 5, 6, 7): rẻ, không đổi luật, bỏ được phần lớn chỗ khó hiểu.
2. **Hầm 2 mở sớm**: hoặc làm boss hầm 1 khó hơn với đội dưới Lv8, hoặc đổi điều kiện mở thành hạ boss nhiều lần. Phương án đầu chỉ sửa số; phương án sau đổi luật và cần thêm dữ liệu lưu.
3. **Tavern đầu game**: cho 1–2 lần làm mới sớm (ví dụ sau 10 phút) hoặc tặng anh hùng thứ 4 qua quest, để đội 2 có ý nghĩa.
4. **Quest chính (M2.1)** giải quyết luôn dẫn dắt bước đầu, quà EXP để thăng T2 đúng mốc, và khoảng chết phút 16–30.
5. **Màn Rèn**: nhóm công thức theo hầm, hiện chỉ số, đưa kho đồ lên trên.
6. **Mô phỏng kinh tế** tính theo nhịp thụ động và tỉ lệ thắng thật, để các mốc trong 03 §4 so được với server.
