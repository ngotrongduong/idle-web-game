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
- Bối cảnh: **high fantasy phương Tây** (02 §2). Tên game vẫn là tên tạm "Project Guildhall".
- Art direction: **pixel art HD-2D lite** (05 §1).
- Pháp lý: **closed beta miễn phí**, quyết phương án thu tiền sau (08 §3).
- Chiến đấu: **mỗi wave bắt đầu đầy HP, 50% MP**, công thức sát thương v2 theo 03 §3 (02 §5.4).
- Thưởng idle: **kỳ vọng của 30 vòng mẫu**, vòng dừng ở wave thua đầu tiên (04 §6).
- Tiến độ: **mở hầm theo thứ tự** sau khi hạ boss hầm trước; số đội song song theo cấp Sảnh (02 §5.1, §5.4).

## Quyết định còn mở

1. Tên game chính thức.
2. Phương án thu tiền sau closed beta: đối tác phát hành hay tự xin G1 (08 §3).
3. Hosting beta: Singapore (rẻ, nhanh) hay VPS Việt Nam ngay từ đầu (04 §11).

## Bước tiếp theo ngay

1. Trạng thái code và việc tiếp theo nằm ở [HANDOFF.md](HANDOFF.md). M0 và M1.1–M1.6 đã xong; tiếp theo là M1.7 (công trình có thời gian xây).
2. Quy tắc làm việc cho mọi agent (Claude Code, Codex) nằm ở [`AGENTS.md`](../AGENTS.md); đội agent của Claude Code ở [`CLAUDE.md`](../CLAUDE.md).
3. Đọc 01 → 02 → 07, sửa trực tiếp trên file hoặc comment trong PR.
