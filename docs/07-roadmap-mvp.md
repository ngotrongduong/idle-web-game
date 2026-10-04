# 07: Lộ trình MVP và backlog

> Giả định: **1 dev full-time** (hoặc 2 dev part-time), art thuê ngoài theo lô. Tổng **~14 tuần** tới closed beta, cộng 4 tuần beta và 6 tuần tới v1.1. Mỗi milestone kết thúc bằng một bản **chơi được** deploy lên môi trường staging.

## Tổng quan

```
Tuần:  0    1-2        3-6             7-9            10-12          13-14        15-18          19-24
      [P0]  [M0 Nền]   [M1 Core loop]  [M2 Meta]      [M3 Polish]    [M4 Beta]    [Closed beta]  [v1.1 Social + $]
       │      │            │               │              │              │
       │      │            │               │              │              └─ 100–300 tester
       │      │            │               │              └─ art thật, PWA, load test
       │      │            │               └─ quest chính, mail, BXH, GM tool
       │      │            └─ chơi được vòng lặp chính (placeholder art)
       │      └─ monorepo, CI, engine chiến đấu + sim
       └─ chốt tên/IP, art direction, sheet config v0
```

## P0: Tiền sản xuất (tuần 0, 3–5 ngày)

| Việc | Đầu ra / tiêu chí xong |
|---|---|
| Chốt tên tạm + tra trùng nhãn hiệu sơ bộ (NOIP, WIPO Brand DB), mua domain | tên + domain |
| Moodboard art, chọn phương án (pixel / chibi), tìm 1–2 họa sĩ | moodboard + báo giá |
| Sheet config v0: 4 họ class T1–T3, 4 hầm, 12 họ quái, ~30 item, ~15 nguyên liệu | Google Sheet có cấu trúc đúng schema (04 §8) |
| Paper prototype: tính tay 10 trận để thử công thức (03 §3) | spreadsheet |

## M0: Nền móng (tuần 1–2)

| # | Việc | Tiêu chí chấp nhận |
|---|---|---|
| M0.1 | Scaffold monorepo: `apps/web`, `apps/server`, `packages/game-core`, `game-data`, `api-contract`, `i18n`, `tools/sim` | `pnpm dev` chạy web + server; `pnpm test` xanh |
| M0.2 | CI GitHub Actions: lint (ESLint + Prettier), typecheck, test, build | PR bị chặn khi đỏ |
| M0.3 | `game-data`: CSV → JSON + Zod validator + kiểm tra tham chiếu | build lỗi khi item trong loot không tồn tại |
| M0.4 | `game-core`: RNG có seed, công thức chỉ số/sát thương, `simulateWave`, lint cấm `Math.random` | golden test hash ổn định trên Node + Chromium |
| M0.5 | `tools/sim battle` và `sim upgrade` | in tỉ lệ thắng/lượt cho đội mẫu vs hầm 1–4 |
| M0.6 | Server: Fastify + Drizzle + migrations, guest auth (cookie session), `/cmd` pipeline với khóa player + idempotency | test song song 2 lệnh không nhân đôi tài nguyên |
| M0.7 | Docker Compose (postgres, server, web), deploy staging lên VPS bằng Caddy | URL staging HTTPS |

## M1: Core loop (tuần 3–6)

| # | Việc | Tiêu chí chấp nhận |
|---|---|---|
| M1.1 | Hero + Sảnh Hội + Tavern (refresh 2 giờ, pity, tuyển mộ) | tuyển được hero, pity đúng theo sim |
| M1.2 | Đội + hầm: gán hero, start/stop, replay client từ seed (DOM trước, PixiJS sau) | xem được 5 wave + boss wave, khớp kết quả server |
| M1.3 | Idle catch-up + báo cáo vắng mặt (cap 8 giờ) | e2e: giả lập +3 giờ thì nhận đúng thưởng (±5% so với sim) |
| M1.4 | Level, EXP, thăng tier, chọn nhánh, tiềm năng 20% | thăng T1 → T2 → T3 chạy end-to-end |
| M1.5 | Kho, trang bị, mặc/tháo, bán, khóa, auto-sell | không mất item khi thao tác nhanh |
| M1.6 | Chế tạo (phẩm chất ngẫu nhiên), Lò Rèn, cường hóa +1…+5 | tỉ lệ thực tế khớp bảng (test thống kê) |
| M1.7 | Công trình có thời gian xây, tăng tốc; cấp Lò Rèn, phân rã đồ ra Bụi Rèn | cấp mới chỉ có hiệu lực khi hết giờ theo đồng hồ server; một thợ xây; tăng tốc không dùng thừa vật phẩm |
| M1.8 | i18n vi/en cho toàn bộ chuỗi đã có | đổi ngôn ngữ không reload |

**Mốc M1**: người thử chơi được 30 phút liên tục với placeholder art, không bị kẹt.

## M2: Meta và vận hành (tuần 7–9)

| # | Việc | Tiêu chí chấp nhận |
|---|---|---|
| M2.1 | Quest chính (~40 bước), mở khóa tính năng dần | funnel từng bước ghi `tutorial_step` |
| M2.2 | Quest ngày/tuần + rương mốc, reset 05:00 VN (pg-boss) | reset đúng giờ, không trùng thưởng |
| M2.3 | Hòm thư (cá nhân + toàn server, đính kèm, hết hạn) | |
| M2.4 | Bảng xếp hạng (lực chiến, độ khó hầm cao nhất) | cập nhật 5 phút |
| M2.5 | Đội hình combo + khắc hệ + 2 công tắc chiến thuật | sim xác nhận combo không quá mạnh (≤ +15% tỉ lệ thắng) |
| M2.6 | GM tool (`apps/admin`): tìm người chơi, xem state, gửi mail, ban/mute, xem event log, publish config | audit log mọi thao tác |
| M2.7 | Analytics events (06 §6) + dashboard Metabase cơ bản | xem được funnel FTUE |
| M2.8 | Liên kết tài khoản guest → Google/email; đổi mật khẩu; xóa tài khoản | |

## M3: Polish và sẵn sàng (tuần 10–12)

| # | Việc | Tiêu chí chấp nhận |
|---|---|---|
| M3.1 | Tích hợp art thật (lô 1: hero, quái, nền, UI kit) | không còn placeholder ở FTUE |
| M3.2 | PixiJS battle scene: animation, hiệu ứng, số sát thương bay | 60 FPS trên máy tầm trung, fallback khi WebGL lỗi |
| M3.3 | Âm thanh + cài đặt (âm lượng, ngôn ngữ, thông báo) | |
| M3.4 | PWA: manifest, offline shell, Web Push "đội đầy túi / xây xong" | cài được trên Android Chrome, iOS Safari 16.4+ |
| M3.5 | Hiệu năng: code-splitting, ngân sách JS < 250 KB gzip | Lighthouse mobile ≥ 85 |
| M3.6 | Bảo mật: CSP, rate limit, kiểm tra quyền admin, review OWASP Top 10 | |
| M3.7 | Load test k6 (2.000 người chơi ảo) | p95 < 150 ms |
| M3.8 | Backup/restore tự động + diễn tập | khôi phục staging từ backup trong < 30 phút |
| M3.9 | Trang chính sách quyền riêng tư, điều khoản, credits, công bố tỉ lệ | (08) |

## M4: Closed beta (tuần 13–14 chuẩn bị, tuần 15–18 chạy)

- Tuần 13–14: sửa lỗi, cân bằng theo sim, landing page + form đăng ký beta, Discord/Facebook group, chuẩn bị FAQ.
- Tuần 15–18: 100–300 tester, **không thu tiền**. Mỗi tuần 1 bản cập nhật cân bằng, theo dõi KPI (02 §10). Phỏng vấn 10 người chơi.
- **Tiêu chí ra open beta**: D1 ≥ 35%, D7 ≥ 15%, FTUE ≥ 55%, lỗi nghiêm trọng = 0, không có lỗ hổng nhân đôi tài nguyên.

## v1.1: Social + monetization (tuần 19–24)

| Việc | Ghi chú |
|---|---|
| World boss (chu kỳ 4 giờ, HP chung) | xem [04 §7](04-technical-architecture.md#7-realtime-và-nội-dung-chung-server) |
| Arena bất đồng bộ, mùa 7 ngày | |
| Chat thế giới + moderation | |
| Pet | |
| Mở rộng nội dung: họ class 5–6, T4–T5, hầm 5–6, cường hóa +10 | theo nhịp 03 §4 (người chơi nhanh hết nội dung MVP ở D10–D14) |
| Shop + thanh toán (VietQR webhook trước, ví điện tử sau), thẻ tháng, battle pass | **chỉ khi xong khung pháp lý** (08) |
| Xác thực SĐT (OTP) + giới hạn thời gian chơi cho người dưới 18 | bắt buộc nếu vận hành G1 tại VN |

## Later (sau tháng 6)

Bang hội + boss bang, rune/bộ ấn, nhiều server + gộp server, sự kiện theo mùa (Tết…), app Android/iOS (Capacitor), bản quốc tế (EN, Stripe), họ class 7–8 và T6–T8.

## Quy trình làm việc

- **Kanban** (GitHub Projects): Backlog → Ready (có tiêu chí chấp nhận) → In progress (WIP ≤ 2) → Review → Done.
- Mỗi tuần: thứ Hai lập kế hoạch 30 phút, thứ Sáu demo cho bản thân/bạn bè + ghi changelog.
- Branch `main` luôn deploy được; PR nhỏ (< 400 dòng), mỗi PR có test.
- **Cắt phạm vi trước khi trễ hẹn**: nếu M1 trễ > 1 tuần thì bỏ công tắc chiến thuật, đội hình combo sang v1.1, và giữ nguyên ngày beta.

## Rủi ro lộ trình

| Rủi ro | Dấu hiệu | Phản ứng |
|---|---|---|
| Engine chiến đấu không deterministic giữa client/server | golden test lệch trên WebKit | dùng số nguyên tuyệt đối; nếu vẫn lệch thì client chỉ phát log do server gửi (bỏ tự mô phỏng) |
| Art trễ | họa sĩ trễ mốc lô 1 | dùng asset pack cho beta, art riêng cho bản ra mắt |
| Cân bằng sai (quá nhanh/chậm) | sim lệch mốc > 20% | chỉnh config, không đổi code |
| Burn-out solo | trễ 2 milestone liên tiếp | giảm phạm vi, nghỉ 1 tuần, tìm cộng sự part-time |
