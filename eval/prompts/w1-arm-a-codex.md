# Benchmark V4 Arm A — Continuous Codex (W1)

You are implementing the full W1 specification in this repository in one continuous session.

Read and follow: `eval/specs/w1-persisted-ledger.md`

## Required deliverables

1. Versioned SQLite migrations for accounts/transactions (schema_version / schema_migrations).
2. Persistent ledger storage per authenticated user (replace in-memory Map of Ledger).
3. Service layer (LedgerService) testable without Express.
4. API integration + contract/integration tests (supertest).
5. Frontend compatibility; fix form.reset() after await if present.
6. Data preservation across restart (integration test).
7. `npm ci && npm test && npm run build` pass.
8. Playwright: enable ledger smoke in `eval/e2e/smoke.spec.ts` and make `node eval/scripts/verify.mjs --tier 2` pass.

## Constraints

- Do not invent unrelated features (no recurring/budgets — those are W2).
- Integer cents for money.
- Only one logical owner for `packages/core/src/index.ts` exports.
- Commit incrementally with clear messages.
- Do not push to `main`. Stay on the current branch.
- When done, run `node eval/scripts/verify.mjs --tier 1` then tier 2 and leave the tree green.

Start now.
