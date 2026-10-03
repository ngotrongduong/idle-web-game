# Research: fworldgm.com ("FWORLD GM — Fantasy World: Guild Master")

Thư mục này chứa **bằng chứng thu thập được** khi inspect game https://fworldgm.com/ ngày **2026-10-03**. Phần tổng hợp bài học và kế hoạch cho game của mình nằm trong [`docs/`](../../docs/README.md).

## Tóm tắt nhanh

| Mục | Phát hiện |
|---|---|
| Thể loại | **Idle Guild Master RPG**: quản lý guild, chiêu mộ nhà thám hiểm (tavern), gửi đội 4 người auto-battle qua hầm ngục (chạy song song, farm cả khi offline), thăng class 8 tier, chế tạo/cường hóa trang bị, pet, rune, world boss chung server, arena PvP bất đồng bộ |
| Nền tảng | Web (mobile-first, khung ~400px), song ngữ VI/EN |
| Client | **Expo / React Native Web** (bundle Metro 4,1 MB, một file), bị **javascript-obfuscator** (string array) |
| Backend | **PHP 8.3** (`api.php?action=…`) trên **Hostinger** (CDN `hcdn`), Socket.IO tại `socket.fworldgm.com` (chỉ cho chat/presence) |
| Kiến trúc dữ liệu | Server-authoritative: mỗi action trả về **toàn bộ `saveData`** (JSON blob, `SAVE_VERSION 4`); trận đánh mô phỏng trên server, trả về log kèm snapshot |
| Monetization | Tiền cao cấp "Sao ⭐": closed beta 1.000đ = 10⭐, sau beta 1.000đ = 5⭐; thanh toán SePay (QR chuyển khoản), MoMo, chuyển khoản tay; mốc nạp tích lũy, sự kiện lật thẻ, Star Shop |
| Trạng thái | Mở ngày **27/09/2026** (closed beta), arena đang ở mùa 2 |
| Quy mô nội dung | 288 class (8 họ × 36), 8 hầm ngục × 5 wave, 32 họ quái × 4 bậc, 502 trang bị, 340 công thức, 95 nguyên liệu, 31 đội hình |

## Danh mục tài liệu

| File | Nội dung | Cách tạo |
|---|---|---|
| [01-static-recon.md](01-static-recon.md) | HTML, header, hosting, meta/OG, tài nguyên tĩnh | viết tay từ curl + capture |
| [02-har-analysis.md](02-har-analysis.md) | Host, tài nguyên, fingerprint công nghệ, API khi load trang | `pnpm inspect:analyze` |
| [03-config-tables.md](03-config-tables.md) | 59 bảng config phát hiện tự động + thống kê cột | `pnpm inspect:extract` |
| [04-game-data.md](04-game-data.md) | Dữ liệu game đã chọn lọc: class, hầm ngục, quái, item, rune, pet, đội hình, kinh tế, công thức | `pnpm --filter @idle/inspect fworldgm:report` |
| [05-api-architecture.md](05-api-architecture.md) | Danh mục ~80 API action, schema saveData, auth, socket, nhận xét bảo mật | viết tay từ bundle đã giải mã + log API |
| [06-mechanics.md](06-mechanics.md) | Công thức chiến đấu, EXP, loot, offline, cường hóa, chi phí | viết tay từ code đã giải mã |
| [07-gameplay-walkthrough.md](07-gameplay-walkthrough.md) | Chơi thử bằng tài khoản test: onboarding, 9 tab, UI, LiveOps, monetization | viết tay + screenshot |
| [data/](data/) | JSON máy đọc được: `har-analysis.json`, `config-tables.json`, `fworldgm-mechanics.json` | sinh tự động |
| [screenshots/](screenshots/) | Ảnh màn hình (username người chơi khác đã được làm mờ) | `capture.ts`, `explore.ts` |

## Phương pháp

1. **Static recon**: `curl` trang chủ, header, file tĩnh. Server trả SPA fallback (mọi path đều ra `index.html`).
2. **Capture động**: `tools/inspect/src/capture.ts` (Playwright + Chromium, desktop 1280×720 và iPhone 13) ghi HAR, request, console, screenshot.
3. **Giải mã bundle**: `deobfuscate-strings.ts` chạy riêng phần decoder của javascript-obfuscator trong `node:vm` (không chạy code game), giải mã được 12.525 chuỗi và thay 50.088 lời gọi decoder. Sau đó format lại bằng prettier để đọc logic.
4. **Dump dữ liệu**: `dump-metro-modules.ts` gọi registry `__r(id)` của Metro trong trình duyệt để lấy các hằng số dữ liệu (CLASSES, ITEMS, DUNGEONS…). `tabulate-fworldgm.ts` gọi các hàm công thức thuần (chi phí, EXP, tỉ lệ) để lập bảng. Toàn bộ chạy phía client, không gọi API.
5. **Chơi thử**: `explore.ts` dùng một tài khoản test (username/mật khẩu ngẫu nhiên, không dùng thông tin cá nhân) để đi qua onboarding, gửi đội vào hầm ngục đầu và chụp từng tab. Không nạp tiền, không tấn công arena/world boss, không gửi chat.

### Nguyên tắc đã tuân thủ

- Chỉ quan sát như một người chơi: không fuzz, không load test, không gọi endpoint admin, không thử khai thác lỗ hổng.
- Bundle, HAR, body response, profile trình duyệt và thông tin tài khoản test nằm trong `raw/` (**gitignored**), không commit mã/asset có bản quyền của bên khác.
- Báo cáo đã che token/cookie. Username người chơi khác trong screenshot đã làm mờ, và tài liệu chỉ giữ số liệu tổng hợp.

## Chạy lại

```bash
pnpm install                                   # tại gốc repo
pnpm inspect:test                              # self-test bộ công cụ (không cần mạng)
pnpm inspect:capture --url https://fworldgm.com/ --wait 30
pnpm inspect:analyze --har research/fworldgm/raw/<capture-dir>/desktop
pnpm --filter @idle/inspect deobf --in research/fworldgm/raw/static/bundle.js
pnpm --filter @idle/inspect dump-metro --url https://fworldgm.com/ --out research/fworldgm/raw/static/metro-exports.json
pnpm --filter @idle/inspect fworldgm:tabulate --out research/fworldgm/raw/static/formulas.json
pnpm --filter @idle/inspect fworldgm:report
```

Lưu ý khi chạy trong container cloud: domain phải được cho phép (Network access = Full hoặc Custom), và Chromium phải tin CA của proxy (`certutil -A -n ccr-agent-proxy -t "C,," -i /root/.ccr/agent-proxy-ca.crt -d sql:$HOME/.pki/nssdb`).
