# A07 — BNA current-state and control-plane audit

**Intended commit path:** `ops/audits/2026-07-26/parallel-control-tower/A07-result.md`
**Audit date:** 2026-07-26
**Audit mode:** Read-only
**Repository audited:** `shloimie-beep/bnei-neviim-academy`
**Master checkpoint:** `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`
**Open lanes:** PR #141 and PR #142
**Mutations performed:** None. No goal, requirement register, packet, branch, PR, comment, file, deployment, provider action, or external send was created or changed.

## Evidence boundary

This audit inspected committed and pushed GitHub state. It did not inspect an unpushed local worktree, make a fresh production request, open private provider records, or exercise provider credentials.

Therefore:

* **[CONFIRMED CURRENT TRUTH]** Repository, branch, commit, PR, and committed-evidence conclusions are grounded in current GitHub readback.
* **[UNPROVEN]** Any local-only work after the inspected commits remains outside this audit.
* **[UNPROVEN]** A fresh July 26 live-runtime acceptance was not performed. The BNA production conclusion below is based on the canonical master checkpoint and accepted restoration evidence already committed in the repository.

---

# 1. BNA canonical-truth verdict

## Executive verdict

**[NEW FINDING] `FAIL_CLOSED_CONTROL_TRUTH_FRAGMENTED`**

`shloimie-beep/bnei-neviim-academy@cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c` is the canonical committed BNA production-code checkpoint, but it is **not a reliable canonical current-control-state authority**.

The repository presently contains several mutually inconsistent “current” maps:

* `BNA-START-HERE.md`;
* `ops/execution-runs/latest.json`;
* the pointed run’s `run.json`;
* `PLAN.md`;
* `REQUIREMENTS.md` and `requirements.json`;
* `NEXT-SESSION.md`;
* `BATCH-STATUS.md`;
* `TASKS.md`;
* `SYSTEM-STATE.md`;
* generated dropoff control-tower files;
* PR descriptions and branch-local status files.

Because these surfaces disagree about the active run, current requirement, current product, current branch, and next executable task, **no agent should autonomously select implementation work from the legacy BNA pointers until the control-pointer repair is accepted**.

## Canonical authority matrix

| Concern                            | Verdict                       | Current authority                                                                                   |
| ---------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| BNA committed production code      | **[CONFIRMED CURRENT TRUTH]** | `shloimie-beep/bnei-neviim-academy@cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`                        |
| BNA current control status         | **[NEW FINDING]**             | No coherent authority; fail closed                                                                  |
| BNA School product ownership       | **[CONFIRMED CURRENT TRUTH]** | First-party BNA application and data remain in the legacy BNA repository pending extraction         |
| One Time product/control truth     | **[CONFIRMED CURRENT TRUTH]** | `shloimie-beep/onetimev2`, controlled by its own `ops/goals/CURRENT.yaml → OT-LAUNCH-01/BOARD.yaml` |
| PR #141 integration acceptance     | **[UNPROVEN]**                | Open draft, mixed scope, no PR review acceptance or actual-head Actions run                         |
| PR #142 implementation evidence    | **[CONFIRMED CURRENT TRUTH]** | Accepted read-only/provider-off slice at exact head `c95a77f92ae5b1d5f7261a0d3ad2956b1cd551eb`      |
| PR #142 BNA integration/activation | **[UNPROVEN]**                | Open draft stacked on unaccepted PR #141; no deployment or provider activation authorized           |
| Fresh live BNA runtime at master   | **[UNPROVEN]**                | Existing evidence says production was restored to master; no new live call was made in this audit   |

### A07-F01 — BNA master is the production preservation checkpoint

**Classification: CONFIRMED CURRENT TRUTH**

The repository defines itself as the live BNA Express/Postgres/Railway system as well as its durable operating brain. PR #141’s incident correction records that an unintended feature deployment was removed and production was restored to exact master checkpoint `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`, with health and database-integrity readback.

**Execution consequence:** Preserve this commit as the BNA production rollback and comparison baseline. Do not treat either open PR as production truth.

### A07-F02 — The BNA “current handoff” is stale and contradicts the current run pointer

**Classification: NEW FINDING**

`BNA-START-HERE.md` still calls the June 24 Issue #20 run the latest handoff “as of 2026-06-25,” while `ops/execution-runs/latest.json` points to the July 12 shared-CRM/communications run. The entrypoint itself declares stale references and multiple active runs to be validation failures.

**Execution consequence:** `BNA-START-HERE.md` cannot currently be used to choose work.

### A07-F03 — The run pointed to by `latest.json` is One Time-first, not a current BNA work program

**Classification: CONFIRMED CURRENT TRUTH**

The pointed run declares itself active but sets `current_implementation_target` to `one_time_first`. Its requirements explicitly defer BNA frontend parity, preserve the old BNA/One Time parity requirement only as historical evidence, and classify the remaining open gates as One Time owner-test/verifier gates.

**Execution consequence:** The July 12 run may be used as historical One Time evidence, but it must not be resumed as the BNA implementation queue.

### A07-F04 — The legacy BNA repository currently performs all four audited roles

**Classification: NEW FINDING**

At the inspected refs, the legacy repository functions as:

1. **School application:** public site, parent/student/provider portals, school Operations, APIs, and BNA production runtime.
2. **Control plane:** platform/super-admin views, agent-action orchestration, technical routing, workspace taxonomy, and the proposed control-plane bot.
3. **Shared brain:** memory, tasks, run pointers, prompt packets, ledgers, agent fleet, dropoff system, and audit governance.
4. **One Time bridge:** historical One Time UI/runtime, provider adapters, communications architecture, imported execution queues, and cross-workspace status.

The repository explicitly describes itself as both the BNA live system and durable brain, while its workspace model includes Platform, BNA School, providers, and a Rabbi/One Time workspace.   The operating guide likewise declares the repository the shared brain and canonical workspace for current execution.

**Execution consequence:** Physical decomposition is justified, but only after current-pointer repair and explicit assignment. A mechanical repository split is unsafe because the boundaries are currently logical rather than consistently modular.

### A07-F05 — One Time implementation truth in the BNA repository is superseded

**Classification: SUPERSEDED/HISTORICAL**

The current One Time repository explicitly prohibits copying BNA’s server, Operations shell, provider runtime, agents, memory, secrets, or broad migrations. It identifies its own Board as the only current status map and forbids PR descriptions, reports, and generated projections from copying mutable status.

`shloimie-beep/onetimev2` also requires separate sessions and cookies and forbids BNA production coupling.

**Execution consequence:** Legacy BNA One Time routes, deployment records, shared-CRM run material, imported queues, and provider adapters are provenance or temporary bridge evidence. They are not current One Time implementation authority.

### A07-F06 — Goal-mode behavior can start execution before discussion

**Classification: NEW FINDING**

The BNA operating guide interprets “goal mode,” “finish everything,” “build everything,” and similar language as execution permission. It directs the agent to create or continue a goal, create registers, start implementation immediately, and continue through unblocked batches without asking the operator to choose sequencing.

The ramble protocol independently declares the execution CLI the queue authority and tells agents to select the next unblocked batch immediately unless a narrow class of external decisions intervenes.

**Execution consequence:** The current behavior is unsafe for audits, architecture discussion, preservation reviews, prompt-writing, and “Work off” sessions. A precedence rule must state that audit/review/discussion/planning prompts never trigger goal-mode execution unless an exact Board assignment and explicit implementation authorization are present.

### A07-F07 — BNA School remains no-GHL; One Time’s GHL use is a separate product concern

**Classification: CONFIRMED CURRENT TRUTH**

At master, BNA’s no-GHL policy prohibits GHL as an active BNA runtime and keeps first-party BNA Operations canonical for school records.

PR #141 proposes the correct scoped reconciliation:

* BNA School remains no-GHL.
* GHL is canonical only for One Time customer communications.
* The One Time application remains canonical for One Time product/account state.
* The exception does not authorize BNA School GHL adoption or a provider mutation.

**Classification: UNPROVEN**

That proposed scoped wording is not yet canonical BNA master policy because PR #141 is unmerged.

**Execution consequence:** Do not revive BNA GHL. Do not reject current One Time GHL work because of the old global BNA wording. The final boundary belongs in separate repositories and a sanitized connector contract.

### A07-F08 — No active BNA School feature lane is proven

**Classification: UNPROVEN**

The pointed run is One Time-first. The unchecked `TASKS.md` material inspected in the current section primarily concerns One Time helper, Telegram, communication-agent, and external acceptance work rather than a newly assigned BNA School feature. The open PRs are platform/control-plane lanes, not a bounded school feature.

**Execution consequence:** No BNA School feature implementation should be inferred from open checkboxes or old queue entries. The only current BNA actions supported by evidence are preservation, pointer repair, PR disposition, and later extraction planning.

### A07-F09 — PR #141 is evidence-rich but not integration-accepted

**Classification: UNPROVEN**

Current GitHub readback:

* PR: #141
* State: open draft
* Base: `master@cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`
* Actual head: `dff66b24fd966a08cdd6a16e80f954d2f988673a`
* Scope: 99 changed files across architecture, memory, control tower, platform UI, school UI, One Time connector UI, server, migration, agent-action persistence, Telegram, and tests
* Reviews: none
* Inline review threads: none
* GitHub Actions runs at the actual head: none returned

The PR description and branch records still cite an earlier head. Its generated `CONTROL-TOWER.md` claims an earlier branch name rather than PR #141’s actual branch.

The branch’s own continuation record also says its queue is pinned to a historical One Time projection and that current repinning remains separate work.

**Execution consequence:** Do not merge PR #141 merely because it is mergeable or because branch-local files say “complete.” Preserve it and assign a convergence/disposition decision.

### A07-F10 — PR #142’s narrow implementation is accepted as provider-off evidence

**Classification: CONFIRMED CURRENT TRUTH**

Current GitHub readback:

* PR: #142
* State: open draft
* Head: `c95a77f92ae5b1d5f7261a0d3ad2956b1cd551eb`
* Base: PR #141’s branch at `dff66b24fd966a08cdd6a16e80f954d2f988673a`
* Scope: 12 files
* Reviews: none
* Inline review threads: none
* GitHub Actions runs at the actual head: none returned

The ADR limits the implementation to a separate, default-off, redacted notifier/read-only status viewer, with an empty mutation allowlist and no One Time runtime dependency.

Its focused record reports 31 passing tests, provider-off readiness, zero secret findings, no One Time dependency, and no product-database access.

The current One Time Board independently records the exact PR #142 head as a completed dependency track while preserving provider-off defaults and requiring a separate decision for any activation.

### A07-F11 — PR #142 integration and activation remain unproven

**Classification: UNPROVEN**

PR #142 is stacked on PR #141 rather than directly on master. Its own test record acknowledges unrelated base-lineage failures and action-registry drift that it deliberately did not broaden.

No deployment was performed or authorized, and the provider remains off.

**Execution consequence:** Preserve the exact commit. Do not activate it, add mutations, or merge it independently without resolving PR #141’s disposition and the future control-plane repository assignment.

---

# 2. Current active BNA work only

There is **no proven active BNA School feature-build lane**.

The bounded current BNA work is:

| Lane                              | Classification                   | Current allowed action                                                                               | Forbidden action                                                             |
| --------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `BNA-CONTROL-POINTER-01`          | **NEW FINDING — P0**             | Establish one current pointer and one status Board; add audit/discussion precedence                  | App code, provider actions, deployment, decomposition                        |
| `BNA-SCHOOL-RUNTIME-PRESERVE-01`  | **CONFIRMED CURRENT TRUTH — P0** | Preserve `master@cebbfc…` as the BNA production checkpoint; readback only when separately authorized | New features inferred from stale queues                                      |
| `BNA-PR141-CONVERGENCE-01`        | **UNPROVEN — P1**                | Readback, changed-file ownership map, and Board disposition                                          | More feature work or an automatic merge                                      |
| `BNA-PR142-PRESERVE-01`           | **CONFIRMED CURRENT TRUTH — P1** | Preserve exact provider-off implementation and assign future repository ownership                    | Activation, mutation expansion, deployment, independent merge                |
| `BNA-DECOMPOSITION-ASSIGNMENT-01` | **NEW FINDING — P1**             | Assign future control-plane and BNA School repository owners and boundaries                          | Moving code before target repositories and dependency contracts are accepted |

The July 12 execution run is not on this list. Its current correction expressly makes One Time the implementation target and defers BNA feature parity.

---

# 3. Stale or historical work that must not be resumed

| Item                                                                                                      | Classification                                                     | Required treatment                                                                        |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| June 24 Issue #20 handoff presented as “current” in `BNA-START-HERE.md`                                   | **SUPERSEDED/HISTORICAL**                                          | Preserve as accepted historical evidence; remove current-authority status                 |
| June 18/19 “active run” in `SYSTEM-STATE.md`                                                              | **SUPERSEDED/HISTORICAL**                                          | Keep as dated system history, not current status                                          |
| July 12 shared-CRM/communication-agent run as BNA’s active execution queue                                | **SUPERSEDED/HISTORICAL**                                          | Preserve as One Time-first migration evidence; do not resume through BNA goal mode        |
| Simultaneous BNA/One Time frontend parity under the old requirement                                       | **SUPERSEDED/HISTORICAL**                                          | Do not reopen; the run explicitly deferred BNA adoption                                   |
| One Time product, CRM, communications, helper, provider, or deployment truth sourced from legacy BNA code | **SUPERSEDED/HISTORICAL**                                          | Use `shloimie-beep/onetimev2` as current authority                                        |
| Old shared production claims saying One Time and BNA had the same current runtime head                    | **SUPERSEDED/HISTORICAL**                                          | Keep only as migration/deployment provenance                                              |
| Historical One Time queue projection imported into PR #141                                                | **SUPERSEDED/HISTORICAL**                                          | Do not relabel it as current; current repinning was explicitly left separate              |
| Global interpretation of “no GHL” that also forbids One Time’s separate GHL communications architecture   | **SUPERSEDED/HISTORICAL**                                          | Preserve BNA School no-GHL; scope One Time separately                                     |
| Unchecked One Time entries in legacy `TASKS.md`                                                           | **SUPERSEDED/HISTORICAL** unless re-assigned by the One Time Board | Do not execute from the BNA queue                                                         |
| July 13 generated agent-fleet/dropoff snapshot                                                            | **SUPERSEDED/HISTORICAL**                                          | Preserve as a point-in-time dirty-worktree report                                         |
| PR #139 and PR #140 as separately resumable implementation lanes                                          | **SUPERSEDED/HISTORICAL**                                          | PR #141 records semantic continuation; do not reopen both independently                   |
| Broad personal Telegram control-plane proposal                                                            | **SUPERSEDED/HISTORICAL**                                          | PR #142’s narrow, read-only ADR replaces it                                               |
| Any PR #142 mutation, Codex runner, shell, deploy, database, or One Time capability                       | **SUPERSEDED/HISTORICAL / FORBIDDEN BY CURRENT ADR**               | Requires a new one-capability ADR and separate acceptance                                 |
| Destructive workspace-key migration                                                                       | **UNPROVEN / BLOCKED**                                             | Remains blocked pending inventory, rollback, compatibility, and privacy proof             |
| Pre-BNA family-accountability application assumptions                                                     | **SUPERSEDED/HISTORICAL**                                          | Archive unless a separately accepted BNA School requirement revives a specific capability |

`SYSTEM-STATE.md` still calls a June 18 run active and was last updated June 19, directly conflicting with both the June 25 entrypoint and July 12 run pointer.

---

# 4. Pointer and status-model drift

## Drift matrix

| Surface                              | Current claim                              | Conflicting evidence                                        | Classification              | Safety effect                                         |
| ------------------------------------ | ------------------------------------------ | ----------------------------------------------------------- | --------------------------- | ----------------------------------------------------- |
| `BNA-START-HERE.md`                  | Latest run is closed June 24 Issue #20     | `latest.json` points to July 12 run                         | **NEW FINDING**             | Entry session can begin from wrong run                |
| `SYSTEM-STATE.md`                    | June 18 platform-completion run is active  | START-HERE and latest point elsewhere                       | **SUPERSEDED/HISTORICAL**   | Third incompatible “current” map                      |
| `latest.json`                        | July 12 run is current                     | Run is One Time-first, not current BNA work                 | **NEW FINDING**             | Goal mode can resume the wrong product                |
| Pointed `run.json`                   | Current requirement is `REQ-20260712-307`  | `NEXT-SESSION.md` calls it Done                             | **NEW FINDING**             | Machine pointer and narrative status disagree         |
| `PLAN.md`                            | Requirement 908 is Current and 911 Ready   | `REQUIREMENTS.md` says both are Done                        | **NEW FINDING**             | Plan is stale inside the active run                   |
| `NEXT-SESSION.md`                    | Requirement 312 is next unblocked          | Same run’s later status material treats that lane as closed | **NEW FINDING**             | “Next” is not a reliable command                      |
| `BATCH-STATUS.md`                    | Repeated append-like rows per requirement  | Multiple states can coexist                                 | **NEW FINDING**             | No single row is guaranteed current                   |
| `TASKS.md`                           | Open checkboxes imply work remains         | Many rows are One Time or superseded history                | **NEW FINDING**             | Checklist status can reactivate old work              |
| Base dropoff `CONTROL-TOWER.md`      | July 13 dirty master and large stale queue | Point-in-time local snapshot only                           | **SUPERSEDED/HISTORICAL**   | Must not represent July 26 GitHub truth               |
| PR #141 `CONTROL-TOWER.md`           | Claims earlier branch identity             | Actual PR branch differs                                    | **NEW FINDING**             | Generated artifact lacks semantic identity validation |
| PR #141 description                  | Cites an earlier head                      | Actual head is four commits later                           | **NEW FINDING**             | PR narrative is not exact-head acceptance             |
| PR #141 branch status                | Says complete/provider-ready               | No review acceptance or actual-head Actions run             | **UNPROVEN**                | Branch-local labels cannot authorize integration      |
| One Time `CURRENT.yaml → BOARD.yaml` | One pointer and one mutable Board          | Explicitly forbids duplicated mutable status                | **CONFIRMED CURRENT TRUTH** | Correct reference model for repair                    |

The internal run disagreement is direct: `PLAN.md` says 908 is current and 911 ready, while `REQUIREMENTS.md` records 908, 909, and 911 as done.

`NEXT-SESSION.md` simultaneously presents requirement 312 as next, records numerous earlier requirements as done, and says the old BNA parity lane must not be reopened.

## Required future status model

**Classification: NEW FINDING**

BNA should adopt the same authority pattern already enforced by One Time:

1. A pointer-only entrypoint.
2. One mutable current Board.
3. Immutable evidence and handoff artifacts that point to the Board.
4. PR descriptions, generated dashboards, run reports, and task lists may not copy mutable status.
5. No execution selector may treat historical run files as current merely because their filenames contain `latest` or `active`.

One Time’s operating guide states this exact principle, and its current pointer contains only the goal and Board paths.

---

# 5. Repository decomposition map

## Current structural verdict

**Classification: NEW FINDING**

The legacy repository is a transition monolith. It should not remain the permanent home of school product code, cross-repository control state, generalized agent work, and One Time bridge code.

The decomposition must be **contract-first and provenance-preserving**, not a mass move.

## A. Future BNA Control Plane repository

**Classification: NEW FINDING — exact target scope**

The future control-plane repository should own:

### Canonical control state

* One pointer-only current file.
* One Board/status model.
* Cross-repository assignment records.
* Dependencies, writer slots, stop conditions, and acceptance evidence.
* Technical tickets requiring explicit `source_workspace`.
* Decisions and operator-action gates.
* Sanitized readiness and deployment-status references.

### Agent-action and control contracts

Semantically extract from PR #141, after dependency review:

* external-product connector schemas;
* sanitized Agent Action job/result contracts;
* Agent Action claim, lease, idempotency, partial-result, completion, supersession, and readback logic;
* workspace and connector taxonomy used for control routing;
* result-only GitHub fallback contract;
* provider-off readiness surfaces;
* platform-level action and route registry entries;
* control-plane UI for assignments, status, blockers, and technical escalation.

Relevant candidate paths include:

* `docs/architecture/contracts/**`;
* `src/lib/bna/agent-action-hub.js`;
* `src/lib/bna/agent-action-postgres-repository.js`;
* `src/lib/bna/agent-action-storage.js`;
* the platform portion of `src/lib/bna/workspace-taxonomy.js`;
* `public/platform-control.html`;
* `public/agent-actions.html`;
* `public/agent-action-dropoff.html`;
* their narrowly related JS/CSS;
* platform-only tests and migration contracts.

These are candidate ownership paths, **not an authorization to copy them mechanically**. `server.js`, registries, styles, and migrations contain mixed ownership and require symbol/route-level decomposition.

### PR #142 read-only operations bot

The future control-plane repository should own the accepted PR #142 slice:

* replacement ADR and threat model;
* isolated worker;
* strict redacted status-envelope parser;
* dedicated provider-off readiness;
* read-only commands and refresh callback;
* denied-action audit;
* lease/replay/rate-limit behavior;
* focused tests;
* explicit empty mutation allowlist.

### Control-plane exclusions

It must not own:

* BNA School parent or Student records;
* school CRM, classes, assignments, newsletters, communities, or school portals;
* One Time product/account records;
* One Time customer communication transcripts;
* One Time GHL execution;
* product databases used as a control-plane bot data source;
* shared browser sessions, cookies, or provider credentials;
* unrestricted natural-language action execution;
* raw private messages, transcripts, or customer exports.

PR #141’s proposed architecture correctly separates Super Admin control, BNA School, and the One Time external connector while keeping their canonical systems distinct.

## B. Future BNA School repository

**Classification: NEW FINDING — exact target scope**

The future BNA School repository should own:

* the BNA public website;
* BNA signup and school-facing forms;
* BNA School Operations/admin;
* parent portal;
* Student portal;
* BNA provider directory and school-approved provider links;
* school staff/rabbi/admin roles;
* school contacts, parents, Students, staff, classes, assignments, worksheets, newsletters, and communities;
* BNA first-party CRM and communications records;
* school-scoped bot and assistant behavior;
* school route/action registries;
* BNA database access and school migrations;
* BNA cream/navy/teal brand system;
* school privacy and wrong-scope tests;
* BNA production deployment, rollback, health, and smoke contracts.

### School-repository exclusions

It must not own:

* a platform-global Agent Action queue;
* cross-repository technical orchestration;
* One Time routes, UI, accounts, entitlements, classes, or communications;
* One Time GHL workflow/campaign truth;
* broad provider-control infrastructure;
* the control-plane Operations bot;
* the historical agent fleet/shared brain;
* legacy family-app features not expressly adopted;
* BNA GHL runtime code.

The master no-GHL policy remains the school boundary: first-party BNA records are canonical, and legacy GHL material is historical.

## C. `shloimie-beep/onetimev2`

**Classification: CONFIRMED CURRENT TRUTH**

One Time remains in its existing standalone repository and continues to own:

* One Time public and authenticated application;
* One Time accounts, access, enrollment, classes, products, and entitlements;
* One Time CRM and customer communications integration;
* One Time GHL registry, workflow, campaign, and readback truth;
* One Time Rabbi Telegram worker;
* One Time content/media and Zoom operations;
* One Time migrations, tests, deployments, and launch Board;
* product-specific prompt and knowledge contracts.

The BNA control plane may consume or emit only versioned, sanitized connector/result contracts. One Time must remain operable when the BNA control plane is unavailable.

## D. Legacy `bnei-neviim-academy` repository

**Classification: NEW FINDING — archive and transition scope**

The legacy repository must retain, with history intact:

* prior execution runs;
* audits and accepted evidence;
* production incident and restoration evidence;
* PR lineage and old handoffs;
* historical One Time bridge implementation;
* historical shared-CRM and communication-agent work;
* old family-accountability application material;
* legacy GHL archive;
* old deployment and migration proof;
* historical tasks, memory, ledgers, and changelogs;
* source fingerprints and provenance needed to establish how extracted code was derived.

Until BNA School is extracted and cut over, it also remains the production BNA School source.

After both extractions are accepted, it should become a provenance archive rather than a third active implementation repository.

### Archive prohibitions

* Do not rewrite history.
* Do not delete historical evidence merely because it is stale.
* Do not move raw private content into a new repository.
* Do not copy secrets, credentials, private destinations, sessions, or provider identifiers.
* Do not remove the production rollback commit until the BNA School cutover has independent rollback proof.
* Do not delete old paths until both target repositories identify their accepted source commit and provenance manifest.

---

# Recommended control tasks

## BNA-CONTROL-POINTER-01

**Classification:** NEW FINDING — P0
**Dependency:** A07 verdict accepted and one BNA control-doc writer assigned.
**Owner/writer slot:** `BNA-CONTROL-DOC-WRITER-01` — sole writer.
**Exact write scope:**

* `BNA-START-HERE.md`;
* `AGENTS.md`;
* new `ops/control/CURRENT.yaml`;
* new `ops/control/BNA-BOARD.yaml`.

No other path.

**Stop condition:** Stop without writing if repository policy requires a different accepted canonical path, or if a second writer is assigned to any of the four files. Do not modify application code to make the pointer model work.

**Required proof:**

* exactly one current pointer;
* exactly one mutable status Board;
* all entrypoint links resolve;
* historical run pointer explicitly demoted from current BNA authority;
* audit/review/discussion precedence recorded;
* no app/runtime/migration/provider diff;
* YAML parsing and `git diff --check`;
* exact starting and ending commits;
* independent readback that all copied mutable statuses were removed from the entrypoint.

**Board assignment required:** **Yes — BNA Board.**
**One Time Board edit required:** No.

## BNA-PR-CONVERGENCE-01

**Classification:** UNPROVEN — P1
**Dependency:** `BNA-CONTROL-POINTER-01` accepted.
**Owner/writer slot:** `BNA-PR-CONVERGENCE-READER-01`; no source writer until the Board records a disposition.
**Exact write scope after assignment:**

* the PR #141 and PR #142 descriptions;
* the two PR status rows in `ops/control/BNA-BOARD.yaml`;
* one sanitized convergence report under `ops/control/convergence/`.

No implementation source changes.

**Stop condition:** Stop at `needs_operator_decision` unless the Board chooses one of:

1. preserve both PRs pending extraction;
2. split PR #141 into target-repository patches;
3. integrate a bounded subset into legacy master;
4. close one or both PRs as superseded after provenance capture.

**Required proof:**

* exact `master…PR-head` comparisons;
* full changed-path ownership matrix;
* actual-head test/CI record;
* stale PR-description refs removed;
* PR #142 dependency on PR #141 explicit;
* no hidden One Time runtime dependency;
* no provider or production change.

**Board assignment required:** **Yes — BNA Board.**

## BNA-CONTROL-PLANE-EXTRACTION-01

**Classification:** NEW FINDING — P1, later gated task
**Dependency:** Pointer repair accepted; target repository named; PR disposition decided; One Time compatibility boundary accepted.
**Owner/writer slot:** `BNA-CONTROL-PLANE-WRITER-01`.
**Exact write scope:** Assigned control-plane target repository plus a provenance manifest in the legacy repository.
**Stop condition:** Stop before source movement if any candidate module imports school-domain data, One Time runtime code, mixed `server.js` state, or unversioned provider configuration.
**Required proof:** Full dependency graph, source hashes, forbidden-dependency scan, contract tests, no-secrets scan, no product-data migration, compatibility adapter plan, rollback plan, and independent One Time outage-isolation proof.
**Board assignment required:** **Yes — BNA Board.** Any change to a One Time-consumed contract additionally requires One Time Board assignment.

## BNA-SCHOOL-EXTRACTION-01

**Classification:** NEW FINDING — P1, later gated task
**Dependency:** Control-plane boundary accepted; target school repository named; current BNA production readback captured; data ownership accepted.
**Owner/writer slot:** `BNA-SCHOOL-WRITER-01`.
**Exact write scope:** Assigned BNA School target repository plus a provenance/cutover manifest in the legacy repository.
**Stop condition:** Stop before code movement if school routes cannot be separated from platform or One Time dependencies, or if database migration/cutover lacks inventory and rollback.
**Required proof:** Route/API matrix, no-GHL scan, privacy and wrong-scope tests, data-ownership matrix, no-write row-count census, migration checksum plan, visual route acceptance, deployment and rollback design, and independent One Time non-regression proof.
**Board assignment required:** **Yes — BNA Board.**

## BNA-LEGACY-ARCHIVE-01

**Classification:** NEW FINDING — P2
**Dependency:** Both target repositories accepted and cut over.
**Owner/writer slot:** `BNA-LEGACY-ARCHIVIST-01`.
**Exact write scope:** Archive/readme/pointer metadata only; no history rewrite.
**Stop condition:** Stop if any production rollback, provenance, audit, or unresolved PR evidence would be lost.
**Required proof:** Source-hash manifests, repository-tagged final checkpoints, rollback verification, no secrets/private content in new manifests, and exact keep/archive/delete-later matrix.
**Board assignment required:** **Yes — BNA Board.**

---

# 6. Smallest BNA control-pointer repair prompt

**Classification: READY EXECUTION PROMPT**

```text
BNA-CONTROL-POINTER-01 — SINGLE CURRENT POINTER REPAIR

Mode: control-docs only
Repository: shloimie-beep/bnei-neviim-academy
Start commit: cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c
Branch: codex/bna-control-pointer-repair-20260726
Writer slot: BNA-CONTROL-DOC-WRITER-01

Do not create or modify a goal, requirement register, implementation packet,
application file, runtime module, database migration, provider configuration,
deployment, external system, or One Time Board record.

Read before writing:

- BNA-START-HERE.md
- AGENTS.md
- docs/BNA-RAMBLE-TO-DONE.md
- ops/execution-runs/latest.json
- the complete run it points to
- TASKS.md
- SYSTEM-STATE.md
- PR #141 at dff66b24fd966a08cdd6a16e80f954d2f988673a
- PR #142 at c95a77f92ae5b1d5f7261a0d3ad2956b1cd551eb
- shloimie-beep/onetimev2 ops/goals/CURRENT.yaml and
  ops/goals/OT-LAUNCH-01/BOARD.yaml at
  53a18e771488c61cf271cb33a0bcacee2c7135f4

Write exactly these four paths:

1. BNA-START-HERE.md
2. AGENTS.md
3. ops/control/CURRENT.yaml
4. ops/control/BNA-BOARD.yaml

No other file may change.

Required control model:

- BNA-START-HERE.md becomes pointer-only. It must not copy mutable statuses,
  current requirements, PR heads, deployment IDs, or next actions.
- ops/control/CURRENT.yaml points to exactly one Board:
  ops/control/BNA-BOARD.yaml.
- BNA-BOARD.yaml is the only mutable BNA current-status map.
- The Board must record:
  - canonical BNA production checkpoint:
    cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c;
  - BNA control truth currently under repair;
  - no assigned BNA School feature implementation;
  - PR #141 as needs_operator_decision/readback;
  - PR #142 as preserved provider-off implementation awaiting convergence;
  - the July 12 shared-CRM run as superseded historical One Time-first evidence;
  - One Time current control as external and owned by
    shloimie-beep/onetimev2;
  - One Time-first launch dependency preservation;
  - no decomposition or provider activation authorized.
- AGENTS.md must state that the Board is the only current status map.
- AGENTS.md must demote execution-runs/latest.json, TASKS.md,
  SYSTEM-STATE.md, handoffs, PR descriptions, generated dashboards, and reports
  to evidence/projection roles unless they point to the Board.
- Add an explicit precedence rule:
  AUDIT, REVIEW, DISCUSSION, ANALYSIS, PLAN-ONLY, PROMPT-ONLY, PRESERVATION,
  WORK-OFF, or read-only instructions never trigger goal-mode execution.
- Goal-mode execution requires:
  1. one Board-assigned executable task;
  2. one named writer slot;
  3. exact write scope;
  4. stop condition;
  5. required proof; and
  6. explicit implementation authorization.
- A stale or missing Board must fail closed and return a control finding rather
  than resume the latest execution run.

Do not edit the historical execution run in this task. Preserve it exactly as
evidence. The new Board must classify it rather than rewrite history.

Verification:

- parse both YAML files;
- prove CURRENT.yaml resolves to one Board;
- prove BNA-START-HERE.md points only to CURRENT.yaml for mutable status;
- search the four changed files for copied mutable PR heads, deployment IDs,
  current requirement IDs, and next-action prose;
- confirm no file under public/, src/, scripts/, tests/, migrations, or
  shloimie-beep/onetimev2 changed;
- run git diff --check;
- record exact starting and ending commits;
- obtain independent readback of all four files.

Stop after opening a bounded draft PR. Do not merge or deploy.
```

---

# 7. Later control-plane extraction prompt

**Classification: BLOCKED EXECUTION PROMPT — ready only after assignment**

```text
BNA-CONTROL-PLANE-EXTRACTION-01 — CONTRACT-FIRST EXTRACTION

Prerequisites:

- BNA-CONTROL-POINTER-01 is accepted.
- The BNA Board names the exact target control-plane repository.
- The BNA Board names writer slot BNA-CONTROL-PLANE-WRITER-01.
- PR #141 and PR #142 have an explicit preserve/split/integrate disposition.
- The current One Time Board and accepted One Time product source are pinned.
- No One Time launch task depends on this extraction completing.

Source repository:
shloimie-beep/bnei-neviim-academy

Pinned sources:

- master:
  cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c
- PR #141:
  dff66b24fd966a08cdd6a16e80f954d2f988673a
- PR #142:
  c95a77f92ae5b1d5f7261a0d3ad2956b1cd551eb
- One Time control reference:
  shloimie-beep/onetimev2
  codex/full-app-staging-live
  53a18e771488c61cf271cb33a0bcacee2c7135f4

Hard boundary:

The control plane owns assignments, Boards, technical tickets, connector
contracts, sanitized status/readback, Agent Action lifecycle, and the isolated
read-only Operations bot.

It does not own BNA School product records, One Time product records, customer
communications, provider credentials, product sessions, or product databases.

Phase 1 — mandatory inventory, no source movement:

1. Produce a symbol-level dependency map for:
   - docs/architecture/contracts/**
   - Agent Action hub/storage/repository modules
   - workspace/connector taxonomy
   - platform-control and Agent Action UI
   - technical-ticket/source-workspace contracts
   - PR #142 ADR, worker, library, registry row, and tests
2. Classify every dependency:
   - move;
   - copy then retire source;
   - compatibility adapter;
   - remain BNA School;
   - remain One Time;
   - archive only;
   - forbidden/private.
3. Identify every import from server.js, school-domain modules, school database
   access, One Time modules, provider configuration, sessions, or cookies.
4. Produce a source-hash provenance manifest.
5. Produce a versioned compatibility and rollback plan.
6. Prove One Time remains operational when the proposed control plane is absent.

Stop after Phase 1 unless the BNA Board explicitly accepts the inventory and
names the target repository and extraction commit range.

Phase 2 — allowed only after the Phase 1 Board gate:

- Move only contract-clean modules into the assigned target repository.
- Preserve original authorship and source hashes.
- Add one pointer and one Board in the target repository.
- Port PR #142 only as the provider-off read-only slice.
- Keep the mutation allowlist empty.
- Add no customer send, product write, shell runner, Codex runner, deployment
  control, or unrestricted natural-language execution.
- Replace direct legacy imports with explicit, versioned adapters.
- Leave the legacy source paths intact until target tests and consumer readback
  pass.
- Do not change shloimie-beep/onetimev2 except through a separately assigned,
  backward-compatible contract-consumer task.

Required proof:

- clean target build and focused tests;
- contract schema and example validation;
- no forbidden BNA School or One Time imports;
- no secrets or private data;
- no shared cookies/sessions;
- no product-database access from the Operations bot;
- One Time outage-isolation proof;
- legacy compatibility proof;
- exact source and target commits;
- rollback instructions;
- independent semantic review.

Stop before merge, deploy, provider activation, source deletion, or legacy
archive conversion. Each requires its own Board assignment.
```

---

# 8. Later BNA School extraction prompt

**Classification: BLOCKED EXECUTION PROMPT — ready only after assignment**

```text
BNA-SCHOOL-EXTRACTION-01 — PRODUCT-BOUNDARY EXTRACTION

Prerequisites:

- BNA-CONTROL-POINTER-01 is accepted.
- The BNA control-plane boundary is accepted.
- The BNA Board names the exact target BNA School repository.
- Writer slot BNA-SCHOOL-WRITER-01 is assigned.
- A fresh read-only production inventory is recorded against
  bnei-neviim-academy master
  cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c.
- One Time remains independently controlled by shloimie-beep/onetimev2.

Goal:

Extract the BNA School product into a dedicated repository without moving
platform-global control state, One Time implementation, historical shared-brain
queues, private data, or legacy provenance.

BNA School target ownership:

- BNA public website and signup;
- BNA School Operations/admin;
- parent portal;
- Student portal;
- school-approved provider directory and school provider links;
- BNA classes, assignments, worksheets, newsletters, and communities;
- BNA contacts, parents, Students, staff, rabbis, and school settings;
- BNA first-party CRM and school communications;
- school-scoped bot/assistant behavior;
- BNA route/action registry rows;
- BNA database access and school migrations;
- BNA brand, privacy, tests, deployment, health, rollback, and live smoke.

Forbidden target ownership:

- One Time app, routes, CRM, GHL, accounts, access, classes, entitlements,
  communications, provider integrations, or launch status;
- platform-global Agent Action jobs;
- cross-repository Boards and writer assignments;
- the control-plane Operations bot;
- broad Agent Fleet/shared-brain execution;
- old family-app behavior not explicitly adopted;
- active GHL runtime for BNA School;
- raw historical transcripts, private exports, secrets, sessions, or provider
  credentials.

Phase 1 — mandatory no-write extraction census:

1. Map every BNA public, Operations, parent, Student, provider, API, manifest,
   health, and asset route.
2. Map each route to server handlers, libraries, tables, migrations, tests,
   action registry rows, route registry rows, styles, and assets.
3. Classify mixed server.js and public/operations code at symbol/view level.
4. Inventory database tables and row ownership without exporting private rows.
5. Identify all imports or runtime assumptions involving:
   - platform-global control;
   - One Time;
   - provider-wide configuration;
   - historical family-app state;
   - global agent fleet or shared memory.
6. Produce a no-GHL active-source scan.
7. Produce a cutover and rollback design.
8. Produce exact keep/move/copy/archive/delete-later classifications.

Stop after Phase 1 until the BNA Board accepts:

- route/API ownership;
- data ownership;
- target repository;
- migration order;
- compatibility window;
- rollback plan;
- production cutover authority.

Phase 2 — only after Board acceptance:

- build the target from school-owned modules only;
- use forward-only checksummed migrations;
- preserve current BNA route behavior through a compatibility window;
- keep platform technical-ticket integration optional and versioned;
- make control-plane absence non-fatal to school runtime;
- preserve BNA School no-GHL policy;
- add privacy and wrong-workspace tests before any data migration;
- deploy only to a new isolated staging target;
- perform no DNS, production, provider, email, WhatsApp, payment, access, or
  customer mutation.

Required proof:

- complete route/API parity matrix;
- focused and full tests;
- parent/Student/provider wrong-scope rejection;
- public privacy proof;
- no-GHL scan;
- database no-write census and migration checksums;
- mobile/tablet/desktop route acceptance;
- staging health/readiness;
- One Time non-regression;
- exact source and target commits;
- rollback rehearsal;
- independent semantic review.

Stop before production cutover, DNS change, legacy source deletion, or archive
conversion. Those require separate Board assignments.
```

---

# 9. Dependency rule preserving One Time-first launch

## `OT-FIRST-DEP-01`

**Classification: NEW FINDING — REQUIRED CONTROL RULE**

1. **One Time launch ordering is owned exclusively by the current `shloimie-beep/onetimev2` Board.**
2. No BNA pointer repair, BNA School parity task, PR #141 merge, PR #142 merge, control-plane extraction, school extraction, or legacy cleanup may become an implicit dependency of One Time launch.
3. A BNA task may block One Time only when the One Time Board explicitly names a versioned contract from that task as a launch dependency.
4. Any contract consumed by One Time must be changed additively. The existing contract or adapter remains available until the One Time Board records migration acceptance.
5. The BNA control plane must be optional from the One Time runtime’s perspective:

   * no shared database;
   * no shared session or cookie;
   * no required BNA web process;
   * no shared provider credential;
   * no synchronous dependency for customer use;
   * no control-plane outage that prevents One Time classes, access, or communications.
6. PR #141 and PR #142 may be preserved or extracted without delaying current One Time execution.
7. Legacy BNA One Time bridge cleanup occurs only after One Time has independently accepted replacements.
8. When a BNA status map conflicts with the One Time Board on One Time work, the One Time Board controls and the BNA copy is classified as stale or historical.
9. No BNA School implementation should be started merely to create visual or feature parity with One Time.
10. Control-plane and BNA School extraction work must use separate writer slots and must not write to `shloimie-beep/onetimev2` unless the One Time Board separately assigns the exact compatibility change.

This rule follows the current One Time invariant that its repository is standalone and does not share BNA sessions, runtime, agents, or broad migrations.

---

# PR integration-state summary

## PR #141

**Classification: UNPROVEN**

* Preserve.
* Do not add implementation.
* Do not call it integrated.
* Do not use its generated control tower as current.
* Do not treat its imported historical One Time queue as current.
* Do not merge before an ownership/decomposition decision.
* Correcting only its PR description would not resolve the mixed repository boundary.

Its architecture work is useful as decomposition input, especially its separation of BNA School, Super Admin control, and the One Time external connector.

## PR #142

**Classification: CONFIRMED CURRENT TRUTH for implementation evidence**
**Classification: UNPROVEN for integration and activation**

* Preserve exact head `c95a77f92ae5b1d5f7261a0d3ad2956b1cd551eb`.
* Keep provider off.
* Keep the mutation allowlist empty.
* Do not deploy.
* Do not broaden into Agent Work, Codex, shell, infrastructure, product writes, or One Time access.
* Assign it to the future control-plane repository.
* Resolve its stack dependency on PR #141 before any legacy-master merge decision.

---

# Source list

## BNA master checkpoint

**Repository:** `shloimie-beep/bnei-neviim-academy`
**Commit:** `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`

Primary sources:

* `BNA-START-HERE.md`
* `AGENTS.md`
* `docs/BNA-RAMBLE-TO-DONE.md`
* `ops/execution-runs/latest.json`
* `ops/execution-runs/2026-07-12-shared-crm-communication-agents-addendum/run.json`
* complete pointed-run protocol files:

  * `SOURCE.md`
  * `BASELINE.md`
  * `PLAN.md`
  * `REQUIREMENTS.md`
  * `requirements.json`
  * `STATUS.md`
  * `BATCH-STATUS.md`
  * `NEXT-SESSION.md`
  * `EVIDENCE.md`
  * `TEST-RESULTS.md`
  * `DEPLOYMENT.md`
  * `FINAL-REPORT.md`
* `TASKS.md`
* `MEMORY.md`
* `SYSTEM-STATE.md`
* `README.md`
* `docs/architecture/no-ghl-policy.md`
* `docs/REPO-SURFACE-MAP.md`
* `ops/chatgpt-ramble-dropoff/CONTROL-TOWER.md`
* `ops/chatgpt-ramble-dropoff/CONTROL-TOWER.json`

The entrypoint, current-pointer, run, goal-mode, and source-of-truth evidence are directly reflected in the cited files.

## PR #141

**Repository:** `shloimie-beep/bnei-neviim-academy`
**PR:** #141
**Actual head:** `dff66b24fd966a08cdd6a16e80f954d2f988673a`
**Base:** `master@cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`

Primary sources:

* GitHub PR metadata, changed-file list, review list, review-thread list, and actual-head workflow-run readback
* `docs/architecture/no-ghl-policy.md`
* `docs/architecture/one-time-communications-architecture-v1.md`
* `docs/architecture/workspace-community-provider-role-map.md`
* `docs/platform-workspace-taxonomy-migration-plan.md`
* `tasks-pending/2026-07-22-platform-agent-actions-telegram-preview.md`
* `tasks-pending/2026-07-21-platform-bna-workspace-agent-actions.status.json`
* `ops/codex-runs/2026-07-22-platform-agent-actions-telegram-preview/TEST-RESULTS.md`
* PR-head `ops/chatgpt-ramble-dropoff/CONTROL-TOWER.md`

The scoped GHL boundary, connector architecture, compatibility-only taxonomy plan, historical queue caveat, and corrected production incident are documented in these sources.

## PR #142

**Repository:** `shloimie-beep/bnei-neviim-academy`
**PR:** #142
**Head:** `c95a77f92ae5b1d5f7261a0d3ad2956b1cd551eb`
**Base:** PR #141 branch at `dff66b24fd966a08cdd6a16e80f954d2f988673a`

Primary sources:

* GitHub PR metadata, changed-file list, review list, review-thread list, and actual-head workflow-run readback
* `docs/architecture/bna-control-plane-operations-bot-adr-2026-07-24.md`
* `ops/codex-runs/2026-07-24-bna-control-plane-operations-bot/HANDOFF.md`
* `ops/codex-runs/2026-07-24-bna-control-plane-operations-bot/TEST-RESULTS.md`

The exact read-only/provider-off scope and its unactivated release state are documented in the ADR and handoff.

## One Time current control

**Repository:** `shloimie-beep/onetimev2`
**Default branch tip inspected:** `main@610b585f3d221addd4e7b824c92a5cc256cffcf9`
**Current launch/control branch inspected:** `codex/full-app-staging-live@53a18e771488c61cf271cb33a0bcacee2c7135f4`

Primary sources at the control branch:

* `AGENTS.md`
* `ops/goals/CURRENT.yaml`
* `ops/goals/OT-LAUNCH-01/BOARD.yaml`

The Board records one current milestone/status model and independently accepts PR #142’s exact provider-off control-plane slice.

```text
CONTROL-TOWER-RETURN
AUDIT_ID: A07
REPOSITORY: shloimie-beep/bnei-neviim-academy
EXACT_COMMIT: cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c
VERDICT: FAIL_CLOSED_CONTROL_TRUTH_FRAGMENTED; production checkpoint is preserved, but no coherent BNA current-status authority exists
P0: Board-assign and execute the four-file BNA control-pointer repair before any autonomous BNA implementation selection
P1: Preserve PR #141 and PR #142; decide repository ownership and convergence before merge, activation, or decomposition
P2: Archive historical One Time, family-app, GHL, execution-run, task, and generated-status material only after accepted control-plane and BNA School cutovers
CURRENT_BLOCKER: No Board-assigned canonical BNA current-status authority; PR #142 is stacked on integration-unproven PR #141
SAFE_PARALLEL_TASK: Read-only dependency and path inventory for the future BNA Control Plane and BNA School repositories; no writes or source movement
WRITER_SLOT: BNA-CONTROL-DOC-WRITER-01
ASSIGNMENT_REQUIRED: YES
EXECUTION_PROMPT_READY: YES
EXECUTION_PROMPT_MODE: CONTROL_DOCS_ONLY_NO_APP_CODE_NO_DEPLOY_NO_PROVIDER
EXECUTION_PROMPT_BRANCH: codex/bna-control-pointer-repair-20260726
FORBIDDEN_OVERLAPS: PR #141/#142 implementation files; server.js; public product surfaces; src runtime modules; migrations; provider configuration; deployments; shloimie-beep/onetimev2 Board or product work
```
