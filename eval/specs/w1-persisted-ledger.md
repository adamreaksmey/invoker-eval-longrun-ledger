# W1 — Persisted ledger modernization

**Baseline:** git tag `eval-v3-w1-baseline` (`0d3bf647d10a0b1dd9a3c1632ddb1b6125279797`)

## Functional requirements

1. **Versioned migrations** — Add a migration runner and schema version table. Persist accounts and transactions in SQLite (same DB file as auth, or documented separate file with single `DATABASE_PATH`).
2. **Service layer** — Domain operations (add account, post transaction, list, balance) live in a testable service in `@personal-ledger/core` or `@personal-ledger/api` that does not depend on Express.
3. **API** — Replace in-memory `Map<string, Ledger>` with persisted storage per authenticated user. Preserve existing HTTP routes and JSON shapes (`/accounts`, `/transactions`, `/accounts/:id/balance`, `/auth/*`).
4. **Frontend** — No regression in README auth smoke flow (register, ledger, sign out/in, per-user isolation).
5. **Data preservation** — After API restart, accounts/transactions/balances for a user remain correct (integration test required).
6. **Regression** — All existing Vitest tests pass; `npm run build` succeeds.

## Acceptance deliverables (D1–D5)

| ID | Deliverable | Verification |
|----|-------------|--------------|
| D1 | Migrations apply on empty DB | `eval/scripts/verify.mjs --tier 1` |
| D2 | Service layer + unit tests | tier 1 |
| D3 | API contract / integration tests | tier 1 |
| D4 | Playwright auth + ledger smoke | `eval/scripts/verify.mjs --tier 2` |
| D5 | Full bundle | tiers 1 + 2 |

## Out of scope

- New product features (recurring, budgets, exports) — those are W2/W3.
- Deployment or cloud hosting changes.

## Implementation notes

- Only one task may own barrel/export changes to `packages/core/src/index.ts` per workflow (avoid parallel index edits).
- Use integer cents for money throughout.
