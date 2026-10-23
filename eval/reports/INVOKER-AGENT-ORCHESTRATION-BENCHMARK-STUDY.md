# Measuring Orchestration Value for AI Coding Agents: An Empirical Study of Invoker, Continuous Codex, and Cursor

**Study series:** Invoker Benchmarks V3–V4  
**Date:** 2026-10-23  
**Subject systems:** Invoker (workflow orchestrator), OpenAI Codex CLI, Cursor Agent, Anthropic Claude Code (attempted)  
**Subject application:** Personal Ledger (`invoker-eval-longrun-ledger`)  
**Primary workload completed:** W1 — persisted ledger modernization  
**Status:** W1 full four-arm matrix accepted under V4 (Cursor + Codex); V3 Claude matrix incomplete due to authentication

---

## Abstract

Software teams increasingly use AI coding agents either as **single continuous sessions** (one agent holds the whole task) or as **orchestrated multi-task workflows** (a planner splits work into a dependency graph and routes each node to an agent/model). It is unclear whether orchestration reduces cost, improves acceptance rates, or merely adds overhead for small-to-medium feature work.

This study evaluates that question on a fixed product modernization task using a shared specification and a shared automated verifier. We compare four execution arms:

| Arm | Execution style |
|-----|-----------------|
| **A** | One continuous agent session |
| **B** | Invoker DAG with a uniform model |
| **C** | Invoker DAG with mixed (cheaper/harder) model routing |
| **D** | Cursor Agent in a single pass |

**Benchmark V3** targeted Claude Code for Arms A–C and Cursor for Arm D. Claude authentication blocked A–C; only Cursor completed W1.

**Benchmark V4** excluded Claude and re-ran the matrix with ChatGPT-authenticated Codex for A–C, reusing the Cursor tip for D when comparability held. All four arms achieved full acceptance (`verify --tier 2`). On token and wall-clock cost for this workload, **continuous Codex was cheapest**; **Invoker mixed routing beat Invoker uniform by ~20% input tokens**; **Invoker was not cheaper than continuous same-family Codex**; **Cursor matched acceptance with unknown token cost**.

The result is evidence-bounded to one workload class (W1) and one successful model path (`gpt-reserve` / `gpt-6-luna`). Larger multi-PR workloads (W2/W3) and recovery experiments remain future work.

---

## 1. Introduction

### 1.1 Motivation

AI coding agents can implement non-trivial features from a natural-language or markdown specification. Two competing operational models are common:

1. **Continuous session.** One agent explores the repository, implements changes, runs tests, and iterates until done. Context accumulates in a single transcript.
2. **Orchestrated DAG.** A workflow system decomposes the specification into tasks with dependencies, provisions isolated worktrees/branches per task, runs an agent (or command) per node, and merges results. Different nodes may use different models.

**Invoker** is an open workflow product designed for the second model: durable task graphs, git worktrees, agent adapters (Claude, Codex, etc.), verification gates, and optional pull-request publication. The product claim under test is not “can agents write code?” (they can) but:

> Does Invoker’s persistent orchestration and model routing provide **measurable value**—especially on **cost per accepted deliverable**—over continuous same-model agent work and over Cursor?

### 1.2 Why a controlled product workload?

Comparing tools on vague prompts invites confounds (different goals, different stop conditions). This study therefore:

- freezes a **real application baseline**;
- publishes a **written functional specification** with numbered deliverables;
- uses an **identical verifier** for every arm;
- forbids silent human repair of the evaluated implementation;
- records tokens, wall clock, and operational interventions separately from acceptance.

### 1.3 Contributions

1. A reusable **evaluation harness** for agent orchestration comparisons on a Node/TypeScript monorepo.
2. Two campaign reports: **V3** (Claude-blocked; Cursor succeeds) and **V4** (Codex+Cursor full matrix).
3. Evidence that, for W1-scale work under Codex, **decomposition into an Invoker DAG increases token spend versus a continuous session**, while **mixed-model routing within Invoker reduces spend versus uniform Invoker**.
4. An explicit negative/partial result discipline: incomplete matrices are reported as incomplete, not as refutations.

---

## 2. Background: systems under study

### 2.1 Invoker

**Invoker** is a local-first agent workflow runtime. Relevant capabilities for this study:

- **Plans as YAML.** Tasks declare prompts, optional `executionAgent` / `executionModel`, and dependencies.
- **Worktree isolation.** Each task typically runs in a git worktree on an experiment branch.
- **Agent adapters.** Workers can invoke Claude Code, Codex CLI, or command-only verify steps.
- **Persistence.** Workflow/task state lives in SQLite (desktop owner or `invoker-cli` standalone home).
- **Finish modes.** Plans may request pull-request publication after the DAG completes.

In this study, Invoker Arms B and C were submitted via:

```bash
invoker-cli run <plan.yaml> --standalone --json
```

Acceptance for Invoker tips was defined by the **shared verifier**, not by successful GitHub merge. (V4 B/C merge tasks failed for lack of a configured review provider; those failures were treated as out of scope for acceptance.)

### 2.2 Continuous Codex (OpenAI Codex CLI)

**Codex** (`codex exec`) runs a ChatGPT-authenticated coding agent in a working directory. Arm A used a **single continuous session** with:

- isolated `CODEX_HOME` (to avoid global Invoker routing skills contaminating the arm);
- a local `AGENTS.md` forbidding Invoker handoff;
- model `gpt-reserve` on the final successful run;
- approvals/sandbox bypassed for unattended execution.

### 2.3 Cursor Agent

**Cursor** is an IDE-integrated coding agent. Arm D ran as one agent pass over an isolated worktree/branch with the same W1 specification. Cursor does not expose token telemetry to the evaluating agent; wall clock and verify outcomes are recorded instead.

### 2.4 Claude Code (V3 only; incomplete)

V3 intended Anthropic **Claude Code** for Arms A–C (uniform Opus vs mixed models). On the evaluation machine, Claude was not logged in and no API key was available. V3 therefore could not measure H2/H3 under Claude. V4 **explicitly excluded Claude** rather than wait on Anthropic auth/spend.

### 2.5 Subject application: Personal Ledger

The evaluation repository is a small **personal finance ledger** monorepo used as a realistic but bounded product:

| Package / area | Role |
|----------------|------|
| `packages/core` | Domain rules (ledger, auth helpers, money in integer cents) |
| `packages/api` | Express HTTP API + SQLite auth DB |
| `apps/web` | Vite/React UI; proxies `/api` to the local API |
| Tests | Vitest unit/integration; Playwright smoke e2e |

**Pre-W1 state (problem statement):** authentication already used SQLite, but ledger accounts/transactions lived in an **in-memory `Map`**, so data did not survive API restart and lacked a proper migration/service architecture.

Repository: `https://github.com/adamreaksmey/invoker-eval-longrun-ledger`

---

## 3. Research questions and hypotheses

### 3.1 Primary question

**RQ1.** On a fixed accepted deliverable, does Invoker orchestration reduce **cost** (tokens and/or wall clock) or **operator intervention** relative to continuous agent sessions and Cursor?

### 3.2 Hypotheses

| ID | Statement | Contrast |
|----|-----------|----------|
| **H1** | Invoker orchestration provides value vs Cursor (and vs continuous agent) on acceptance, intervention, and/or recovery | B/C vs D (and vs A) |
| **H2** | Task decomposition reduces tokens vs one continuous session **using the same model family** | B vs A |
| **H3** | Routing mechanical tasks to cheaper models reduces tokens vs uniform frontier/agentic models **without losing acceptance** | C vs B |

### 3.3 Secondary questions (pre-registered style)

1. Is Invoker cheaper than continuous Codex for the same accepted spec?
2. Does decomposition reduce tokens relative to continuous context growth?
3. Does mixed routing save tokens? Does it increase retries?
4. Does Invoker reduce human intervention?
5. Does Invoker recover better from mid-flight failure? *(annex; not executed)*
6. Is quality comparable under a shared verifier?
7. Is Cursor operationally simpler for single-slice work?
8. What benefits are specifically attributable to Invoker vs the underlying coding model?

---

## 4. Experimental design

### 4.1 Workloads

Three workloads were designed; **only W1 was fully executed**.

| ID | Name | Intent |
|----|------|--------|
| **W1** | Persisted ledger modernization | Feature modernization with migrations, service layer, API persistence, restart test, UI smoke |
| **W2** | Recurring transactions + budgets | Larger cross-cutting feature (planned; not run) |
| **W3** | Regression repair basket | Fix injected failing tests without deleting coverage (planned; not run) |

W2/W3 were gated behind W1 completion and remaining budget/quota. After V4 W1 completed, they were left for a follow-on campaign.

### 4.2 W1 specification (summary)

Full text: `eval/specs/w1-persisted-ledger.md`.

**Functional requirements**

1. Versioned SQLite migrations for accounts/transactions (schema version table).
2. Express-free service layer for domain operations.
3. Replace in-memory ledger map with per-user persisted storage; preserve HTTP JSON contracts.
4. No regression in README auth smoke (register, ledger use, sign-out/in, isolation).
5. Data survives API restart (integration test required).
6. Existing Vitest suite and production build remain green.

**Acceptance deliverables**

| ID | Deliverable | Gate |
|----|-------------|------|
| D1 | Migrations on empty DB | verify tier 1 |
| D2 | Service layer + unit tests | tier 1 |
| D3 | API contract/integration tests | tier 1 |
| D4 | Playwright auth + ledger smoke | tier 2 |
| D5 | Full bundle | tiers 1 + 2 |

### 4.3 Shared verifier

All arms are judged by the same script:

```bash
node eval/scripts/verify.mjs --tier 1   # npm ci, npm test, npm run build
node eval/scripts/verify.mjs --tier 2   # tier 1 + Playwright smoke (npm run test:e2e)
```

**Acceptance rule used in V4:** both tiers exit 0 on the arm’s tip commit. GitHub PR merge is **not** required for acceptance.

### 4.4 Arms (intended matrix)

| Arm | Tool | Decomposition | Model policy |
|-----|------|---------------|--------------|
| A | Continuous CLI agent | None (one session) | Uniform |
| B | Invoker | Fixed DAG (~7 implement + 2 verify tasks) | Uniform |
| C | Invoker | Same DAG as B | Mixed: cheaper models on mechanical nodes; stronger models on integration/architecture |
| D | Cursor Agent | None (one session) | Cursor’s default agent stack |

**Invoker DAG shape (W1):** migrations → persistence → service → API integration → restart preservation; core exports after service/API; web smoke fixes; then command-only verify tier 1 and tier 2.

### 4.5 Baselines and freezes

| Campaign | Product/harness baseline | Notes |
|----------|--------------------------|-------|
| V3 | `eval-v3-w1-baseline` @ `0d3bf647…` | Pre-persistence ledger; harness added on `benchmark/v3-infrastructure` |
| V4 | `eval-v4-w1-baseline` @ `ca9c4d2` (retarget) | Includes eval harness + Codex plans; model IDs switched from `gpt-5.6-terra` to `gpt-reserve` after capacity errors |

Arm D (Cursor) started from the V3 product baseline and later copied harness files; V4 documented comparability in `eval/runs/arm-d-w1-v4-reuse.json`.

### 4.6 Cost accounting

| Path | How cost is measured |
|------|----------------------|
| Claude (V3 intended) | Token × list price via `eval/scripts/cost-roll-up.mjs` / `eval/pricing-table.json`; hard cap USD 300 API-equivalent (`eval/SPENDING-CAP.md`) |
| Codex (V4) | ChatGPT subscription-included tokens from session/turn usage JSONL; **no API-equivalent USD** on this auth path; incremental metered charge observed: **$0** |
| Cursor | Token/cost **unknown** to the evaluating agent |

Subscription usage is **not** treated as free: quota exhaustion and Plus purchase are real costs, but they are not convertible to per-token USD in this study.

### 4.7 Integrity rules

- No silent repair of an arm’s product code by the operator after the arm “finishes.”
- Arm A must not accidentally call Invoker (isolated `CODEX_HOME` + forbid routing).
- Failed auth/quota runs are recorded; successful reruns supersede them for primary tables.
- Interventions (harness fixes, relaunches, account login) are logged separately from acceptance.

### 4.8 Study evolution: V3 → V4

```text
V3 design: Claude A/B/C + Cursor D
    │
    ├─ Phase 0 harness + shared verify  ✓
    ├─ Arm D (Cursor) W1 accept         ✓
    └─ Arms A/B/C                       ✗ Claude not authenticated
         │
         ▼
User decision: skip Claude / do not pay Anthropic for this campaign
         │
         ▼
V4 design: Codex A/B/C + reuse Cursor D
    │
    ├─ Wrong ChatGPT account hit usage limit
    ├─ Correct account + Codex Plus ($20)
    ├─ gpt-5.6-terra capacity → freeze gpt-reserve (+ luna for C mechanical)
    └─ Full A/B/C/D W1 acceptance       ✓
```

---

## 5. Campaign V3 results (Claude incomplete; Cursor accepted)

**Report:** `eval/reports/BENCHMARK-V3-FINAL-REPORT.md`  
**Date:** 2026-10-23  
**Metered Anthropic spend observed:** USD 0.00

### 5.1 Phase 0

Harness branch `benchmark/v3-infrastructure` landed verify scripts, specs, Claude-oriented plans, pricing table, and cost roll-up. Tier 1 and tier 2 passed on the harness (ledger Playwright smoke initially `fixme` until W1).

### 5.2 Per-arm outcomes

| Arm | Status | Detail |
|-----|--------|--------|
| A continuous Claude | Not executed | Claude Code not logged in; no API key |
| B Invoker uniform Opus | Failed at first task | `Not logged in · Please run /login`; downstream skipped |
| C Invoker mixed Claude | Not executed | Same auth blocker |
| D Cursor | **Accepted** | Branch `benchmark/v3/arm-d-w1` @ `d5b68ea`; ~3 min wall; D1–D5 true; verify tiers 1–2 pass; cost unknown |

### 5.3 V3 hypothesis status

| Hypothesis | V3 finding |
|------------|------------|
| H1 | Incomplete — Cursor succeeded; Invoker never ran agent work |
| H2 | Not testable |
| H3 | Not testable |

### 5.4 V3 interpretation

V3 is a **valid negative/partial environmental result**: under missing Claude auth, Invoker’s orchestration could not be compared to Cursor on cost or acceptance. It is **not** a refutation of Invoker. It did establish that **Cursor can fully accept W1** under the shared verifier, providing Arm D for V4 reuse.

---

## 6. Campaign V4 results (Codex + Cursor full matrix)

**Report:** `eval/reports/BENCHMARK-V4-FINAL-REPORT.md`  
**Date:** 2026-10-23 (completed after correct Codex Plus login)  
**Spend:** ChatGPT Codex Plus ($20) on account `d048654b`; Cursor Pro spend not readable

### 6.1 Final model freeze

| Arm | Final model policy |
|-----|--------------------|
| A | `gpt-reserve` continuous |
| B | Uniform `gpt-reserve` |
| C | `gpt-6-luna` on mechanical tasks; `gpt-reserve` on hard tasks |
| D | Cursor (reused V3 tip) |

Original V4 freeze used `gpt-5.6-terra`; capacity errors forced the retarget recorded at `ca9c4d2`.

### 6.2 Operational incidents (confounders managed)

| Incident | Mitigation | Effect on primary result |
|----------|------------|--------------------------|
| Global `~/.codex/AGENTS.md` routed Arm A into Invoker | Isolated `CODEX_HOME` + local forbid-Invoker `AGENTS.md` | Contaminated early attempts discarded |
| Wrong ChatGPT account usage limit | User logged into correct account + Plus | Unblocked A/B/C |
| `gpt-5.6-terra` at capacity | Switch plans/exec to `gpt-reserve` | Model ID differs from first freeze |
| Background shells SIGHUP’d on macOS | Cursor-managed durable background jobs | Required relaunch; no product-code repair |
| Invoker `__merge__` needs review provider | Ignore merge for accept; verify-only criterion | B/C workflow JSON status `failed` despite green verifies |

### 6.3 Headline acceptance matrix (W1)

| Arm | Accept? | Wall clock | Input tokens | Output tokens | Tip / branch |
|-----|---------|------------|--------------|---------------|--------------|
| A continuous Codex | **Yes** | **103 s** | **900,076** | **9,077** | `benchmark/v4/arm-a-w1` @ `eb4feea` |
| B Invoker uniform | **Yes** | **449 s** | **2,495,992** | **32,778** | `babee971…` (wf `wf-1792742928661-1`) |
| C Invoker mixed | **Yes** | **418 s** | **2,006,759** | **28,429** | `4c7a346c…` (wf `wf-1792743443911-1`) |
| D Cursor | **Yes** | **~180 s** | **unknown** | **unknown** | `benchmark/v3/arm-d-w1` @ `d5b68ea` |

All accepts confirmed by **independent** re-run of `verify --tier 1` and `--tier 2` on the tip.

### 6.4 Arm B per-task tokens (uniform `gpt-reserve`)

| Task | Input | Output | Cached input |
|------|------:|-------:|-------------:|
| w1-migrations | 447,773 | 4,901 | 397,440 |
| w1-persistence-layer | 506,565 | 8,337 | 456,576 |
| w1-service-layer | 246,810 | 4,302 | 212,992 |
| w1-api-integration | 390,383 | 4,495 | 343,296 |
| w1-restart-preservation | 303,478 | 4,334 | 287,488 |
| w1-core-exports | 199,163 | 2,316 | 186,496 |
| w1-web-smoke-fixes | 401,820 | 4,093 | 375,680 |
| **Sum** | **2,495,992** | **32,778** | **2,259,968** |

### 6.5 Arm C per-task tokens (mixed)

| Task | Model | Input | Output | Cached input |
|------|-------|------:|-------:|-------------:|
| w1-migrations | gpt-6-luna | 234,975 | 2,954 | 202,880 |
| w1-persistence-layer | gpt-6-luna | 256,951 | 3,846 | 235,520 |
| w1-service-layer | gpt-reserve | 274,000 | 5,242 | 259,328 |
| w1-api-integration | gpt-reserve | 427,519 | 7,104 | 399,616 |
| w1-restart-preservation | gpt-reserve | 305,228 | 4,353 | 286,976 |
| w1-core-exports | gpt-6-luna | 99,377 | 977 | 88,576 |
| w1-web-smoke-fixes | gpt-reserve | 408,709 | 3,953 | 383,104 |
| **Sum** |  | **2,006,759** | **28,429** | **1,856,000** |

Relative to B: **≈20% fewer input tokens**, **≈13% fewer output tokens**, slightly lower wall clock, same acceptance.

### 6.6 Arm A usage (continuous)

From Codex `turn.completed.usage` on the successful run:

- input tokens: 900,076 (cached input 863,616)
- output tokens: 9,077 (reasoning output 1,587)

Relative to B: **≈2.8× fewer input tokens** and **≈4.4× lower wall clock** for the same verify surface.

### 6.7 Quality

Under the shared verifier, **quality is a tie**: all four tips pass identical automated gates. Blind human diff review was not performed.

### 6.8 Recovery annex

Not executed. Claims that Invoker “recovers better” from mid-flight failure remain **untested**.

---

## 7. Combined hypothesis verdicts

| ID | Verdict (evidence-bounded to W1 V4 + V3 Cursor) | Evidence |
|----|--------------------------------------------------|----------|
| **H1** orchestration value | **Not supported on cost/latency for W1.** Supported only insofar as Invoker *can* reach full acceptance and isolate sessions. Cursor and continuous Codex also accept; continuous Codex is cheaper/faster. | A ≪ B tokens & wall; D accepts with unknown cost |
| **H2** decomposition efficiency | **Rejected for this W1 instance** (same model family `gpt-reserve`) | B input ≈ 2.8× A |
| **H3** model-routing efficiency | **Modestly supported** | C input ≈ 0.80 × B; both accept |

### Answers to secondary questions

1. **Invoker cheaper than continuous Codex?** No (W1).  
2. **Decomposition reduce tokens?** No — it increased them.  
3. **Routing savings?** Yes vs uniform Invoker; still much higher than continuous A.  
4. **Cheaper models → more retries?** Not observed on C.  
5. **Less human intervention?** Cursor simplest; Invoker needed durable-process babysitting and quota/capacity handling before clean runs.  
6. **Better recovery?** Untested.  
7. **Quality?** Tie on automated acceptance.  
8. **Cursor simpler for single-slice?** Yes.  
9. **Invoker-attributable benefits observed?** DAG progress, per-task session isolation, mixed-routing savings vs uniform Invoker — **not** a cost win vs continuous Codex on W1.  
10. **Adopt Invoker on this evidence alone?** Not on W1 cost grounds; reconsider for multi-slice / multi-PR / recovery scenarios after W2/W3.

---

## 8. Discussion

### 8.1 Why continuous Codex can beat a DAG on W1

W1 is a **single coherent modernization** touching one API surface and a small UI fix set. A continuous agent keeps repository understanding in one context window (with high cache hit rates: Arm A cached ~864k of ~900k input). A DAG pays **repeated orientation costs** per task (each Invoker worker receives an orientation pack and re-reads specs/code). For this size, re-orientation dominates any benefit from isolation.

### 8.2 Why mixed routing still helps inside Invoker

When a DAG is already required (policy, review slices, parallel ownership rules), routing migrations/persistence/exports to `gpt-6-luna` cut tokens without losing verify acceptance. That supports **conditional** use of Invoker routing: not “always orchestrate,” but “if orchestrating, route mechanically.”

### 8.3 Cursor’s place in the comparison

Cursor matched acceptance with low operator friction (~3 minutes) but **opaque economics**. H1 cannot be settled on dollars-per-accept among all three ecosystems until Cursor token export exists or a billed API proxy is used.

### 8.4 What this study does *not* claim

- It does not claim Invoker is useless. Isolation, durability, multi-PR stacking, and recovery may dominate on W2/W3-class work.
- It does not claim `gpt-reserve` equals the originally frozen `gpt-5.6-terra`.
- It does not claim Claude results; V3 never ran Claude successfully.
- It does not claim statistical generality; this is a **single-workload, single-environment case study** with careful measurement, not a multi-repo randomized trial.

---

## 9. Limitations

1. **One completed workload (W1).** W2/W3 not run.  
2. **Model freeze drift** (`terra` → `reserve`) due to capacity.  
3. **n = 1 successful run per arm** after operational failures.  
4. **Cursor cost unknown.**  
5. **Subscription tokens lack USD equivalence** on the Codex ChatGPT path.  
6. **Recovery annex absent.**  
7. **No blind human review** of diffs.  
8. **Environment sensitivity:** auth, account selection, SIGHUP, and capacity materially affected earlier attempts.  
9. **Arm A wall clock is unusually short**; still verify-backed, but treat as one sample.  
10. **Merge publication failures** on Invoker tips (review provider) — orthogonal to verify acceptance but relevant to end-to-end “ship” claims.

---

## 10. Reproducibility

### 10.1 Clone and baseline

```bash
git clone https://github.com/adamreaksmey/invoker-eval-longrun-ledger.git
cd invoker-eval-longrun-ledger
git checkout eval-v4-w1-baseline   # ca9c4d2
npm ci
node eval/scripts/verify.mjs --tier 1
```

### 10.2 Re-verify accepted tips

```bash
# Arm A
git checkout benchmark/v4/arm-a-w1
node eval/scripts/verify.mjs --tier 2

# Arm B tip
git checkout babee9710d417a9791f202ff488fe803d2891cd9
node eval/scripts/verify.mjs --tier 2

# Arm C tip
git checkout 4c7a346c92de9b07eaa6b31433065aab70db8502
node eval/scripts/verify.mjs --tier 2

# Arm D
git checkout benchmark/v3/arm-d-w1
node eval/scripts/verify.mjs --tier 2
```

### 10.3 Re-run Invoker arms (requires Codex quota)

```bash
invoker-cli run eval/plans/w1-uniform-codex.yaml --standalone --json
invoker-cli run eval/plans/w1-mixed-codex.yaml --standalone --json
```

Keep the CLI process alive for the full workflow (durable terminal / owner). Do not rely on ephemeral background jobs that receive SIGHUP.

### 10.4 Artifact index

| Artifact | Path |
|----------|------|
| This study | `eval/reports/INVOKER-AGENT-ORCHESTRATION-BENCHMARK-STUDY.md` |
| V3 report | `eval/reports/BENCHMARK-V3-FINAL-REPORT.md` |
| V4 report | `eval/reports/BENCHMARK-V4-FINAL-REPORT.md` |
| V3/V4 methodology notes | `eval/BENCHMARK-V3-METHODOLOGY.md`, `eval/BENCHMARK-V4-METHODOLOGY.md` |
| W1–W3 specs | `eval/specs/w1-persisted-ledger.md`, `w2-…`, `w3-…` |
| Spending cap (V3) | `eval/SPENDING-CAP.md` |
| Plans | `eval/plans/w1-*-codex.yaml`, `w1-*-opus.yaml`, `w1-mixed-models.yaml` |
| Cost JSON | `eval/runs/arm-{a,b,c}-w1-cost.json` |
| Arm D summary | `eval/runs/arm-d-w1-summary.json`, `arm-d-w1-v4-reuse.json` |
| Verify logs | `eval/runs/arm-*-w1-verify-tier*.txt` |

---

## 11. Recommendations

### 11.1 For practitioners (given W1-class tasks)

| Goal | Prefer |
|------|--------|
| Minimize Codex tokens / latency on a single coherent change | Continuous Codex with isolated home |
| Already committed to an Invoker DAG | Mixed routing (cheaper models on mechanical nodes) |
| Minimize operator ceremony; cost opaque OK | Cursor single pass |
| Need multi-PR / durable overnight / recovery | Invoker — **re-validate on W2/W3 before cost claims** |

### 11.2 For follow-on research

1. Execute **W2** and **W3** under the same four-arm discipline.  
2. Add a **recovery annex** (kill mid-task; compare resume cost).  
3. Export or proxy **Cursor token usage**.  
4. Re-freeze models only when capacity-stable; document substitutions as V4 did.  
5. Optionally add a Claude matrix once auth/spend is intentional—not as a silent substitute for Codex results.

---

## 12. Conclusion

Across Benchmarks V3 and V4, we built a shared harness and drove a realistic ledger-modernization workload through continuous agents, Invoker DAGs, and Cursor. V3 showed that without working Claude auth, orchestration comparisons collapse. V4 completed the Cursor+Codex matrix: **all arms can accept W1**, but **Invoker orchestration did not win on cost or wall clock against continuous Codex**, while **mixed-model routing improved Invoker’s own efficiency**.

For single-slice W1-scale work, the evidence favors **continuous Codex (isolated)** on economics and **Cursor** on operational simplicity. Invoker’s distinctive value—if any for adoption—likely lies in **larger, longer, or multi-output workflows**, which this study designed (W2/W3, recovery) but has not yet measured.

---

## Appendix A — Timeline (condensed)

| Phase | Outcome |
|-------|---------|
| Design V3 (Claude + Cursor) | Hypotheses H1–H3; W1–W3 specs; $300 Claude cap |
| Phase 0 harness | Shared verify, plans, pricing scripts |
| V3 Arm D | Cursor accepts W1 (~3 min) |
| V3 Arms A–C | Blocked — Claude not logged in |
| Decision | Skip Claude; run V4 Codex-only |
| V4 partial | Terra capacity, wrong-account limit, SIGHUP orphans |
| V4 complete | Correct account + `gpt-reserve`; A/B/C/D all verify tier 2 |
| This paper | Combined V3+V4 narrative for context-free readers |

## Appendix B — Glossary

| Term | Meaning |
|------|---------|
| **Arm** | One execution condition in the matrix (A/B/C/D) |
| **DAG** | Directed acyclic task graph (Invoker plan dependencies) |
| **Tip** | Final commit used for independent verification |
| **Tier 1 / Tier 2** | Shared verify levels (unit/build vs + Playwright) |
| **Accept** | Both verify tiers exit 0 on the tip |
| **Uniform** | Every agent task uses the same model |
| **Mixed routing** | Mechanical vs hard tasks use different models |
| **API-equivalent USD** | Tokens × published list prices (Claude path); not available for ChatGPT Codex subscription path in this study |

---

*End of study document. Campaign detail lives in the V3 and V4 final reports; this paper is the consolidated, context-complete account.*
