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
- Expanded M0.3 into the first complete MVP content slice.
- 4 original class families with 24 T1–T3 classes.
- 4 dungeons and 12 enemy families.
- 32 craftable equipment items and 15 materials.
- Added class-parent and enemy-dungeon cross-reference validation.
- Added explicit MVP shape validation for required counts and class-tier structure.
- Added `docs/M0_CONTENT_SLICE.md`.
- Removed duplicated hard-coded dungeon encounter data from `tools/sim`; battle simulation now derives the four encounters and enemies directly from `@idle/game-data`.
- The sample simulation team is also derived from four T3 classes in game-data.

## Verification status
Runtime verification remains pending until the root lockfile is regenerated in a checkout with package-registry access.

## Next work on this branch
1. Add skills/ULT/passive config for the 24 classes.
2. Add dungeon wave composition and boss definitions.
3. Extend `simulateWave` to consume those skill definitions under a versioned battle ruleset.
4. Run simulations and tune numbers after package installation is available.

## Parallel infrastructure work
M0.6b PostgreSQL/Drizzle persistence should be a separate stacked branch to avoid mixing content and persistence changes.
