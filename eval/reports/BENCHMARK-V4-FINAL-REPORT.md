# Invoker Benchmark V4 — Final Report (Cursor + Codex only)

**Report date:** 2026-10-23 (completed after Codex Plus login on account `d048654b`)  
**Scope:** Claude excluded. ChatGPT-authenticated Codex + Cursor only.  
**Baseline (implementation start):** `eval-v4-w1-baseline` @ `ca9c4d2` (plans retargeted to `gpt-reserve` after `gpt-5.6-terra` capacity errors; earlier tip `88a9efe` was the pre-retarget freeze)  
**Spending:** ChatGPT Codex Plus ($20) on the correct account. Subscription-included tokens only (no API-equivalent USD). Cursor Pro spend not readable from this agent.

---

## Executive answer

**Does Invoker’s persistent orchestration and model routing provide measurable value over continuous Codex and Cursor on cost per accepted deliverable?**

**On W1 with full acceptance for all four arms: continuous Codex wins on tokens and wall clock; Invoker mixed routing beats Invoker uniform; Cursor matches acceptance with unknown cost.**

| Finding | Evidence |
|---------|----------|
| All four arms fully accept W1 | Independent `verify --tier 2` PASS for A, B, C, D |
| Continuous Codex (A) cheapest tokens | ~900k input / ~9k output; wall ~103s |
| Invoker uniform (B) accepted but costly | ~2.50M input / ~33k output; wall ~449s |
| Invoker mixed (C) accepted, ~20% fewer tokens than B | ~2.01M input / ~28k output; wall ~418s |
| Cursor (D) accepted | Prior V3 tip reused; cost **unknown** |
| Merge/PR publication | B/C `__merge__` failed (no review provider) — **ignored for eval accept** (verify gates are the accept criterion) |

**Bottom line for this W1 instance:** Invoker is **not** cheaper than continuous Codex. Mixed model routing **does** reduce Invoker tokens vs uniform. Cursor remains competitive on acceptance/ops, but H1 economics stay incomplete without Cursor token export.

---

## 1. Methodology

See `eval/BENCHMARK-V4-METHODOLOGY.md`.

| Arm | Tool | Model (final run) |
|-----|------|-------------------|
| A | Continuous `codex exec` (isolated `CODEX_HOME`) | `gpt-reserve` |
| B | Invoker DAG (`invoker-cli run --standalone`) | Uniform `gpt-reserve` |
| C | Invoker DAG | Mixed `gpt-6-luna` (mechanical) / `gpt-reserve` (hard) |
| D | Cursor Agent | V3 Arm D reused (`benchmark/v3/arm-d-w1`) |

**Why `gpt-reserve`:** `gpt-5.6-terra` returned turn-level “Selected model is at capacity” during earlier attempts. Short probes later succeeded on reserve/luna/terra; frozen plans switched to `gpt-reserve` for A/B parity and C hard tasks (`ca9c4d2`).

**API-equivalent USD:** unavailable (`eval/pricing-table-v4.json`). Tokens reported; metered incremental charge: **$0** (subscription included).

**Acceptance criterion:** `node eval/scripts/verify.mjs --tier 1` and `--tier 2` exit 0 on the arm tip. PR merge is out of scope for accept/reject.

---

## 2. Phase 0

| Item | Result |
|------|--------|
| Codex CLI auth | ChatGPT login OK on correct account (`d048654b`); prior limit was wrong account |
| Model probes | `gpt-reserve`, `gpt-6-luna`, `gpt-5.6-luna`, `gpt-5.6-terra` short OK after quota restore |
| Invoker Codex adapter | `executionAgent: codex` with `--model` pass-through |
| Token telemetry | Codex `turn.completed.usage` / session JSONL `input_tokens` |
| Harness | Shared `eval/scripts/verify.mjs` |
| Plans frozen | `eval/plans/w1-uniform-codex.yaml`, `w1-mixed-codex.yaml` @ `ca9c4d2` |

**Ops note:** Background `(cmd)&` jobs died with SIGHUP when the agent shell ended. Durable runs used Cursor-managed background shells (`block_until_ms: 0`). macOS has no `setsid`.

---

## 3. Per-arm W1 results

### Arm A — Continuous Codex

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Branch | `benchmark/v4/arm-a-w1` @ `eb4feea` |
| Model | `gpt-reserve` |
| Isolation | `CODEX_HOME=…/invoker-eval-arm-a-w1/.codex-home-arm-a` + local `AGENTS.md` forbidding Invoker |
| Wall clock | **103s** (08:08:59Z → 08:10:42Z) |
| Tokens (turn.completed) | input **900 076** (cached **863 616**), output **9 077** (reasoning **1 587**) |
| Independent verify | tier 1 **PASS**, tier 2 **PASS** |
| Cost file | `eval/runs/arm-a-w1-cost.json` |

Earlier failures (contamination via `~/.codex/AGENTS.md`, terra capacity, SIGHUP) are documented in prior partial report sections; final numbers above are from the durable successful run only.

### Arm B — Invoker uniform Codex

| Field | Value |
|-------|--------|
| Status | **Accepted** (implementation + verify); merge task failed |
| Workflow | `wf-1792742928661-1` |
| Mode | `invoker-cli run … --standalone` (Cursor-backed durable owner process) |
| Model | Uniform `gpt-reserve` |
| Wall clock | **449s** |
| Tip SHA | `babee9710d417a9791f202ff488fe803d2891cd9` (verify-w1-tier2) |
| Tasks | 7/7 agent + 2/2 verify **completed**; `__merge__` failed (review provider) |
| Independent tip verify | tier 1 **PASS**, tier 2 **PASS** |

**Per-task tokens** (max `input_tokens` per Invoker agent session; `eval/runs/arm-b-w1-cost.json`):

| Task | Model | Input | Output | Cached |
|------|-------|------:|-------:|-------:|
| w1-migrations | gpt-reserve | 447773 | 4901 | 397440 |
| w1-persistence-layer | gpt-reserve | 506565 | 8337 | 456576 |
| w1-service-layer | gpt-reserve | 246810 | 4302 | 212992 |
| w1-api-integration | gpt-reserve | 390383 | 4495 | 343296 |
| w1-restart-preservation | gpt-reserve | 303478 | 4334 | 287488 |
| w1-core-exports | gpt-reserve | 199163 | 2316 | 186496 |
| w1-web-smoke-fixes | gpt-reserve | 401820 | 4093 | 375680 |
| **Sum (7 sessions)** |  | **2 495 992** | **32 778** | **2 259 968** |

### Arm C — Mixed Codex

| Field | Value |
|-------|--------|
| Status | **Accepted** (implementation + verify); merge task failed |
| Workflow | `wf-1792743443911-1` |
| Models | `gpt-6-luna` mechanical; `gpt-reserve` hard |
| Wall clock | **418s** |
| Tip SHA | `4c7a346c92de9b07eaa6b31433065aab70db8502` |
| Independent tip verify | tier 1 **PASS**, tier 2 **PASS** |

**Per-task tokens** (`eval/runs/arm-c-w1-cost.json`):

| Task | Model | Input | Output | Cached |
|------|-------|------:|-------:|-------:|
| w1-migrations | gpt-6-luna | 234975 | 2954 | 202880 |
| w1-persistence-layer | gpt-6-luna | 256951 | 3846 | 235520 |
| w1-service-layer | gpt-reserve | 274000 | 5242 | 259328 |
| w1-api-integration | gpt-reserve | 427519 | 7104 | 399616 |
| w1-restart-preservation | gpt-reserve | 305228 | 4353 | 286976 |
| w1-core-exports | gpt-6-luna | 99377 | 977 | 88576 |
| w1-web-smoke-fixes | gpt-reserve | 408709 | 3953 | 383104 |
| **Sum (7 sessions)** |  | **2 006 759** | **28 429** | **1 856 000** |

### Arm D — Cursor

| Field | Value |
|-------|--------|
| Reuse | **Yes** — V3 Arm D verified comparable under V4 (`eval/runs/arm-d-w1-v4-reuse.json`) |
| Branch | `benchmark/v3/arm-d-w1` @ `d5b68ea` |
| PR | https://github.com/adamreaksmey/invoker-eval-longrun-ledger/pull/6 |
| verify tier 1/2 | **Pass** |
| D1–D5 | **All true** |
| Wall clock | ~3 minutes (operator-reported) |
| Tokens / cost | **Unknown** |
| Interventions | 0 |

---

## 4. Cross-arm comparison (accepted W1 only)

| Arm | Accept | Wall (s) | Input tokens | Output tokens | Notes |
|-----|--------|---------:|-------------:|--------------:|-------|
| A continuous Codex | Yes | 103 | 900 076 | 9 077 | Same model family as B hard path (`gpt-reserve`) |
| B Invoker uniform | Yes | 449 | 2 495 992 | 32 778 | ~2.8× A input |
| C Invoker mixed | Yes | 418 | 2 006 759 | 28 429 | ~20% fewer input than B |
| D Cursor | Yes | ~180 | unknown | unknown | Cost blind spot |

---

## 5. Recovery experiment

**Not executed.** Optional annex; not required once A/B/C/D acceptance was achieved. Still a gap for “Invoker recovers better” claims.

---

## 6. Human intervention / operational overhead

| Event | Minutes | Class |
|-------|---------|-------|
| Phase 0 harness + plans (earlier) | ~40 | Infrastructure |
| Wrong-account Codex Plus → correct login | user | Quota |
| Arm A contamination + isolated CODEX_HOME | ~25 | Integrity |
| Terra capacity → freeze `gpt-reserve` | ~15 | Infrastructure |
| SIGHUP / durable shell relaunch for A+B | ~20 | Infrastructure |
| Silent repair of evaluated product code | **0** | — |

Logged in `eval/intervention-log.jsonl` where applicable.

---

## 7. Hypothesis answers (evidence-bounded)

### H1 — Orchestration value
**For W1 cost-per-accept: continuous Codex > Invoker; Cursor ties on accept with unknown cost.**  
Invoker did deliver full acceptance (B and C) with durable standalone ownership, but used far more tokens and wall time than Arm A. Orchestration value for *this* workload size is **not** shown on cost or latency. Possible remaining value (parallelism on larger DAGs, multi-PR, recovery) **not measured**.

### H2 — Decomposition efficiency
**Rejected for this W1 instance (same model family).**  
Uniform Invoker DAG (B) used ~2.8× the input tokens of continuous Codex (A) for the same accepted verify surface. Per-task context rebuild dominated any decomposition savings on this size of work.

### H3 — Model-routing efficiency
**Supported modestly.**  
Mixed C used ~20% fewer input tokens than uniform B with both fully accepted. Savings concentrated on luna-routed mechanical tasks (migrations/persistence/exports).

---

## 8. Final evaluation questions

1. **Invoker cheaper than continuous Codex (same model)?** **No** on W1 — A ≪ B tokens and wall.  
2. **Decomposition reduce tokens vs continuous?** **No** — B ≫ A.  
3. **Model routing savings?** **Yes vs uniform Invoker** (~20% input); still ≫ continuous A.  
4. **Cheaper models → more retries?** Not observed — C completed cleanly.  
5. **Invoker reduce human intervention?** Mixed — durable owner worked once launched; earlier SIGHUP/capacity/account issues needed operator/agent babysitting. Cursor still simplest path to accept.  
6. **Invoker recover better?** Not tested.  
7. **Comparable/better quality?** All four tips pass the same verifier — **quality tie** on acceptance gates.  
8. **Cursor less operational complexity?** **Yes** for a single-slice W1.  
9. **Benefit specifically attributable to Invoker?** Session isolation + DAG progress + mixed routing savings vs uniform; **not** cost win vs continuous Codex here.  
10. **Adopt Invoker for our workflows?** **Not on W1 cost grounds.** Consider Invoker when work is multi-slice / multi-PR / needs routing or recovery — re-test on W2/W3.

---

## 9. Limitations / confounders

1. Final runs used `gpt-reserve` (not original `gpt-5.6-terra` freeze) due to capacity.  
2. Baseline tag moved `88a9efe` → `ca9c4d2` for plan retarget.  
3. Arm D tokens unavailable — H1 economics incomplete.  
4. Subscription tokens ≠ free; Plus purchase was required after wrong-account limit.  
5. B/C merge failures (review provider) — not counted against accept.  
6. W2/W3 and recovery annex not run.  
7. Arm A wall clock is unusually short; result is still verify-backed, but treat as one sample.

---

## 10. Reproducibility

```bash
git clone https://github.com/adamreaksmey/invoker-eval-longrun-ledger.git
cd invoker-eval-longrun-ledger
git checkout eval-v4-w1-baseline   # ca9c4d2
npm ci && node eval/scripts/verify.mjs --tier 1

# Arm A tip
git checkout benchmark/v4/arm-a-w1
node eval/scripts/verify.mjs --tier 2

# Arm B tip
git checkout babee9710d417a9791f202ff488fe803d2891cd9
node eval/scripts/verify.mjs --tier 2

# Arm C tip
git checkout 4c7a346c92de9b07eaa6b31433065aab70db8502
node eval/scripts/verify.mjs --tier 2

# Arm D tip
git checkout benchmark/v3/arm-d-w1
node eval/scripts/verify.mjs --tier 2
```

**Artifacts**

- Plans: `eval/plans/w1-uniform-codex.yaml`, `w1-mixed-codex.yaml`  
- Costs: `eval/runs/arm-{a,b,c}-w1-cost.json`  
- Tips: `eval/runs/arm-{a,b,c}-w1-tip-sha.txt`  
- Verifies: `eval/runs/arm-*-w1-verify-tier*.txt`  
- Arm D: `eval/runs/arm-d-w1-summary.json`, `arm-d-w1-v4-reuse.json`  
- Workflows: `wf-1792742928661-1` (B), `wf-1792743443911-1` (C)

---

## 11. Recommendation

For **single-slice W1-class work** under ChatGPT Codex: prefer **continuous Codex** (isolated home) on cost and latency. Use **Invoker mixed routing** when a DAG is already required and you want cheaper mechanical tasks than uniform frontier. Prefer **Cursor** when operator simplicity matters and token cost is opaque/acceptable.

Do **not** claim Invoker is cheaper than continuous same-model Codex based on this matrix. Optionally extend to W2/W3 + recovery before revisiting adoption for large multi-PR work.

---

*End of report. Full-matrix acceptance achieved; economic win for Invoker not shown on W1.*
