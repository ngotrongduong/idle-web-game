# Tài liệu dự án: Project Guildhall (idle guild RPG trên web)

Bộ tài liệu nền tảng để bắt đầu xây một web game **idle guild-management RPG**, lấy cảm hứng từ phân tích [fworldgm.com](https://fworldgm.com/) (bằng chứng trong [`research/fworldgm/`](../research/fworldgm/README.md)).

## Đọc theo thứ tự

| # | Tài liệu | Trả lời câu hỏi | Trạng thái |
|---|---|---|---|
| 01 | [Teardown fworldgm](01-teardown-fworldgm.md) | Game tham khảo là gì, làm tốt gì, sai gì, mình học gì? | ✅ có dữ liệu thật |
| 02 | [Game Design Document](02-game-design-document.md) | Game của mình là gì: vision, core loop, hệ thống, phạm vi MVP, FTUE, UI | 📝 v0.1, chờ chốt |
| 03 | [Kinh tế và cân bằng](03-economy-balancing.md) | Tiền tệ, công thức, nhịp tiến độ, cường hóa, gacha, loot | 📝 số đề xuất, sẽ hiệu chỉnh bằng sim |
| 04 | [Kiến trúc kỹ thuật](04-technical-architecture.md) | Stack, monorepo, server-authoritative, engine deterministic, DB, idle catch-up, bảo mật, hạ tầng | 📝 v0.1 |
| 05 | [Nội dung, art, âm thanh](05-content-art-audio.md) | Art direction, danh sách asset, nguồn hợp pháp, ngân sách, i18n | 📝 v0.1 |
| 06 | [Monetization và LiveOps](06-monetization-liveops.md) | Bảng giá, kênh thanh toán VN, lịch sự kiện, analytics, KPI | 📝 v0.1 |
| 07 | [Lộ trình MVP](07-roadmap-mvp.md) | Làm gì, theo thứ tự nào, trong bao lâu, tiêu chí xong | 📝 v0.1 |
| 08 | [Pháp lý và rủi ro](08-legal-risks.md) | IP, NĐ 147/2024 (G1), xác thực SĐT, dữ liệu cá nhân, thuế, sổ rủi ro | ⚠ cần luật sư xác minh |

## Quyết định đã chốt

- Thể loại: **Idle RPG treo máy**, cụ thể là idle guild master (giống fworldgm).
- Quy mô: **solo / 1–2 người**, ra **MVP** trong ~14 tuần tới closed beta.
- Stack: **TypeScript full-stack** (React + Vite PWA, Node + Fastify, PostgreSQL, Socket.IO, pnpm monorepo).

## Quyết định còn mở (cần bạn chốt trước M0)

1. Tên game và bối cảnh (đề xuất: huyền huyễn pha văn hóa dân gian Việt; 02 §2).
2. Art direction: pixel HD-2D lite (đề xuất) hay chibi vector (05 §1).
3. Phương án pháp lý trước khi thu tiền: closed beta miễn phí → đối tác phát hành hay tự xin G1 (08 §3).
4. Hosting beta: Singapore (rẻ, nhanh) hay VPS Việt Nam ngay từ đầu (04 §11).

## Bước tiếp theo ngay

1. Đọc 01 → 02 → 07, sửa trực tiếp trên file hoặc comment trong PR.
2. Chốt 4 quyết định còn mở.
3. Bắt đầu **M0** (07): scaffold `apps/` + `packages/` trong monorepo (`pnpm-workspace.yaml` đã có sẵn), viết `packages/game-core` + `tools/sim` trước tiên.
