# idle-web-game

Dự án web game **idle guild-management RPG** (tên tạm: *Project Guildhall*), mobile-first, TypeScript full-stack.

- 📚 **Kế hoạch và thiết kế**: [`docs/`](docs/README.md): teardown, GDD, kinh tế, kiến trúc, art, monetization, roadmap, pháp lý.
- 🔍 **Research game tham khảo** (fworldgm.com): [`research/fworldgm/`](research/fworldgm/README.md).
- 🛠 **Công cụ inspect**: [`tools/inspect/`](tools/inspect/) (Playwright capture, phân tích HAR, trích config, giải mã bundle).

## Bắt đầu

```bash
pnpm install                  # Node 22+, pnpm 10+
pnpm dev                      # server :3001 + web :5173
scripts/ci-local.sh --quick   # lint, Prettier, typecheck, test
scripts/ci-local.sh           # toàn bộ pipeline như GitHub Actions (cần PostgreSQL + Chromium)
```

Trạng thái hiện tại và việc tiếp theo: [`docs/HANDOFF.md`](docs/HANDOFF.md).

## Làm việc với agent

- [`AGENTS.md`](AGENTS.md): quy tắc chung cho mọi coding agent (Claude Code, ChatGPT/Codex) và người.
- [`CLAUDE.md`](CLAUDE.md): đội agent của Claude Code. Agent chuyên trách ở [`.claude/agents/`](.claude/agents/)
  (game-core, server, web, balance, QA, review, docs); quy trình ở [`.claude/skills/`](.claude/skills/)
  (`/ship-feature`, `/local-ci`, `/new-migration`, `/balance-pass`, `steward`).
