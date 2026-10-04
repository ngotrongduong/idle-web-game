# 04: Kiến trúc kỹ thuật

> Ràng buộc: **1–2 dev**, TypeScript full-stack, chi phí vận hành thấp, mobile web là chính. Nguyên tắc: *ít thành phần chạy, server-authoritative, dữ liệu game là config.*

## 1. Stack đề xuất

| Lớp | Lựa chọn | Lý do | Thay thế |
|---|---|---|---|
| Ngôn ngữ | TypeScript 5.x (strict) cho mọi package | dùng chung types, công thức, engine chiến đấu | – |
| Monorepo | pnpm workspaces (+ Turborepo khi build chậm) | đã khởi tạo trong repo (`pnpm-workspace.yaml`) | Nx |
| Client UI | **React 19 + Vite**, TanStack Query (server state), Zustand (UI state), React Router | game idle phần lớn là UI/DOM, giống fworldgm. React là lựa chọn quen thuộc nhất | Preact (nhẹ hơn), SolidJS |
| Styling | Tailwind CSS + Radix UI primitives | nhanh, nhất quán, accessible | CSS Modules |
| Cảnh chiến đấu | **PixiJS v8** (lazy-load) cho replay + sprite animation; fallback DOM | 2D WebGL nhẹ, chỉ tải khi mở màn trận | Phaser (nặng hơn), CSS sprite |
| PWA | vite-plugin-pwa (Workbox), Web Push | cài lên màn hình chính, thông báo "đội đã đầy túi" | – |
| Server | **Node 22 LTS + Fastify 5** | nhanh, schema-first, plugin tốt | Hono, NestJS (nặng cho solo) |
| Validate / contract | **Zod** → chia sẻ schema request/response qua `packages/api-contract` | typed end-to-end, validate cả 2 phía | tRPC (cũng hợp; chọn REST để dễ debug/curl) |
| Realtime | **Socket.IO 4** (cùng process Fastify) | rooms (chat, world boss), tự reconnect | `ws` thuần, Centrifugo |
| Database | **PostgreSQL 16** + **Drizzle ORM** + drizzle-kit migrations | quan hệ + JSONB, transaction, row lock | Prisma |
| Cache / pub-sub | MVP: không dùng. v1.1: **Redis/Valkey** (leaderboard ZSET, rate limit, Socket.IO adapter khi > 1 instance) | giảm thành phần lúc đầu | – |
| Job định kỳ | **pg-boss** (queue trên Postgres) | reset ngày, mùa arena, chu kỳ world boss, gửi mail hàng loạt | BullMQ (khi đã có Redis) |
| Auth | tự làm: session token ngẫu nhiên trong cookie `HttpOnly`, lưu hash trong DB; guest → liên kết Google/email; OTP SĐT khi thương mại hóa | đơn giản, đủ an toàn | Lucia-style libs, Better Auth |
| Test | Vitest (unit, property-based với fast-check), Testcontainers (Postgres thật), Playwright (e2e) | Playwright đã dùng trong `tools/inspect` | – |
| Quan sát | pino (log JSON), Sentry (client + server), Prometheus metrics + Grafana Cloud free / Uptime Kuma | phát hiện lỗi và chậm | – |
| Hạ tầng | Docker Compose trên 1 VPS + Caddy (TLS tự động) + Cloudflare (DNS/CDN/WAF) | một máy là đủ cho vài nghìn CCU nếu thiết kế đúng | Fly.io, Railway |
| CI/CD | GitHub Actions: lint → typecheck → test → build image → deploy (SSH + compose pull) | | |

## 2. Cấu trúc monorepo

```
idle-web-game/
├─ apps/
│  ├─ web/            React + Vite PWA (game client)
│  ├─ server/         Fastify API + Socket.IO + job workers
│  └─ admin/          GM tool (React), deploy domain riêng, chặn bằng Cloudflare Access
├─ packages/
│  ├─ game-core/      engine chiến đấu deterministic, công thức, RNG, idle calc (thuần TS, không I/O)
│  ├─ game-data/      config game: CSV/YAML → JSON + Zod schema + validator + version hash
│  ├─ api-contract/   Zod schema request/response, error codes, typed client
│  ├─ i18n/           chuỗi vi/en (ICU message format)
│  └─ ui/             component dùng chung web/admin (tùy chọn)
├─ tools/
│  ├─ inspect/        (đã có) công cụ inspect game tham khảo
│  └─ sim/            mô phỏng cân bằng (03 §10)
├─ infra/             docker-compose.yml, Caddyfile, scripts backup/restore
├─ docs/              tài liệu này
└─ research/          dữ liệu teardown
```

Quy tắc phụ thuộc: `game-core` không import gì ngoài `game-data` types. `web` và `server` cùng import `game-core`, `api-contract`. `server` là nơi duy nhất ghi DB.

## 3. Mô hình server-authoritative theo "intent"

```
Client                                   Server (Fastify)                              Postgres
  │ POST /api/v1/cmd {type:"enhance",      │ 1. auth session → playerId                    │
  │   itemId, expectVersion: 42}           │ 2. validate Zod                               │
  │──────────────────────────────────────► │ 3. BEGIN; SELECT … FROM players               │
  │                                        │    WHERE id=$1 FOR UPDATE   (khóa theo player)│
  │                                        │ 4. catchUpIdle(player, now)  (04 §6)          │
  │                                        │ 5. game-core.applyCommand(state, cmd, rng)    │
  │                                        │ 6. ghi diff + event log; version++; COMMIT    │
  │ ◄────────────────────────────────────  │ 7. trả {ok, version: 43, patch, events}       │
```

- Client **không bao giờ gửi state**, chỉ gửi lệnh và `expectVersion` (để phát hiện tab cũ).
- Server trả **patch** (thay đổi), không trả cả save như fworldgm. Client giữ state bằng TanStack Query + áp patch.
- Mọi random phía server dùng RNG có seed lưu theo bản ghi, nên audit/replay được.
- Idempotency: mỗi lệnh có `cmdId` (UUID). Server lưu 24 giờ để bỏ qua lệnh gửi lại do mạng chập chờn.
- Rate limit theo player/IP (token bucket trong memory ở MVP, Redis ở v1.1).

## 4. Chiến đấu: engine dùng chung, replay từ seed

`packages/game-core/battle`:

```ts
simulateWave(input: { allies: HeroSnapshot[]; enemies: EnemySpec[]; seed: number; rules: BattleRules })
  → { result: 'win' | 'lose' | 'draw'; turns: number; events: CompactEvent[]; rewards: Rewards; hash: string }
```

- **Deterministic tuyệt đối**: RNG `xoshiro128**` hoặc `mulberry32` từ seed. Toán dùng **số nguyên / fixed-point** (nhân 1000), **không dùng `Math.pow/exp/log/sin`** trong vòng lặp vì kết quả có thể lệch giữa các engine JS. Bảng tra (lookup table) tính sẵn ở build time. Không dùng `Math.random()` ở bất kỳ đâu trong game-core (bật lint rule cấm).
- **Golden tests**: lưu (input, seed) → hash kết quả. CI chạy trên Node và trên Chromium/WebKit (Playwright) để bảo đảm client và server cho cùng kết quả.
- **Luồng online**: client gọi `POST /dungeon/{id}/start` → server trả `{runId, seedBase, startedAt}`. Client tự mô phỏng wave i với `seed = hash(seedBase, i)` để **hiển thị** (không cần gọi server mỗi wave). Server tính thưởng khi người chơi "nhận" hoặc ở lần catch-up kế tiếp, bằng cùng engine. So với fworldgm (1 request ~40 KB mỗi 4–6 giây), cách này giảm ~95% traffic.
- Replay chi tiết (Battle Details) thì client tự mô phỏng lại từ seed, không cần lưu log trên server. Arena/world boss lưu `(seed, snapshot hai đội)` (~2 KB) để xem lại.

## 5. Mô hình dữ liệu (Postgres)

```sql
accounts        (id uuid pk, kind text /*guest|google|email|phone*/, email citext unique, phone text unique,
                 password_hash text, created_at, last_login_at, banned_until, flags jsonb)
sessions        (id_hash bytea pk, account_id fk, created_at, expires_at, user_agent, ip inet)
players         (id uuid pk, account_id fk unique, world_id int, name text unique, version int,
                 gold bigint, gems int, gems_bound int, power int, tutorial_step int,
                 buildings jsonb /*{hall:{lv,buildEndsAt}}*/, counters jsonb /*refresh, pity*/,
                 last_tick_at timestamptz, created_at)
heroes          (id uuid pk, player_id fk, class_id text, level int, exp bigint, rarity smallint,
                 personality text, potential jsonb, status text, team_id uuid null, created_at)
items           (id uuid pk, player_id fk, item_id text, quality smallint, enhance smallint,
                 equipped_hero_id uuid null, locked bool, created_at)
materials       (player_id fk, material_id text, qty bigint, primary key(player_id, material_id))
teams           (id uuid pk, player_id fk, slot smallint, dungeon_id text, difficulty smallint,
                 hero_ids uuid[], pet_id uuid null, run_seed bigint, started_at, last_claim_at,
                 pending jsonb /*thưởng chưa nhận*/)
quests          (player_id fk, quest_id text, progress int, claimed_at, period_key text, pk(...))
mails           (id uuid pk, player_id fk null /*null = toàn server*/, title, body, attachments jsonb,
                 expires_at, created_at);  mail_claims(mail_id, player_id, claimed_at)
leaderboard_snapshots (board text, period text, rank int, player_id, score bigint, created_at)
transactions    (id uuid pk, player_id, provider text, provider_ref text unique, amount_vnd int,
                 gems int, status text, raw jsonb, created_at, completed_at)
event_log       (id bigserial, player_id, type text, data jsonb, created_at)  -- partition theo tháng
config_versions (version text pk, hash text, published_at, published_by)
```

- Bảng "nóng" (players, heroes, items, materials, teams) nằm trong một transaction có khóa `players FOR UPDATE`, nên các lệnh của cùng một người chơi được tuần tự hóa. Các người chơi khác nhau chạy song song.
- `event_log` là nguồn cho analytics, chống gian lận và CSKH ("tôi mất đồ").
- Ước lượng dung lượng: ~10–30 KB/người chơi (không kể event_log). 100K tài khoản ≈ 3 GB.

## 6. Tính toán idle / offline

`catchUpIdle(player, now)` chạy đầu mỗi lệnh (hoặc khi mở app):

```
for team in player.teams where team.dungeon_id != null:
    Δ = min(now − team.last_claim_at, OFFLINE_CAP = 8h)
    n = floor(Δ / waveDuration(team) · efficiency)        // efficiency = 1.0 nếu online, 0.75 nếu offline
    if n ≤ 50:  mô phỏng đầy đủ n wave bằng game-core (seed = hash(run_seed, waveIndex))
    else:       mô phỏng 30 wave mẫu → winRate, avgRewards, avgTurns
                rewards = n · winRate · avgRewards  (+ roll hiếm: số boss gặp ~ Binomial(n, p) bằng RNG có seed)
    team.pending += rewards;  team.last_claim_at += n · waveDuration
```

- Giới hạn CPU: tối đa ~200 wave mô phỏng cho mỗi lần catch-up (≈ vài ms với engine số nguyên).
- Cache kết quả mẫu theo `(teamPowerHash, dungeon, difficulty)` vài phút.
- Hero lên cấp trong lúc offline: áp EXP theo từng "lô" 10 wave để đội mạnh dần hợp lý.

**Đã cài (M1)**, đơn giản hơn nhưng cùng tinh thần "giá trị kỳ vọng":
- Lúc bắt đầu lượt chạy, server mô phỏng `rewardSampleCycles` (30) vòng mẫu; mỗi vòng dừng ở wave thua đầu tiên. Lưu cả 30 mẫu `{gold, exp, kills}` vào `dungeon_runs.cycle_samples`; mẫu 0 chính là replay client tự kiểm hash.
- Vòng idle thứ c trả theo mẫu `c mod 30` (vàng, EXP, loot roll bằng seed `deriveCycleLootSeed(run_seed, c)`), nên chia nhỏ số lần nhận không đổi tổng và không cần mô phỏng lại khi catch-up.
- `run_seed = hash(player, dungeon, snapshot đội, luật)`: dừng rồi chạy lại với cùng đội cho ra cùng mẫu, chặn việc "bấm lại tới khi thắng boss".
- Chưa có tốc độ online 100% và chưa áp EXP theo lô: snapshot đội cố định suốt lượt chạy, muốn dùng chỉ số mới thì dừng và chạy lại.

## 7. Realtime và nội dung chung server

- Socket.IO namespace `/live`, xác thực bằng session cookie. Rooms: `world:{id}` (chat, thông báo), `boss:{id}` (HP world boss), `player:{id}` (thông báo cá nhân: xây xong, mail mới).
- **World boss**: HP lưu trong Postgres (một dòng mỗi chu kỳ), cập nhật bằng `UPDATE … SET hp = hp − $dmg RETURNING hp` (atomic). Đòn kết liễu xác định bằng `hp` chuyển từ > 0 sang ≤ 0 trong cùng câu lệnh. Broadcast HP gộp mỗi 1 giây.
- **Arena**: snapshot đội phòng thủ lưu khi người chơi đổi đội; ghép trận query theo điểm (index trên `arena_points`); mô phỏng trên server, lưu `(seed, snapshots)`.
- **Chat**: lưu 200 tin gần nhất mỗi kênh, lọc từ cấm, rate limit 1 tin/3 giây, slow-mode khi đông.

## 8. Pipeline dữ liệu game (config)

1. Designer sửa **Google Sheets** (hoặc CSV trong repo). Mỗi sheet là một bảng: classes, skills, enemies, dungeons, items, recipes, loot, quests, shop…
2. `pnpm data:pull` → CSV → `packages/game-data/src/*.csv`.
3. `pnpm data:build` → parse + **Zod validate** + kiểm tra tham chiếu chéo (item trong loot có tồn tại, công thức đủ nguyên liệu…) → `dist/game-data.<hash>.json`.
4. Server load config theo version, hỗ trợ **hot reload** qua GM tool (đổi cân bằng không cần deploy). Client tải config cùng version (cache bất biến theo hash).
5. Guide/tooltip trong game sinh từ cùng config, nên không bao giờ lệch như fworldgm.

## 9. Bảo mật và chống gian lận

| Mối đe dọa | Biện pháp |
|---|---|
| Sửa state phía client | không có state nào được tin từ client; chỉ lệnh |
| Spam lệnh / bot | rate limit, idempotency, giới hạn hành động theo thời gian thực (vd. tối đa 1 refresh tavern miễn phí / 2 giờ) |
| Race condition (2 tab nhân đôi tài nguyên) | khóa `FOR UPDATE` theo player + `expectVersion` |
| Đoán seed RNG | seed sinh bằng CSPRNG phía server, không lộ seed tương lai |
| Chiếm tài khoản | mật khẩu ≥ 8 ký tự (argon2id), giới hạn đăng nhập sai, OTP SĐT/email khi đổi thông tin |
| XSS (chat, tên) | React escape mặc định, CSP chặt (`script-src 'self'`), lọc tên |
| Lộ dữ liệu | API chỉ trả trường cần thiết (khác fworldgm lộ số sao), log không chứa token |
| Thanh toán giả | chỉ cộng tiền qua **webhook có chữ ký** từ cổng thanh toán + đối soát, không tin client |
| Admin | app riêng, Cloudflare Access/SSO, audit log mọi thao tác GM |

## 10. Hiệu năng (ngân sách)

| Chỉ số | Mục tiêu |
|---|---|
| JS tải lần đầu (gzip) | < 250 KB (PixiJS và màn phụ lazy-load) |
| Time to interactive (4G, máy tầm trung) | < 3 giây |
| API p95 | < 150 ms (lệnh thường), < 400 ms (catch-up dài) |
| Request/phút mỗi người online | < 4 (so với 15–25 của fworldgm) |
| 1 VPS 4 vCPU / 8 GB | ~2.000–5.000 CCU (ước lượng, cần load test bằng k6 ở M3) |

## 11. Hạ tầng và chi phí ước tính

| Giai đoạn | Cấu hình | Chi phí/tháng (ước tính) |
|---|---|---|
| Dev / closed beta | 1 VPS 2–4 vCPU, 4–8 GB (Hetzner/Vultr Singapore), Cloudflare free, Sentry free, R2 backup | ~5–15 USD |
| Open beta VN | VPS tại Việt Nam (Viettel IDC / VNPT / FPT / BizFly) nếu cần đáp ứng yêu cầu máy chủ khi xin phép G1, + VPS dự phòng | ~20–60 USD |
| Scale | tách Postgres managed + 2 app instance + Redis | ~100–300 USD |

Backup: `pg_dump` mỗi giờ (giữ 48 bản) + mỗi ngày (giữ 30 bản) lên R2/S3, **diễn tập restore mỗi tháng**. Deploy blue/green đơn giản bằng 2 container + Caddy.

## 12. Chiến lược test

| Tầng | Công cụ | Nội dung |
|---|---|---|
| game-core | Vitest + fast-check | công thức, RNG, engine: property (HP không âm, tổng thưởng ≥ 0), golden hash |
| game-data | validator | tham chiếu chéo, khoảng giá trị, không có công thức tạo vàng vô hạn |
| server | Vitest + Testcontainers | từng lệnh: đúng/sai điều kiện, race (2 lệnh song song), idempotency |
| client | Vitest + Testing Library | component quan trọng (kho, cường hóa) |
| e2e | Playwright (mobile viewport) | FTUE 10 phút đầu, offline catch-up (giả lập thời gian), thanh toán sandbox |
| tải | k6 | 2.000 người chơi ảo, kịch bản 1 lệnh/20 giây + socket |
| cân bằng | tools/sim trong CI | mốc nhịp ở 03 §4 |
