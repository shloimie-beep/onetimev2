# A06 — Security, Privacy, Credentials, and History Audit

**Audit date:** 2026-07-26  
**Mode:** Read-only audit; no repository, provider, credential, browser-history, or Git-history mutation authorized or performed  
**Intended commit path:** `ops/audits/2026-07-26/parallel-control-tower/A06-result.md`

## 1. Scope and immutable evidence anchors

This audit inspected the following pinned repository states:

| Repository | Immutable commit | Default branch at audit time | Visibility observed at audit time |
|---|---|---|---|
| `shloimie-beep/onetimev2` | `e986b5e6502b1168b3eb28e200fd49ac8de46477` | `main` | Public |
| `shloimie-beep/bnei-neviim-academy` | `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c` | `master` | Public |

Mutable PR descriptions and current GitHub metadata were inspected only as dated evidence. They are not immutable source-of-truth records and must not override the pinned trees or the canonical One Time Board.

### Audit boundaries

The audit did **not**:

- rotate or validate a credential against a provider;
- open a protected provider destination;
- test whether a tracked external folder destination is anonymously accessible;
- render, copy, compare, or quote a protected value;
- decode tracked ZIP, image, screenshot, PDF, font, or other binary payloads;
- inspect the operator’s current local worktrees, browser databases, Codex task stores, or unpushed commits;
- rewrite Git history, force-push, edit PR descriptions, delete Actions artifacts, or invalidate downstream clones;
- alter production, staging, DNS, email, WhatsApp, Telegram, Zoom, Vimeo, HighLevel, Stripe, Drive, database, or access state.

Those limitations are material. Several risks are therefore classified as **UNPROVEN** rather than asserted as incidents.

## 2. Classification and severity model

### Conclusion classifications

- **NEW FINDING** — a material delta not already represented accurately in the current One Time Board or an accepted security track.
- **CONFIRMED CURRENT TRUTH** — directly supported by the pinned tree or current Board and still relevant to execution.
- **SUPERSEDED/HISTORICAL** — true for a prior state but not sufficient evidence of current runtime or local state.
- **UNPROVEN** — plausible and consequential, but the permitted evidence did not establish the condition.

### Severity

- **P0** — confirmed active compromise, confirmed publicly usable production credential, confirmed unrestricted private-data disclosure, or confirmed cross-tenant production access.
- **P1** — public tracked exposure, history exposure, false security acceptance, material isolation failure, or a control gap that must change execution order before further release work.
- **P2** — bounded or already-contained exposure, stale security truth, local collision risk, or metadata/linkability risk that still requires tracked remediation.

## 3. Executive determination

**Overall status: `P1_ACTION_REQUIRED`.**

1. **NEW FINDING — P1:** The public BNA repository currently tracks a real operator destination and several classes of protected operational metadata. It also tracks One Time review fixtures containing real external provider destinations, provider/media identifiers, and replayable/static review identifiers. The evidence labels many rows as synthetic or no-write, but no-write does not make externally identifying data safe to publish.

2. **NEW FINDING — P1:** The accepted secret-scan claims are materially broader than the implementations. The One Time scanner is a limited plaintext regex scan and intentionally skips major binary evidence classes and history. The BNA `secrets:audit` implementation checks only tracked **path names**, not file contents, and broadly excludes `docs/`, `tests/`, and keyholder-diagnostic evidence. A passing BNA scan cannot establish that tracked content is free of secrets, destinations, PII, provider IDs, or replayable links.

3. **CONFIRMED CURRENT TRUTH — P1:** One Time current files have redacted a private Administrator destination, while older Git objects retain it. The current Board already classifies history remediation as requiring an operator decision. That settled conclusion remains correct. No rewrite is authorized.

4. **CONFIRMED CURRENT TRUTH — P1:** At the pinned BNA tree, One Time still exists inside BNA’s shared runtime, data model, route registry, review fixtures, provider surfaces, and deployment evidence. This conflicts with One Time’s canonical standalone invariant. Current One Time Board evidence indicates that standalone One Time later became the governed target, so the **current live extent** of BNA coupling is unproven; the architecture debt in the pinned BNA tree is nevertheless confirmed.

5. **NEW FINDING — P1:** Public generated evidence exposes credential topology and correlation metadata: local storage layout, credential source precedence, truncated fingerprints, lengths, timestamps, presence/match state, provider classes, environment-variable names, and deployment/readiness identifiers. No raw active secret was verified, but this is unnecessary public reconnaissance material and invalidates the claim that generated evidence is uniformly sanitized.

6. **CONFIRMED CURRENT TRUTH — P2:** Authorized browser/task diagnostics historically rendered fictional staging credentials and a private destination. The affected fictional Administrator credentials were repeatedly rotated and sessions invalidated; replacement values were reported absent from tracked files and ordinary browser stores. Authorized task history still retains invalidated values. This is contained historical exposure, not proof of current credential compromise.

7. **SUPERSEDED/HISTORICAL plus UNPROVEN — P2:** A committed BNA control-tower snapshot reported a dirty `master` worktree and overlapping operational files on 2026-07-13. GitHub-connected audit access cannot establish the operator’s local state on 2026-07-26. No writer should begin until a fresh sanitized local readback exists.

8. **NEW FINDING — P2:** BNA’s `BNA-START-HERE.md` declares an older closed execution run as current, while `ops/execution-runs/latest.json` points to a later active run. That stale handoff can cause agents to rely on obsolete deployment and security assumptions.

9. **NEW FINDING — P2:** Public BNA evidence contains stable pseudonymous learner/question/media identifiers combined with exact dates and operational job linkage. No raw transcript body or learner name was verified in the sampled artifacts, but the records are linkable across reports and should not be treated as anonymous publication-safe evidence.

**Confirmed P0 findings: none.**

No raw live credential, unrestricted customer export, raw Student transcript, active replayable production class link, or confirmed cross-tenant production disclosure was established within the audit boundary. This is not a clean bill of health: the existing scanners cannot prove those negatives for all tracked/history/binary surfaces.

## 4. Settled work that should not be repeated

The following conclusions are already supported and should be preserved rather than reimplemented:

### 4.1 CRM PII in browser URLs

**CONFIRMED CURRENT TRUTH.** One Time PR #7 implemented the correct privacy direction: pause free-text CRM search until a POST-body endpoint exists, avoid PII in GET URLs/history/storage/traces/screenshots, and use private/no-store request semantics. A06 does not recommend rebuilding that completed control.

### 4.2 Current-file redaction of the private Administrator destination

**CONFIRMED CURRENT TRUTH.** The One Time Board records current-file placeholders and zero current direct matches for the specific destination covered by its existing privacy track. A06 does not recommend re-redacting the same three records merely to create more activity.

### 4.3 Rotation of historically rendered fictional staging Administrator credentials

**CONFIRMED CURRENT TRUTH.** The Board records multiple bounded rotations, session invalidation, rejection of old values, protected handoff replacement, and sanitized replacement scans. A06 does not recommend another rotation absent new evidence that a current credential was rendered or is replayable.

### 4.4 History rewrite authority

**CONFIRMED CURRENT TRUTH.** The Board correctly blocks history rewriting without explicit operator authorization. A06 preserves that block.

### 4.5 Standalone One Time target

**CONFIRMED CURRENT TRUTH.** `onetimev2/AGENTS.md` establishes standalone runtime, session, secret, scope, and database boundaries. A06 treats that as the governing architecture, not BNA’s earlier shared-platform model.

## 5. Exposure-class matrix

| Exposure class | Determination | Severity | Primary finding |
|---|---|---:|---|
| Current tracked-file exposure | Confirmed in public BNA tree: real operator destination, provider destinations/identifiers, static review identifiers, credential topology, operational metadata | P1 | A06-P1-01, A06-P1-05 |
| Git-history-only exposure | Confirmed private Administrator destination in older One Time objects; current files redacted | P1 | A06-P1-03 |
| Local dirty-worktree exposure | Historical dirty-state snapshot confirmed; current local state unavailable | P2 / UNPROVEN current | A06-P2-02 |
| Browser/task-history exposure | Confirmed invalidated fictional values and private destination in authorized diagnostic history; replacements not shown as present | P2 | A06-P2-01 |
| Generated-artifact exposure | Confirmed credential topology, fingerprints, timestamps, presence/match state, provider/readiness metadata; binary payload contents unproven | P1 | A06-P1-05, U-A06-03 |
| Architecture isolation failure | Confirmed in pinned BNA tree; current live mounting and data reuse unproven | P1 | A06-P1-04 |
| Learner/media linkability | Confirmed stable pseudonymous IDs plus dates/job links; no sampled raw transcript body | P2 | A06-P2-04 |
| Unproven active exposure | External share permissions, live route mounting, binary archive contents, all-ref/history scope, current local-only commits, forks/caches | — | Section 8 |

## 6. P1 findings

### A06-P1-01 — Current public BNA tracked-file exposure

**Classification:** **NEW FINDING**  
**Exposure classes:** current tracked-file exposure; generated-artifact exposure  
**Repositories:** `shloimie-beep/bnei-neviim-academy` at the pinned commit  
**Execution effect:** Current-file containment must precede further acceptance of BNA-hosted One Time review/security evidence.

#### Exact evidence

1. The repository was publicly visible at audit time.

2. `memory/2026-07-02.md` tracks a real operator email destination authorized for seed/test messages and internal alerts. The value is intentionally omitted from this report.

3. `src/platform/instances/one-time-shared-review-data.js` tracks and returns:
   - real external Drive folder destinations and direct folder links;
   - real provider/workspace labels and identifiers;
   - a static review access identifier;
   - real historical media identifiers and direct media/embed references;
   - public review links containing the static identifier;
   - a provider review payload that includes the external drop-off destinations.

4. `public/one-time-classroom.html` accepts a review query parameter, installs the static review identifier in client state, and calls the review API without a normal member session when review mode is active.

5. The merged implementation recorded in BNA PR #9 added an unauthenticated review API returning the shared review data. The current route registry labels several review fixtures as public and synthetic/no-write. Synthetic/no-write status does not neutralize real provider destinations or operational identifiers embedded in the same payload.

6. `config/service-provider-sites/one-time.json` also references the review surface and scoped One Time identifiers.

#### Risk

- Publicly identifies an operator destination.
- Reveals provider folder topology and direct destinations that may facilitate targeted access attempts, phishing, or accidental content discovery.
- Creates replayable review URLs/identifiers and exposes implementation internals.
- Expands the attack surface even where the linked provider independently enforces permissions.
- Makes public-repository evidence dependent on continued provider permission hygiene.

The audit did **not** prove that any external folder was anonymously readable or that the static review identifier grants access to real customer data. Those escalation conditions remain unproven.

#### Safe immediate containment

- Mark the BNA public review fixture and its generated evidence **not acceptable as security proof** until current-file remediation is reviewed.
- Freeze new One Time review-route, credential, provider-link, and data-model work in BNA.
- Preserve only repository, commit, path, blob SHA, and field class in the incident inventory; do not copy the values into another issue, prompt, or report.
- Prepare current-file syntheticization and route minimization in an isolated BNA security writer slot.
- Do not alter Drive/provider sharing, delete provider folders, or rotate credentials without an operator decision and a protected readback.

#### Stop/escalation conditions

Escalate to P0 and stop ordinary remediation if a protected operator verifies any of the following without rendering the value into the task log:

- a tracked provider destination is anonymously accessible and contains private material;
- the public review endpoint returns real customer, learner, contact, credential, or provider-secret data;
- the static review identifier authorizes a real member or administrator session;
- a current raw credential is found in a tracked blob.

---

### A06-P1-02 — Secret-scan implementations do not support accepted security claims

**Classification:** **NEW FINDING**  
**Exposure classes:** current tracked-file exposure; history exposure; generated-artifact exposure; unproven risk  
**Repositories:** both pinned repositories  
**Execution effect:** Existing “secret scan passed” evidence cannot close privacy/security acceptance.

#### Exact evidence — One Time

`scripts/secret-scan.mjs`:

- scans tracked and nonignored untracked text files only;
- skips common images, PDFs, fonts, and NUL-containing binaries;
- recognizes a narrow list of credential formats;
- does not scan Git object history, all refs, PR/issue/comment bodies, browser/task history, workflow artifacts, release assets, forks, ZIP contents, screenshots, or external destinations;
- has no rules for ordinary email destinations, provider IDs, Drive links, access/reset/magic links, signed URLs, session cookies, generic JWTs, many provider-token formats, private customer content, or stable Student identifiers.

The scanner is useful as a bounded plaintext check. It is not a repository privacy/history scanner.

#### Exact evidence — BNA

`scripts/audit-secrets.mjs`:

- runs `git ls-files`;
- evaluates only file **path names** against risky filename patterns;
- does not open or scan file contents;
- excludes all `docs/`, all `tests/`, selected diagnostic artifacts, and several scripts;
- does not inspect untracked files, ignored files, Git history, PR metadata, binaries, archives, screenshots, browser/task stores, provider destinations, PII, or replayable links.

A pass means only that no non-excluded tracked path matched its filename rules.

#### Acceptance contradiction

Board entries and PR descriptions cite passing scans as evidence that repositories or result artifacts contain no secret exposure. Those statements must be narrowed to the scanner’s actual coverage. In BNA, the accepted scan coexists with current tracked credential-diagnostic metadata because the relevant path class is expressly allowed.

#### Safe immediate containment

- Downgrade every current acceptance statement that treats these scans as comprehensive.
- Add a Board blocker: `SECURITY_SCAN_COVERAGE_NOT_SUFFICIENT_FOR_ACCEPTANCE`.
- Keep the current scanners available as one bounded layer, but do not use their pass result to close PII, history, binary, screenshot, provider-link, or replayable-link acceptance.
- Assign separate One Time and BNA scanner-hardening writers; do not let a single broad writer touch both repositories and the evidence corpus simultaneously.
- Require scanners to report only class, path, line/object reference, and deterministic redacted token—not the matched value.

---

### A06-P1-03 — One Time private destination persists in Git history

**Classification:** **CONFIRMED CURRENT TRUTH**  
**Exposure class:** Git-history-only exposure  
**Repository:** `shloimie-beep/onetimev2`  
**Execution effect:** Preserve current-file redaction; history rewrite remains blocked pending explicit operator authority.

#### Exact evidence

`ops/goals/OT-LAUNCH-01/BOARD.yaml` records:

- current branch records use a redacted placeholder;
- direct current-file readback found no current occurrence of the protected destination in the specified records;
- older Git commits retain the destination;
- current-file cleanup cannot remove historical objects;
- the track status is `needs_operator_decision`;
- history rewriting and force-push are not authorized.

#### Delta from existing Board truth

The existing Board track is narrowly scoped to one One Time destination. A coordinated rewrite decision must not use that narrow inventory as proof that the entire privacy scope is known. BNA contains separate current and historical exposure classes, and public GitHub metadata/artifacts may retain additional copies.

#### Safe immediate containment

- Preserve the current redaction and the existing Board decision.
- Do not rerun or expose exact-value searches in an ordinary task transcript.
- Do not create another current-file “fix” for records already redacted.
- Complete a protected cross-repo/all-surface inventory before asking the operator to authorize a rewrite.
- Keep history rewrite as a separate operator decision, not an implementation job.

---

### A06-P1-04 — One Time/BNA architecture isolation failure in the pinned BNA tree

**Classification:**  
- **CONFIRMED CURRENT TRUTH** for the pinned BNA source tree;  
- **SUPERSEDED/HISTORICAL** for older claims that the shared BNA runtime is the intended final One Time architecture;  
- **UNPROVEN** for the exact current production/staging mounting and data dependency on 2026-07-26.

**Exposure class:** architecture isolation failure  
**Repositories:** both pinned repositories  
**Execution effect:** Architecture readback and a BNA freeze must precede any decommissioning or further shared-platform work.

#### Exact evidence

The canonical One Time operating guide requires:

- a standalone repository/runtime;
- no copied BNA server, Operations shell, provider runtime, agents, memory, secrets, or broad migrations;
- no shared BNA session/cookie;
- server-owned scope;
- protected destinations from protected configuration only.

The pinned BNA tree and current BNA execution records contain:

- One Time product/runtime modules, routes, review fixtures, workspace/project keys, provider UI, CRM, communications, classroom, content, and database contracts;
- a same-repository architecture decision retaining shared backend/API/contact/outbox/agent/ticket contracts;
- evidence that BNA and One Time deployments were repeatedly built from the same source lineage;
- BNA memory stating that One Time data belongs in BNA Operations tables and APIs;
- direct public One Time review fixtures in BNA source.

Current One Time Board evidence, however, treats `onetimev2` as the canonical standalone product and BNA restoration as a separate concern.

#### Risk

- Cross-repo drift can reintroduce shared secrets, sessions, routes, tables, identities, or provider behavior.
- Security fixes can be applied to one copy and not the other.
- Agents may mutate the wrong repository based on stale BNA memory.
- A decommission attempt without a dependency map could break a still-mounted route, migration, worker, or data pipeline.
- Shared evidence makes it difficult to prove which source produced production or staging.

No current cross-tenant production data disclosure was established. This is a confirmed isolation/control failure in source and governance, not a confirmed active breach.

#### Safe immediate containment

- Freeze new One Time feature implementation in BNA.
- Allow only preservation, security containment, source/readback, and explicitly assigned decommission-preparation work in BNA’s One Time surfaces.
- Produce a read-only route/import/table/env/session/cookie/worker/deployment dependency map before removing code.
- Do not delete BNA tables, migrations, routes, or provider records in the audit-remediation lane.
- Require exact source attestation for both web and worker before claiming that a legacy BNA One Time surface is no longer live.

---

### A06-P1-05 — Generated evidence and public metadata expose credential topology

**Classification:** **NEW FINDING**  
**Exposure classes:** generated-artifact exposure; current tracked-file exposure; GitHub metadata exposure  
**Repository:** primarily BNA; selected One Time PR/Board surfaces also carry operational metadata  
**Execution effect:** Evidence-generation policy must be remediated before generated reports can satisfy security acceptance.

#### Exact evidence

Current tracked BNA credential-diagnostic artifacts disclose, without raw values:

- the operator’s local credential-store path structure;
- credential aliases and source precedence;
- provider credential categories;
- whether local, ignored-repository, environment, and hosted copies exist;
- whether copies match;
- truncated fingerprints;
- normalized lengths;
- modification timestamps;
- environment-variable names and fallback order.

Other tracked BNA memory, execution records, and PR descriptions expose detailed provider readiness, deployment topology, exact environment confirmation names, service relationships, and operational destinations.

One Time PR descriptions and Board evidence also expose extensive immutable source/deployment/provider metadata. Most of that is appropriate audit metadata when narrowly necessary, but it becomes risky when combined with credential-source topology or protected destination references.

No raw active secret was verified in these artifacts.

#### Risk

- Supplies an attacker with a provider and credential inventory.
- Reveals which copies match, which stores are stale, and which fallback source is selected.
- Makes targeted phishing and workstation-path attacks easier.
- Allows correlation of a credential across environments through fingerprints.
- Increases the chance that future evidence generators accidentally add a raw value because the schema already models sensitive properties in detail.

#### Safe immediate containment

- Treat fingerprints, credential lengths, local paths, copy-presence matrices, exact aliases, and match state as protected—not “sanitized.”
- Current public evidence should retain only provider class, configured/not-configured, scope classification, last checked date bucket, and a non-correlatable per-report status identifier.
- Do not amend historical PR descriptions or delete artifacts until the operator decides the GitHub-metadata/history scope.
- Remediate the generator before regenerating current evidence, otherwise the same disclosure will recur.
- Do not rotate credentials solely because topology metadata is public; rotate only when a raw or active replayable value is confirmed, or when a provider-specific risk decision says otherwise.

## 7. P2 findings

### A06-P2-01 — Browser and authorized task history retain invalidated fictional values

**Classification:** **CONFIRMED CURRENT TRUTH**  
**Exposure class:** browser/task-history exposure  
**Repository authority:** One Time Board  
**Execution effect:** Preserve containment evidence; operator decides history retention/deletion separately.

#### Exact evidence

The One Time Board records repeated incidents where an authorized diagnostic rendered a fictional staging Administrator password and, in some incidents, a private destination. It also records:

- immediate form clearing and cessation of probing;
- treatment of the rendered password as compromised;
- bounded Administrator-only rotation;
- session invalidation;
- rejection of the old value;
- protected handoff replacement;
- no intentional replacement rendering;
- zero replacement matches in tracked files and ordinary scanned browser stores;
- old-value matches remaining in authorized Codex/task history;
- no history rewrite.

#### Determination

This is not a new credential incident. The exposed fictional values are reported invalidated. The residual exposure is historical task content and private-destination PII.

#### Safe immediate containment

- Do not paste historical values into the Board, issue, report, scanner output, or rewrite manifest.
- Preserve incident timestamps/task identifiers and hashes only.
- Do not delete task/browser history until preservation and operator retention decisions are complete.
- Keep the replacement credential out of browser DOM snapshots and generalized diagnostic capture.

---

### A06-P2-02 — Dirty-worktree and local-only-commit hazard is unresolved for current execution

**Classification:**  
- **SUPERSEDED/HISTORICAL** for the committed 2026-07-13 snapshot;  
- **UNPROVEN** for the operator’s current 2026-07-26 local state.

**Exposure class:** local dirty-worktree exposure  
**Repository:** BNA  
**Execution effect:** No writer assignment may begin against the local BNA checkout without a new sanitized readback.

#### Exact evidence

`ops/chatgpt-ramble-dropoff/CONTROL-TOWER.md` reported:

- branch `master`;
- dirty worktree;
- multiple modified execution, ledger, performance, and watchdog files;
- a collision warning;
- the rule that GitHub-connected ChatGPT cannot see local dirty work.

`BNA-START-HERE.md` independently states that GitHub-connected sessions cannot see local dirty or local-only changes.

#### Risk

- A security writer could commit unrelated private or unfinished evidence.
- A current-file remediation could overwrite a local remediation or expose unpushed protected data.
- Local-only commits can make GitHub evidence falsely appear complete.

#### Safe immediate containment

Run only sanitized metadata commands locally before assigning a writer:

- branch/upstream identity;
- `git status --porcelain=v2 --branch`;
- worktree list;
- ahead/behind counts;
- local-only commit SHAs and subjects;
- no diff bodies, file contents, environment output, or credential output.

Stop if any target path is dirty, unmerged, or claimed by another writer.

---

### A06-P2-03 — BNA start-here handoff is stale

**Classification:** **NEW FINDING**  
**Exposure class:** governance/current-truth failure  
**Repository:** BNA  
**Execution effect:** Security and deployment work can start from obsolete assumptions unless the pointer is corrected through an assigned governance task.

#### Exact evidence

- `BNA-START-HERE.md` says the latest execution run is a closed June run.
- `ops/execution-runs/latest.json` points to a later July active run.
- The later run contains materially different One Time architecture, communications, deployment, and security state.

#### Risk

An agent following the mandated read order can receive contradictory “current” truth before reaching the later pointer. This can cause:

- use of superseded deployment/state claims;
- accidental resumption of closed work;
- missed security blockers;
- wrong repository or runtime targeting.

#### Safe immediate containment

- Treat `ops/execution-runs/latest.json` plus its pointed run as the newer BNA execution pointer for this audit.
- Do not edit the start-here file in the A06 audit lane.
- Assign a narrow governance writer after local worktree readback; the writer must update pointers only, not copy mutable deployment details.

---

### A06-P2-04 — Stable pseudonymous learner and media metadata is publicly linkable

**Classification:** **NEW FINDING**  
**Exposure classes:** current tracked-file exposure; generated-artifact exposure  
**Repository:** BNA  
**Execution effect:** Public evidence policy must stop treating stable internal identifiers as anonymous.

#### Exact evidence

Sampled tracked artifacts include:

- exact class/media dates and timestamps;
- stable pseudonymous learner identifiers;
- stable question hashes;
- stable Drive/media identifiers;
- content-job links and processing status.

The sampled reports state that they are sanitized and contain no raw transcript bodies. The sample did not expose learner names or raw questions.

#### Risk

Stable identifiers permit cross-report correlation and can become indirectly identifying when combined with school schedules, screenshots, newsletters, provider records, or future leaks. Minors’ data warrants a stricter standard than ordinary operational telemetry.

#### Safe immediate containment

- Public evidence should use per-report random labels, counts, date buckets, and aggregated outcomes.
- Stable learner/contact/media/question identifiers should stay in protected evidence, not Git.
- Do not backfill raw names or questions to “make the evidence clearer.”
- Existing current reports should be remediated only after the preservation manifest records their blob SHAs and field classes.

## 8. Unproven risks and escalation conditions

These items are material but not proven by the permitted read-only connector evidence.

### U-A06-01 — External provider destination permissions

**Classification:** **UNPROVEN**

Tracked real provider folder destinations may be permission-protected, link-accessible, or public. The audit did not open them. An operator-authorized, protected readback is required.

**Escalate to P0** if an unauthenticated or unintended identity can access private recordings, transcripts, customer/Student material, credentials, or operator-only content.

### U-A06-02 — Current live mounting of BNA One Time review routes

**Classification:** **UNPROVEN**

The pinned BNA tree contains public review routes and fixtures. The audit did not test the current BNA or One Time deployments. Current Board evidence suggests architecture moved toward standalone One Time, but exact live route removal/mounting is not independently attested here.

**Escalate to P0/P1** if a public route currently returns real private data, or if BNA and standalone One Time share live sessions, secrets, or customer tables contrary to the standalone invariant.

### U-A06-03 — Binary, archive, screenshot, PDF, and generated evidence contents

**Classification:** **UNPROVEN**

One Time tracks at least one audit-input ZIP. The One Time scanner skips NUL-containing/binary payloads and common image/PDF/font types. BNA also retains curated screenshots and generated artifacts by policy. The audit did not decode or OCR these files.

**Escalate to P0/P1** if a binary contains a current credential, private destination, customer/Student data, replayable link, or protected provider payload.

### U-A06-04 — Current local dirty worktrees and local-only commits

**Classification:** **UNPROVEN**

Connector access cannot see them. The last committed BNA control-tower snapshot was dirty, but that is not current proof.

### U-A06-05 — Production/staging source attestation

**Classification:** **UNPROVEN**

The One Time production-pilot handoff states that an observed production service was CLI-uploaded without independent repository-source metadata. Human commit labels and route health do not alone prove the exact source or absence of uncommitted build inputs.

### U-A06-06 — Full GitHub retention surface

**Classification:** **UNPROVEN**

The audit did not exhaustively inspect:

- every branch and tag;
- deleted branches;
- PR/issue comments;
- review comments;
- release assets;
- Actions artifacts and caches;
- packages;
- wiki;
- forks;
- mirrors;
- search-engine caches;
- downstream clones/worktrees.

### U-A06-07 — Full raw transcript and private-content history

**Classification:** **UNPROVEN**

Sampled current BNA reports explicitly state that raw transcript bodies were not committed, and no sampled raw transcript body was found. BNA’s raw-first model and large historical evidence footprint justify an all-ref inventory before any categorical “no raw private content in history” claim.

## 9. Safe immediate containment, in order

This order changes execution and should be reflected in the Board before implementation work resumes.

1. **Preserve without copying values.** Create a protected inventory keyed by repository, commit/ref, path, blob/object SHA, field class, exposure surface, and current/history status. Never include the protected value.

2. **Assign dedicated security lanes.** One Time current-file/scanner work, BNA current-file/scanner work, architecture readback, and Git-history decision must have separate owner/writer slots.

3. **Invalidate false acceptance.** Mark existing secret-scan passes as bounded plaintext/path checks only. They cannot close privacy, history, binary, screenshot, provider-link, or replayable-link acceptance.

4. **Freeze BNA One Time expansion.** No new One Time feature, provider, migration, session, CRM, class, transcript, or portal work in BNA until architecture readback establishes what is still live and what is legacy.

5. **Perform fresh local metadata readback.** Before any writer starts, verify clean/nonoverlapping worktrees and local-only commits without printing diffs.

6. **Remediate current tracked files first.** Remove/syntheticize public operator destinations, external provider destinations, static review identifiers, credential topology, correlatable fingerprints, and stable learner/media identifiers. Remediate generators before regenerating evidence.

7. **Prove route and bundle boundaries.** Public fixtures must contain synthetic data only, no access identifiers, no provider destinations, and no administrator/provider identity details. Normal private routes must fail closed.

8. **Obtain operator decisions.** Repository visibility, public review-route availability, external provider share validation/revocation, PR/issue metadata cleanup, browser/task-history retention, legacy BNA One Time decommissioning, and history rewriting are operator decisions.

9. **Only then consider history rewrite.** A rewrite is not an immediate containment step and remains unauthorized.

## 10. Actions requiring operator decision

| Decision | Why operator authority is required | Safe default until decided |
|---|---|---|
| Temporarily make BNA, or both repositories, private during remediation | Changes public access, forks, deployments, collaborators, and public links | Leave visibility unchanged but block acceptance and prioritize current-file remediation |
| Disable/unpublish/gate BNA public One Time review routes | May affect existing review workflows or live users | Freeze new use; do not publish links; remediate source first |
| Validate, revoke, or replace external provider folder/share destinations | Requires opening a protected provider and may disrupt content workflows | Do not open or mutate provider; retain protected reference only |
| Edit historical PR/issue/review descriptions and delete GitHub artifacts | Mutable GitHub metadata cleanup is outside ordinary source remediation | Preserve references; no edits/deletions |
| Delete or retain browser/Codex task history containing invalidated values | Retention, audit, and incident-evidence tradeoff | Preserve without rendering |
| Decommission BNA’s legacy One Time routes/tables/workers | May break live dependencies or erase required history | Freeze expansion; read-only dependency map |
| Rotate credentials based only on topology disclosure | Rotation can break integrations and is not justified without active-value exposure | Do not rotate unless a raw/replayable current value or provider risk is confirmed |
| Coordinate Git-history rewrite | Broad, disruptive, incomplete against forks/caches, and requires collaborator coordination | Not authorized; preserve current redaction |
| Decide retention/publication standard for Student-linked evidence | Involves minors’ privacy and operating-policy choices | No stable Student identifiers or exact private activity in public evidence |

## 11. Actions that require coordinated history rewrite

The following cannot be removed from historical Git objects by a normal current-file commit:

- the known historical private One Time Administrator destination;
- any historical BNA/current One Time destination, provider identifier, credential topology, or private-content copies found by the protected all-ref inventory;
- values embedded in renamed/deleted files, merge commits, tags, or historical binary artifacts.

A history rewrite would still not automatically remove:

- PR/issue/review comments;
- release assets;
- Actions artifacts/caches;
- forks and mirrors;
- collaborator clones and worktrees;
- downloaded archives;
- search-engine or platform caches;
- browser/Codex task history;
- provider-side shared links or credentials.

Therefore, “rewrite Git” cannot be accepted as a complete privacy closeout by itself.

## 12. Preservation-before-remediation rules

1. **Never quote or duplicate a protected value.** Preserve only repository/ref/path/object SHA, field class, and containment state.

2. **Current-file evidence before deletion.** Record immutable blob/object references and sanitized counts before changing or deleting current tracked artifacts.

3. **Protected evidence stays off-repo.** Exact-value match sets, screenshots, browser/task database extracts, and provider readbacks belong in an encrypted operator-controlled location.

4. **No broad staging.** Use path-explicit adds; never `git add -A` or a broad commit from a dirty worktree.

5. **One writer per collision domain.** Separate BNA current files, One Time scanner, BNA scanner, architecture readback, and governance pointers.

6. **Stop on raw value discovery.** Do not print it, add a test fixture from it, or continue scanning into logs. Record a protected incident reference and obtain operator/provider action.

7. **Do not rotate before preserving state.** Rotation can destroy evidence and does not remove Git/task/browser copies.

8. **Do not rewrite history before current files are clean.** Otherwise the value can be recommitted immediately.

9. **Do not treat hashes/fingerprints as harmless.** Stable credential fingerprints and stable learner identifiers are correlatable protected metadata.

10. **Binary evidence fails closed.** ZIPs, screenshots, images, PDFs, and recordings cannot satisfy security acceptance until inspected by a protected non-echoing process or removed from the acceptance set.

11. **Student evidence is aggregate by default.** Public evidence may use counts, broad date buckets, and per-report randomized labels. No stable internal Student/contact/question/media ID.

12. **Provider access and source remediation are separate.** Removing a tracked link does not change provider permissions; changing provider permissions does not remove Git history.

13. **History rewrite uses protected replacement inputs.** Exact values must come from an encrypted local file or protected operator channel, never a prompt, issue, PR body, command history, or report.

14. **Keep old commit maps protected.** A rewrite map itself can reveal where sensitive objects existed.

15. **Acceptance requires negative and positive proof.** Prove that protected classes are absent from public/current files and that required synthetic fixtures still work.

## 13. Recommended Board tasks

Every task below requires a Board row before execution. “Writer slot” means an exclusive branch/worktree and collision domain.

### A06-T01 — Protected cross-repo exposure inventory

- **Dependency:** Pinned commits from this audit; no implementation dependency.
- **Owner:** Security conductor.
- **Writer slot:** `A06-SECURITY-INVENTORY`; read-only evidence collector. A separate narrow governance writer may commit only the sanitized inventory summary after review.
- **Exact scope:** Both repositories; all branches/tags; tracked/current blobs; deleted/renamed historical blobs; PR/issue/review metadata; release/Actions artifact indexes; generated evidence classes; browser/task-history reference counts; no provider access.
- **Write scope:** Sanitized manifest only: repository, ref, path/object SHA, exposure class, current/history status, remediation owner, and protected-evidence pointer.
- **Stop condition:** Any tool attempts to print a match; any raw credential/private content appears in ordinary output; source identity is ambiguous.
- **Required proof:** Deterministic manifest checksum; per-surface counts; zero protected values in the committed summary; independent reviewer confirms classifications.
- **Board assignment required:** **Yes.**

### A06-T02 — BNA current tracked-file containment

- **Dependency:** A06-T01 current-file manifest; fresh clean-worktree readback from A06-T07.
- **Owner:** BNA security remediation owner.
- **Writer slot:** `A06-BNA-CURRENT-FILES`; one isolated BNA worktree.
- **Exact write scope:** Current tracked occurrences and generators affecting:
  - `memory/*.md` and `MEMORY.md`;
  - `src/platform/instances/one-time-shared-review-data.js`;
  - `public/one-time-classroom.html`;
  - `config/service-provider-sites/one-time.json`;
  - `ops/route-registry.json`;
  - current generated credential/readiness artifacts under `ops/qa-runs/`, `ops/watchdog-audits/`, and related generators;
  - sampled learner/media evidence and the generators that emit stable IDs;
  - focused tests for public fixture privacy and private-route denial.
- **Stop condition:** A real provider/data dependency is needed; a target path is dirty/claimed; a raw secret or real customer/Student payload is discovered; remediation would delete a migration/table/provider object.
- **Required proof:** Current tracked content scan; synthetic fixture tests; public route negative tests; no provider destination/access identifier/admin identity in public payload; no raw private content; exact changed-file list; no deployment.
- **Board assignment required:** **Yes.**

### A06-T03 — One Time scanner and acceptance hardening

- **Dependency:** A06-T01 field-class taxonomy.
- **Owner:** One Time security-tool owner.
- **Writer slot:** `A06-OT-SCANNER`; isolated `onetimev2` worktree.
- **Exact write scope:** `scripts/secret-scan.mjs`, focused security tests/fixtures, package/CI wiring, scanner documentation, and acceptance wording that currently overstates coverage.
- **Stop condition:** Scanner emits matched value; binary inspection is attempted in normal CI output; scan time/coverage requires unreviewed broad infrastructure.
- **Required proof:** Synthetic tests for multiple secret formats, ordinary email/private destinations, provider IDs, signed/replayable links, JWT/session-like data, DB URLs, archives-as-uninspected findings, tracked/untracked and all-ref modes; output contains class/path/reference only.
- **Board assignment required:** **Yes.**

### A06-T04 — BNA scanner and acceptance hardening

- **Dependency:** A06-T01 field-class taxonomy.
- **Owner:** BNA security-tool owner.
- **Writer slot:** `A06-BNA-SCANNER`; separate from A06-T02.
- **Exact write scope:** `scripts/audit-secrets.mjs`, focused tests/fixtures, package/CI wiring, generated-evidence policy, and acceptance wording. Remove filename-only assurance and broad unreviewed `docs/`/`tests/`/diagnostic exemptions.
- **Stop condition:** Same as A06-T03; additionally stop if a current artifact contains a raw value and move to protected incident handling.
- **Required proof:** Content-based synthetic corpus; protected-class rules; no value echo; current/untracked/all-ref coverage modes; explicit uninspected-binary failure state; false-positive allowlist reviewed by field class and exact path.
- **Board assignment required:** **Yes.**

### A06-T05 — One Time/BNA architecture-isolation readback

- **Dependency:** A06-T01; A06-T07 local-state readback; current accepted One Time Board head.
- **Owner:** Architecture verifier.
- **Writer slot:** `A06-ARCH-READBACK`; read-only first. No code-removal writer is assigned by this task.
- **Exact scope:** Imports, route mounts, sessions/cookies, secrets/config aliases, tables/migrations, queues/outboxes, workers, provider adapters, transcript/content paths, deployment descriptors, DNS targets, and source attestation across both repositories.
- **Write scope:** One sanitized dependency map and disposition table only.
- **Stop condition:** A live dependency cannot be proven without provider/database mutation; source attestation is missing; a real data sample would be required.
- **Required proof:** Static dependency graph; exact source/ref map; authenticated/public route matrix using synthetic requests only when separately authorized; table/migration ownership map; web/worker source attestation.
- **Board assignment required:** **Yes.**

### A06-T06 — Generated-evidence governance remediation

- **Dependency:** A06-T01; generator inventory from A06-T02/T04.
- **Owner:** Evidence-governance owner.
- **Writer slot:** `A06-EVIDENCE-GOVERNANCE`.
- **Exact write scope:** Generator schemas and current generated outputs that expose local paths, aliases, fingerprints, lengths, timestamps, presence/match matrices, provider IDs, private destinations, stable Student/media IDs, or raw snippets.
- **Stop condition:** A historical PR/comment/artifact edit is needed; hand off to operator decision instead of editing.
- **Required proof:** Regenerated synthetic evidence contains no protected metadata classes; schema rejects them; tests prove status/readiness remains useful without correlation fields.
- **Board assignment required:** **Yes.**

### A06-T07 — Fresh local dirty-worktree/local-only-commit readback

- **Dependency:** None.
- **Owner:** Operator or local Codex readback executor.
- **Writer slot:** None; read-only.
- **Exact scope:** Both local repositories and all worktrees: branch/upstream, porcelain status, worktree list, ahead/behind counts, local-only commit SHAs/subjects, path-collision list. No file contents or diff bodies.
- **Stop condition:** A command would print environment variables, credential helpers, diff bodies, ignored secret paths, or protected file contents.
- **Required proof:** Sanitized signed readback with timestamp, repository root label, counts, SHAs, and collision paths only.
- **Board assignment required:** **Yes**, because the result controls every writer lane.

### A06-T08 — Operator security decision packet

- **Dependency:** A06-T01, A06-T05, and protected provider-share readback if separately authorized.
- **Owner:** Operator.
- **Writer slot:** Board decision writer only after the operator decides.
- **Exact decision scope:** Repository visibility; public review-route disposition; provider share validation/revocation; PR/issue/artifact cleanup; browser/task-history retention; legacy BNA One Time decommissioning; credential rotation criteria.
- **Stop condition:** No explicit decision; any protected value would be included.
- **Required proof:** Dated decision IDs, chosen option, rationale, owner, rollback, and authorized writer scope.
- **Board assignment required:** **Yes.**

### A06-T09 — History rewrite decision

- **Dependency:** Current-file containment complete; protected cross-repo/all-surface inventory complete; downstream clone/fork map; operator decision packet.
- **Owner:** Operator.
- **Writer slot:** None unless explicit authorization is recorded.
- **Exact scope:** Decision only: authorize, defer, or reject a coordinated rewrite; identify repositories/refs/metadata surfaces and downstream remediation obligations.
- **Stop condition:** Anything less than explicit authorization naming scope and force-push window.
- **Required proof:** Signed Board decision and protected rewrite manifest checksum.
- **Board assignment required:** **Existing One Time assignment must be retained; a companion BNA/cross-repo decision row is required.**

## 14. Codex current-file remediation prompt

The following prompt is for a future, Board-assigned current-file remediation run. It does **not** authorize execution now.

```text
TASK: A06 current-file security and privacy remediation
MODE: CURRENT FILES ONLY. NO HISTORY REWRITE. NO PROVIDER ACTION.

Authority prerequisites:
1. Read each repository's AGENTS file.
2. In onetimev2, read ops/goals/CURRENT.yaml and the referenced GOAL, SPEC,
   ACCEPTANCE, BOARD, and DECISIONS files.
3. Confirm Board jobs exist for A06-T02, A06-T03, A06-T04, A06-T06, and the
   local-state gate A06-T07.
4. Stop if the Board assignments, owner slots, dependencies, or clean-worktree
   evidence are absent.

Repositories and immutable audit anchors:
- shloimie-beep/onetimev2 at
  e986b5e6502b1168b3eb28e200fd49ac8de46477
- shloimie-beep/bnei-neviim-academy at
  cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c

Hard prohibitions:
- Do not print, quote, compare in visible output, or commit any protected value.
- Do not rotate credentials.
- Do not open Drive, Zoom, Vimeo, HighLevel, Stripe, email, WhatsApp, Telegram,
  Railway, DNS, production databases, or protected handoffs.
- Do not rewrite history, force-push, delete branches/tags, edit PR/issue bodies,
  or delete GitHub artifacts.
- Do not deploy.
- Do not delete migrations, tables, provider objects, contacts, Students,
  recordings, transcripts, or access records.
- Do not use git add -A.
- Do not mix BNA and One Time writer scopes.

Required lane split:
A. A06-BNA-CURRENT-FILES
B. A06-BNA-SCANNER
C. A06-OT-SCANNER
D. A06-EVIDENCE-GOVERNANCE
Each lane uses an isolated clean worktree and path-explicit staging.

First, preservation:
- Consume the protected A06-T01 manifest by checksum/reference only.
- In committed evidence, record repository, ref, path, blob/object SHA,
  protected field class, and disposition. Never record the matched value.
- If a raw credential, private content body, or active replayable value appears,
  stop immediately and return a protected incident reference.

BNA current-file objectives:
1. Replace every current tracked real operator destination in public memory or
   evidence with a semantic placeholder or protected-config reference.
2. Make public One Time review fixtures fully synthetic:
   - no real provider folder destination;
   - no direct provider link;
   - no real provider/media identifier;
   - no static access identifier returned to the browser;
   - no administrator/provider login identity or handoff detail;
   - no real customer, Student, contact, transcript, or support content.
3. Public review endpoints must return only an explicitly versioned synthetic
   fixture. Prefer removing the access-token/code concept from public fixture
   payloads entirely.
4. Normal classroom/member/provider routes remain private and fail closed.
5. Replace stable Student/contact/question/media IDs in public evidence with
   per-report random labels, aggregate counts, and date buckets.
6. Remove credential fingerprints, lengths, local paths, exact aliases,
   modification timestamps, and copy-presence/match matrices from current public
   generated evidence.
7. Remediate the generators before regenerating current reports.
8. Update the route registry and focused tests to describe disclosure controls,
   not merely "no write."

One Time scanner objectives:
1. Preserve the existing bounded plaintext checks.
2. Add protected field classes for ordinary private destinations, provider IDs,
   signed/replayable links, JWT/session-like material, additional provider
   credentials, and private-content markers.
3. Add explicit scan modes for current tracked files, nonignored untracked
   files, and all Git refs/objects.
4. Treat ZIPs, images, PDFs, screenshots, and other uninspected binaries as
   uninspected findings, not passes.
5. Output only class, path/object reference, and a deterministic redacted marker.

BNA scanner objectives:
1. Replace filename-only assurance with content scanning.
2. Remove blanket trust for docs, tests, and credential-diagnostic paths.
3. Allowlist only exact reviewed synthetic fixtures and exact field classes.
4. Add current/untracked/all-ref modes and explicit binary blind-spot reporting.
5. Never echo a match.

Acceptance wording:
- Change all affected "repository secret scan passed" claims so they state the
  exact scanner mode and coverage.
- No scan may close screenshot, archive, history, PR metadata, browser/task
  history, or provider-share acceptance unless that surface was actually
  inspected by its dedicated protected process.

Required proof:
- Exact changed-file list and path-explicit staged set.
- Clean worktree before and after each lane.
- Synthetic positive and negative scanner fixtures.
- Public review payload contains no protected field classes.
- Logged-out private routes return no private payload.
- Public bundles contain no static access identifier or provider destination.
- Generated evidence schema rejects fingerprints, local paths, lengths, exact
  aliases, stable Student IDs, and raw snippets.
- No provider call, external message, deployment, credential mutation, database
  mutation, or history rewrite.
- Independent reviewer reads the diff and reports only path/field-class findings.

Stop conditions:
- dirty or overlapping target paths;
- unresolved live dependency;
- protected value appears in visible output;
- remediation requires provider/database access;
- a generated artifact cannot be proven synthetic;
- any request to rewrite history or force-push.

Return:
- complete Markdown result;
- finding-by-finding disposition;
- commits and test evidence;
- remaining operator decisions;
- explicit statement that history rewrite remains NOT AUTHORIZED.
```

## 15. Coordinated history-rewrite plan — **NOT AUTHORIZED**

**Status: `NOT_AUTHORIZED`.**  
This section is a plan for operator review only. It must not be executed from this audit.

### 15.1 Preconditions

All of the following are mandatory:

1. Explicit operator authorization naming each repository, ref class, protected field class, GitHub metadata surface, and force-push window.
2. A06-T01 protected inventory complete across both repositories and GitHub retention surfaces.
3. Current-file remediation merged and verified.
4. Public review-route and provider-share decisions completed.
5. Architecture dependency map complete; no production/staging build depends on an object that would be removed without a replacement.
6. Freeze window agreed with every collaborator/automation that pushes.
7. Branch protection and CI behavior documented.
8. Fork, mirror, package, release, deployment, runner-cache, clone, and worktree inventory completed.
9. Encrypted preservation package created with:
   - original ref tips;
   - protected object manifest;
   - checksums;
   - authorization;
   - replacement rules;
   - rollback procedure.
10. Legal/operational retention decision recorded for incident evidence and Student/customer data.
11. Exact protected match inputs supplied through an encrypted local file or protected operator mechanism—not a prompt, issue, PR, shell history, or report.

### 15.2 Rewrite lanes

Use separate coordinated owners:

- **Rewrite conductor:** controls freeze, manifest, ref map, and authorization.
- **One Time mirror writer:** rewrites only `onetimev2`.
- **BNA mirror writer:** rewrites only `bnei-neviim-academy`.
- **GitHub metadata cleaner:** handles PR/issue/review text, releases, and Actions artifacts under separate authorization.
- **Downstream remediation owner:** coordinates collaborators, clones, worktrees, runners, mirrors, and deployments.
- **Independent verifier:** has no write credentials during rewrite construction.

### 15.3 Technical sequence

1. Freeze all pushes and disable automated writers.
2. Create protected bare mirrors from authoritative remotes.
3. Record every branch/tag/ref tip and object count.
4. Run a protected all-object scanner that reports object/path/class only.
5. Build narrowly targeted `git filter-repo` transformations:
   - exact-value replacement from protected input;
   - exact-path removal only where the entire artifact is unauthorized;
   - preserve unrelated history;
   - never use a broad regex that can corrupt normal source.
6. Produce old-to-new commit/ref maps in protected storage.
7. Re-run full scans on rewritten mirrors.
8. Build/test representative historical and current release points where feasible.
9. Obtain operator go/no-go after reviewing:
   - object count delta;
   - affected refs;
   - path/class counts;
   - build/test results;
   - residual surfaces.
10. Temporarily adjust branch protections only as authorized.
11. Force-push rewritten branches and tags during the approved window.
12. Restore protections immediately.
13. Separately clean authorized GitHub metadata:
   - PR/issue/review bodies and comments;
   - release notes/assets;
   - Actions artifacts/caches;
   - packages or wiki where applicable.
14. Rebuild deployments only from verified rewritten commits if required.
15. Notify collaborators to delete/reclone or hard-reset every clone/worktree.
16. Purge affected local mirrors, runner workspaces, caches, archives, and generated bundles according to the decision.
17. Verify public raw-object URLs, branch/tag refs, search results, release assets, and current deployments.
18. Record residual risk.

### 15.4 Verification requirements

- Zero protected matches in rewritten reachable objects using the protected scanner.
- Zero current-file protected matches.
- Every branch/tag has an authorized new tip.
- Current build, tests, migrations, and source-attestation gates pass.
- Public routes and generated artifacts satisfy the remediated privacy policy.
- Actions/release/PR metadata cleanup separately verified.
- Collaborator/downstream acknowledgment recorded.
- Provider-side links or credentials separately validated/rotated where authorized.

### 15.5 Stop conditions

Stop and do not force-push if:

- authorization is ambiguous;
- protected match scope changes materially after freeze;
- a current deployment cannot be reproduced from the rewritten tree;
- a required collaborator/fork/mirror cannot be coordinated and the operator has not accepted residual risk;
- the rewrite alters unrelated source or migration bytes;
- a protected input appears in ordinary logs;
- current files are not already clean.

### 15.6 Residual risk

Even a successful rewrite cannot guarantee removal from:

- forks outside operator control;
- prior clones, worktrees, mirrors, bundles, archives, and backups;
- caches and search indexes;
- screenshots and task/browser history;
- copied chat, email, or issue content;
- external provider systems.

The final closeout must say “rewritten from controlled refs and coordinated surfaces,” not “erased everywhere.”

## 16. Source list

### 16.1 Immutable One Time sources

Repository: `shloimie-beep/onetimev2`  
Commit: `e986b5e6502b1168b3eb28e200fd49ac8de46477`

- `AGENTS.md`
- `ops/goals/CURRENT.yaml`
- `ops/goals/OT-LAUNCH-01/GOAL.md`
- `ops/goals/OT-LAUNCH-01/SPEC.yaml`
- `ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml`
- `ops/goals/OT-LAUNCH-01/BOARD.yaml`
- `ops/goals/OT-LAUNCH-01/DECISIONS.yaml`
- `.gitignore`
- `package.json`
- `scripts/secret-scan.mjs`
- `ops/execution/registry.json`
- `ops/execution/ot-80/STATE.json`
- `ops/execution/ot-80/RESUME.md`
- `ops/execution/ot-80/audit-inputs/OT-DAYONE-COMMUNICATIONS-COPY-PACK.zip` — existence and binary status only; contents not decoded
- `ops/goals/OT-LAUNCH-01/handoffs/production-pilot--persistent-staging-conductor.json`

### 16.2 Mutable One Time GitHub metadata observed on 2026-07-26

These are supporting descriptions, not canonical current truth:

- PR #7, head `c1584577780d7b5125bce4fb81d2a454c9e84096`
- PR #97, head `53a18e771488c61cf271cb33a0bcacee2c7135f4`
- PR #107, head `1e247c70004dffb6247fc1ee407f1153d753bd7d`
- PR #115, head `06c14e9b59c5e7c963397fb961634fe711b00e0c`

### 16.3 Immutable BNA sources

Repository: `shloimie-beep/bnei-neviim-academy`  
Commit: `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`

- `AGENTS.md`
- `docs/BROWSER-AGENT-SECURITY.md`
- `GOAL-MODE.md`
- `BNA-START-HERE.md`
- `MEMORY.md`
- `memory/2026-07-02.md`
- `memory/2026-07-13.md`
- `ops/execution-runs/latest.json`
- `ops/execution-runs/2026-07-12-shared-crm-communication-agents-addendum/STATUS.md`
- `ops/chatgpt-ramble-dropoff/CONTROL-TOWER.md`
- `.gitignore`
- `package.json`
- `scripts/audit-secrets.mjs`
- `config/service-provider-sites/one-time.json`
- `public/one-time-classroom.html`
- `src/platform/instances/one-time-shared-review-data.js`
- `ops/route-registry.json`
- `ops/drive-transcript-visibility/2026-07-02/SOURCE.md`
- `ops/drive-transcript-visibility/2026-07-02/OPENAI-KIMI-CREDENTIAL-AUDIT.md`
- `ops/qa-runs/2026-07-02T15-42-05-723Z-keyholder-diagnostics.json`
- `ops/class-drive-intake/2026-06-26-two-week-class-intake-audit/STUDENT-QUESTION-MATRIX.md`
- `ops/class-drive-intake/2026-06-26-two-week-class-intake-audit/DRIVE-MEDIA-CENSUS.md`
- `tests/one-time-ui-review-data-seed.test.js`
- `tests/one-time-product-system.test.js`
- `tests/one-time-preview-page.test.js`
- pinned commit diff for `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`

### 16.4 Mutable or historical BNA GitHub metadata

- PR #9, merged as `41ec81c0e1b327d862394afc00ec3b14ff58af8e`
- PR #64, head `77d60043527106b464618260872714931c3f1176`, merged as `4b73d10e75d66161c45f13f1c9717d779e503f49`
- PR #64 changed-file inventory, used to identify the breadth of raw-input, Drive, transcript, Student-question, credential-diagnostic, provisioning, and generated-evidence surfaces

## 17. Final verdict

The most important correction is not another credential rotation or an immediate history rewrite. It is to stop accepting incomplete scanners and “no-write” fixtures as proof of publication safety.

The current execution order should be:

1. protected inventory and fresh local-state readback;
2. Board assignment;
3. BNA current-file containment and generator remediation;
4. scanner/acceptance hardening in both repositories;
5. architecture-isolation readback;
6. operator decisions on repository visibility, public review routes, provider shares, metadata/history retention, and legacy BNA One Time disposition;
7. only then, a separate decision on coordinated history rewrite.

No repository or provider mutation was performed by A06.

```yaml
CONTROL-TOWER-RETURN
audit_id: A06
audit_title: Security, privacy, credentials, and history audit
result_path: ops/audits/2026-07-26/parallel-control-tower/A06-result.md
audit_date: 2026-07-26
mode: read_only
repositories:
  - repository: shloimie-beep/onetimev2
    commit: e986b5e6502b1168b3eb28e200fd49ac8de46477
  - repository: shloimie-beep/bnei-neviim-academy
    commit: cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c
overall_status: P1_ACTION_REQUIRED
confirmed_p0_findings: 0
confirmed_p1_findings: 5
confirmed_p2_findings: 4
unproven_risk_groups: 7
history_rewrite_authorized: false
repository_changes_performed: false
provider_actions_performed: false
credential_rotations_performed: false
protected_values_rendered: false
current_file_remediation_authorized_by_this_audit: false
board_assignments_required:
  - A06-T01
  - A06-T02
  - A06-T03
  - A06-T04
  - A06-T05
  - A06-T06
  - A06-T07
  - A06-T08
  - A06-T09-companion-cross-repo-decision
operator_decisions_required:
  - repository_visibility_during_remediation
  - public_review_route_disposition
  - protected_provider_share_validation_or_revocation
  - github_metadata_and_artifact_cleanup
  - browser_and_task_history_retention
  - legacy_bna_one_time_decommissioning
  - credential_rotation_only_if_active_exposure_confirmed
  - coordinated_history_rewrite
next_safe_action: >
  Assign A06-T01 and A06-T07 first, preserve protected evidence by object reference
  only, then assign separate current-file and scanner writers. Do not rewrite
  history, force-push, open providers, rotate credentials, or deploy.
END-CONTROL-TOWER-RETURN
```
