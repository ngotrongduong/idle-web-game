# 05: Nội dung, art, âm thanh, bản địa hóa

## 1. Art direction

**Đề xuất: pixel art 2D "HD-2D lite"** (sprite 48–64px, nền vẽ tay độ phân giải thấp, UI phẳng hiện đại).

| Lý do | Chi tiết |
|---|---|
| Rẻ và nhanh | nhiều asset pack thương mại chất lượng; 1 họa sĩ freelance làm được sprite + animation |
| Nhẹ | spritesheet nhỏ, hợp mobile web (mục tiêu < 5 MB asset cho MVP) |
| Nhất quán | tránh lỗi của fworldgm (pixel sprite lẫn art anime AI) |
| Thân thiện idle | đọc rõ ở kích thước nhỏ, animation 4–8 frame là đủ |

Phương án B: **chibi vector 2D** (Spine/DragonBones hoặc PixiJS mesh), đẹp và "mobile" hơn nhưng tốn công rig.

Key art (logo, màn đăng nhập, banner sự kiện, avatar boss) có thể là tranh vẽ chi tiết hơn, miễn cùng bảng màu và tinh thần.

## 2. Danh sách asset cho MVP

| Nhóm | Số lượng | Chi tiết |
|---|---|---|
| Hero | 24 class (4 họ × 6) | mỗi class: idle (4f), attack (6f), ULT (8f), hit/death (4f). T2/T3 dùng palette swap + phụ kiện để giảm chi phí |
| Quái | 12 họ × 3 bậc (thường / tinh anh / boss) = 36 | idle, attack, hit. Bậc cao = palette + kích thước + hiệu ứng |
| Boss hầm | 4 | sprite lớn 96–128px + key art |
| Nền hầm | 4 | parallax 2–3 lớp |
| Hội quán | 1 cảnh chính + 4 công trình × 3 cấp hình ảnh | thay đổi khi nâng cấp |
| Item icon | ~60 trang bị + ~25 nguyên liệu + ~15 vật phẩm đặc biệt | 32–48px |
| Hiệu ứng | ~20 | chém, bắn, nổ phép, hồi máu, buff/debuff, crit, level up, thăng tier |
| UI kit | 1 bộ | khung, nút, thanh HP/MP, tab, popup, icon tiền tệ, viền theo độ hiếm |
| Logo / key art / OG image | 3–5 | |

## 3. Nguồn asset hợp pháp

| Nguồn | Ghi chú | Lưu ý giấy phép |
|---|---|---|
| Asset pack thương mại (itch.io, CraftPix, GameDev Market, Unity Asset Store bản 2D) | rẻ (5–50 USD/pack), dùng để prototype và cả bản phát hành | đọc kỹ license: thương mại OK? được sửa? cấm phân phối lại dạng file gốc |
| CC0 (Kenney.nl, OpenGameArt lọc CC0) | miễn phí, không cần ghi công | kiểm tra từng file; OpenGameArt có nhiều license khác nhau |
| CC-BY (game-icons.net …) | miễn phí, **bắt buộc ghi công** | thêm trang "Credits" trong game |
| Thuê freelancer (VN: Facebook groups, Behance; quốc tế: Fiverr, ArtStation) | dùng cho hero/boss/key art để có bản sắc riêng | hợp đồng **chuyển giao quyền tác giả** (work-for-hire), giữ file nguồn |
| AI hỗ trợ (concept, moodboard) | tăng tốc ý tưởng | không dùng output AI làm asset cuối nếu chưa rõ quyền; nếu dùng thì nên cho họa sĩ vẽ lại. Ghi chú chính sách store về nội dung AI |

**Ước tính ngân sách art MVP** (tham khảo, VN freelance):

| Hạng mục | Khoảng chi phí |
|---|---|
| Asset pack (nền, quái, UI, icon) | 100–300 USD |
| Freelance: 4 hero gốc + palette tier, 4 boss, logo/key art | 800–2.500 USD |
| Âm thanh (pack + 3 track nhạc) | 50–300 USD |
| **Tổng** | **~1.000–3.000 USD** |

## 4. Âm thanh

- Nhạc: 3 track loop (hội quán, hầm ngục, boss) + jingle (thăng tier, nhận thưởng lớn). Nguồn: pack bản quyền (itch.io, Humble bundles) hoặc commission.
- SFX: ~30 file (đánh, phép, crit, rơi đồ theo độ hiếm, cường hóa thành công/thất bại, nút UI). Định dạng `.webm/opus` + fallback `.mp3`, tổng < 1,5 MB.
- Dùng Howler.js hoặc Web Audio API trực tiếp. Tôn trọng chế độ im lặng; mặc định tắt trên mobile.

## 5. Viết nội dung (content writing)

- Tên hero ngẫu nhiên: 2 bộ tên (Việt và fantasy) × giới tính, ~300 tên, lọc từ nhạy cảm.
- Mỗi hầm: tên, 2–3 câu lore, 1 câu thoại boss. Mỗi item: 1 câu mô tả ngắn, hài hước nhẹ.
- Toàn bộ chuỗi đi qua `packages/i18n` (ICU: số nhiều, biến số). Có bảng thuật ngữ (glossary) VI ↔ EN để dịch nhất quán.
- **Không sao chép** tên class, quái, item, mô tả của fworldgm hay game khác. Danh sách từ fworldgm ở `research/` chỉ dùng để tham khảo **quy mô**.

## 6. Bản địa hóa

| Ngôn ngữ | Giai đoạn | Ghi chú |
|---|---|---|
| Tiếng Việt | MVP (mặc định) | font hỗ trợ đầy đủ dấu: **Be Vietnam Pro** hoặc **Nunito** (SIL OFL) |
| Tiếng Anh | MVP | mở rộng thị trường quốc tế, có thể là phương án pháp lý (08 §3) |
| Thái / Indonesia | Later | thị trường idle SEA lớn |

Định dạng số: `1.234.567` (vi) / `1,234,567` (en); rút gọn K/M/B; ngày giờ theo `Asia/Ho_Chi_Minh` cho reset, hiển thị theo giờ máy người chơi.

## 7. Quy trình sản xuất nội dung

1. Thiết kế trong Sheets (class, skill, quái, hầm, item, công thức) → `pnpm data:build` validate.
2. Placeholder art (hình khối màu + tên) để test cân bằng **trước** khi đặt vẽ.
3. Đặt art theo lô sau khi cân bằng ổn (tránh vẽ class bị cắt).
4. Mỗi asset có ID khớp config (`hero.warrior.t2.knight`). Script kiểm tra asset thiếu/thừa trong CI.
5. Atlas hóa sprite (TexturePacker hoặc free-tex-packer) → `.webp` + JSON cho PixiJS.
