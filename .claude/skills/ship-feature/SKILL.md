---
name: ship-feature
description: Lead playbook for delivering a roadmap item (e.g. M1.7 buildings) end to end with the agent team — scope from the docs, ask the user only real design questions, plan by layer, delegate to specialists with disjoint file ownership, verify, review, document, commit and push. Use when asked to implement the next milestone or a feature that spans several packages.
argument-hint: "[roadmap item or feature, e.g. M1.7]"
---

# Ship: $ARGUMENTS

You are the lead. Specialists do the focused work; you keep the plan, verify claims, commit and
push. Track the steps with the task list.

## 1. Scope
- Read `docs/HANDOFF.md` (state, decisions, next work), the `docs/07-roadmap-mvp.md` row and its
  acceptance criterion, and the docs/02–04 sections the item touches.
- Check the branch: `git fetch origin chatgpt/m0-foundation` and look at what landed since you last
  worked (another agent shares the branch).
- Write down: acceptance criteria, rules and numbers from the docs, and open questions. Questions
  that change game rules or numbers go to the user in one batch, each with a recommended option.
  Implementation details are yours to decide.

## 2. Plan by layer
Split the work into slices that each end green and can be committed alone:

1. Data and rules: `packages/game-data` schema + data, `packages/game-core` pure functions and tests
   → `game-core-engineer` (numbers → `balance-designer`).
2. Contract and server: schemas, error codes, commands, stores, migration →
   `server-engineer` (`new-migration` skill).
3. Client: screens, i18n, E2E flow → `web-engineer`.
4. Balance check if numbers moved → `balance-designer`.

Run specialists in parallel only when their files do not overlap; otherwise go in the order above,
passing each agent the interface the previous one produced. Each brief is self-contained: goal,
acceptance criteria, doc references, owned files, interfaces to use, commands to run, what to
report.

## 3. Integrate and verify
- Read each specialist's diff yourself; do not trust a summary.
- `qa-verifier`: `scripts/ci-local.sh --quick` between slices, full run before the push.
- `plan-reviewer`: review `git diff origin/chatgpt/m0-foundation...HEAD`. Verify every finding,
  fix confirmed ones (with a regression test) through the owning specialist, and take plan
  deviations to the user.

## 4. Document
`docs-keeper` updates `docs/HANDOFF.md` and any design-doc section whose rules or numbers changed.

## 5. Land
Follow the `steward` skill: commit each slice, fetch + merge, full local CI, push, watch GitHub
Actions until green, then tell the user what shipped, what was verified, and what is next.
