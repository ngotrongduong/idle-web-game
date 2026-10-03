# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-foundation`

## Current milestone
M0 — Nền móng.

## Completed in this branch
- M0.1 monorepo workspace paths: `apps/*`, `packages/*`, `tools/*`.
- `apps/web`: React 19 + Vite shell, mobile-first placeholder UI.
- `apps/server`: Fastify server with `GET /health`.
- Shared packages: `game-core`, `game-data`, `api-contract`, `i18n`.
- `tools/sim`: scaffold wired to `game-core`.
- Root scripts: `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm build`.
- Small smoke/unit tests for each new workspace.

## Next work
1. Regenerate and commit `pnpm-lock.yaml` after `pnpm install`.
2. Verify `pnpm test`, `pnpm typecheck`, and `pnpm build` locally/CI.
3. M0.2: add ESLint + Prettier and GitHub Actions.
4. M0.3: implement CSV → JSON game-data build + Zod cross-reference validation.
5. M0.4: deterministic seeded RNG + battle formulas + `simulateWave` + golden tests.

## Important constraints
- Keep `main` deployable; use small PRs.
- Do not copy third-party names, art, lore, UI, or source code from the reference game.
- Game logic remains server-authoritative and deterministic.
- Do not use `Math.random()` inside `packages/game-core` once M0.4 starts.
