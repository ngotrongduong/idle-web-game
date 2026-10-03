# idle-web-game

Dự án web game **idle guild-management RPG** (tên tạm: *Project Guildhall*), mobile-first, TypeScript full-stack.

- 📚 **Kế hoạch và thiết kế**: [`docs/`](docs/README.md): teardown, GDD, kinh tế, kiến trúc, art, monetization, roadmap, pháp lý.
- 🔍 **Research game tham khảo** (fworldgm.com): [`research/fworldgm/`](research/fworldgm/README.md).
- 🛠 **Công cụ inspect**: [`tools/inspect/`](tools/inspect/) (Playwright capture, phân tích HAR, trích config, giải mã bundle).

## Bắt đầu

```bash
pnpm install          # Node 22+, pnpm 10+
pnpm inspect:test     # self-test bộ công cụ inspect
```

Code game (`apps/`, `packages/`) sẽ được scaffold ở milestone M0. Xem [`docs/07-roadmap-mvp.md`](docs/07-roadmap-mvp.md).
