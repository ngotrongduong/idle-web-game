# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-content-slice`

## Branch relationship
This branch is stacked on `chatgpt/m0-foundation` / PR #2. Keep content work separate from the foundation PR.

## Completed on the parent foundation branch
- M0.1 monorepo + web/server/shared packages.
- M0.2 CI scaffold (runtime verification still blocked).
- M0.3 CSV → JSON/Zod pipeline.
- M0.4 deterministic battle core.
- M0.5 battle + enhancement simulations.
- M0.6a guest auth + idempotent, versioned command pipeline using temporary in-memory persistence.

## Completed on this branch
- Complete first MVP content slice: 4 families / 24 classes, 4 dungeons, 12 enemy families, 32 items, 15 materials.
- One data-driven ULT + passive definition for every class.
- Four original dungeon bosses.
- Six-wave composition for every dungeon, with boss on wave 6.
- Validators for class trees, skill/class references, effect/target side consistency, enemy/boss dungeon ownership, contiguous waves and final-boss placement.
- `tools/sim` derives sample team and encounters from `@idle/game-data` rather than duplicated constants.
- `docs/M0_CONTENT_SLICE.md` documents counts and originality rules.

## Verification status
Runtime verification remains pending until the root lockfile is regenerated in a checkout with package-registry access.

## Next work on this branch
1. Add a versioned battle-rules adapter that turns class skills into combat actions.
2. Add MP gain and automatic ULT use while preserving deterministic replay.
3. Simulate complete six-wave dungeon runs, not only one-wave encounters.
4. Tune config after runtime tests are available.

## Parallel infrastructure work
M0.6b PostgreSQL/Drizzle persistence should be a separate stacked branch to avoid mixing content and persistence changes.
