# Invoker Benchmark V4 methodology (Cursor + Codex only)

Claude is excluded. No Anthropic APIs.

## Arms

| Arm | Tool | Model policy |
|-----|------|--------------|
| A | Continuous `codex exec` | Uniform `gpt-5.6-terra` |
| B | Invoker DAG | Uniform `codex` + `gpt-5.6-terra` |
| C | Invoker DAG | Mixed: `gpt-6-luna` mechanical / `gpt-5.6-terra` hard |
| D | Cursor Agent | Prior W1 result reusable if baseline+spec+verify match |

## Baseline

`eval-v4-w1-baseline` → harness tip including `eval/` scripts and product code at ledger W1 start state.

## Hypotheses

- **H1:** B/C recovery & intervention vs D
- **H2:** B vs A (same Codex model)
- **H3:** C vs B (routing) — only if mixed models execute

## Cost

Token telemetry from Codex JSONL / Invoker session drivers. Subscription-included usage is **not** treated as free; incremental metered charge reported separately when present (expected: none for ChatGPT login path).
