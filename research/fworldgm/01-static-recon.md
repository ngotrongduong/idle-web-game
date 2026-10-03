# 01: Static recon fworldgm.com

Ngày thu thập: 2026-10-03. Nguồn: `curl` + `tools/inspect/src/capture.ts` (dữ liệu thô trong `raw/static/`, `raw/capture-2/`, gitignored).

## Hosting và header

| Header / dấu hiệu | Giá trị | Ý nghĩa |
|---|---|---|
| `server` | `hcdn` | CDN của **Hostinger** |
| `platform` / `panel` | `hostinger` / `hpanel` | shared hosting / cloud hosting Hostinger (hPanel) |
| `x-powered-by` | `PHP/8.3.33` | backend PHP |
| `cache-control` (HTML) | `no-cache, no-store, must-revalidate` | luôn tải HTML mới (để nhận bundle mới) |
| `cache-control` (bundle JS) | `public, max-age=31536000, immutable` | bundle có hash trong tên + `?v=<timestamp>` |
| `cache-control` (ảnh) | `public, max-age=604800` | 7 ngày |
| `content-security-policy` | `upgrade-insecure-requests` | CSP tối thiểu (không có `script-src`) |
| `alt-svc` | `h3=":443"` | hỗ trợ HTTP/3 |
| HTTP | HTTP/2 | |

Routing: mọi path (`/robots.txt`, `/sitemap.xml`, `/manifest.json`, `/.well-known/security.txt`) đều trả về chính `index.html` (2.702 byte), tức là **SPA fallback**, không có robots/sitemap/manifest thật. `favicon.ico` (14,5 KB) và `logo.jpg` (1012×450, 156 KB, dùng cho OG image) là file thật.

## HTML

- `<title>FWORLD GM</title>`, `lang="en"`, viewport mobile (`width=device-width, initial-scale=1, shrink-to-fit=no`).
- Style reset của **Expo** (`<style id="expo-reset">`), `<div id="root">`, một script duy nhất: `/_expo/static/js/web/index-<hash>.js?v=<timestamp>` (`defer`).
- Comment gốc của template Expo Router ("Use static rendering with Expo Router…"), nhưng không bật static rendering: HTML rỗng, render hoàn toàn bằng JS.
- SEO/OG:
  - `description` / `og:description`: "Xây dựng guild của riêng bạn: chiêu mộ anh hùng, nâng cấp class, chế tạo trang bị và chinh phục hầm ngục — game idle RPG chơi ngay trên trình duyệt."
  - `og:title`: "FWORLD GM — Idle Guild Master"; `og:image`: `/logo.jpg`; `twitter:card`: `summary_large_image`.

## Tài nguyên khi tải trang (chưa đăng nhập)

| Request | Kích thước | Ghi chú |
|---|---|---|
| `GET /` | 2,7 KB | HTML |
| `GET /_expo/static/js/web/index-93ffc551….js` | **4,08 MB** (không nén trong HAR) | toàn bộ app trong một bundle, không code-splitting |
| `GET https://ipwho.is/` | 0,8 KB | **tra vị trí địa lý theo IP** của người chơi (dịch vụ bên thứ ba) |
| `GET /api.php?action=get_class_stats` | 328 B | gọi kèm header `X-API-Key`; không có key sẽ trả `{"ok":false,"error":"API key khong hop le."}` |
| `GET /assets/assets/login_bg.<hash>.jpg` | 237 KB (webp) | nền màn đăng nhập |

Asset sau khi đăng nhập nằm dưới `/assets/assets/...<hash>.(png|jpg)`: sprite class, quái, item, vòng aura, nền hầm ngục, banner nạp. Bundle tham chiếu **448 cell sprite**, 317 sprite item, 136 sprite quái, 8 sprite class (theo họ) và 8 vòng aura.

## Fingerprint công nghệ

| Lớp | Công nghệ | Bằng chứng |
|---|---|---|
| UI framework | Expo SDK + React Native Web + React | `_expo/static`, `expo-reset`, global `expo`, `__reactResponderSystemActive`, cảnh báo `useNativeDriver` |
| Bundler | Metro | global `__d`, `__r`, `__c`, `__METRO_GLOBAL_PREFIX__`, `__BUNDLE_START_TIME__` |
| Build | javascript-obfuscator (string array + base64 + rotation) | global `_0x204d` (decoder) và `_0x3d41` (mảng chuỗi) |
| Render | DOM (React Native Web), **không dùng canvas/WebGL** | probe: 0 canvas; sprite là `<img>`/background |
| Realtime | Socket.IO client (engine.io packet types 0–6) | `PACKET_TYPES`, `socket.fworldgm.com` (chat, presence) |
| Icon | react-native-vector-icons (Material Community Icons, FontAwesome) | glyph private-use trong text |
| Thanh toán | SePay (QR chuyển khoản), MoMo, Buy Me a Coffee | action `sepay_*`, chuỗi "momo", `buymeacoffee.com/vikclass` |
| Cộng đồng | Nhóm Zalo | link `zalo.me/g/…` trong bundle |
| Dev flags | `__DEV__` có mặt; endpoint local `http://localhost/server/api.php`, socket `http://localhost:3001` | config hard-code trong bundle |

## Nhận xét

- **Ưu điểm**: một codebase (Expo) có thể build ra web, Android và iOS; deploy rất rẻ (shared hosting PHP); cache bundle immutable đúng cách.
- **Nhược điểm**: bundle 4 MB không code-split nên lần tải đầu chậm trên 3G/4G yếu. Không có PWA manifest hay service worker. HTML rỗng nên SEO kém. Obfuscation chỉ làm chậm người đọc chứ không bảo vệ được logic (đã giải mã toàn bộ chuỗi trong < 1 giây). Gọi `ipwho.is` mà không thông báo là vấn đề quyền riêng tư (xem `docs/08-legal-risks.md`).
