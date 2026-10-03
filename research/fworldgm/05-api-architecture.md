# 05: API và kiến trúc client ↔ server của fworldgm

Nguồn: bundle đã giải mã (`raw/static/bundle.pretty.js`) + log API của phiên chơi thử (`raw/explore/api.jsonl`, token đã che). Không gọi endpoint nào ngoài những gì client tự gọi khi chơi bình thường.

## 1. Sơ đồ tổng thể

```
Trình duyệt (Expo / React Native Web, 1 bundle 4 MB)
  │  HTTPS POST JSON  https://fworldgm.com/api.php?action=<action>
  │    header: Content-Type: application/json, X-API-Key: <hằng số trong bundle>
  │    body:   { username, token, ...params }
  │  ◄── { ok: true|false, error?, saveData?, ...kết quả riêng }
  │
  │  Socket.IO  https://socket.fworldgm.com   (chỉ 2 event: "chat", "presence")
  ▼
Hostinger (CDN hcdn) → PHP 8.3 (api.php: router theo ?action=) → MySQL (suy luận từ định dạng
`created_at: "2026-09-29 17:18:30"` và id kiểu `msg_<uniqid>`)
                       → Node Socket.IO server riêng (cổng 3001 khi chạy local)
```

Đặc điểm chính:

1. **Một endpoint, nhiều action** (RPC kiểu `?action=`), luôn là `POST` JSON (trừ `get_class_stats` là `GET`).
2. **Auth bằng token tự quản**: `login`/`register` trả `{ token, username, displayName, isAdmin }`. Client lưu token vào AsyncStorage (localStorage trên web), rồi gửi `username` + `token` trong **body** mọi request. Có `installAuthFetchGuard`: hễ server báo token hết hạn thì xóa session và quay về màn đăng nhập.
3. **`X-API-Key` là hằng số public** nằm trong bundle (giá trị mặc định chưa đổi, kiểu "change_this…"), nên không có giá trị bảo mật.
4. **Whole-save pattern**: hầu hết action trả về **toàn bộ `saveData`** (JSON) và client thay state bằng bản server. Server là nguồn sự thật cho trận đánh, loot, cường hóa, recruit, thanh toán.
5. **Mô phỏng chiến đấu trên server** (`run_dungeon`, `arena_attack`, `world_boss_attack`). Server trả về log từng hành động kèm **snapshot trạng thái của cả hai phe sau mỗi hành động**, để client phát lại (replay). Code mô phỏng (`simulateWave`) cũng có trong bundle, nên client dùng được cho preview hoặc offline.

## 2. Danh mục action (78 action người chơi + ~20 action admin)

| Nhóm | Action | Ghi chú |
|---|---|---|
| Tài khoản | `register`, `login`, `change_password`, `delete_account`, `rename_player`, `user_profile_get` | username 3–30 ký tự chữ/số, mật khẩu ≥ 4 ký tự; **không có email/SĐT/OTP** |
| Đồng bộ | `load`, `reconcile`, `claim` | `reconcile` gửi `saveData` + `activeDungeons`, nhận `saveData` + `pendingRewards`/`offlineReport` |
| Guild / công trình | `upgrade_guild`, `upgrade_tavern`, `upgrade_inventory`, `upgrade_shop` | chi phí tăng theo cấp số nhân (xem 06) |
| Tavern (recruit) | `tavern_check`, `tavern_refresh`, `recruit` | refresh tự động mỗi 2 giờ hoặc dùng Sách làm mới; có pity cho class hiếm |
| Nhà thám hiểm | `change_class`, `rename_adventurer`, `release_adventurer`, `revive_adventurer`, `reroll_personality`, `use_exp_orb`, `use_x` | `use_x`: dùng vật phẩm x2 EXP 24h |
| Đội / hầm ngục | `save_team`, `run_dungeon`, `end_dungeon`, `claim_dungeon_rewards`, `clear_reports` | `run_dungeon {dungeonId, waveIndex, memberIds, teamIdx, lang}` |
| Kho / trang bị | `equip_item`, `unequip_item`, `upgrade_item`, `toggle_item_lock`, `sell_item`, `sell_material`, `set_auto_sell`, `socket_rune`, `craft_item`, `open_chest` | cường hóa roll trên server |
| Shop | `refresh_shop`, `buy_material`, `buy_star_scroll` | shop vàng refresh theo giờ; Star Shop mua bằng ⭐ |
| Pet | `open_egg`, `feed_pet`, `devour_pet`, `release_pet` | |
| World boss | `world_boss_list`, `world_boss_attack`, `world_boss_claim` | HP chung server, chu kỳ hồi sinh 2 giờ |
| Arena (PvP bất đồng bộ) | `arena_status`, `arena_opponents`, `arena_attack`, `arena_history`, `arena_claim`, `pvp_challenge`, `pvp_accept`, `pvp_battle_get` | mùa giải ~2 ngày, 5 lượt đánh, điểm khởi đầu 1000 |
| Quest | `daily_quest_claim_task`, `daily_quest_claim`, `weekly_quest_claim_task`, `weekly_quest_claim` | |
| Nạp tiền | `sepay_packs`, `sepay_checkout`, `sepay_check`, `topup_status`, `topup_claim`, `flip_topup_status`, `flip_topup_claim`, `flip_board`, `flip_card` | `sepay_checkout {packId}` → `{invoice, payUrl}`; client poll `sepay_check` |
| Xã hội | `chat_get`, `chat_send`, `list_announcements`, `submit_feedback`, `list_feedback`, `gift_code_redeem` | chat lấy bằng HTTP polling, socket chỉ để đẩy realtime |
| Dữ liệu | `get_class_stats` | chỉ số gốc class từ server (để đồng bộ khi cân bằng lại) |
| Admin (UI admin có sẵn trong client) | `admin_list_users`, `admin_delete_user`, `admin_reset_password`, `admin_set_mod`, `admin_gift_stars`, `admin_gift_materials`, `admin_gift_equipment`, `admin_gift_log_*`, `admin_*_announcement`, `admin_list_feedback`, `admin_*_item_override` | hiện/ẩn dựa trên cờ `isAdmin` trong storage; quyền thật phải do server kiểm tra (**không thử**) |

## 3. Nhịp gọi API khi đang mở game (đo trong phiên thử)

| Action | Nhịp | Kích thước response tối đa | Nhận xét |
|---|---|---|---|
| `run_dungeon` | mỗi ~4–6 s cho mỗi đội đang đánh | ~40 KB | mỗi wave là một request; log kèm snapshot nên rất nặng |
| `reconcile` | ~10–20 s | ~2 KB (save mới) | đồng bộ save + nhận phần thưởng chờ |
| `world_boss_list` | ~15–30 s (gọi đôi) | ~7 KB | polling, có thể cache |
| `chat_get` | ~15–30 s | **~29 KB** | trả cả lịch sử chat mỗi lần; lộ cả **số sao** của người khác |
| `arena_status` | ~15–60 s | ~6 KB | kèm cả leaderboard |
| `list_announcements`, `get_class_stats` | ~15–60 s | ~1 KB | nên chỉ gọi khi mở app |

Ước lượng: một người chơi online tạo ~15–25 request/phút. 1.000 CCU sẽ thành ~300 request/giây vào PHP trên shared hosting, đây là điểm nghẽn khi tăng quy mô.

## 4. Schema `saveData` (SAVE_VERSION 4)

```jsonc
{
  "version": 4,
  "gold": 168, "stars": 0,
  "guildName": "…", "guildLevel": 1,
  "adventurers": [{
    "id": "adv_<createdAtMs>_<rand>_<idx>", "name": "Aldric", "classId": "kiem_si",
    "level": 1, "xp": 6, "xpToNext": 30, "hp": 132, "maxHp": 132, "mp": 10, "maxMp": 100,
    "equipped": { "weapon": null, "helmet": null, "armor": null, "accessory": null },
    "status": "idle | inDungeon | resting", "personality": null
    // + t8BonusLevel, petId…
  }],
  "teams": [{
    "id": "team_1", "name": "Party 1", "memberIds": ["adv_…"], "waveIndex": 4,
    "status": "fighting", "dungeonId": "forest_of_whispers",
    "startedAt": 1791034584000, "lastClaimAt": 1791034584000,
    "runPace": { /* 2 field: tốc độ chạy wave để tính offline */ }, "log": []
  }],
  "inventory": [ "<itemId>|<quality>|<upgrade>|<engrave>…" ],   // item mã hoá thành chuỗi (encodeItemId/parseItemId)
  "craftingMaterials": [ { "id": "mat_slime_gel", "count": 3 } ],
  "facilities": { "dorm": {"level":1}, "tavern": {"level":1}, "warehouse": {"level":1}, "shop": {"level":1} },
  "recruitCost": 50, "nextRecruitSeed": 2,
  "shopSlots": [], "shopRefreshedAt": 0, "shopNextRefreshAt": 0,
  "dungeonSlots": { "forest_of_whispers": ["adv_…", null, null, null] },
  "pets": [], "dungeonPets": [],
  "pendingRewardsByDungeon": null, "offlineReports": null,
  "createdAt": 0, "lastSavedAt": 0
}
```

Bài học: mô hình "một blob JSON / người chơi" giúp làm nhanh lúc đầu (PHP chỉ cần `SELECT save FROM users`). Đổi lại, mỗi lần ghi phải ghi đè cả blob, dễ race condition khi nhiều tab/request song song, khó query (leaderboard, thống kê) và khó migrate schema. Hệ quả là trong code có `SAVE_VERSION`, `reconcile` và nhiều nhánh xử lý "save cũ".

## 5. Realtime

- Socket.IO (engine.io v4, `PACKET_TYPES` 0–6) tới `socket.fworldgm.com`. Client nghe `chat` (tin nhắn mới, thông báo hệ thống như world boss bị hạ) và `presence` (số người online).
- Mọi thứ khác (world boss HP, arena, phần thưởng) dùng **HTTP polling**.

## 6. Nhận xét bảo mật / chống gian lận (chỉ quan sát, không khai thác)

| Quan sát | Rủi ro | Bài học cho game của mình |
|---|---|---|
| `X-API-Key` hard-code trong bundle | không ngăn được ai gọi API trực tiếp | đừng dựa vào "API key phía client"; dùng session/JWT theo người dùng + rate limit |
| Token đi trong **body** chứ không phải header/cookie | dễ lọt vào log; không dùng được cookie `HttpOnly` | dùng cookie `HttpOnly; Secure; SameSite` hoặc header `Authorization` |
| `reconcile` nhận `saveData` từ client | nếu server merge thiếu kiểm tra, client có thể sửa save (chưa kiểm chứng) | client **không bao giờ** gửi state; chỉ gửi intent (hành động) |
| Bộ chọn mục tiêu dùng `Math.random()` trong khi phần còn lại dùng RNG có seed | replay không tái tạo được, khó audit tranh chấp | toàn bộ mô phỏng dùng một RNG có seed, lưu seed theo trận |
| Panel admin nằm trong bundle công khai | lộ bề mặt tấn công (tên action admin) | tách admin thành app riêng, đặt sau VPN/SSO |
| `chat_get` trả về số sao (tiền nạp) của người khác | lộ thông tin tài chính | chỉ trả các trường cần hiển thị |
| Gọi `ipwho.is` lấy IP/vị trí, không có thông báo | vấn đề quyền riêng tư (Luật BVDLCN 2025) | có chính sách quyền riêng tư; tự xử lý geo-IP phía server nếu cần |
| Mật khẩu tối thiểu 4 ký tự, không xác thực SĐT | yếu; chưa đáp ứng yêu cầu xác thực SĐT cho game G1 (NĐ 147/2024) | xem `docs/08-legal-risks.md` |
| Không thấy rate limit phía client; polling dày | tốn tài nguyên server | gộp polling vào một kênh realtime; rate limit theo user/IP |
