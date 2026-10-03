# @idle/inspect

Bộ công cụ **inspect thụ động** một web game, dùng để làm teardown trong [`research/`](../../research/). Chỉ quan sát như người chơi: không fuzz, không load test, không gọi endpoint admin.

| Script | Lệnh | Việc làm |
|---|---|---|
| `src/capture.ts` | `pnpm capture --url <url> [--wait 30] [--viewport desktop --viewport mobile] [--steps steps.json] [--storage-state s.json]` | Playwright: HAR (kèm body), request/response, frame WebSocket, console, screenshot theo mốc, probe engine/global trong mọi frame, robots/sitemap/manifest. Báo host bị proxy chặn |
| `src/analyze-har.ts` | `pnpm analyze --har <file.har \| thư mục> [--slug x]` | Host/CDN, tài nguyên theo loại/đuôi, fingerprint engine/SDK/thanh toán, danh mục API (gom path), WebSocket (shape, trường lệnh), URL/path trong JS, chuỗi VI/ZH; xuất body ra `raw/bodies` |
| `src/extract-config.ts` | `pnpm extract --dir <bodies> [--min-rows 5] [--full]` | Tìm bảng config (mảng object, map id→object, dạng cột), thống kê cột, nhận diện đường cong tăng trưởng (tuyến tính / mũ / lũy thừa) |
| `src/deobfuscate-strings.ts` | `pnpm deobf --in bundle.js` | Giải mã string-array của javascript-obfuscator (chạy riêng decoder trong `node:vm`) và thay lời gọi bằng literal |
| `src/dump-metro-modules.ts` | `pnpm dump-metro --url <url> --out x.json` | App Expo/React Native Web: dump export viết HOA của mọi module Metro qua `__r(id)` |
| `src/explore.ts` | `pnpm explore --do "click:Text" --do "tap:x,y" --do shot:name …` | Phiên trình duyệt bền (profile) để khám phá game từng bước; log API (đã che token) |
| `src/tabulate-fworldgm.ts`, `src/report-fworldgm-data.ts` | `pnpm fworldgm:tabulate`, `pnpm fworldgm:report` | Riêng cho fworldgm: lập bảng hàm công thức, sinh `04-game-data.md` |
| `test/selftest.ts` | `pnpm test` | 8 test không cần mạng (HAR giả, WS, redaction, bảng config, giải mã) |

Dữ liệu thô ghi vào `research/<slug>/raw/` (**gitignored**: bản quyền bên thứ ba và có thể chứa token). Báo cáo đã che cookie/token/mật khẩu (`src/lib/redact.ts`).

Chạy trong container cloud có proxy TLS: Chromium cần tin CA của proxy:

```bash
certutil -A -n ccr-agent-proxy -t "C,," -i /root/.ccr/agent-proxy-ca.crt -d sql:$HOME/.pki/nssdb
```
