# Invoker Benchmark V3 — Final Report (partial)

**Report date:** 2026-10-23  
**Operator:** autonomous Cursor agent (infrastructure + Arm D); Invoker/Claude arms blocked by auth  
**Spending cap:** USD 300 API-equivalent (`eval/SPENDING-CAP.md`) — **USD 0.00 metered API observed** (no Claude session completed)

---

## 1. Executive answer

**Does Invoker’s persistent orchestration and model routing provide measurable value over continuous Claude and Cursor, on cost per accepted deliverable?**

**Not determinable from this run.** Arms **A, B, and C** did not execute agent work because **Claude Code is not authenticated** on this machine (`Not logged in · Please run /login`; no `ANTHROPIC_API_KEY` / `CLAUDE_CODE_OAUTH_TOKEN`; worker config at `~/.invoker/claude-worker/.claude.json` has no OAuth/API key material).

**Arm D (Cursor)** **completed W1** with all deliverables **D1–D5** verified locally. Token/cost data for Cursor is **not exposed** to the agent; only **~3 minutes wall-clock** was recorded.

A single successful Cursor arm **cannot** support H2 (decomposition vs single session) or H3 (mixed models) without Claude-backed Arms A/B/C.

---

## 2. Methodology (summary)

Full design: `eval/BENCHMARK-V3-METHODOLOGY.md`.

| Arm | Intended execution | W1 status |
|-----|-------------------|-----------|
| **A** | Continuous `claude` Opus session | **Not run** — auth |
| **B** | Invoker DAG uniform Opus (`eval/plans/w1-uniform-opus.yaml`) | **Failed at first task** — auth |
| **C** | Invoker DAG mixed models (`eval/plans/w1-mixed-models.yaml`) | **Not run** — auth |
| **D** | Cursor Agent, isolated worktree | **Complete** — see §4 |

**Shared spec:** `eval/specs/w1-persisted-ledger.md`  
**Baseline:** `0d3bf647d10a0b1dd9a3c1632ddb1b6125279797` (tag/branch `eval-v3-w1-baseline`)

**Verification (all arms):** `node eval/scripts/verify.mjs --tier 1|2`

---

## 3. Phase 0 outcomes

| Item | Result |
|------|--------|
| Harness branch | `benchmark/v3-infrastructure` @ `1dd3817` pushed |
| Tier 1 on harness | **Pass** (`npm ci`, `npm test`, `npm build`) |
| Tier 2 on harness | **Pass** (auth Playwright smoke; ledger smoke deferred as `fixme` until W1) |
| Pricing table | `eval/pricing-table.json` (Anthropic list prices 2026-10-23) |
| Cost script | `eval/scripts/cost-roll-up.mjs` (tokens → USD; not exercised on live Claude sessions) |
| Model probe | **Fail** — CLI rejects `claude-haiku-5-5` catalog id; aliases `haiku`/`sonnet`/`opus` also require login |
| Invoker cost query | Headless `query cost-events` available via Electron owner; **USD estimates in Invoker remain 0** in product code |

**Repo provision:** added `npm ci` for eval repo in `~/.invoker/config.json`.

---

## 4. Per-arm results (W1)

### Arm A — Single-session Claude

| Field | Value |
|-------|--------|
| Status | **Not executed** |
| Reason | Claude Code not logged in; no API key |
| Cost | N/A |

### Arm B — Invoker uniform Opus

| Field | Value |
|-------|--------|
| Workflow ID | `wf-1792727239886-1` |
| Mode | `invoker-cli run … --standalone` |
| First task | `w1-migrations` → **failed** (exit 1) |
| Log excerpt | `Not logged in · Please run /login` |
| Downstream tasks | **skipped** |
| Cost | **0** (no usage events) |

Worktree log: `~/.invoker-cli/outputs/full/f3b4653f88505877c6e642fcfcae3fa27e1302afa1567f1fda1c729a89439de9.log`

### Arm C — Invoker mixed models

| Field | Value |
|-------|--------|
| Status | **Not executed** (blocked by same auth prerequisite) |

### Arm D — Cursor workflow

| Field | Value |
|-------|--------|
| Branch | [`benchmark/v3/arm-d-w1`](https://github.com/adamreaksmey/invoker-eval-longrun-ledger/tree/benchmark/v3/arm-d-w1) |
| Commits | `d363181`, `d5b68ea` |
| Wall clock | **~3 min** (operator-reported) |
| verify tier 1 | **Pass** (independently re-run by operator) |
| verify tier 2 | **Pass** (2 Playwright tests) |
| D1–D5 | **All true** — see `eval/runs/arm-d-w1-summary.json` |
| API-equivalent cost | **Unknown** (Cursor usage not visible) |
| Human intervention | **0 min** (automated agent pass) |

**Quality notes (Arm D):** +739 / −65 lines vs baseline; migrations, `LedgerService`, SQLite repository, restart test, enabled ledger e2e; fixed baseline UI bug (`event.currentTarget` null after `await` on form reset).

---

## 5. Token and cost breakdown

| Arm | Input tokens | Output tokens | API-equivalent USD | Billed USD |
|-----|-------------|---------------|-------------------|------------|
| A | — | — | — | — |
| B | 0 (no session) | 0 | 0.00 | 0.00 |
| C | — | — | — | — |
| D | — | — | — | — |

**Primary metric (cost / accepted deliverable):** undefined for A–C; undefined for D (cost unknown).

---

## 6. Verification matrix (W1)

| Check | Arm B | Arm D |
|-------|-------|-------|
| Tier 1 | Not reached | Pass |
| Tier 2 | Not reached | Pass |
| Blind diff review | N/A | **Not performed** (time/consistency; recommend before publication) |

---

## 7. Recovery experiment

**Not executed.** Requires a live Invoker Claude task mid-flight; blocked by auth. No recovery cost recorded.

---

## 8. Human intervention and overhead

| Activity | Minutes | Notes |
|----------|---------|-------|
| Phase 0 harness | ~45 | Operator agent |
| Arm B submit/debug | ~10 | Standalone workflow + log/DB inspection |
| Arm D execution | ~3 | Subagent wall clock |
| User supervision | **0** | Per authorization |

Logged in `eval/intervention-log.jsonl` (empty — no manual repairs to evaluated implementations).

---

## 9. Hypothesis findings

| ID | Finding |
|----|---------|
| **H1** (orchestration vs Cursor) | **Incomplete.** Cursor (D) completed W1 in one pass. Invoker (B) never left orchestration setup. |
| **H2** (decomposition vs single session) | **Not testable** without Arm A and successful Arm B. |
| **H3** (mixed models) | **Not testable** without Arm C. |

---

## 10. Limitations and confounders

1. **Claude authentication absent** — primary blocker for 75% of the matrix.
2. **Cursor cost opacity** — Arm D economics unknown.
3. **Invoker `estimatedCostUsd`** still zero in headless cost rollup (product limitation; external script ready).
4. **Arm D agent** had full spec context in one session (matches Arm A intent but is not Claude Opus).
5. **W2/W3** not started (budget validity moot while Claude blocked).
6. **Prior endurance workflows** on same repo (`wf-1792722819743-9` et al.) are **not** part of this V3 matrix (different plans/base).

---

## 11. Reproducibility

```bash
# Baseline
git clone https://github.com/adamreaksmey/invoker-eval-longrun-ledger.git
cd invoker-eval-longrun-ledger
git checkout eval-v3-w1-baseline  # or 0d3bf647

# Phase 0 harness
git checkout benchmark/v3-infrastructure
npm ci && node eval/scripts/verify.mjs --tier 1

# Arm D result
git checkout benchmark/v3/arm-d-w1
npm ci && node eval/scripts/verify.mjs --tier 2

# Arm B (requires Claude login + Invoker owner)
invoker-cli run eval/plans/w1-uniform-opus.yaml --standalone
```

**Artifacts**

- Plans: `eval/plans/w1-uniform-opus.yaml`, `eval/plans/w1-mixed-models.yaml`
- Arm D summary: `eval/runs/arm-d-w1-summary.json` on branch `benchmark/v3/arm-d-w1`
- Failed B log: `~/.invoker-cli/outputs/full/f3b4653f88505877…log`

---

## 12. Recommendation on Invoker adoption

From **this partial run only:**

- **Economic benefit of Invoker DAG vs single Cursor session:** **no evidence** (Invoker did not run; Cursor completed W1 quickly with full acceptance).
- **Orchestration value (H1):** **unproven** — recovery, retry, and multi-day DAG benefits were not exercised.
- **Before retrying the benchmark:** authenticate Claude Code for Invoker worker config (`~/.invoker/claude-worker`), confirm model IDs (`opus`/`sonnet`/`haiku` vs full SKU strings), start a reachable owner (`invoker-cli owner serve` or desktop), and re-submit Arms B/C with cost export via session JSONL + `eval/scripts/cost-roll-up.mjs`.

**Negative result is valid:** under current environment constraints, **Invoker’s orchestration and model routing were not demonstrated to reduce cost or improve outcomes** relative to Cursor for W1; the comparison is **incomplete**, not a refutation of Invoker in environments where Claude execution works.

---

## 13. W2 / W3

**Not executed** (Claude/Invoker prerequisite unresolved; spending cap preserved).

---

*End of report.*
