# 08: Pháp lý và rủi ro

> ⚠ Đây là tổng hợp thông tin công khai để **định hướng**, **không phải tư vấn pháp lý**. Phải xác minh với luật sư chuyên về game/CNTT tại Việt Nam trước khi thu tiền hoặc phát hành rộng. Văn bản và mức phạt có thể đã thay đổi; luôn đối chiếu nguyên văn trên cổng văn bản pháp luật chính thức.

## 1. Sở hữu trí tuệ khi "làm game tương tự"

| Được phép (nói chung) | Không được phép |
|---|---|
| Học **cơ chế, thể loại, cấu trúc hệ thống** (idle guild, auto-battle, chế tạo, thăng tier). Cơ chế game thường không được bảo hộ bản quyền | Sao chép **mã nguồn, asset (hình, âm thanh), văn bản, tên riêng, logo** của fworldgm hay bất kỳ game nào |
| Tự xây công thức riêng sau khi tham khảo nhịp số | Copy nguyên bảng dữ liệu (tên, mô tả, chỉ số) sang game mình |
| Dùng văn hóa dân gian thuộc phạm vi công cộng | Dùng nhân vật/thương hiệu được bảo hộ (fworldgm dùng "Saiyan / Super Saiyan / Ultra Instinct" của Dragon Ball, rủi ro lớn) |

Repo này: dữ liệu fworldgm trong `research/` chỉ phục vụ phân tích. Bundle/asset gốc **không** được commit (`raw/` gitignored). Khi viết `packages/game-data`, mọi tên và mô tả phải là bản gốc.

## 2. Tên game và nhãn hiệu

- Tra trùng trên **IP Việt Nam** (Cục SHTT, WIPOPublish) và **WIPO Global Brand Database**; kiểm tra tên trên App Store/Google Play/Steam.
- Đăng ký nhãn hiệu nhóm 9 (phần mềm game) và 41 (dịch vụ giải trí trực tuyến) khi đã chốt tên.
- Đăng ký domain `.vn` / `.com` sớm.

## 3. Quản lý trò chơi điện tử trên mạng (Việt Nam)

Văn bản chính: **Nghị định 147/2024/NĐ-CP** (hiệu lực 25/12/2024) về quản lý, cung cấp, sử dụng dịch vụ Internet và thông tin trên mạng; **Nghị định 174/2026/NĐ-CP** (hiệu lực 01/07/2026) về xử phạt vi phạm hành chính trong bưu chính, viễn thông, CNTT (theo báo chí).

| Phân loại | Định nghĩa (tóm tắt) | Game của mình |
|---|---|---|
| **G1** | nhiều người chơi **tương tác với nhau** qua máy chủ của doanh nghiệp | **Có**: world boss chung, arena, chat, BXH, nên nhiều khả năng là G1 |
| G2 | người chơi chỉ tương tác với máy chủ | bản MVP không có arena/chat vẫn có BXH, cần luật sư xác định |
| G3 | nhiều người chơi tương tác, không qua máy chủ | không |
| G4 | tải về, không tương tác | không |

Yêu cầu chính với G1 (theo thông tin công khai, cần xác minh):

- Doanh nghiệp phải có **Giấy phép cung cấp dịch vụ trò chơi điện tử G1** và **Quyết định phê duyệt nội dung, kịch bản** cho từng game trước khi phát hành.
- Tên miền đăng ký hợp pháp. Hệ thống kỹ thuật kết nối thanh toán qua **tổ chức cung ứng dịch vụ thanh toán/trung gian thanh toán hợp pháp**, lưu thông tin thanh toán, cho người chơi tra cứu lịch sử nạp trong tài khoản.
- Máy chủ: hợp đồng thuê còn hiệu lực tối thiểu 6 tháng với đơn vị có giấy phép viễn thông.
- **Xác thực tài khoản bằng số điện thoại di động Việt Nam** (họ tên, ngày sinh, SĐT). Người dưới 16 tuổi do cha mẹ/người giám hộ đăng ký. Từ 01/07/2026 mức phạt khi không xác thực là **40–60 triệu đồng** với G1 (20–40 triệu với G2–G4).
- Người chơi **dưới 18 tuổi**: tối đa **60 phút/game/ngày** và **180 phút/ngày** trên tất cả game của cùng doanh nghiệp. Hiển thị cảnh báo "Chơi quá 180 phút một ngày sẽ ảnh hưởng xấu đến sức khỏe" mỗi 30 phút.
- Báo chí cũng nêu: **mua bán vật phẩm ảo** trái quy định có thể bị phạt (người chơi tới 3 triệu đồng). Thiết kế **không** có giao dịch vật phẩm lấy tiền thật giữa người chơi.

**Phương án thực tế cho dev indie** (cân nhắc với luật sư):

| Phương án | Ưu | Nhược |
|---|---|---|
| A. Closed beta **miễn phí**, giới hạn người chơi, không thu tiền | rủi ro thấp nhất để kiểm chứng sản phẩm | chưa có doanh thu; vẫn nên xác thực SĐT nếu có tính năng G1 |
| B. **Hợp tác nhà phát hành** đã có giấy phép G1 (chia doanh thu) | pháp lý, thanh toán, marketing có sẵn | chia doanh thu 30–70%, mất một phần quyền quyết định |
| C. Lập doanh nghiệp + xin giấy phép G1 + phê duyệt nội dung | toàn quyền | hồ sơ và thời gian dài, chi phí |
| D. Phát hành **quốc tế** trước (EN), không nhắm thị trường VN | thủ tục khác, Stripe/Paddle | phải tuân thủ luật nơi phát hành; người chơi VN vẫn có thể truy cập, cần đánh giá |

Khuyến nghị: **A → (B hoặc C)**. Thiết kế sẵn kỹ thuật cho các yêu cầu G1 ngay từ đầu (OTP SĐT, giới hạn giờ chơi theo tuổi, lịch sử nạp, lưu log) để không phải đập đi làm lại.

## 4. Dữ liệu cá nhân

- **Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15** (hiệu lực **01/01/2026**). Nghị định 13/2023/NĐ-CP là văn bản trước đó, cần kiểm tra phần còn hiệu lực/hướng dẫn mới.
- Việc cần làm: chính sách quyền riêng tư rõ ràng; **xin đồng ý** trước khi thu thập (SĐT, ngày sinh, analytics); chỉ thu thập dữ liệu cần thiết; cho phép xem/sửa/**xóa tài khoản**; không bán dữ liệu; mã hóa dữ liệu nhạy cảm; quy trình xử lý sự cố lộ lọt.
- Không gọi dịch vụ geo-IP bên thứ ba từ client mà không thông báo (fworldgm gọi `ipwho.is`). Nếu cần thì xử lý phía server và ghi trong chính sách.
- Không hiển thị dữ liệu tài chính (số tiền nạp) của người chơi cho người khác.

## 5. Thuế, doanh nghiệp, thanh toán

- Thu tiền thường xuyên: cần **hộ kinh doanh hoặc công ty**, tài khoản ngân hàng đứng tên tổ chức, hóa đơn điện tử, kê khai thuế (GTGT, TNDN/TNCN). Không thu qua tài khoản cá nhân như fworldgm.
- Hợp đồng với cổng thanh toán/trung gian thanh toán có giấy phép NHNN. Lưu chứng từ đối soát.
- Điều khoản sử dụng: chính sách hoàn tiền, xử lý tài khoản vi phạm, bảo lưu quyền điều chỉnh cân bằng, đóng dịch vụ (thông báo trước, xử lý số dư Ngọc).

## 6. Tuân thủ store (nếu có app)

- Công bố tỉ lệ vật phẩm ngẫu nhiên (Apple, Google bắt buộc với loot box).
- Mua bằng tiền thật trong app phải dùng IAP của store (trừ ngoại lệ). Web PWA không bị ràng buộc này.
- Đánh giá độ tuổi (IARC), chính sách quyền riêng tư, hướng dẫn xóa tài khoản.

## 7. Sổ đăng ký rủi ro

| # | Rủi ro | Khả năng | Ảnh hưởng | Giảm thiểu |
|---|---|---|---|---|
| R1 | Vi phạm IP (vô tình dùng asset/tên có bản quyền) | TB | Cao | quy trình duyệt asset + license log; tên gốc; tra nhãn hiệu |
| R2 | Vận hành G1 không phép / không xác thực SĐT | Cao nếu thu tiền | Cao | phương án A → B/C; kỹ thuật sẵn sàng G1 |
| R3 | Gian lận / nhân đôi tài nguyên | TB | Cao | server-authoritative, khóa player, idempotency, event log, test race |
| R4 | Mất dữ liệu | Thấp | Rất cao | backup giờ/ngày, diễn tập restore, migration có rollback |
| R5 | Lạm phát kinh tế / power creep | Cao | TB | sim trong CI, dashboard tiền tệ, sink mới theo LiveOps |
| R6 | Người chơi hết nội dung nhanh hơn dự kiến | Cao | TB | độ khó hầm 1–10, roadmap nội dung hàng tháng, hệ thống lặp (arena, boss) |
| R7 | Retention thấp (D1 < 30%) | TB | Cao | đo funnel FTUE từng bước, A/B test onboarding, phỏng vấn người chơi |
| R8 | Chi phí server tăng đột biến | Thấp | TB | ngân sách request/người, catch-up có giới hạn CPU, Cloudflare cache |
| R9 | Tấn công DDoS / bot | TB | TB | Cloudflare WAF, rate limit, captcha khi nghi ngờ |
| R10 | Burn-out (solo dev) | Cao | Cao | phạm vi MVP nhỏ, milestone rõ, nghỉ định kỳ, tìm cộng sự |
| R11 | Đối thủ (fworldgm hoặc game khác) ra tính năng tương tự | Cao | Thấp | cạnh tranh bằng chất lượng/UX/công bằng, cộng đồng |
| R12 | Phụ thuộc một cổng thanh toán | TB | TB | tích hợp ≥ 2 kênh, lớp abstraction `PaymentProvider` |

## 8. Danh sách cần làm (checklist)

- [ ] Tra trùng tên + đăng ký domain
- [ ] Quyết định phương án pháp lý (A/B/C/D) cùng luật sư trước v1.1
- [ ] Chính sách quyền riêng tư + điều khoản sử dụng (vi/en)
- [ ] License log cho mọi asset (nguồn, giấy phép, ngày mua, bằng chứng)
- [ ] Trang credits trong game (CC-BY)
- [ ] Công bố tỉ lệ tuyển mộ/chế tạo/cường hóa trong game
- [ ] Kỹ thuật: OTP SĐT, khai báo ngày sinh, bộ đếm thời gian chơi theo tuổi, cảnh báo 30 phút, lịch sử nạp
- [ ] Pháp nhân + tài khoản doanh nghiệp + hợp đồng cổng thanh toán (trước khi thu tiền)
