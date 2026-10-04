# AGENTS.md — Project Guildhall

Shared working rules for every coding agent on this repository (Claude Code, ChatGPT/Codex) and for
humans. Claude Code also reads `CLAUDE.md`, which adds its agent team on top of these rules.

## What this is

A mobile-first **idle guild-management RPG** for the web (working title *Project Guildhall*),
western high fantasy, TypeScript full-stack, solo/1–2 dev MVP towards a free closed beta.

- Design and plan: `docs/02` (GDD), `docs/03` (economy and balance formulas), `docs/04`
  (architecture), `docs/07` (roadmap with acceptance criteria). Docs 01–08 are in Vietnamese.
- Current state, decisions and next work: **`docs/HANDOFF.md` — read it first, update it last.**
- `research/` is analysis of a reference game. Never copy its names, art, lore, UI, code or data
  tables into the game.

## Layout

| Path | Owns |
|---|---|
| `packages/game-core` | Pure deterministic rules: seeded RNG, battle (`simulateWave`, versioned formulas), hero stats, combatant builders, idle accrual, loot, tavern odds, crafting, enhancement, building timers, economy curves. No I/O. |
| `packages/game-data` | Content: `data/*.csv` + `data/*.json`, zod schemas and cross-reference validation, `generated/config.json`. |
| `packages/api-contract` | zod schemas for every API payload, command, patch, event and error code. |
| `packages/i18n` | vi/en strings. |
| `apps/server` | Fastify API: guest session, `/api/v1/cmd` pipeline, stores (`InMemoryGameStore` + `PostgresGameStore`), Drizzle schema, hand-written SQL migrations in `drizzle/`. |
| `apps/web` | React + Vite client; replays battles in the browser through game-core. |
| `tools/sim` | Battle/economy/gacha/upgrade simulations and balance band tests. |
| `tools/inspect` | Playwright golden-battle page check and the browser E2E flows (`src/e2e-*.ts`). |
| `infra` | Docker Compose, Dockerfiles, Caddy. |

## Commands

```bash
pnpm install                       # Node 22+, pnpm 10
pnpm dev                           # server :3001 + web :5173 (in-memory store unless DATABASE_URL is set)
pnpm test                          # all unit/integration tests (PostgreSQL tests run when DATABASE_URL is set)
scripts/ci-local.sh --quick        # lint + Prettier + typecheck + tests
scripts/ci-local.sh                # everything GitHub Actions runs: migrations twice, goldens, 6 E2Es, build
pnpm format                        # fix Prettier
pnpm --filter @idle/game-data build        # regenerate generated/config.json after editing data/*.csv
pnpm --filter @idle/server db:migrate      # apply migrations (needs DATABASE_URL)
pnpm --filter @idle/sim sim:economy        # economy report (also sim:battle, sim:gacha, sim:upgrade)
```

CI database: `postgresql://postgres:postgres@127.0.0.1:5432/guildhall_test`. Browser scripts use the
Chrome channel unless `GUILDHALL_BROWSER=chromium`.

## Invariants (a change that breaks one is wrong even if CI is green)

1. **Determinism.** game-core never uses `Math.random`, `Date.now` or other ambient state; all
   randomness comes from `SeededRng` with seeds derived from persisted values. Prefer integers and
   basis points (bps, 10000 = 100%); round once, explicitly.
2. **Replay compatibility.** Persisted runs carry a battle-rules snapshot and replay in the browser.
   Never change the v1 battle path or `DEFAULT_BATTLE_RULES`; new combat behaviour goes behind a new
   `formulaVersion`. Golden scenarios live in `packages/game-core/src/goldens.ts`; their hashes (v1
   `c080875a`, v2 `fce81aeb`) are pinned in `packages/game-core/test/foundation.test.ts` and
   `tools/inspect/src/golden-battle.ts` (Chromium). They only change when a new version is added on
   purpose, never to make a test pass. The legacy fixture in `apps/web/src/replay.test.ts` must keep
   replaying.
3. **Server-authoritative.** Every player action goes through `/api/v1/cmd` under the player lock
   with idempotency (`cmdId`, checked before the version) and a version check; time-based idle
   accrual is applied under the same lock when runs are read. The client never decides outcomes or
   rewards.
4. **No resource duplication.** Think through repeated, concurrent and interleaved commands
   (stop → promote → claim, one hero or item in two runs, split claims). Rewards are paid once;
   splitting a claim never changes the total.
5. **Store parity.** A persisted field exists in the contract (with a default for old rows), both
   stores, `db/schema.ts`, a migration, and tests for InMemory and PostgreSQL.
6. **Migrations are re-run on every deploy.** They must be idempotent (`IF NOT EXISTS`, guarded `DO`
   blocks). One-shot data fixes are guarded by a marker row in `data_migrations`. Never edit a
   migration that has been pushed; add the next number.
7. **Content is data.** Edit `packages/game-data/data/*`; regenerate `generated/config.json` with the
   build script (never hand-edit or hand-merge it). Balance is tuned in config, not code, and must
   keep `tools/sim` band tests and the `sim:economy` targets from `docs/03`.
8. **Player-facing text.** Legacy ids (`bamboo_grove`, `storm_scribe`, …) are internal only; the UI
   reads names from `/api/v1/catalog` and strings from `@idle/i18n` (vi + en) through `useLocale()`
   — never a fixed locale, a literal in JSX, or sentences glued from fragments (use `{placeholders}`).
   Every API error code has an `error.<CODE>` message in both languages; the server's English
   `message` is for logs, not for players.
9. **Secrets and raw research data** never enter git (`.gitignore` covers `research/*/raw/`).

## Definition of done

- The behaviour is covered by tests; a bug fix includes a regression test that fails on the old code.
- `scripts/ci-local.sh` passes: `--quick` while iterating, the full run before every push.
- Docs updated: `docs/HANDOFF.md` (status, decisions, next work) and the design doc section whose
  numbers or rules changed.
- GitHub Actions is green on the pushed head.

## Git workflow

- Active branch: `chatgpt/m0-foundation` (draft PR #2), **shared by Claude Code and ChatGPT/Codex.**
  Before every push: `git fetch` and **merge** (never rebase, amend or force-push shared history).
  On a conflict in `generated/config.json`, rerun the data build instead of merging by hand.
- Start new cloud sessions (Claude Code on the web, Codex) on `chatgpt/m0-foundation`. `main` (a
  README) and PR #2's base `claude/web-game-analysis-plan-xumrt0` (plan docs only) have none of the
  code, these rules or the agent tooling yet.
- Small commits, one logical step each, imperative subject, body says why.
- Keep PR #2 a draft until M1 is complete.
- Code, comments and `docs/HANDOFF.md` in English; design docs 01–08 in Vietnamese; UI text via i18n.
