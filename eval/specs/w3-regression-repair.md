# W3 — Regression repair basket

**Baseline:** branch `eval-v3-w3-broken` (maintainer-injected failing tests on top of W1-complete).

## Requirements

Fix all failing tests in `packages/**` and `eval/e2e/**` without removing coverage. Do not disable tests to green-wash. Preserve W1 persisted-ledger behavior.

## Deliverables

- All Vitest and Playwright tests pass on W3 baseline branch.
- No new failures vs frozen W1 tier-1 suite (same commands as W1).
