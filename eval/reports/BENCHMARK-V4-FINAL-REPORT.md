# Invoker Benchmark V4 — Final Report (Cursor + Codex only)

**Report date:** 2026-10-23  
**Scope:** Claude excluded. ChatGPT-authenticated Codex + Cursor only.  
**Baseline:** `eval-v4-w1-baseline` / `88a9efe6b5a96ea1550a883aba3088cb33266986`  
**Spending:** No new purchases. Subscription-included Codex usage only. **Codex usage limit hit** mid-pilot (retry not before **2026-11-17** per CLI error).

---

## Executive answer

**Does Invoker’s persistent orchestration and model routing provide measurable value over continuous Codex and Cursor on cost per accepted deliverable?**

**Not established for a fully accepted W1 matrix.**

| Finding | Evidence |
|---------|----------|
| Cursor (Arm D) can fully accept W1 | Independent `verify --tier 2` pass; D1–D5 true |
| Invoker + uniform Codex (Arm B) can implement most of W1 | 6/7 agent tasks completed; **tier 1 pass** on tip; **tier 2 fail** |
| Continuous Codex (Arm A) | **Unavailable** after usage limit (and earlier Invoker-skill contamination) |
| Mixed Codex routing (Arm C) | **Not evaluated** (same usage limit) |
| Cost-per-accepted-spec for Invoker | **Undefined** (Arm B not fully accepted) |

A credible partial conclusion: **Cursor completed the accepted deliverable set with less operational friction in this environment.** Invoker demonstrated multi-task Codex orchestration and left a tier-1-green tip, but did **not** clear shared Playwright acceptance before quota exhaustion.

---

## 1. Methodology

See `eval/BENCHMARK-V4-METHODOLOGY.md`.

| Arm | Tool | Model |
|-----|------|-------|
| A | Continuous `codex exec` | `gpt-5.6-terra` (intended) |
| B | Invoker DAG | Uniform `codex` + `gpt-5.6-terra` |
| C | Invoker DAG | Mixed `gpt-6-luna` / `gpt-5.6-terra` |
| D | Cursor Agent | Prior W1 (reused after comparability check) |

**Verified Codex models (ChatGPT login):** `gpt-5.6-terra`, `gpt-6-luna`, `gpt-5.6-luna`, `gpt-reserve`.

**API-equivalent USD:** unavailable for this auth path (`eval/pricing-table-v4.json`). Tokens reported; billed incremental charge: **$0 metered** (subscription included until hard limit).

---

## 2. Phase 0

| Item | Result |
|------|--------|
| Codex CLI auth | ChatGPT login OK (`codex login status`) |
| Model probes | All four catalog models replied `CODEX_OK` |
| Invoker Codex adapter | `executionAgent: codex` with `--model` pass-through |
| Token telemetry | Codex rollout `token_usage_record` with `thread_token_usage` |
| Harness | `node eval/scripts/verify.mjs --tier 1` pass on baseline |
| Plans frozen | `eval/plans/w1-uniform-codex.yaml`, `w1-mixed-codex.yaml` |

---

## 3. Per-arm W1 results

### Arm A — Continuous Codex

| Field | Value |
|-------|--------|
| Status | **Unavailable / incomplete** |
| Attempt 1 | Contaminated: global `~/.codex/AGENTS.md` Invoker routing + skills caused Codex to route to Invoker instead of implementing |
| Mitigation | Isolated `CODEX_HOME`, local `AGENTS.md` forbidding Invoker, explicit “do it locally” prompt |
| Attempt 2 | Started correctly (“I’ll implement W1 locally…”) then process died mid-explore |
| Attempt 3 | **Usage limit:** “try again at Nov 17th, 2026 9:44 PM” |
| Tokens | Partial contaminated session only; not used as economic baseline |
| Accepted? | **No** |

### Arm B — Invoker uniform Codex

| Field | Value |
|-------|--------|
| Workflow | `wf-1792728508443-1` |
| Mode | `invoker-cli run … --standalone` |
| Model | `gpt-5.6-terra` |
| Wall clock | ~13 minutes (submit → terminal failed) |
| Completed tasks | migrations, persistence, service, api-integration, restart-preservation, core-exports |
| Failed task | `w1-web-smoke-fixes` (exit 1; Playwright binary missing mid-session; process ended before finish) |
| Skipped | verify-w1-tier1, verify-w1-tier2 |
| Independent tip verify | **tier 1 PASS**; **tier 2 FAIL** (ledger account smoke assertion) |
| Full acceptance | **No** |
| Retry | Owner mutation unavailable from CLI without live Electron owner; usage limit then blocked further Codex |

**Per-task tokens** (max `thread_token_usage` per Codex session; see `eval/runs/arm-b-w1-cost.json`):

| Task | Input | Output | Cached input |
|------|------:|-------:|-------------:|
| w1-migrations | 360845 | 5965 | 323840 |
| w1-persistence-layer | 396825 | 7242 | 352768 |
| w1-service-layer | 195275 | 3870 | 171776 |
| w1-api-integration | 297346 | 3845 | 270336 |
| w1-core-exports | 131700 | 1744 | 116992 |
| w1-restart-preservation | 289465 | 3506 | 258816 |
| w1-web-smoke-fixes (failed) | 198974 | 3002 | 175872 |
| **Sum (7 sessions)** | **1 870 430** | **29 174** | **1 670 400** |

Estimated API-equivalent USD: **null** (subscription path).  
Actual billed incremental: **$0** until hard usage limit.

### Arm C — Mixed Codex

| Field | Value |
|-------|--------|
| Status | **Not evaluated** |
| Reason | Codex ChatGPT usage limit after Arm B |

### Arm D — Cursor

| Field | Value |
|-------|--------|
| Reuse | **Yes** — V3 Arm D verified comparable under V4 (`eval/runs/arm-d-w1-v4-reuse.json`) |
| Branch | `benchmark/v3/arm-d-w1` @ `d5b68ea` |
| PR | https://github.com/adamreaksmey/invoker-eval-longrun-ledger/pull/6 |
| verify tier 1/2 | **Pass** (re-run under V4) |
| D1–D5 | **All true** |
| Wall clock | ~3 minutes (operator-reported) |
| Tokens / cost | **Unknown** (Cursor telemetry not exposed) |
| Interventions | 0 |

---

## 4. Recovery experiment

**Not executed.** Requires live Invoker task mid-flight; blocked by usage limit and lack of durable live owner for retry mutations in this CLI-only setup.

---

## 5. Human intervention / operational overhead

| Event | Minutes | Class |
|-------|---------|-------|
| Phase 0 harness + plans | ~40 | Infrastructure |
| Arm A contamination diagnosis + isolated CODEX_HOME | ~25 | Infrastructure / integrity |
| Arm B submit monitor + independent verify | ~20 | Operator |
| Attempted owner retry (failed to register) | ~5 | Infrastructure |
| Silent repair of Arm B product code | **0** | — |

Logged in `eval/intervention-log.jsonl`.

---

## 6. Hypothesis answers (evidence-bounded)

### H1 — Orchestration value
**Inconclusive / leans Cursor for this W1 instance.**  
Cursor delivered full acceptance with low operator time. Invoker orchestrated six successful Codex tasks and preserved a tier-1 tip, but failed to finish acceptance (smoke task + verify gates) and required more operator monitoring. Recovery advantage **not measured**.

### H2 — Decomposition efficiency
**Not measurable.** Arm A (continuous Codex, same model) did not complete. Cannot compare token totals for fully accepted specs. Arm B alone consumed ~1.87M input / ~29k output tokens across seven sessions **without** full acceptance.

### H3 — Model-routing efficiency
**Not evaluated** (Arm C skipped).

---

## 7. Final evaluation questions

1. **Invoker cheaper than continuous Codex (same model)?** Unknown — Arm A unavailable.  
2. **Decomposition reduce tokens vs context rebuild?** Unknown — no Arm A baseline.  
3. **Model routing savings?** Not evaluated.  
4. **Cheaper models → more retries?** Not evaluated.  
5. **Invoker reduce human intervention?** Not in this run — Cursor needed less intervention for a full accept.  
6. **Invoker recover better?** Not tested.  
7. **Comparable/better quality?** Arm B tip tier-1 OK; tier-2 failed vs Cursor full pass.  
8. **Cursor less operational complexity?** **Yes, in this pilot.**  
9. **Benefit specifically attributable to Invoker?** Task graph progress + per-task session isolation observed; **not** proven economic or acceptance benefit here.  
10. **Adopt Invoker for our workflows?** **Not justified by V4 W1 evidence alone.** Re-run after Codex quota resets with Arms A+B+C complete before adopting on cost grounds.

---

## 8. Limitations / confounders

1. **ChatGPT Codex usage limit** truncated the matrix.  
2. **Global Invoker routing in `~/.codex/AGENTS.md`** contaminated Arm A until isolated `CODEX_HOME`.  
3. **Invoker CLI standalone** could not `retry-task` without a live owner (Electron/owner-serve registration failed in this attempt).  
4. **Codex spawn “Reading additional input from stdin…”** noise in Invoker worker logs — possible stdin handling confounder.  
5. **Subscription tokens ≠ free**; hard limit is a real cost (opportunity + delay).  
6. **Arm D cost unknown** — weakens H1 economic comparison.  
7. **W2/W3 not run** (quota + incomplete W1 pilot gate).

---

## 9. Reproducibility

```bash
git clone https://github.com/adamreaksmey/invoker-eval-longrun-ledger.git
cd invoker-eval-longrun-ledger
git checkout eval-v4-w1-baseline   # or 88a9efe
npm ci && node eval/scripts/verify.mjs --tier 1

# Arm B plan (requires Codex quota)
invoker-cli run eval/plans/w1-uniform-codex.yaml --standalone --json

# Arm D tip
git checkout benchmark/v3/arm-d-w1
node eval/scripts/verify.mjs --tier 2
```

**Artifacts**

- Plans: `eval/plans/w1-uniform-codex.yaml`, `w1-mixed-codex.yaml`  
- Arm B cost: `eval/runs/arm-b-w1-cost.json`  
- Arm D: `eval/runs/arm-d-w1-summary.json`, `arm-d-w1-v4-reuse.json`  
- Workflow: `wf-1792728508443-1`  
- Sessions under `~/.codex/sessions/2026/10/23/rollout-2026-10-23T11-*.jsonl`

---

## 10. Recommendation

Do **not** treat V4 as proof that Invoker is cheaper or more autonomous than Cursor/Codex continuous work.

**Next run (after 2026-11-17 Codex quota reset, or with authorized metered API):**

1. Keep isolated `CODEX_HOME` for Arm A (no Invoker skills/AGENTS routing).  
2. Run Arm A to full `verify --tier 2`.  
3. Re-run Arm B (and C) to full acceptance.  
4. Compare **cost of fully accepted specs only**.  
5. Add recovery annex with a live owner.

Until then, the only **fully accepted** W1 arm in this study is **Cursor (Arm D)**.

---

*End of report. Negative and incomplete results reported as such.*
