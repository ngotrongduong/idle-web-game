---
name: steward
description: Repository rules for committing, pushing and driving PRs on Project Guildhall — the shared chatgpt/m0-foundation branch with ChatGPT/Codex, merge-not-rebase, pre-push verification, PR #2 draft status, and how to handle red CI and review comments here. Use before any commit or push and when handling PR events.
---

# Steward rules for this repository

## Shared branch
- `chatgpt/m0-foundation` (PR #2, draft) is pushed to by both Claude Code and ChatGPT/Codex.
- If the other agent is actively pushing a chain of commits and the user asked to only watch,
  do not push; report instead.
- Before every push: `git fetch origin chatgpt/m0-foundation`, then `git merge` (never rebase,
  amend or force-push). On a conflict in `packages/game-data/generated/config.json`, take either
  side and rerun `pnpm --filter @idle/game-data build`. Re-run checks after a merge.
- Push with `git push -u origin chatgpt/m0-foundation`; retry network failures with backoff, never
  with `--force`.

## Commits
- One logical step per commit, imperative subject under ~72 characters, a body that says why and
  lists any migration or rules-version change.
- No AI model names or identifiers in commits, PR text or code.
- Never commit `research/*/raw/`, HAR files, credentials or `.env` files.

## Before pushing
1. `scripts/ci-local.sh` full run is green (the `qa-verifier` agent can run it).
2. `plan-reviewer` has looked at `git diff origin/chatgpt/m0-foundation...HEAD`, and confirmed
   findings are fixed with tests.
3. `docs/HANDOFF.md` describes the new state.

## Red CI
- Read the failing job log first; reproduce locally with the same step from `scripts/ci-local.sh`.
- Common causes here: Prettier (`pnpm format`), generated config drift (data build), a golden hash
  change (a determinism or rules-version regression: fix the code, never the golden), an E2E race
  (fix the wait or the app; a flake is not a root cause), PostgreSQL-only behaviour (ordering,
  types, a non-idempotent migration on the second `db:migrate`).
- Never skip, disable or loosen a test to get green.

## Reviews
- Fix small, local review asks directly, with a test when behaviour changes.
- Design-level asks that change game rules or numbers go to the user with a recommendation.
- GitHub comments end with the Claude Code attribution footer.

## Milestones
- Keep PR #2 a draft until M1 is complete; do not merge it.
