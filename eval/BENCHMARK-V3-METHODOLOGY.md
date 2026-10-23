# Invoker Benchmark V3 methodology

See operator report `eval/reports/BENCHMARK-V3-FINAL-REPORT.md` for results.

## Arms

| Arm | Execution |
|-----|-----------|
| A | Single continuous Claude Code session (`claude-opus-5-5`) |
| B | Invoker DAG, uniform Opus (`eval/plans/w1-uniform-opus.yaml`) |
| C | Invoker DAG, mixed models (`eval/plans/w1-mixed-models.yaml`) |
| D | Cursor Agent, same spec, isolated worktree |

## Hypotheses

- **H1:** B vs D (+ recovery annex) — orchestration / adoption
- **H2:** B vs A — decomposition with same model
- **H3:** C vs B — model routing

## Verification

`node eval/scripts/verify.mjs --tier 1|2` — identical for all arms.

## Cost

`eval/scripts/cost-roll-up.mjs` on Claude session JSONL; cap in `eval/SPENDING-CAP.md`.
