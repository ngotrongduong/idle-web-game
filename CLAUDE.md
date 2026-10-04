@AGENTS.md

# Claude Code: agent team

The main session is the **lead**: it talks to the user, plans, delegates, commits and pushes.
Specialists in `.claude/agents/` do the focused work and report back; they never commit or push.

| Agent | Use it for | Writes to |
|---|---|---|
| `game-core-engineer` | battle formulas, stats, RNG, idle/loot/tavern/crafting math, game-data schemas, goldens | `packages/game-core`, `packages/game-data/src`, `packages/game-data/generated`, `tools/inspect/src/golden-battle.ts` |
| `server-engineer` | commands, stores, migrations, API routes, error codes, contract schemas | `apps/server`, `packages/api-contract` |
| `web-engineer` | React screens, i18n strings, client replay, browser E2E flows | `apps/web`, `packages/i18n`, `tools/inspect/src/e2e-*.ts` |
| `balance-designer` | tuning numbers in data files, simulations, balance band tests, docs/03 targets | `packages/game-data/data`, `packages/game-data/generated`, `tools/sim` |
| `qa-verifier` | running `scripts/ci-local.sh` and diagnosing failures | no source files (uses the test database, ports 3001/5173/5174, `dist/`) |
| `plan-reviewer` | reviewing a diff against the design docs, invariants and exploit cases | nothing (report only) |
| `docs-keeper` | HANDOFF and design-doc updates after a change lands | `docs/`, `README.md` |

Skills: `/ship-feature <item>` (end-to-end playbook for a roadmap item), `/local-ci`,
`/new-migration`, `/balance-pass`, and `steward` (PR and shared-branch rules).

## How the lead runs the team

- Give each agent a self-contained brief: goal, acceptance criteria, relevant doc sections, files
  it owns, and what to report. Agents start without this conversation's context.
- Run agents in parallel only when their files are disjoint (the "Writes to" column). The two data
  owners both regenerate `packages/game-data/generated`, so never run them at the same time. A
  change that crosses layers goes in order: game-data/game-core → api-contract → server → web → E2E.
- Run `qa-verifier` alone: never next to another QA run (shared database and ports) or while an
  agent is still editing files.
- Before a push: `qa-verifier` (full `scripts/ci-local.sh`) and `plan-reviewer` on
  `git diff origin/chatgpt/m0-foundation...HEAD`. Verify each finding yourself before acting on it.
- Design decisions that change game rules or numbers in docs/02–03 belong to the user: ask with a
  recommended option, then record the answer in `docs/HANDOFF.md` → Decisions.
- A PostToolUse hook runs Prettier on every file Claude edits; run `pnpm format` if a file was
  written another way.
- In cloud sessions a SessionStart hook (`.claude/hooks/session-start.sh`) runs `pnpm install` and
  starts PostgreSQL with the `guildhall_test` database; its status line says whether that worked.
