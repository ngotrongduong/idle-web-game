# Phân tích HAR: fworldgm

> Sinh tự động bởi `tools/inspect/src/analyze-har.ts` lúc 2026-10-03T13:42:48.221Z. Token/cookie đã được che. Input: `research/fworldgm/raw/capture-2/desktop/capture.har`, `research/fworldgm/raw/capture-2/desktop/ws.jsonl`

## Tổng quan

| Chỉ số | Giá trị |
| --- | --- |
| Số request | 11 |
| Tổng dung lượng | 4.34 MB |
| Số host | 2 |
| WebSocket | 0 |
| WS frames | 0 |

## Nhận diện công nghệ

| Nhóm | Công nghệ | Số lần khớp | File ví dụ |
| --- | --- | --- | --- |
| build | Metro bundler (React Native) | 1600 | https://fworldgm.com/_expo/static/js/web/index-93ffc55139caea5aa99577b0fba383b3.js?v=1791010551768 |
| build | javascript-obfuscator (string array) | 1 | https://fworldgm.com/_expo/static/js/web/index-93ffc55139caea5aa99577b0fba383b3.js?v=1791010551768 |
| payment | MoMo | 1 | https://fworldgm.com/_expo/static/js/web/index-93ffc55139caea5aa99577b0fba383b3.js?v=1791010551768 |
| ui | Expo / React Native Web | 16 | https://fworldgm.com/, https://fworldgm.com/_expo/static/js/web/index-93ffc55139caea5aa99577b0fba383b3.js?v=1791010551768 |
| ui | React | 10 | https://fworldgm.com/_expo/static/js/web/index-93ffc55139caea5aa99577b0fba383b3.js?v=1791010551768 |

## Host / CDN

| Host | Requests | Dung lượng | Loại | Server | CDN |
| --- | --- | --- | --- | --- | --- |
| fworldgm.com | 10 | 4.34 MB | document:5 script:1 json:2 image:2 | hcdn |  |
| ipwho.is | 1 | 782 B | json:1 | cloudflare | cloudflare |

## Tài nguyên theo loại

| Loại | Số lượng | Dung lượng |
| --- | --- | --- |
| script | 1 | 4.08 MB |
| image | 2 | 251.5 KB |
| document | 5 | 13.2 KB |
| json | 3 | 4.4 KB |

## Tài nguyên theo đuôi file

| Đuôi | Số lượng | Dung lượng |
| --- | --- | --- |
| .js | 1 | 4.08 MB |
| .jpg | 1 | 237.4 KB |
| .ico | 1 | 14.2 KB |
| .txt | 2 | 5.3 KB |
| (none) | 2 | 3.4 KB |
| .xml | 1 | 2.6 KB |
| .json | 1 | 2.6 KB |
| .webmanifest | 1 | 2.6 KB |
| .php | 1 | 992 B |

## 30 tài nguyên lớn nhất

| URL | Loại | Dung lượng |
| --- | --- | --- |
| https://fworldgm.com/_expo/static/js/web/index-93ffc55139caea5aa99577b0fba383b3.js?v=1791010551768 | script | 4.08 MB |
| https://fworldgm.com/assets/assets/login_bg.781c0c69e8e0b3ae5c5eff53ad9ee614.jpg | image | 237.4 KB |
| https://fworldgm.com/favicon.ico | image | 14.2 KB |
| https://fworldgm.com/ | document | 2.6 KB |
| https://fworldgm.com/robots.txt | document | 2.6 KB |
| https://fworldgm.com/sitemap.xml | document | 2.6 KB |
| https://fworldgm.com/manifest.json | json | 2.6 KB |
| https://fworldgm.com/site.webmanifest | document | 2.6 KB |
| https://fworldgm.com/.well-known/security.txt | document | 2.6 KB |
| https://fworldgm.com/api.php?action=get_class_stats | json | 992 B |
| https://ipwho.is/ | json | 782 B |

## JS bundle

| URL | Kích thước | Source map |
| --- | --- | --- |
| https://fworldgm.com/_expo/static/js/web/index-93ffc55139caea5aa99577b0fba383b3.js?v=1791010551768 | 4.08 MB |  |

## API (HTTP)

| Method | Host | Path | Số lần | Status | Response keys |
| --- | --- | --- | --- | --- | --- |
| GET | fworldgm.com | /api.php | 1 | 200 | ok, classStats |

### `GET /api.php`

Response:
```
{"ok":true,"classStats":{"kiem_si":{"hp":120,"mp":100,"atk":14,"def":10,"matk":6,"mdef":7,"spd":8,"crit":5,"critDmg":50,"int":0},"cung_thu":{"hp":90,"mp":100,"atk":16,"def":6,"matk":6,"mdef":6,"spd":12,"crit":12,"critDmg":60,"int":0},"sat_thu":{"hp":85,"mp":100,"atk":15,"def":5,"matk":6,"mdef":5,"spd":14,"crit":18,"critDmg":70,"int":0},"phap_su":{"hp":80,"mp":100,"atk":6,"def":5,"matk":18,"mdef":8,"spd":9,"crit":8,"critDmg":60,"int":0},"cuong_bao":{"hp":140,"mp":100,"atk":22,"def":8,"matk":6,"mdef":6,"spd":10,"crit":10,"critDmg":60,"int":0},"trieu_hoi":{"hp":75,"mp":100,"atk":5,"def":5,"matk":20,"mdef":10,"spd":8,"crit":8,"critDmg":60,"int":0},"dao_si":{"hp":95,"mp":100,"atk":7,"def":7,"matk":15,"mdef":12,"spd":7,"crit":5,"critDmg":50,"int":0},"saija":{"hp":160,"mp":100,"atk":13,"def":14,"matk":12,"mdef":12,"spd":7,"crit":5,"critDmg":50,"int":0}}}
```

## WebSocket

_Không có WebSocket._

## URL tìm thấy trong JS

- https://buymeacoffee.com/vikclass
- https://classic-assets.eascdn.net/
- https://fworldgm.com/
- https://fworldgm.com/logo.jpg
- https://necolas.github.io/react-native-web/docs/setup/
- https://zalo.me/g/kcbdlhnkyj3hjbne1x9e

## Path đáng chú ý trong JS

_Không có._

## Chuỗi tiếng Việt (97 chuỗi khác nhau, hiển thị tối đa 150)

- game idle RPG chơi ngay trên trình duyệt.
- nội
- x20tại
- x20tính
- x20cấp
- Đã
- x20đủ
- x20chuyển
- x20chức
- x20Rơi
- x20từ
- x20cùng
- x20bậc.
- x20ký
- x20mạch
- x20nước
- x20ngầm.
- x20xé
- x20lục
- x20sắt
- x20thép.
- x20thân
- x20núi
- x20bất
- x20diệt.
- x20tụ
- x20khí
- x20thạch.
- x20đầu
- x20trận
- x20sát
- x20thương
- x20gây
- x20mỗi
- x20lượt
- x20kẻ
- x20địch.
- x20làm
- x20chậm
- x20vàng,
- x20rớt:
- x20vật
- x20phẩm
- x20hồi
- x20xuyên
- x20phá
- x20phòng
- x20thủ!
- x20miễn
- x20nhiễm
- x20hiệu
- x20ứng
- x20khống
- x20chế!
- x20phản
- x20nguyên
- x20đòn
- x20phép
- x20trả
- x20về
- x20thịnh
- x20nộ!
- x20tấn
- x20công
- x20né
- x20tránh!
- x20chặn
- x20tầm
- x20của
- x20bị
- x20khiêu
- x20khích
- x20chỉ
- x20hết
- Bước
- x20thắng
- đ)
- x20khắc
- Bán
- x20vàng?
- x20(lên
- x20cấp)!
- x20(tiêu
- x20thẻ)
- Phục
- x20Lần
- x20tiến
- x20hành?
- x20hấp
- x20thụ
- x20phí:
- x20(có:
- x20vàng
- x20không
- x20nhận
- x20được
- x20thưởng.

## Chuỗi tiếng Trung (0 chuỗi khác nhau, hiển thị tối đa 150)

_Không có._
