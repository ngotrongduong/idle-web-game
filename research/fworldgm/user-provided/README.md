# Dữ liệu do người dùng cung cấp

Đặt ở đây các file HAR / screenshot tự xuất từ trình duyệt của bạn (mọi file trong thư mục này, trừ README, đều **gitignored**).

Xuất HAR trong Chrome: DevTools (F12) → tab **Network** → tick "Preserve log" → chơi các màn cần phân tích → chuột phải danh sách request → **Save all as HAR (sanitized)**. Bản "sanitized" đã loại bỏ cookie/Authorization. Đừng dùng bản "with sensitive data".

Phân tích:

```bash
pnpm inspect:analyze --har research/fworldgm/user-provided/<file>.har --slug fworldgm
```

HAR từ Chrome có kèm frame WebSocket (`_webSocketMessages`), và công cụ sẽ tự đọc phần này.
