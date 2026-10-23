# W2 — Recurring transactions and budgets

**Prerequisite:** W1 acceptance (tiers 1–2) on the same repo lineage, or baseline branch `benchmark/v3-w1-complete` tagged after a successful W1 arm.

## Requirements

1. **Recurring rules** — Users can define recurring templates (amount, account, cadence weekly/monthly, description).
2. **Budget caps** — Per-account or global monthly budget with warning threshold; API returns budget status.
3. **Core + API + web** — End-to-end create recurring, materialize next occurrence, show budget status in UI.
4. **Tests** — Unit tests for schedule math; API integration tests; Playwright flow for create recurring + see budget.

## Deliverables D1–D4

Same verification tiers as W1; tier 2 adds Playwright spec `eval/e2e/w2-recurring-budget.spec.ts`.
