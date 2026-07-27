# A04 — Complete HighLevel truth, sender, workflow, and website-assistant audit

**Commit-ready path:** `ops/audits/2026-07-26/parallel-control-tower/A04-result.md`  
**Audit date:** 2026-07-26  
**Audit mode:** GitHub-only, read-only  
**Repository:** `shloimie-beep/onetimev2`  
**Control checkpoint:** `e986b5e6502b1168b3eb28e200fd49ac8de46477`  
**Current application source recorded by the checkpoint Board:** `a22009f4dce6bae6b0553ea9007ff40eceaffd25`  
**Current application migration recorded by the checkpoint Board:** `2227_event_service_email_permission_convergence`  
**HighLevel location:** canonical One Time location from protected executor context; provider identifier intentionally omitted  
**External effects from this audit:** 0  
**Customer sends authorized by this audit:** 0

---

## 1. Executive determination

The current HighLevel control state is **fail-closed and drifted**, not ready for customer enrollment or sending.

The execution-changing conclusions are:

1. **NEW FINDING — PR #116 must be re-authored on the current conductor source.**  
   It must not be merged or cherry-picked wholesale. Its base predates the current application source, migration 2227, and the repaired control-plane rule that Agent Mode is pointer-only and may not execute by generated queue or filename order. Reviewed copy/action ideas may be manually ported after revalidation, but its queue, README, generated projections, result artifacts, and status assumptions are not integration-safe.

2. **NEW FINDING — the July 26 Rabbi-sender intake and design packet is outside the requested checkpoint.**  
   It was added in commit `53a18e771488c61cf271cb33a0bcacee2c7135f4`, exactly one commit after checkpoint `e986b5e...`. This audit reads it because the request explicitly names it, but classifies it as **post-checkpoint evidence/proposed direction**, not checkpoint status or assignment authority.

3. **NEW FINDING — the existing phase-2 Rabbi sender job cannot perform the requested sender canary.**  
   `GHL-UI-13` is a no-send blocker/readback job. Its schema requires `messages_sent = 0`, while phase-2 acceptance requires one operator-owned seed and one reply readback. The repository-design task must preserve `GHL-UI-13` as a preflight or replace it with a reviewed successor, then create a separately authorized, one-message canary job. A job cannot simultaneously require zero sends and prove seed delivery.

4. **CONFIRMED CURRENT TRUTH — OT-E01 is Published but DRIFTED.**  
   Its immediate confirmation action is disabled. The editor did not expose enough subject, sender, reply-to, body, or link data to prove that the disabled action is the accepted action. Re-enabling or saving it is therefore prohibited until exact action identity is proven.

5. **CONFIRMED CURRENT TRUTH — OT-C01 remains two different assets.**  
   The canonical OT-C01 Email Marketing campaign remains Draft, unseeded, unscheduled, and zero-send. A same-name workflow wrapper is a separate cross-kind asset; it was protectively changed from Published to Draft and has zero active enrollments. Historical workflow enrollment counters are not message-delivery counts.

6. **UNPROVEN — archived workflows and hidden/backend AI inventory remain incomplete.**  
   The prior visible inventory did not expose a separate archived view or every hidden/backend Conversation AI surface. OT-A1 has an active repository prompt but no accepted current provider-side identity/readback. The canonical knowledge base and a legacy knowledge base remain distinct; the legacy asset’s dependency and disposition are unresolved.

7. **CONFIRMED CURRENT TRUTH — migration 2227 completed the repository/application contract, not the live provider handoff.**  
   The application has event-scoped permission, deny precedence, deterministic held outbox intent, and fail-closed tag projection. Provider transport remains disabled, immutable provider tag identities remain pending exact readback, and no post-2227 exactly-once operator reprocess/tag/enrollment/confirmation proof is accepted.

8. **CONFIRMED CURRENT TRUTH — OT-02A and OT-02B may share a Rabbi-authored content concept but not an audience predicate or delivery contract.**  
   OT-02A is an operational three-email migration for an exact operator-selected prior-subscriber segment. OT-02B is nurture for independently consented, unsuppressed new leads. Event registration, attendance, historic payment, portal presence, deliverability, or legacy tags do not place a person in either audience.

9. **NEW FINDING — the public website assistant depends on identity and inventory closure, not merely prompt copy.**  
   Before a website-chat canary, the repository/provider pair must prove which OT-A1 asset is canonical, which knowledge base is attached, whether a legacy or hidden AI asset can also answer, how consent/dedupe/suppression are applied, and whether all permitted bot actions have exact deployed contracts. The assistant must remain provider-off until those dependencies are closed.

**Immediate next assignment:** one full-location, read-only inventory.  
**Customer send authorization:** none.

---

## 2. Audit boundary and preservation rules

### 2.1 Canonical checkpoint

The primary evidence boundary is:

```text
repository: shloimie-beep/onetimev2
checkpoint: e986b5e6502b1168b3eb28e200fd49ac8de46477
```

At that checkpoint:

- `ops/goals/CURRENT.yaml` selects `OT-LAUNCH-01`.
- `ops/goals/OT-LAUNCH-01/BOARD.yaml` is the only current status map.
- `integrations/highlevel/registry/workflow-registry.yaml` is the only editable HighLevel automation inventory.
- `integrations/highlevel/workflows.yaml`,
  `integrations/highlevel/registry/current.json`, and
  `integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md`
  are generated projections, not editable status sources.
- `integrations/highlevel/agent-mode/README.md` is pointer-only.
- Jobs may not be selected by filename order, historical PR description, generated queue order, or old deployment status.
- Every provider mutation requires one exact reviewed job and one Board assignment.
- Default authority is no send, no publish, no activation, no enrollment, no payment mutation, and no destructive action.

### 2.2 Post-checkpoint packet

The named July 26 sender packet is located at:

```text
commit: 53a18e771488c61cf271cb33a0bcacee2c7135f4
message: Record Rabbi launch email prompt

ops/goals/OT-LAUNCH-01/inputs/
  20260726T151818Z-rabbi-sender-and-git-prompt-flow.yaml

ops/goals/OT-LAUNCH-01/handoffs/
  ghl-app-contract-shells--rabbi-launch-email-design.md
```

It is one commit after the requested checkpoint. Therefore:

- its operator direction is relevant;
- its sender and audience design is usable as proposed input;
- it does not retroactively change checkpoint Board status;
- it does not assign a provider job;
- it does not authorize a seed, enrollment, publication, or customer send;
- the conductor must explicitly adopt it before a repository or browser executor treats it as assigned work.

### 2.3 Evidence hierarchy used

From strongest to weakest:

1. checkpoint `CURRENT.yaml`, complete goal files, and checkpoint `BOARD.yaml`;
2. checkpoint canonical registries and source-hashed generated projections;
3. accepted application source/handoff evidence integrated into the checkpoint conductor;
4. current sanitized provider observation incorporated by the Board;
5. post-checkpoint intake/design packets, treated as proposed evidence only;
6. PR descriptions and branch results;
7. historical generated queues, exports, snapshots, and old PR assertions.

No conclusion treats a generated projection, PR description, or historical queue as stronger than the Board and editable registry.

---

## 3. Classification legend

| Classification | Meaning |
|---|---|
| **NEW FINDING** | A delta discovered by this audit that changes execution order, safety, assignment, architecture, or acceptance. |
| **CONFIRMED CURRENT TRUTH** | Current truth established by the checkpoint Board/canonical source and supported by the latest accepted evidence. |
| **SUPERSEDED/HISTORICAL** | Previously true or useful evidence that cannot be used as current status or execution authority. |
| **UNPROVEN** | Evidence is absent, incomplete, inaccessible, internally inconsistent, or insufficient for mutation/acceptance. |

---

## 4. Current exact HighLevel truth

| Asset or control surface | Classification | Exact current truth | Execution consequence |
|---|---|---|---|
| Governance/status authority | **CONFIRMED CURRENT TRUTH** | `BOARD.yaml` is the only current status map. `workflow-registry.yaml` is the only editable automation inventory. | Do not execute from generated queues, PR prose, filenames, or historical snapshots. |
| Generated `current.json` | **CONFIRMED CURRENT TRUTH** | A generated projection of canonical registry data. | Read-only; regenerate from canonical source, never edit as provider truth. |
| Generated `workflows.yaml` | **CONFIRMED CURRENT TRUTH** | A generated workflow projection. | Read-only; no assignment authority. |
| Generated control report | **CONFIRMED CURRENT TRUTH** | Intentionally preserves one registry/observed-state disagreement. | A red report is evidence of known drift, not permission to overwrite either side. |
| OT-C01 Email Marketing campaign | **CONFIRMED CURRENT TRUTH** | Separate canonical campaign; Draft; no selected audience; unscheduled; zero sends. | Preserve. Do not seed or send without a new permission snapshot and separate authority. |
| OT-C01 same-name workflow wrapper | **CONFIRMED CURRENT TRUTH** | Separate workflow-kind asset; protectively paused from Published to Draft; zero active enrollments; cross-kind name collision. | Preserve as drift/unknown; do not delete, rename, republish, infer sends, or collapse into the campaign. |
| OT-E01 | **CONFIRMED CURRENT TRUTH** | Published workflow; desired `ACTIVE_TESTED`; observed `DRIFTED`; immediate confirmation action disabled; later wait/reminder remains visible. | No re-enable, save, publication action, enrollment, or test until exact disabled-action identity is proven. |
| OT-E01 historical canary | **SUPERSEDED/HISTORICAL** | A bounded historical canary previously passed. | It proves past behavior only. It does not prove the current disabled action or post-2227 handoff. |
| 17 visible non-Tisha canonical workflows | **CONFIRMED CURRENT TRUTH** | Last accepted exhaustive visible inventory records empty Draft shells, with no configured actions and no production enrollment authority. | Preserve until one exact repository-complete job is Board-assigned. |
| UI jobs GHL-UI-14 through GHL-UI-18 | **CONFIRMED CURRENT TRUTH** | Target exact workflows, but checkpoint jobs do not contain sufficient exact message/action/template details for safe live configuration. | Re-author repository contracts first; do not invent content in the browser. |
| UI jobs GHL-UI-19 through GHL-UI-23 | **CONFIRMED CURRENT TRUTH** | Define HMAC/action intent for bot operations, but depend on OT-A1 identity, deployed action contracts, an approved GHL-side signer, exact Board assignment, and one-at-a-time execution. | Do not activate from file presence alone. |
| OT-A1 repository prompt | **CONFIRMED CURRENT TRUTH** | Active canonical prompt exists in Git. It is adult-only, Website Live Chat/WhatsApp capable, voice deferred, no Student data, no raw provider links, and no automatic human handoff. | Repository contract exists; provider acceptance does not. |
| OT-A1 provider asset | **UNPROVEN** | Current visible/provider identity, state, attachment, and exact knowledge-base binding are not accepted. | No website assistant configuration or canary until full AI inventory proves one canonical asset. |
| Canonical public knowledge base | **CONFIRMED CURRENT TRUTH** | Canonical versioned Git knowledge base exists. | It is the desired source, not proof of current provider attachment. |
| Legacy knowledge base | **UNPROVEN** | A separate legacy/unknown provider asset was observed; dependency and disposition unresolved. | Do not merge, delete, or assume it is unused. |
| Archived workflow inventory | **UNPROVEN** | Prior UI pass did not prove a complete archived/deleted inventory surface. | Full-location read-only inventory is the first task. |
| Hidden/backend Conversation AI inventory | **UNPROVEN** | Prior UI pass did not prove every hidden/backend AI asset or attachment. | Website-chat work remains blocked. |
| `rabbi_campaign` phase 1 | **CONFIRMED CURRENT TRUTH** | Current safe registered campaign identity uses the existing office-routed phase-1 From and default reply route. | May remain the preserved fallback; no phase-2 promotion by inference. |
| Preferred Rabbi campaign From | **UNPROVEN** | Dedicated Rabbi alias is registered as preferred phase 2, but mailbox/routing, provider acceptance, seed delivery, and reply-to-GHL readback are incomplete. | Keep inactive until all prerequisites pass. |
| `office` and `brand` | **CONFIRMED CURRENT TRUTH** | Existing office alias remains responsible for support, access, billing, administration, and neutral operational/program notices. | Do not replace with Rabbi identity for ordinary operations. |
| `account_security` | **CONFIRMED CURRENT TRUTH** | One Time/Resend only for activation, verification, login challenge, password setup/reset, and security-token mail. | Never send security tokens through GHL. |
| Migration 2227 application contract | **CONFIRMED CURRENT TRUTH** | Event-only permission, deny precedence, deterministic held outbox, and exact tag projection are in current application source. | Repository/application side is complete; provider handoff remains separate. |
| Post-2227 provider handoff | **UNPROVEN** | Provider transport remains disabled; exact immutable tag identities/readback and one exactly-once operator reprocess/tag/enrollment/confirmation proof are absent. | No manual tag, fallback send, duplicate enrollment, or broad replay. |

---

## 5. PR and result classification

### 5.1 PR #107

**Classification: SUPERSEDED/HISTORICAL, evidence only.**

Useful evidence:

- prior exhaustive visible HighLevel organization readback;
- prior OT-E01 saved/reopened configuration;
- historical bounded canary behavior;
- discovery that a fresh application signup failed to project the exact event tag/enrollment.

Superseded claim:

- its statement that OT-E01 was currently saved/reopened and accepted is superseded by the later readback showing the immediate action disabled and identity-unverified.

Permitted use:

- preserve historical canary and inventory evidence;
- compare historical accepted action intent to a future identity fingerprint;
- do not use PR #107 as current provider status or merge authority.

### 5.2 PR #115

**Classification: CONFIRMED CURRENT TRUTH as sanitized observation; evidence only as a branch.**

Current evidence incorporated by the Board:

- GHL-UI-14 through GHL-UI-18 remained empty Draft shells;
- no target workflow configuration mutation occurred;
- OT-E01 immediate confirmation was disabled;
- its settings drawer did not expose enough content to prove identity;
- no re-enable/save/publication/enrollment/message occurred;
- the same-name OT-C01 workflow wrapper was protectively paused and reopened as Draft;
- the canonical OT-C01 campaign was not changed.

Branch consequence:

- PR #115 is a result/evidence branch, not the canonical status map;
- its observed result is retained through the checkpoint Board/registry;
- do not merge generated status artifacts merely to make the branch canonical.

### 5.3 PR #116

**Classification: SUPERSEDED/HISTORICAL as an implementation branch; UNPROVEN as provider behavior.**

Exact branch boundary:

```text
base: 5556c4ab78e01d367666694459eb2ea97f4028ef
head: e0e86716608a31c3a2e1adc73d4c083f65ae1777
current checkpoint application source: a22009f4dce6bae6b0553ea9007ff40eceaffd25
```

It is substantially behind the current conductor/product source and predates migration 2227 convergence.

It also changes the old Agent Mode README to say “run these jobs in order” and appends jobs 14–18 to a generated ordered queue. The checkpoint repair explicitly replaces that model with:

- pointer-only Agent Mode;
- Board-selected exact job;
- no execution by filename order;
- no execution from a historical/generated queue.

### 5.4 Semantic integration decision for PR #116

**NEW FINDING: PR #116 must be re-authored on the current conductor source.**

Do not:

- merge PR #116;
- cherry-pick its queue/README/projection/result set;
- reuse its branch status assertions;
- treat its validators as proof that the live provider configuration exists;
- overwrite migration-2227 application contracts with pre-convergence assumptions.

May be salvaged manually after revalidation:

- message-copy concepts;
- action ordering concepts;
- suppression checks;
- protected CTA concepts;
- readback expectations;
- rollback language;
- bounded operator-canary design.

Required re-authoring base:

1. the current governed conductor descendant;
2. current application source `a22009f4dce6bae6b0553ea9007ff40eceaffd25`;
3. checkpoint control repair `e986b5e6502b1168b3eb28e200fd49ac8de46477`;
4. after explicit conductor adoption, the post-checkpoint sender packet commit `53a18e771488c61cf271cb33a0bcacee2c7135f4`.

Re-authoring must preserve the Board, migration 2227, current sender/message-class contracts, and pointer-only job selection.

---

## 6. Missing archived and hidden-AI inventory proof

**Classification: UNPROVEN.**

The accepted visible inventory covered the One Time root, nested workflow folders, visible deprecated/deleted surfaces, the separate Email Marketing campaign, visible Conversation AI, and visible knowledge bases. It did not prove that every archived, deleted, hidden, backend-only, or unassigned AI asset was exposed.

The next inventory must produce all of the following without mutation:

1. **Workflow coverage**
   - every Published/Active workflow;
   - every Draft workflow;
   - every Archived/Deleted workflow;
   - every asset under the deprecated folder;
   - exact normalized name, asset kind, full folder ancestry, status, and safe identity digest;
   - duplicate and near-duplicate matches across all states.

2. **Campaign coverage**
   - every Email Marketing campaign;
   - Draft/scheduled/sent status;
   - recipient-selection count only;
   - zero inference from workflow enrollment counters.

3. **Conversation AI coverage**
   - every visible active, inactive, Draft, archived, deleted, or legacy agent/bot;
   - channel assignment;
   - website/widget assignment;
   - WhatsApp assignment, if any;
   - exact safe identity digest and visible status;
   - explicit statement when the UI exposes no archived/hidden surface.

4. **Knowledge-base coverage**
   - every knowledge base;
   - canonical/legacy/unknown classification;
   - exact AI asset attachments;
   - unassigned knowledge bases;
   - safe content/version fingerprints, not raw private content.

5. **OT-A1 proof**
   - exactly one canonical provider asset or a fail-closed duplicate report;
   - exact prompt version/fingerprint;
   - exact attached canonical knowledge base;
   - provider state;
   - channel/widget assignment;
   - provider-off state.

6. **Scope limitation proof**
   - if HighLevel does not expose an archived/hidden/backend view, record the precise unavailable surface;
   - return `UNPROVEN_UI_SCOPE_UNAVAILABLE`;
   - do not claim exhaustive inventory;
   - do not compensate by creating, renaming, deleting, or deactivating an asset.

This inventory is a dependency for the website assistant and for any claim that OT-A1 or the canonical knowledge base is currently active in HighLevel.

---

## 7. OT-E01 disabled-action identity problem

**Classification: CONFIRMED CURRENT TRUTH for drift; UNPROVEN for exact action identity.**

The observed facts are sufficient to prohibit mutation:

- workflow is Published;
- immediate confirmation action is disabled;
- the action drawer opened;
- subject, sender, reply-to, body, and link controls did not render;
- the workflow remained saved with the action disabled after reload/reopen;
- no save, re-enable, republish, enrollment, or message occurred.

### 7.1 Required identity proof

A read-only identity job must compare the disabled action against the accepted historical configuration using safe fingerprints:

- canonical workflow key and exact folder ancestry;
- stable provider-side action reference represented only as a safe digest;
- action position/order and visible label;
- enabled/disabled state;
- message class;
- sender key;
- reply-to key;
- subject digest;
- normalized body digest;
- public-link custom-value keys;
- suppression/DND gate set;
- prior accepted source commit/checklist;
- version/history/export metadata, if exposed.

### 7.2 Stop condition

If the UI, version history, export, or another read-only provider surface cannot prove those fields, return:

```text
ACTION_IDENTITY_UNVERIFIED
```

Then:

- leave the action disabled;
- do not save the workflow;
- do not recreate an email action;
- do not infer identity from label or position alone;
- do not enroll a contact;
- do not reprocess the application row;
- do not send a test.

### 7.3 Later mutation boundary

Only after exact identity proof and application-handoff proof may a separately Board-assigned exact job consider:

- re-enabling the same action;
- saving the action layer;
- saving the outer workflow;
- navigating away;
- reopening by exact identity;
- reading back all critical values;
- running one separately authorized operator-owned canary.

This audit does not authorize that later mutation.

---

## 8. Application handoff after migration 2227

### 8.1 Repository/application state

**Classification: CONFIRMED CURRENT TRUTH.**

Migration 2227 establishes:

- application-authoritative event-service email permission;
- no inferred general-marketing consent;
- deterministic held HighLevel outbox intent;
- complaint, hard-bounce, suppression, DND, unsubscribe, withdrawal, cancellation, invalid identity, and missing-permission deny precedence;
- exact account/product/location/adult-contact scoping;
- exact two-tag projection intent;
- exact-row canary preparation only;
- no direct fallback delivery;
- no provider mutation from the implementation lane.

The checkpoint Board records this source as integrated into current application source `a22009f4...`.

### 8.2 Live handoff state

**Classification: UNPROVEN.**

Still missing:

- exact immutable provider identities for both event tags;
- exact current provider tag readback;
- exact current workflow enrollment readback;
- proof that one affected operator registration is the intended row;
- proof that it remains held/eligible under current permission and deny precedence;
- one exactly-once reprocess;
- one tag projection;
- one OT-E01 enrollment;
- one immediate confirmation;
- replay proof with no duplicate.

### 8.3 Safe proof order

1. Read the exact application permission/current row and restriction state.
2. Read the exact held outbox/delivery row and idempotency identity.
3. Confirm provider transports and canary budgets remain disabled/zero.
4. Read the exact GHL contact tag and OT-E01 enrollment state.
5. Prove OT-E01 disabled-action identity.
6. Reconcile any mismatch without mutation.
7. Only under separate authority, prepare one exact operator-row reprocess.
8. Execute once, then replay the same business event to prove no duplicate.
9. Read back tag, enrollment, confirmation, and application receipt.
10. Stop; do not expand to another contact.

### 8.4 Forbidden shortcuts

- manual tag application;
- manual workflow enrollment;
- duplicate registration;
- fallback email;
- broad replay;
- inferring permission from Tisha attendance, payment, portal status, deliverability, or legacy tags;
- treating a GHL field/tag as application authorization.

---

## 9. Rabbi sender and reply-routing prerequisites

### 9.1 Current sender boundary

**Classification: CONFIRMED CURRENT TRUTH.**

- `rabbi_campaign`: Rabbi-authored migration, warm enrollment, teaching, and launch communication.
- `rabbi_personal`: later Rabbi-authored Torah answers/follow-up.
- `office`: support, access, billing, cancellation, complaints, and Parent administration.
- `brand`: neutral program, class, content, receipt, and portal notices.
- `account_security`: One Time/Resend only for security-token and authentication lifecycle messages.

### 9.2 Preferred phase-2 Rabbi identity

**Classification: UNPROVEN.**

The preferred dedicated Rabbi From identity remains inactive pending all of:

1. mailbox or routing exists;
2. routing ownership is documented;
3. HighLevel accepts the From identity;
4. registered sender picker values are present and exact;
5. one operator-owned adult seed is separately authorized;
6. the seed is provider-delivered;
7. the visible From identity is correct;
8. a reply reaches the same governed GHL Conversations thread;
9. no parallel private inbox or duplicate customer transcript is created;
10. the result is sanitized and reconciled into Git;
11. phase-1 fallback remains available if any acceptance step fails.

### 9.3 GHL-UI-13 contradiction

**Classification: NEW FINDING.**

The existing `GHL-UI-13` job:

- forbids message sends;
- requires `messages_sent = 0`;
- says not to activate phase 2;
- can only record blockers or evidence from a separately authorized run.

Therefore it is a preflight/readback job, not the canary job requested by the July 26 packet.

Repository design must choose one of these clean models:

- retain `GHL-UI-13` as no-send preflight and add a reviewed successor for one seed/reply canary; or
- version `GHL-UI-13` into two explicit phases with separate authorities and result schemas.

The preferred model is the first: preserve the existing no-send job and add one successor. This avoids changing the meaning of a historical job ID.

### 9.4 Canary prerequisites and limits

The later canary must have:

- one exact operator-owned adult test contact/destination supplied outside Git;
- one message maximum;
- one reply maximum;
- no customer audience;
- no workflow publication;
- no production enrollment;
- no Student contact;
- no security-token content;
- no raw private destination in result evidence;
- exact pre-state and failure fallback;
- Board assignment and explicit operator authority.

Passing the canary proves sender acceptance only. It does not authorize OT-02A, OT-02B, OT-C01, OT-E01, or any customer send.

---

## 10. OT-02A versus OT-02B

### 10.1 Audience difference

| Dimension | OT-02A — Existing Subscriber Migration | OT-02B — New Lead Nurture |
|---|---|---|
| Classification | **CONFIRMED CURRENT TRUTH** | **CONFIRMED CURRENT TRUTH** |
| Message class | `existing_subscriber_migration` | `prelaunch_nurture` |
| Intended audience | Exact adults the operator identifies as prior One Time subscribers needing an operational migration sequence | Adults with independently proven general-marketing consent and clear suppression state |
| Relationship premise | Existing prior service relationship, but only for the exact selected segment | New/prospective lead relationship |
| Sequence | Three-email migration sequence | Nurture sequence; exact cadence/content not yet accepted |
| Entry | Registered existing-subscriber migration audience entry | Registered new-lead nurture audience entry |
| Exit | Activation, opt-out, or suppression | Checkout start, Active status, opt-out, or suppression |
| Forbidden inference | Historic attendance, payment, portal presence, deliverability, or legacy tag does not automatically place a person in the migration segment | Event registration, prior payment, portal presence, deliverability, or legacy tag does not create marketing consent |
| Current authority | Draft design only; no enrollment/publication/send | Draft design only; no enrollment/publication/send |

### 10.2 Copy difference

**Classification: NEW FINDING for the required separation; UNPROVEN for final exact copy.**

At the checkpoint, the prompt/checklist files define purpose, sender, suppression, and audience boundaries, but do not contain an accepted final new-program message body.

The post-checkpoint July 26 packet supplies a shared content brief, not final copy. The repository-design task must create separate canonical copy implementations:

#### OT-02A copy must

- identify the communication as an existing-subscriber migration/continuity notice;
- explain the new program/application and what the selected prior subscriber must do;
- avoid implying current payment, current access, recent attendance, or automatic eligibility;
- use operational/service permission appropriate to the exact selected segment;
- include migration-specific support and unsubscribe/suppression treatment;
- preserve three-email sequence semantics;
- not ask lead-qualification questions already handled elsewhere.

#### OT-02B copy must

- introduce the current program to a consented prospective lead;
- explain outcomes such as clarity, memory, consistency, and love of Mishnah;
- invite the lead to the current program/pilot page;
- avoid claiming an existing subscription or migration obligation;
- avoid unverified price, false urgency, or fabricated scarcity;
- use marketing-permission and unsubscribe treatment;
- stop when checkout begins, the person becomes Active, or suppression/opt-out applies.

### 10.3 Shared elements allowed

Both may use:

- the accepted `rabbi_campaign` voice after sender acceptance;
- the current main program/signup page;
- the same high-level program outcome;
- the same prohibition on raw provider links;
- the same sender registry;
- the same suppression precedence.

They may not share:

- an audience selector;
- an inferred consent rule;
- migration-specific claims;
- sequence state;
- enrollment authority;
- send approval.

Tisha registrants remain event-purpose only unless separate current permission exists.

---

## 11. Website-chat/public lead assistant dependencies

### 11.1 Existing contract

**Classification: CONFIRMED CURRENT TRUTH.**

The canonical repository direction is one public OT-A1 assistant, initially designed for Website Live Chat and WhatsApp, with voice deferred. It:

- serves adults only;
- may collect adult contact and consent fields;
- does not collect Student credentials or detailed child data;
- does not expose raw Zoom/Vimeo links, tokens, internal IDs, or payment-card data;
- does not pretend to be Rabbi Scheller;
- does not give Torah rulings;
- routes only explicit substantive Torah/Mishnah/halachic questions to the private Rabbi-authorship queue;
- leaves login, billing, support, scheduling, complaints, and ordinary enrollment operations with the normal operator/GHL lane;
- creates no automatic human-handoff task;
- does not proactively state price;
- uses only published price values when permitted.

The next requested canary is website-chat only. WhatsApp must not be implemented as a second bot or duplicate lead workflow.

### 11.2 Exact dependencies

Before repository design is accepted:

1. full-location workflow/campaign/AI/knowledge-base inventory is complete;
2. exactly one provider OT-A1 asset is proven or duplicates are reported;
3. canonical prompt fingerprint is proven;
4. canonical knowledge-base fingerprint and attachment are proven;
5. legacy/unknown knowledge-base disposition is decided;
6. hidden/backend AI scope is either proven or explicitly blocked;
7. the public landing/chat embed surface is stable and the placeholder helper is removed;
8. adult-only consent, source classification, dedupe, suppression, and DND contracts are exact;
9. no Student contact/field/tag path exists;
10. pricing values are dynamic and fail closed;
11. ordinary support and substantive Torah routing are distinct;
12. no promise of automatic human follow-up exists;
13. B01–B05 action contracts and HMAC signer dependencies are exact;
14. provider mode remains off;
15. one exact website-chat canary job is Board-assigned.

Before a browser canary:

1. one operator-owned adult synthetic/test identity is available outside Git;
2. contact matching/dedupe behavior is specified;
3. explicit channel consent is recorded;
4. no broad workflow is armed;
5. no customer audience is selected;
6. replay uses the same business identity and creates no duplicate contact or conversation;
7. opt-out/suppression wins before any later eligible communication;
8. no Student data enters GHL;
9. the assistant uses the canonical knowledge base only;
10. any substantive Torah question creates only the private Rabbi queue projection and no second customer transcript.

### 11.3 Current acceptance state

**Classification: UNPROVEN.**

A canonical Git prompt and knowledge base exist, but that is not enough to claim:

- provider-side OT-A1 exists in the intended state;
- the canonical knowledge base is attached;
- no legacy bot is also active;
- website widget assignment is correct;
- dedupe/suppression actions are configured;
- B01–B05 are safely callable;
- a website-chat canary passed.

---

## 12. Safest single-writer HighLevel queue

The requested order is retained. No evidence justifies moving a mutating task ahead of the full read-only inventory.

| Order | Task | Dependency | Owner / writer slot | Exact write scope | Stop condition | Required proof | Board assignment |
|---:|---|---|---|---|---|---|---|
| 1 | **Read-only full-location inventory** | Checkpoint and protected location context | One read-only GHL executor; Codex is the only later Git evidence writer | No provider writes. Inspect all workflow states, campaigns, Conversation AI, knowledge bases, folder ancestry, duplicates, and cross-kind collisions. Write only a sanitized result after readback. | Location mismatch; any action would mutate state; duplicate identity cannot be disambiguated; archived/hidden UI scope unavailable. | Exhaustive visible inventory, safe identity digests, coverage statement, unknowns, zero mutations. | **Yes** |
| 2 | **Repository-only sender/email contract** | Order 1 result; conductor adoption of post-checkpoint sender packet | Codex sole Git writer on current conductor descendant | Reconcile sender/message-class contracts, OT-02A/OT-02B prompt/checklist copy, preserve GHL-UI-13 preflight, add one reviewed successor canary job and schema, regenerate projections through scripts, add sanitized handoff. | Packet not adopted; audience/message class unresolved; mailbox/routing responsibility unresolved; diff would create duplicate registry/job/status model. | Reviewable diff, registry/projection/governance tests, no external effects, exact browser job. | **Yes** |
| 3 | **Operator-owned Rabbi sender canary** | Order 2 merged; mailbox/routing exists; exact operator authority | One GHL writer plus operator; no other browser writer | Sender acceptance surface only; at most one operator-owned seed and one reply readback; no customer audience/workflow enrollment. | From rejected; reply route ambiguous; suppression/DND uncertain; wrong thread; any customer contact selected; more than one message required. | Delivered seed, correct visible From, reply in the same GHL Conversations thread, phase-2 readback, phase-1 fallback preserved, sanitized result. | **Yes, separate canary authority** |
| 4 | **OT-E01 exact identity and application-handoff proof** | Order 1; migration 2227 current; Order 3 terminal result with sender fallback known | Read-only GHL executor plus read-only application inspector; Codex reconciles evidence | No mutation. Fingerprint disabled Email A; inspect exact permission/outbox row, exact tags, enrollment state, and one affected operator candidate. | Action identity cannot be proven; app row ambiguous; exact tag identity absent; permission denied; any manual repair would be required. | Action fingerprint, app/outbox state, provider tag/enrollment readback, exactly-one candidate, zero mutations. | **Yes** |
| 5 | **Non-Tisha workflow jobs, one at a time** | Order 4; each job repository-complete; each external contract deployed | One GHL writer; one exact job at a time; Codex reconciles after each result | One exact asset only. Configure/save/reopen/readback in Draft unless a separate authority explicitly permits more. No customer send or enrollment. | Duplicate/near-duplicate; missing exact copy/action; signer/portal/value dependency absent; readback mismatch; prior job not closed. | Exact identity/path, pre/post state, action-layer and outer-workflow readback, zero sends/enrollments, sanitized result. | **Yes, separately for every job** |
| 6 | **Website-chat assistant contract** | Orders 1, 2, and relevant Order 5 action contracts; stable landing chat surface | Codex sole Git writer | Reconcile OT-A1 prompt, canonical KB, legacy disposition, consent/dedupe/suppression, website widget job, B01–B05 dependencies, provider-off canary contract. | OT-A1 identity unproven; legacy/hidden AI unresolved; canonical KB attachment cannot be specified; duplicate bot/workflow required. | Reviewable diff, prompt/KB fingerprints, exact job, contract tests, zero external effects. | **Yes** |
| 7 | **Website-chat operator canary** | Order 6 merged; one exact operator-owned adult; provider-off configuration accepted | One GHL writer plus operator | One website-chat thread, one deduped adult lead/contact, consent/suppression proof, one replay, one opt-out path. No broad workflow/customer send. | Duplicate contact/conversation; Student data; wrong KB; unresolved suppression; provider attempts to arm broad automation. | One canonical conversation/contact, replay no duplicate, suppression precedence, no Student data, sanitized result. | **Yes, separate canary authority** |
| 8 | **Separately authorized customer enrollment/send** | Orders 1–7 accepted; exact audience snapshot; final copy; permission; rollback; operator approval | Operator and one GHL writer only | Only the exact separately approved asset, audience, count, schedule, and message revision. | Any audience/permission/copy/count mismatch; unresolved drift; nonzero unapproved recipients; rollback unavailable. | Immutable audience snapshot, exact approval, preflight, provider receipt, suppression reconciliation, post-send readback. | **Yes, new assignment and explicit approval** |

### 12.1 Internal order for non-Tisha work

Order 5 is not authority to run every file. The conductor should assign one exact job at a time. Recommended safety order:

1. suppression/opt-out contract (`OT-B05`) with no acknowledgement send;
2. password-help security boundary (`OT-B04`) with no GHL token;
3. member-login safe route (`OT-B03`);
4. next-confirmed-class safe route (`OT-B02`);
5. complete-signup action (`OT-B01`);
6. OT-01 lead intake;
7. OT-07 Parent invitation companion;
8. OT-08 Parent activated companion;
9. OT-09 class reminder;
10. OT-10 recording available;
11. OT-02A and OT-02B remain Draft until exact copy, audience predicates, and separate activation/send approvals exist.

Billing and paid-lifecycle workflows should remain preservation-only during the controlled free pilot unless their own product dependencies and Board assignments become current.

---

## 13. Proposed Board assignment prompt

```text
Assign task OT-LAUNCH-01-GHL-FULL-INVENTORY-02.

Classification: read-only evidence collection.
Repository boundary: shloimie-beep/onetimev2 at checkpoint
e986b5e6502b1168b3eb28e200fd49ac8de46477.
Provider boundary: the canonical protected One Time HighLevel location only.

Owner slots:
- Browser owner: one read-only HighLevel executor.
- Git writer: Codex only after the sanitized result is returned.
- Board writer: conductor only.

Dependency:
- CURRENT.yaml and the complete OT-LAUNCH-01 goal files.
- .agents/skills/one-time-ghl-ui-job/SKILL.md.
- workflow-registry.yaml and its generated projections.
- latest accepted sanitized results and PR #115 evidence.

Exact scope:
- Read every visible Published/Active, Draft, Archived, Deleted, and deprecated
  workflow surface.
- Read Email Marketing campaigns separately from workflows.
- Read every visible Conversation AI agent/bot, channel/widget assignment, and
  knowledge base.
- Prove full folder ancestry, asset kind, normalized name, visible status, safe
  identity digest, and duplicate/near-duplicate matches.
- Prove OT-C01 campaign and workflow-wrapper separation.
- Prove or explicitly fail to prove OT-A1, canonical KB, legacy KB, and
  archived/hidden AI coverage.
- Perform zero mutation, zero save, zero send, zero publication, zero
  enrollment, zero contact change, and zero deletion.

Stop immediately if:
- the visible location does not match the protected canonical location;
- any step requires mutation;
- a duplicate cannot be disambiguated;
- archived/hidden/backend surfaces are unavailable.

Required result:
- one sanitized JSON result with coverage, safe digests, unknowns, zeroed
  mutation counters, and readback timestamp;
- status must be UNPROVEN_UI_SCOPE_UNAVAILABLE rather than exhaustive when a
  required surface is not exposed;
- no protected provider ID, private destination, customer data, Student data,
  raw message body, or secret.

This assignment authorizes inventory only. It does not authorize cleanup,
configuration, sender acceptance, OT-E01 repair, a canary, enrollment, or send.
```

---

## 14. Repository-design Work prompt

```text
Task: OT-LAUNCH-01-GHL-RABBI-LAUNCH-EMAIL-DESIGN-REAUTHOR

Use repository shloimie-beep/onetimev2.

Evidence boundary:
- checkpoint e986b5e6502b1168b3eb28e200fd49ac8de46477;
- current application source a22009f4dce6bae6b0553ea9007ff40eceaffd25;
- post-checkpoint intake/design evidence
  53a18e771488c61cf271cb33a0bcacee2c7135f4, only after the conductor
  explicitly adopts it for this task.

Do not merge or cherry-pick PR #116. Re-author the required semantics on the
current conductor descendant.

Read completely:
- CURRENT.yaml and all OT-LAUNCH-01 goal files;
- the two July 26 sender intake/design files;
- .agents/skills/one-time-ghl-ui-job/SKILL.md;
- sender-registry.yaml;
- message-class-registry.yaml;
- communications-contract.json;
- workflow-registry.yaml;
- custom-values.yaml;
- prompt-registry.yaml;
- OT-02A and OT-02B prompt/checklist pairs;
- GHL-UI-13;
- the latest full-location inventory result.

Produce the smallest reviewable Git diff that:

1. Reuses rabbi_campaign, rabbi_personal, office, brand, and account_security.
2. Preserves the existing office-routed phase-1 sender until phase-2 acceptance.
3. Makes every dedicated Rabbi From/reply-routing prerequisite explicit.
4. Preserves GHL-UI-13 as a zero-send preflight/readback job.
5. Adds one reviewed successor job for exactly one operator-owned sender seed
   and one reply-to-GHL readback, with one-message maximum and no customer
   audience.
6. Writes separate canonical copy for:
   - OT-02A operational existing-subscriber migration;
   - OT-02B independently consented new-lead nurture.
7. Allows a shared program concept but never a shared audience predicate,
   consent inference, sequence state, or send authority.
8. Keeps Tisha registrants event-purpose only absent separate permission.
9. Keeps security-token mail in One Time/Resend only.
10. Creates no duplicate sender, message class, workflow, campaign, bot,
    knowledge base, queue, or status model.
11. Does not hand-edit generated projections; regenerate them through the
    canonical scripts.
12. Adds one sanitized handoff and the exact browser-executor prompt.

Stop if:
- the conductor has not adopted the post-checkpoint packet;
- the full AI/inventory result is incomplete in a way that changes sender or
  assistant identity;
- mailbox/routing ownership is unresolved;
- final copy cannot be assigned to one exact message class;
- any customer list, private destination, protected ID, or secret would enter
  Git.

Required validation:
- HighLevel registry validation;
- workflow-control projection sync/check;
- goal governance validation;
- focused tests for sender/message-class separation;
- secret scan;
- formatting and diff checks.

External effects must remain zero:
- no HighLevel access or mutation;
- no send;
- no contact enrollment;
- no customer/Student data;
- no Stripe/access/production mutation.
```

---

## 15. Read-only GHL Work prompt

```text
Task: OT-LAUNCH-01-GHL-FULL-INVENTORY-02
Mode: HighLevel read-only
Authority: inventory only

Open only the protected canonical One Time location and verify the visible
location before reading assets. Do not expose the provider identifier in the
result.

Read the current Board-assigned exact inventory contract and canonical registry.
Do not use the historical generated queue as authority.

Inspect separately:

A. Workflows
- Published/Active
- Draft
- Archived/Deleted
- deprecated folder
- all nested folders

B. Email Marketing
- campaigns, Draft/scheduled/sent state, selected-recipient count, send count

C. Conversation AI
- every visible active/inactive/Draft/archived/deleted/legacy agent
- channel/widget assignments
- knowledge-base assignments
- provider-off/on state

D. Knowledge bases
- every visible KB
- canonical, legacy, unknown, and unassigned status
- safe version/content digest
- attached AI assets

For every asset, return:
- canonical or unknown classification;
- asset kind;
- normalized visible name;
- full folder ancestry;
- visible status;
- safe identity digest, never the raw provider ID;
- duplicate/near-duplicate matches;
- readback timestamp.

Specifically prove or fail to prove:
- OT-C01 campaign and same-name workflow wrapper remain separate;
- OT-E01 current disabled-action state without opening a mutating save path;
- OT-A1 exact provider identity;
- canonical public KB attachment;
- legacy KB dependency;
- archived workflow coverage;
- hidden/backend Conversation AI coverage.

Do not:
- click Save;
- toggle a status;
- edit a prompt, KB, workflow, campaign, sender, field, tag, value, or pipeline;
- create, rename, move, archive, restore, delete, publish, enroll, or send;
- open customer or Student content beyond what is necessary to count and
  classify assets;
- return raw message bodies, private destinations, protected IDs, or secrets.

If a required archived/hidden/backend surface is unavailable, return
UNPROVEN_UI_SCOPE_UNAVAILABLE and identify the missing surface. Do not claim
exhaustive inventory.

Return one sanitized result conforming to the A04 result schema, with every
mutation and send counter equal to zero.
```

---

## 16. Exact-job GHL Work template

This is a template only. It is not executable until every bracketed field is resolved in a reviewed repository job and assigned by the Board.

```text
Job ID: [EXACT_JOB_ID]
Board task ID: [EXACT_BOARD_TASK_ID]
Repository checkpoint: [IMMUTABLE_COMMIT]
Canonical asset key: [EXACT_CANONICAL_KEY]
Asset kind: [workflow|campaign|conversation_ai|knowledge_base|sender]
Protected provider identity: supplied privately; return only safe digest
Full folder/UI path: [EXACT_PATH]
Desired terminal control state: [EXACT_STATE]

Dependency proof required before opening the edit surface:
- [DEPENDENCY_1]
- [DEPENDENCY_2]
- [DEPENDENCY_3]

Allowed operations:
- [EXACT_OPERATION_1]
- [EXACT_OPERATION_2]

Explicit authority:
- send authority: [none|one_operator_canary]
- maximum operator-canary messages: [0|1]
- customer send authority: none
- publication authority: [false unless separately assigned]
- production enrollment authority: false
- contact mutation authority: [exactly stated or false]
- Student contact/data authority: false
- destructive authority: false

Pre-state:
1. Verify the protected canonical location.
2. Match exact asset kind + canonical key + protected identity + full path.
3. Search all visible states for duplicates and near-duplicates.
4. Capture sanitized pre-state and safe identity digest.
5. Stop on zero matches, multiple matches, kind mismatch, path mismatch, or
   unresolved dependency.

Execution:
1. Perform only the listed operation.
2. Save the action/configuration layer when applicable.
3. Save the outer asset when applicable.
4. Navigate away.
5. Reload.
6. Reopen the exact asset by protected identity.
7. Read back every critical field.
8. Run a canary only when `send authority = one_operator_canary`, the exact
   operator-owned destination is supplied privately, and the Board assignment
   includes one-message authority.

Stop conditions:
- unexpected customer/audience count;
- suppression/DND ambiguity;
- Student data;
- raw provider link/token/secret;
- duplicate or identity drift;
- required field not rendered;
- readback mismatch;
- second message/enrollment/contact would be required;
- any operation outside the allowed list.

Rollback:
- For a read-only job: none required; no mutation permitted.
- For a configuration job: restore only the exact captured pre-state when the
  reviewed job explicitly authorizes that rollback.
- Never delete, recreate, or broad-disable as an improvised rollback.
- If rollback cannot be proven safe, stop and preserve the changed asset in the
  safest disabled/Draft state permitted by the reviewed job.

Return:
- one sanitized result conforming to the A04 schema;
- no raw provider IDs;
- no private destination;
- no customer/Student data;
- exact counters;
- readback evidence;
- blockers and next required Board decision.
```

---

## 17. Result JSON schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "one-time-a04-ghl-job-result-v1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "job_id",
    "board_task_id",
    "repository",
    "repository_checkpoint",
    "classification",
    "status",
    "location_match_verified",
    "scope",
    "assets",
    "coverage",
    "mutations",
    "safety_counters",
    "readback",
    "blockers",
    "next_action"
  ],
  "properties": {
    "schema_version": {
      "const": 1
    },
    "job_id": {
      "type": "string",
      "minLength": 1
    },
    "board_task_id": {
      "type": "string",
      "minLength": 1
    },
    "repository": {
      "const": "shloimie-beep/onetimev2"
    },
    "repository_checkpoint": {
      "type": "string",
      "pattern": "^[0-9a-f]{40}$"
    },
    "classification": {
      "enum": [
        "NEW_FINDING",
        "CONFIRMED_CURRENT_TRUTH",
        "SUPERSEDED_HISTORICAL",
        "UNPROVEN"
      ]
    },
    "status": {
      "enum": [
        "done",
        "already_satisfied",
        "blocked",
        "partial",
        "failed",
        "unproven_ui_scope_unavailable"
      ]
    },
    "location_match_verified": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "mode",
        "allowed_operations",
        "forbidden_operations",
        "send_authority",
        "max_operator_canary_messages"
      ],
      "properties": {
        "mode": {
          "enum": [
            "read_only",
            "repository_only",
            "configuration",
            "operator_canary"
          ]
        },
        "allowed_operations": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "forbidden_operations": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "send_authority": {
          "enum": [
            "none",
            "one_operator_canary"
          ]
        },
        "max_operator_canary_messages": {
          "type": "integer",
          "minimum": 0,
          "maximum": 1
        }
      }
    },
    "assets": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "canonical_key",
          "asset_kind",
          "normalized_name",
          "full_path",
          "safe_identity_digest",
          "visible_status",
          "exact_match_count",
          "duplicate_candidates",
          "observed_state"
        ],
        "properties": {
          "canonical_key": {
            "type": ["string", "null"]
          },
          "asset_kind": {
            "enum": [
              "workflow",
              "campaign",
              "conversation_ai",
              "knowledge_base",
              "sender",
              "custom_value",
              "unknown"
            ]
          },
          "normalized_name": {
            "type": "string"
          },
          "full_path": {
            "type": ["string", "null"]
          },
          "safe_identity_digest": {
            "type": "string",
            "minLength": 8
          },
          "visible_status": {
            "type": "string"
          },
          "exact_match_count": {
            "type": "integer",
            "minimum": 0
          },
          "duplicate_candidates": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "observed_state": {
            "type": "object"
          },
          "desired_state": {
            "type": ["string", "null"]
          },
          "drift": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      }
    },
    "coverage": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "published_active",
        "draft",
        "archived_deleted",
        "deprecated",
        "email_marketing",
        "conversation_ai",
        "knowledge_bases",
        "hidden_backend_scope"
      ],
      "properties": {
        "published_active": {
          "enum": ["complete", "incomplete", "unavailable"]
        },
        "draft": {
          "enum": ["complete", "incomplete", "unavailable"]
        },
        "archived_deleted": {
          "enum": ["complete", "incomplete", "unavailable"]
        },
        "deprecated": {
          "enum": ["complete", "incomplete", "unavailable"]
        },
        "email_marketing": {
          "enum": ["complete", "incomplete", "unavailable"]
        },
        "conversation_ai": {
          "enum": ["complete", "incomplete", "unavailable"]
        },
        "knowledge_bases": {
          "enum": ["complete", "incomplete", "unavailable"]
        },
        "hidden_backend_scope": {
          "enum": ["complete", "incomplete", "unavailable", "not_applicable"]
        }
      }
    },
    "mutations": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "asset_safe_digest",
          "operation",
          "pre_state",
          "post_state",
          "saved",
          "reopened",
          "readback_match"
        ],
        "properties": {
          "asset_safe_digest": {
            "type": "string"
          },
          "operation": {
            "type": "string"
          },
          "pre_state": {
            "type": "object"
          },
          "post_state": {
            "type": "object"
          },
          "saved": {
            "type": "boolean"
          },
          "reopened": {
            "type": "boolean"
          },
          "readback_match": {
            "type": "boolean"
          },
          "rollback_performed": {
            "type": "boolean"
          }
        }
      }
    },
    "safety_counters": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "customer_messages_sent",
        "operator_canary_messages_sent",
        "workflows_published",
        "production_contacts_enrolled",
        "contacts_created",
        "student_contacts_created",
        "stripe_mutations",
        "access_mutations",
        "destructive_actions"
      ],
      "properties": {
        "customer_messages_sent": {
          "const": 0
        },
        "operator_canary_messages_sent": {
          "type": "integer",
          "minimum": 0,
          "maximum": 1
        },
        "workflows_published": {
          "type": "integer",
          "minimum": 0
        },
        "production_contacts_enrolled": {
          "type": "integer",
          "minimum": 0
        },
        "contacts_created": {
          "type": "integer",
          "minimum": 0
        },
        "student_contacts_created": {
          "const": 0
        },
        "stripe_mutations": {
          "const": 0
        },
        "access_mutations": {
          "const": 0
        },
        "destructive_actions": {
          "const": 0
        }
      }
    },
    "readback": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "performed",
        "timestamp_utc",
        "same_asset_reopened",
        "result_safe_digest"
      ],
      "properties": {
        "performed": {
          "type": "boolean"
        },
        "timestamp_utc": {
          "type": "string",
          "format": "date-time"
        },
        "same_asset_reopened": {
          "type": "boolean"
        },
        "result_safe_digest": {
          "type": "string",
          "minLength": 8
        }
      }
    },
    "application_handoff": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "migration_2227_current": {
          "type": "boolean"
        },
        "permission_state": {
          "enum": ["eligible", "denied", "ambiguous", "not_inspected"]
        },
        "outbox_state": {
          "enum": [
            "held",
            "disabled",
            "eligible",
            "processed",
            "ambiguous",
            "not_inspected"
          ]
        },
        "provider_tag_readback": {
          "enum": ["present", "absent", "ambiguous", "not_inspected"]
        },
        "workflow_enrollment_readback": {
          "enum": ["present", "absent", "ambiguous", "not_inspected"]
        },
        "reprocess_performed": {
          "const": false
        }
      }
    },
    "blockers": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "code",
          "classification",
          "detail",
          "required_owner"
        ],
        "properties": {
          "code": {
            "type": "string"
          },
          "classification": {
            "enum": [
              "NEW_FINDING",
              "CONFIRMED_CURRENT_TRUTH",
              "SUPERSEDED_HISTORICAL",
              "UNPROVEN"
            ]
          },
          "detail": {
            "type": "string"
          },
          "required_owner": {
            "type": "string"
          }
        }
      }
    },
    "next_action": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "action",
        "dependency",
        "board_assignment_required",
        "customer_send_authorized"
      ],
      "properties": {
        "action": {
          "type": "string"
        },
        "dependency": {
          "type": "string"
        },
        "board_assignment_required": {
          "type": "boolean"
        },
        "customer_send_authorized": {
          "const": false
        }
      }
    }
  }
}
```

---

## 18. Rollback and stop matrix

| Condition | Classification | Immediate stop | Permitted rollback/preservation | Required next proof |
|---|---|---|---|---|
| Protected location mismatch | **UNPROVEN** | Stop before asset access or mutation. | None; close the session. | Correct protected location verification. |
| Zero or multiple exact asset matches | **UNPROVEN** | Stop; do not create or rename. | Preserve all candidates. | Full inventory and Board/operator identity decision. |
| Workflow/campaign cross-kind collision | **CONFIRMED CURRENT TRUTH** | Do not collapse, delete, or infer equivalence. | Preserve both asset kinds. | Exact kind-specific assignment. |
| Archived/hidden AI surface unavailable | **UNPROVEN** | Stop exhaustive-coverage claim. | No mutation. | Explicit unavailable-scope result or alternate approved read-only provider surface. |
| Generated projection disagrees with observed provider state | **CONFIRMED CURRENT TRUTH** | Do not “fix” provider or projection by guess. | Preserve disagreement. | Codex reconciliation against registry and sanitized observation. |
| PR branch conflicts with current pointer-only control model | **NEW FINDING** | Do not merge/cherry-pick wholesale. | Preserve branch as historical design evidence. | Re-authored current-source diff. |
| Rabbi mailbox/routing absent | **UNPROVEN** | Keep phase 2 inactive; no seed. | Preserve phase-1 sender. | Routing existence and ownership proof. |
| HighLevel rejects preferred Rabbi From | **UNPROVEN** | Stop canary. | Preserve phase-1 sender and office routing. | Provider acceptance proof after repository/operator decision. |
| Seed not delivered | **UNPROVEN** | No phase-2 activation; no retry outside exact job budget. | Preserve fallback sender; record failure safely. | Root-cause correction and a new separately authorized canary. |
| Reply does not reach same GHL conversation | **UNPROVEN** | Fail sender acceptance. | Preserve office/phase-1 route; do not create parallel customer transcript. | Same-thread reply-routing proof. |
| OT-E01 disabled action fields do not render | **CONFIRMED CURRENT TRUTH** | Leave disabled; no save/recreate. | Preserve current workflow state. | Safe identity fingerprint from read-only history/export/provider surface. |
| Migration-2227 exact tag identities absent | **UNPROVEN** | No reprocess, manual tag, or enrollment. | Keep outbox held/disabled. | Exact sanitized provider tag readback. |
| Application permission denied or ambiguous | **UNPROVEN** | No provider action. | Preserve denial/held state. | Current permission and restriction resolution. |
| More than one affected operator candidate | **UNPROVEN** | No reprocess. | Preserve all rows. | Exact operator selection and idempotency identity. |
| Duplicate/replay creates second effect | **NEW FINDING** | Stop the job/provider worker; no expansion. | Disable exact canary path if authorized; preserve evidence. | Idempotency repair and fresh separate approval. |
| Suppression, DND, complaint, bounce, or unsubscribe ambiguous | **UNPROVEN** | No send. | Preserve suppression/deny state. | Exact deny-precedence readback. |
| Student data/contact appears in GHL scope | **NEW FINDING** | Stop immediately; do not copy or expand the record. | Preserve evidence safely; no improvised deletion. | Privacy/Board remediation assignment. |
| Raw provider URL, token, secret, or private destination appears in evidence | **NEW FINDING** | Stop and redact result before commit. | Preserve only safe digest/status; rotate only through separate security authority if required. | Secret/privacy review. |
| Nonzero customer audience without exact authority | **UNPROVEN** | No seed, enrollment, schedule, or send. | Clear selection only when an exact reviewed rollback authorizes it; otherwise leave untouched and stop. | Immutable audience/permission snapshot plus operator approval. |
| Readback differs after save | **UNPROVEN** | Do not publish/test. | Restore exact captured pre-state only when explicitly authorized; otherwise leave safest disabled/Draft state. | Same-asset save/reopen/readback match. |
| Rollback cannot be proven safe | **UNPROVEN** | Stop further mutation. | Preserve safest disabled/Draft state permitted by the job. | Board/operator decision. |

---

## 19. Conclusion register

| ID | Classification | Conclusion |
|---|---|---|
| A04-F01 | **CONFIRMED CURRENT TRUTH** | Board and canonical registries, not generated queues or PR prose, control execution. |
| A04-F02 | **CONFIRMED CURRENT TRUTH** | OT-E01 is Published/DRIFTED with disabled immediate confirmation and unproven action identity. |
| A04-F03 | **CONFIRMED CURRENT TRUTH** | OT-C01 campaign and same-name workflow wrapper are separate assets; both remain non-sending. |
| A04-F04 | **UNPROVEN** | Archived workflow and hidden/backend AI inventory is incomplete. |
| A04-F05 | **UNPROVEN** | OT-A1 provider identity, state, channel assignment, and canonical KB binding are not accepted. |
| A04-F06 | **SUPERSEDED/HISTORICAL** | PR #107’s prior OT-E01 accepted-state assertion is not current. |
| A04-F07 | **CONFIRMED CURRENT TRUTH** | PR #115 is the latest accepted sanitized provider observation incorporated by the Board. |
| A04-F08 | **NEW FINDING** | PR #116 must be re-authored; direct integration would restore obsolete queue-order semantics and pre-2227 assumptions. |
| A04-F09 | **NEW FINDING** | The July 26 sender packet is post-checkpoint evidence at commit `53a18e...`, not checkpoint status. |
| A04-F10 | **NEW FINDING** | GHL-UI-13 cannot prove a sender seed because it requires zero sends; a separate successor canary job is required. |
| A04-F11 | **CONFIRMED CURRENT TRUTH** | Migration 2227 completes repository/application permission control but leaves the live provider handoff unproven. |
| A04-F12 | **CONFIRMED CURRENT TRUTH** | OT-02A and OT-02B have distinct audience and permission contracts. |
| A04-F13 | **UNPROVEN** | Final exact OT-02A/OT-02B launch copy is not accepted at the checkpoint. |
| A04-F14 | **NEW FINDING** | Website-chat acceptance depends on full AI/KB identity inventory and action-contract readiness, not prompt existence alone. |
| A04-F15 | **CONFIRMED CURRENT TRUTH** | No customer enrollment or send is authorized. |

---

## 20. Source list

### 20.1 Repository and commits

- `shloimie-beep/onetimev2`
- control checkpoint: `e986b5e6502b1168b3eb28e200fd49ac8de46477`
- current application source recorded by Board: `a22009f4dce6bae6b0553ea9007ff40eceaffd25`
- post-checkpoint Rabbi-sender packet commit: `53a18e771488c61cf271cb33a0bcacee2c7135f4`
- PR #107 head: `1e247c70004dffb6247fc1ee407f1153d753bd7d`
- PR #115 head: `06c14e9b59c5e7c963397fb961634fe711b00e0c`
- PR #116 base: `5556c4ab78e01d367666694459eb2ea97f4028ef`
- PR #116 head: `e0e86716608a31c3a2e1adc73d4c083f65ae1777`
- PR #122 head: `37b83461bb1fed8c0f795234e125b5270d5414c0`

### 20.2 Goal and governance

- `ops/goals/CURRENT.yaml`
- `ops/goals/OT-LAUNCH-01/GOAL.md`
- `ops/goals/OT-LAUNCH-01/SPEC.yaml`
- `ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml`
- `ops/goals/OT-LAUNCH-01/DECISIONS.yaml`
- `ops/goals/OT-LAUNCH-01/BOARD.yaml`
- `.agents/skills/one-time-ghl-ui-job/SKILL.md`
- `ops/goals/OT-LAUNCH-01/inputs/20260723T103247Z-live-pilot-launch.yaml`

### 20.3 HighLevel registries and projections

- `integrations/highlevel/registry/workflow-registry.yaml`
- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/custom-values.yaml`
- `integrations/highlevel/registry/prompt-registry.yaml`
- `integrations/highlevel/registry/current.json`
- `integrations/highlevel/workflows.yaml`
- `integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md`

### 20.4 Agent Mode

- `integrations/highlevel/agent-mode/README.md`
- `integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json`
- `integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json`
- `integrations/highlevel/agent-mode/jobs/GHL-UI-13-phase-2-rabbi-acceptance.json`
- `integrations/highlevel/agent-mode/jobs/GHL-UI-14-activate-ot-01.json`
- `integrations/highlevel/agent-mode/jobs/GHL-UI-15-activate-ot-07.json`
- `integrations/highlevel/agent-mode/jobs/GHL-UI-16-activate-ot-08.json`
- `integrations/highlevel/agent-mode/jobs/GHL-UI-17-activate-ot-09.json`
- `integrations/highlevel/agent-mode/jobs/GHL-UI-18-activate-ot-10.json`
- `integrations/highlevel/agent-mode/jobs/GHL-UI-19-activate-ot-b01.json`
- `integrations/highlevel/agent-mode/jobs/GHL-UI-20-activate-ot-b02.json`
- `integrations/highlevel/agent-mode/jobs/GHL-UI-21-activate-ot-b03.json`
- `integrations/highlevel/agent-mode/jobs/GHL-UI-22-activate-ot-b04.json`
- `integrations/highlevel/agent-mode/jobs/GHL-UI-23-activate-ot-b05.json`
- `integrations/highlevel/agent-mode/results/GHL-UI-14-18-20260723.result.json`

### 20.5 Public assistant, knowledge, and workflow copy

- `ops/product-decisions/2026-07-20-ghl-public-bot/DECISIONS.json`
- `ops/product-decisions/2026-07-20-ghl-public-bot/ORIGINAL-DIRECTION.md`
- `integrations/highlevel/prompts/active/OT-A1-v1.0.0.md`
- `integrations/highlevel/knowledge-bases/active/one-time-public-kb-v1.0.0.md`
- `integrations/highlevel/ai-workflow-prompts/OT-02A-existing-subscriber-migration-2026-v1.md`
- `integrations/highlevel/ai-workflow-prompts/OT-02B-new-lead-nurture-v1.md`
- `integrations/highlevel/workflow-checklists/OT-02A-existing-subscriber-migration-2026-v1.md`
- `integrations/highlevel/workflow-checklists/OT-02B-new-lead-nurture-v1.md`

### 20.6 Application handoff

- `ops/goals/OT-LAUNCH-01/handoffs/event-service-email-permission--OT-LAUNCH-01-EVENT-PERMISSION-CONVERGENCE.json`
- `packages/db/migrations/2227_event_service_email_permission_convergence.sql`
- PR #122 description and changed-file inventory

### 20.7 Post-checkpoint sender intake/design evidence

These are deliberately identified as post-checkpoint:

- commit `53a18e771488c61cf271cb33a0bcacee2c7135f4`
- `ops/goals/OT-LAUNCH-01/inputs/20260726T151818Z-rabbi-sender-and-git-prompt-flow.yaml`
- `ops/goals/OT-LAUNCH-01/handoffs/ghl-app-contract-shells--rabbi-launch-email-design.md`

---

## 21. CONTROL-TOWER-RETURN

```text
CONTROL-TOWER-RETURN
AUDIT_ID: A04
AUDIT_STATUS: COMPLETE_READ_ONLY
REPOSITORY: shloimie-beep/onetimev2
CONTROL_CHECKPOINT: e986b5e6502b1168b3eb28e200fd49ac8de46477
POST_CHECKPOINT_EVIDENCE_REVIEWED: 53a18e771488c61cf271cb33a0bcacee2c7135f4
CURRENT_GHL_CONTROL_STATE: DRIFTED_FAIL_CLOSED
PRIMARY_NEW_FINDING: PR116_MUST_BE_REAUTHORED_ON_CURRENT_CONDUCTOR_SOURCE
SECONDARY_NEW_FINDING: GHL_UI_13_ZERO_SEND_JOB_CANNOT_EXECUTE_SENDER_CANARY
ARCHIVED_HIDDEN_AI_INVENTORY: UNPROVEN
OT_E01_ACTION_IDENTITY: UNPROVEN_DISABLED
APPLICATION_2227_SOURCE: CONFIRMED_CURRENT
APPLICATION_TO_GHL_LIVE_HANDOFF: UNPROVEN
NEXT_BOARD_ASSIGNMENT: OT-LAUNCH-01-GHL-FULL-INVENTORY-02
GHL_MUTATIONS_PERFORMED_BY_AUDIT: 0
GIT_MUTATIONS_PERFORMED_BY_AUDIT: 0
CUSTOMER_SEND_AUTHORIZED: NO
CUSTOMER_ENROLLMENT_AUTHORIZED: NO
END_CONTROL-TOWER-RETURN
```
