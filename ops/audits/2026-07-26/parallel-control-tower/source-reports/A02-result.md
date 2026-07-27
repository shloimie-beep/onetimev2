# A02 — One Time controlled-production-pilot gap audit

**Audit ID:** A02  
**Audit date:** 2026-07-26  
**Repository:** `shloimie-beep/onetimev2`  
**Control checkpoint:** `e986b5e6502b1168b3eb28e200fd49ac8de46477`  
**Board-recorded accepted product source:** `a22009f4dce6bae6b0553ea9007ff40eceaffd25`  
**Intended commit path:** `ops/audits/2026-07-26/parallel-control-tower/A02-result.md`  
**Mode:** Read-only audit. No branch, file edit, deployment, form submission, authentication, login code, provider call, production mutation, or release branch was created by this audit.

## Executive decision

**[CONFIRMED CURRENT TRUTH]** `production_pilot` is unclaimed. The Board requires the normal-Student Zoom path and accepted staging canary before the semantic production-candidate task is queued.

**[NEW FINDING]** The public production home page still renders the exact placeholder experience that accepted staging removed: **“Offline readiness”** and **“The WhatsApp assistant is being connected.”** The current production release source also contains that helper, while accepted staging does not.

**[NEW FINDING]** A standalone landing hotfix is not the default recommendation. It would create another production-only delta and make the already-required semantic convergence harder. The placeholder must be an explicit production-candidate acceptance check. A separate hotfix requires an operator decision and a separately assigned narrow production job.

**[CONFIRMED CURRENT TRUTH]** Accepted staging is a coherent full-app source at `a22009f4dce6bae6b0553ea9007ff40eceaffd25`, with schema through `2227_event_service_email_permission_convergence`, accepted Admin/Parent/Student role journeys, protected synthetic playback, and provider-off defaults.

**[CONFIRMED CURRENT TRUTH]** The current Git production release line is PR #106, branch `release/tisha-bav-2026-live`, head `0d69de15e3c5e7a5e51f2b9262c992ea153c51fb`. It is a narrow Tisha B’Av line, not the accepted full application.

**[UNPROVEN]** The exact current production and staging bodies for `/version`, `/health`, and `/ready` were not independently read back during this audit. The public production root was read successfully; direct runtime endpoint bodies were not. Therefore old endpoint evidence is preserved as evidence, not promoted to a fresh current assertion.

**[CONFIRMED CURRENT TRUTH]** Zoom remains the release-order blocker. One disposable non-Tisha meeting still lacks proven provider deletion and a signed terminal deletion tombstone; normal Student/host control proof is not accepted.

**Audit outcome:** **PREPARATION ONLY — DO NOT RUN A PRODUCTION CANDIDATE OR PROMOTION YET.**

---

## Classification legend

| Classification | Meaning |
|---|---|
| **NEW FINDING** | A delta established by this audit that changes execution order, safety, assignment, architecture, or acceptance. |
| **CONFIRMED CURRENT TRUTH** | Supported by the canonical Board/checkpoint, current Git state, accepted test evidence, or a fresh public readback. |
| **SUPERSEDED/HISTORICAL** | Valid evidence for an earlier state, but not current authority or a current release target. |
| **UNPROVEN** | Plausible or previously claimed, but not established by acceptable current proof. |

---

## Audit boundaries and source-of-truth rules

**[CONFIRMED CURRENT TRUTH]** The status authority is:

1. `ops/goals/CURRENT.yaml`
2. the complete `OT-LAUNCH-01` goal files named by it
3. `ops/goals/OT-LAUNCH-01/BOARD.yaml` as the only mutable status map

**[CONFIRMED CURRENT TRUTH]** The accepted deployed product source is `a22009f4dce6bae6b0553ea9007ff40eceaffd25`. Later commits containing only Board, decision, generated projection, validation, or prompt-packet changes are control/evidence descendants, not product sources.

**[CONFIRMED CURRENT TRUTH]** PR #97 currently points at `53a18e771488c61cf271cb33a0bcacee2c7135f4`. Relative to the requested control checkpoint, that is one later repository-only Rabbi email design/control commit. It does not supersede `a22009f4dce6bae6b0553ea9007ff40eceaffd25` as the accepted product source.

**[SUPERSEDED/HISTORICAL]** The existing production-pilot handoff observed older heads (`5311c348...` production and `d236d398...` staging). Its semantic rules remain useful; its observed mutable heads do not.

---

# 1. Current production truth

| ID | Classification | Current production conclusion | Execution consequence |
|---|---|---|---|
| P-01 | **NEW FINDING** | The public home page still contains the offline/assistant-being-connected placeholder. | The production candidate must remove it and prove absence in desktop/mobile HTML and browser behavior. |
| P-02 | **CONFIRMED CURRENT TRUTH** | The current Git production release branch is `release/tisha-bav-2026-live` at `0d69de15e3c5e7a5e51f2b9262c992ea153c51fb` in open draft PR #106. | Use this line only as the production-behavior reference. Do not use it as the candidate base. |
| P-03 | **CONFIRMED CURRENT TRUTH** | Production has only the separately authorized narrow Tisha public/event lineage; the broader accepted Admin/Parent/Student/content/control-plane application has not been promoted. | A mechanical replacement or merge from the production branch is forbidden. |
| P-04 | **CONFIRMED CURRENT TRUTH** | Production and staging share `2220_tisha_bav_event_email_permission.sql` byte-for-byte in Git. | Preserve `2220`; the forward schema gap begins at `2221`. |
| P-05 | **UNPROVEN** | A previous read-only handoff recorded production `/version`, `/health`, and `/ready` as 200 with latest migration `2220_tisha_bav_event_email_permission`, but also recorded weak CLI-upload source attestation. | Before candidate work, obtain fresh public endpoint bodies and exact web/worker source attestation. |
| P-06 | **CONFIRMED CURRENT TRUTH** | The production release source defines the public Tisha landing, protected live route, event registration, event-scoped email permission, and public metadata. | Preserve the live Tisha behavior semantically; do not overwrite the accepted full-app source with the release branch. |
| P-07 | **CONFIRMED CURRENT TRUTH** | Broad production enrollment, broad messaging, live payment, real Zoom controls, and customer-provider activation are not authorized by `production_pilot`. | Promotion must retain provider-off and one-household scope. |
| P-08 | **SUPERSEDED/HISTORICAL** | Provider-state assertions in the PR #106 description are not current authority where they conflict with the later canonical Board. | Use the Board for GHL truth; use PR #106 for source lineage and narrow Tisha code only. |
| P-09 | **UNPROVEN** | The exact current live production web commit, worker commit, deployment artifacts, latest migration, and rollback artifact have not been freshly read back in this audit. | They are mandatory preconditions, not assumptions. |

### Public production page readback

**[NEW FINDING]** The public root currently exposes:

- `Offline readiness`
- `Questions about joining?`
- `The WhatsApp assistant is being connected. Sign up now and the team will follow up with class information.`

**[CONFIRMED CURRENT TRUTH]** The production release source renders the same helper and places it into the root landing output.

**[CONFIRMED CURRENT TRUTH]** Accepted staging source removes the helper entirely, places the campaign ticker before the main hero, uses the accepted hero hierarchy, and retains no fake connected-state fallback.

**[UNPROVEN]** A fresh direct public readback of the current `/tisha-bav` page and its response metadata was not obtained. The current release source defines:

- canonical path `/tisha-bav`;
- event-specific title and description;
- Open Graph title/description/image dimensions;
- favicon and Apple touch icon;
- `No charge`;
- `3:00 p.m. Eastern Time`;
- protected `/tisha-bav/live` as `noindex, nofollow`.

Those are source facts, not a fresh public-route acceptance result.

---

# 2. Current staging truth

| ID | Classification | Current staging conclusion | Execution consequence |
|---|---|---|---|
| S-01 | **CONFIRMED CURRENT TRUTH** | Board-accepted staging product source is exactly `a22009f4dce6bae6b0553ea9007ff40eceaffd25`. | This is the only valid candidate base named by this audit. |
| S-02 | **CONFIRMED CURRENT TRUTH** | Checkpoint evidence records exact web and worker source readback, `/version`, `/health`, `/ready`, and schema latest `2227_event_service_email_permission_convergence`. | Preserve this evidence; re-read it fresh before execution. |
| S-03 | **CONFIRMED CURRENT TRUTH** | Accepted staging includes the polished main landing, Launch Status, Admin IA, access projection, adult contact operations, Parent/Student portals, occurrence-scoped content, protected playback, Rabbi communications, GHL-held event permission/outbox, and Zoom provider-off code. | The production candidate must retain all these semantics. |
| S-04 | **CONFIRMED CURRENT TRUTH** | Accepted staging passed real Parent and three separate Student logins, sibling isolation, actual read-only Student shells, protected synthetic playback, restart persistence, and unpublish revocation without external provider effects. | Do not repeat the fictional three-sibling acceptance merely to create more evidence; production needs the smaller real one-household proof. |
| S-05 | **CONFIRMED CURRENT TRUTH** | HighLevel event/actions modes are disabled, budget is zero, run ID and allowlist are absent, real Zoom/canary gates are off, and content processing is synthetic. | These are the promotion defaults. |
| S-06 | **CONFIRMED CURRENT TRUTH** | Optional email/WhatsApp transport readiness being configured is not equivalent to HighLevel provider activation. | Treat account-security delivery as a bounded exception, not permission for campaign/event sends. |
| S-07 | **UNPROVEN** | The exact current public staging endpoint bodies were not freshly re-read during this audit. | Fresh readback is required before assignment or candidate execution. |
| S-08 | **CONFIRMED CURRENT TRUTH** | Current PR #97 head `53a18e771488c61cf271cb33a0bcacee2c7135f4` is a control/prompt descendant, not a newly accepted deployed product source. | Do not promote PR #97 head merely because it is newer. |

---

# 3. Exact semantic differences

| Area | Classification | Production release line | Accepted staging source | Candidate rule |
|---|---|---|---|---|
| Public home helper | **NEW FINDING** | Renders the WhatsApp helper, “Offline readiness,” and assistant-being-connected copy. | Helper absent. | Preserve staging; prove the placeholder absent. |
| Hero/ticker hierarchy | **CONFIRMED CURRENT TRUTH** | Old kicker + `Give your son...` H1; ticker rendered after the helper. | Ticker precedes the hero; accepted H1/supporting hierarchy. | Preserve staging. |
| Gallery/landing interaction | **CONFIRMED CURRENT TRUTH** | Older gallery controls and section order. | Accepted pause control, landing class, and revised section order. | Preserve staging unless an exact product decision says otherwise. |
| Launch control plane | **CONFIRMED CURRENT TRUTH** | Does not contain the accepted operator Launch Status projection and full accepted navigation composition. | Contains Launch Status and accepted five-area Admin IA. | Preserve staging. |
| Experience Preview | **CONFIRMED CURRENT TRUTH** | Lacks the accepted full Experience Preview route composition and detached read-only Student shells. | Accepted, capability-gated, production-rejecting preview. | Preserve code; keep preview production-disabled. |
| Access truth | **CONFIRMED CURRENT TRUTH** | Does not have the complete accepted `account_access_projections` / independent source-state model through `2225`. | Free-pilot, paid, complimentary, and administrative facts are separated from payment history. | Promote the accepted access model; do not infer access from historical payment. |
| Adult contact operations | **CONFIRMED CURRENT TRUTH** | Lacks the accepted adult-household contact operation and audit model. | Adult contact is durable; Students remain local and never become GHL contacts. | Preserve staging and provider-off sync. |
| Parent/Student portals | **CONFIRMED CURRENT TRUTH** | Older portal/application composition. | Accepted Parent five-category and Student six-category IA, sibling isolation, mobile behavior, and protected content. | Preserve staging. |
| Content factory | **CONFIRMED CURRENT TRUTH** | Does not include the complete accepted durable occurrence-scoped worker, storage, lease, retry, publish/unpublish, and constraint repairs through `2224`. | Accepted synthetic provider-off pipeline. | Promote code and migrations; keep external providers off. |
| Protected playback | **CONFIRMED CURRENT TRUTH** | Does not contain the full accepted occurrence-entitlement and content-factory playback path. | First-party authorized playback, captions, sibling denial, and immediate unpublish revocation. | Preserve staging and prove on a separate production device. |
| Rabbi communications | **CONFIRMED CURRENT TRUTH** | Lacks accepted `2226` Rabbi conversation/confirmation/outbox/task model. | Accepted synthetic/internal workflow with customer delivery disabled. | Promote schema/code; keep provider delivery disabled. |
| Zoom application code | **CONFIRMED CURRENT TRUTH** | Narrow production line does not represent the accepted normal-Student Zoom application path. | Normal-Student code gap is closed, but provider-off and canary unaccepted. | Do not activate in the production candidate. |
| GHL event permission | **CONFIRMED CURRENT TRUTH** | Has event email permission through `2220`. | Adds contact-scoped convergence, restriction precedence, and held outbox in `2227`. | Promote schema/code with provider dispatch held. |
| Tisha behavior | **CONFIRMED CURRENT TRUTH** | Contains the current narrow event/hotfix lineage. | Contains accepted event convergence alongside the full app. | Perform a semantic residual diff; never copy the branch wholesale. |
| Migration line | **NEW FINDING** | Shared through exact `2220`. | Adds `2221`–`2227`. | Forward-only promotion begins at `2221`. |
| Runtime source attestation | **CONFIRMED CURRENT TRUTH** | Historical production evidence warns that CLI-upload labels were not independent Git-backed attestation. | Accepted staging has exact Git source/readback evidence. | Candidate must produce one Git-attested web+worker source. |

---

# 4. Migration and data-risk matrix

## Inventory boundary

**[CONFIRMED CURRENT TRUTH]** The exact shared migration is:

- `2220_tisha_bav_event_email_permission.sql`
- identical Git blob on the current production release head and accepted staging source

**[NEW FINDING]** The production-candidate forward migration set is therefore exactly:

1. `2221_video_to_classroom_e2e.sql`
2. `2222_content_factory_provider_constraint.sql`
3. `2223_account_product_access_projection.sql`
4. `2224_content_factory_publish_ready_constraint.sql`
5. `2225_parent_student_contact_operations.sql`
6. `2226_rabbi_telegram_communications.sql`
7. `2227_event_service_email_permission_convergence.sql`

The audit did not regenerate the normalized migration-ledger SHA-256 values. Candidate proof must regenerate and compare every normalized checksum against the accepted source and the post-apply ledger. No migration may be renamed, reordered, edited, or replaced.

| Migration | Classification | Data/schema risk | Required proof before promotion | Rollback implication |
|---|---|---|---|---|
| Historical through `2220` | **CONFIRMED CURRENT TRUTH** | Existing production event registrations, event delivery rows, permission events/current state, and narrow Tisha data may exist. | Fresh production ledger readback; byte/checksum preservation; no replay. | Old data remains; no destructive rollback. |
| `2221_video_to_classroom_e2e` | **CONFIRMED CURRENT TRUTH** | Adds occurrence references, durable storage locators, idempotency, jobs, stage results, learner occurrence entitlements, and new provider constraints. Existing rows and FK compatibility must be checked. | Apply on a protected production restore clone; verify FK/orphan counts, job uniqueness, no provider calls, and synthetic worker readiness. | Schema remains after code rollback; old runtime compatibility must be tested. |
| `2222_content_factory_provider_constraint` | **CONFIRMED CURRENT TRUTH** | Repairs PostgreSQL 63-byte identifier truncation and potentially coexisting constraints. | PG18 catalog readback proving only the intended provider constraint remains. | Forward-only; old code must tolerate the repaired constraint. |
| `2223_account_product_access_projection` | **CONFIRMED CURRENT TRUTH** | Creates canonical access projections/events. It separates current access from billing history and requires explicit source facts. | Restore-clone apply; no duplicate prefix; explicit one-household free-pilot seed; no access inferred from old payment rows. | Rollback must revoke the pilot projection, not delete identities or payment history. |
| `2224_content_factory_publish_ready_constraint` | **CONFIRMED CURRENT TRUTH** | Replaces a stale publication check. Existing published rows could violate the new approved/provider-ID/captions contract. | Pre-apply violation query; apply on restore clone; prove accepted rows satisfy the final check. | Schema remains; rollback code must not require the removed raw-provider-URL contract. |
| `2225_parent_student_contact_operations` | **CONFIRMED CURRENT TRUTH** | Adds paused/complimentary/admin-suspension states, backfills source states, creates unique adult-household links, receipts, and audit events. Duplicate adults/households or ambiguous ownership can block apply or produce wrong projection. | Preflight uniqueness report; deterministic backfill counts; no Student provider rows; provider sync remains pending/off. | Keep durable identity/audit rows; revoke access instead of deleting them. |
| `2226_rabbi_telegram_communications` | **CONFIRMED CURRENT TRUTH** | Adds question revision state, encrypted/digested conversation references, action confirmations, reply outbox, and internal tasks. | Restore-clone apply; encryption/config readiness check; provider mode disabled; zero customer delivery. | Tables remain; old code must ignore safely. |
| `2227_event_service_email_permission_convergence` | **CONFIRMED CURRENT TRUTH** | Adds contact scope to event registrations/permissions, changes uniqueness semantics, and creates append-only/global restriction state. Existing duplicate emails, ambiguous adult identity, suppression, complaint, or bounce state can affect eligibility. | Pre-migration ambiguity/restriction report; apply on restore clone; exact contact-scoped uniqueness; held outbox; no GHL dispatch; post-apply registration/permission counts. | Old runtime must tolerate nullable contact scope and new uniqueness/indexes, or a compatibility rollback artifact is required. |

## Existing backup/restore evidence

| Evidence | Classification | Finding |
|---|---|---|
| Production PG18 backup/restore before the narrow Tisha release, at migration `2211` | **SUPERSEDED/HISTORICAL** | Useful proof that the tooling once worked; insufficient for the current production data state and the `2221`–`2227` upgrade. |
| Accepted staging PG16/PG18 assurance and restore at `a22009f4...` | **CONFIRMED CURRENT TRUTH** | Proves the accepted source can migrate and restore in staging/assurance environments; it is not a production-data restore proof. |
| Fresh production backup at the current exact pre-promotion state | **UNPROVEN** | Required. |
| Fresh protected restore clone of current production, then `2221`–`2227` apply | **UNPROVEN** | Required. |
| Current-runtime rollback artifact tested against schema `2227` | **UNPROVEN** | Required. |

## Required migration rehearsal sequence

1. **[UNPROVEN]** Read back exact production web/worker source and schema ledger.
2. **[UNPROVEN]** Create a fresh protected production backup without exposing raw data.
3. **[UNPROVEN]** Restore to an isolated clone.
4. **[UNPROVEN]** Run preflight queries for orphan FKs, duplicate adult/household links, published-content constraint violations, event identity ambiguity, and active global restrictions.
5. **[UNPROVEN]** Apply exact `2221`–`2227` bytes once.
6. **[UNPROVEN]** Verify migration IDs/checksums, constraints, indexes, row counts, and no external effects.
7. **[UNPROVEN]** Start the exact candidate web and worker against the upgraded clone with provider-off defaults.
8. **[UNPROVEN]** Start the exact rollback artifact against the same `2227` clone and prove health/readiness and safe feature degradation.
9. **[UNPROVEN]** Destroy the clone and retain only sanitized counts, hashes, source SHAs, and pass/fail evidence.

---

# 5. Provider-off defaults required for promotion

The promotion readback must prove the following names and values without printing protected values.

| Boundary | Required production-pilot default | Classification |
|---|---|---|
| HighLevel event sync | `HIGHLEVEL_EVENT_SYNC_MODE=disabled` | **CONFIRMED CURRENT TRUTH** |
| HighLevel actions | `HIGHLEVEL_ACTIONS_MODE=disabled` | **CONFIRMED CURRENT TRUTH** |
| HighLevel canary | `HIGHLEVEL_CANARY_BUDGET=0`; run ID and delivery-key allowlist absent | **CONFIRMED CURRENT TRUTH** |
| Event fallback delivery | `ONE_TIME_EVENT_EMAIL_FALLBACK=disabled` | **CONFIRMED CURRENT TRUTH** |
| Generic outbox | `OUTBOX_TRANSPORT_MODE=sink` | **CONFIRMED CURRENT TRUTH** |
| Delivery transport | `DELIVERY_TRANSPORT_MODE=sink`; `DELIVERY_PROVIDER_MODE=sink`; provider per-run/per-provider budgets `0` | **CONFIRMED CURRENT TRUTH** |
| Public WhatsApp | public autoreply disabled; canary unauthorized; no fake connected-state helper | **CONFIRMED CURRENT TRUTH** plus **NEW FINDING** for the live helper removal |
| Rabbi customer reply | `ONE_TIME_RABBI_GHL_REPLY_MODE=disabled` | **CONFIRMED CURRENT TRUTH** |
| Real Telegram transport | disabled | **CONFIRMED CURRENT TRUTH** |
| Content providers | `CONTENT_FACTORY_PROCESSING_MODE=synthetic`; external Vimeo/OpenAI canary disabled | **CONFIRMED CURRENT TRUTH** |
| Zoom classroom | `ZOOM_CLASSROOM_ENABLED=false`; provider mode `sink`; real provider false; canary false | **CONFIRMED CURRENT TRUTH** |
| Zoom protected values | SDK/S2S/origin/host/meeting/passcode values absent from the candidate environment | **CONFIRMED CURRENT TRUTH** |
| Fake Zoom path | fake adapter may remain enabled for provider-off UI acceptance | **CONFIRMED CURRENT TRUTH** |
| Payments | payment transport disabled; live charges not authorized; test checkout/portal/resource mutation disabled | **CONFIRMED CURRENT TRUTH** |
| Broad enrollment/messaging | zero | **CONFIRMED CURRENT TRUTH** |

### Bounded lifecycle-email exception

**[CONFIRMED CURRENT TRUTH]** Real Admin/Parent activation may require the existing account-security/lifecycle email path. That is a narrow security transport, not permission for campaign, nurture, event reminder, or general customer messaging.

The exception must be:

- restricted to the operator-owned Administrator and one operator-owned Parent adult;
- protected by an exact allowlist and bounded budget;
- excluded from Student destinations;
- excluded from GHL campaign/event workflows;
- recorded only as sanitized delivery success/failure;
- disabled or returned to its approved steady state after acceptance.

**[UNPROVEN]** The exact production lifecycle-email exception and allowlist have not yet been accepted for this candidate.

---

# 6. Exact rollback target and proof still required

## Provisional target

**[NEW FINDING]** The old narrow-release rollback target `ed77a04d...` is historical. It predates later Tisha repairs and is not the correct default rollback target for the full production-pilot promotion.

**[UNPROVEN]** The provisional rollback source is the current production release head:

`0d69de15e3c5e7a5e51f2b9262c992ea153c51fb`

It becomes the exact rollback target only when a fresh production `/version` and Railway source/artifact readback prove that the current web and worker correspond to that source or identify the actual current source.

## Required rollback package

The release task must retain, privately:

1. exact pre-promotion web artifact identity;
2. exact pre-promotion worker artifact identity;
3. exact source commit from fresh `/version`;
4. exact pre-promotion runtime configuration hash with secrets removed;
5. exact current migration ledger hash;
6. fresh production backup reference;
7. rollback command/runbook bound to the exact artifacts;
8. access-revocation procedure for the pilot household.

## Compatibility gate

**[UNPROVEN]** The provisional rollback runtime has not been proven compatible with schema through `2227`.

The candidate may not be promoted until one of these is true:

- the exact current production web and worker start and pass `/health` and `/ready` against the upgraded `2227` restore clone; or
- a minimal compatibility-only rollback artifact is created from the current production source, introduces no new product behavior, and passes the same test.

## Rollback trigger and stop behavior

Rollback immediately on any of the following:

- web/worker source mismatch;
- migration checksum or prefix mismatch;
- `/health` or `/ready` failure;
- worker heartbeat failure;
- unexpected provider mode;
- unexpected outbox delivery;
- broad enrollment/contact mutation;
- real-role scope leak;
- playback authorization leak or raw provider URL;
- unresolved data-migration count mismatch.

After runtime rollback:

- leave forward migrations in place;
- revoke/suspend only the pilot access projection;
- do not delete adult identity, Student identity, audit rows, event permission history, or payment history;
- keep providers off;
- record sanitized proof and stop.

---

# 7. Real Admin/Parent/Student activation and separate-device test plan

## Preconditions

All of the following must already be true:

1. Exact candidate commit and immutable web/worker artifacts are known.
2. Fresh production backup/restore and `2221`–`2227` rehearsal passed.
3. Exact rollback artifact passed against schema `2227`.
4. Provider-off readback passed.
5. Board assigned the production-promotion task.
6. Only one operator-owned adult household is authorized.
7. No Zoom production activation is included.
8. No Student is created in GHL or used as an email/WhatsApp destination.

## Device matrix

| Device | Actor | Session boundary | Required proof |
|---|---|---|---|
| Device A | Real operator Administrator | Normal production Admin session | Activation/login, Dashboard, Contacts, Classes, Content, Launch Status; no preview-only production controls. |
| Device B | One operator-owned Parent adult | Separate browser profile/device; no shared cookies | Parent-only household scope, correct categories, one learner, free-pilot state, no Admin controls. |
| Device C | One Student | Separate physical device/browser; separate credential | Student-only scope, no Parent/Admin shell, no sibling data, protected playback. |

Staging already proved three fictional siblings. The smallest production pilot does not need three real Students.

## Test sequence

1. **Administrator activation**
   - Complete the normal production account lifecycle through the approved security-email exception.
   - Verify no code, destination, token, or credential enters logs/screenshots/Git.
   - Verify Admin can reach the accepted five-area IA and Launch Status.
   - Verify Experience Preview and any isolated-staging-only route remain unavailable in production.

2. **Adult contact and household**
   - Create or select exactly one operator-owned adult contact.
   - Create/link exactly one household locally.
   - Keep provider sync pending/off; do not create or mutate a GHL contact in this proof.
   - Record only sanitized keys/counts.

3. **Explicit free-pilot access**
   - Apply one `free_pilot` access source with explicit start, expiry, revision, policy version, and opaque source reference.
   - Verify payment history remains untouched and is not used to infer access.
   - Verify no second household becomes active.

4. **Parent activation on Device B**
   - Activate/login through the approved lifecycle path.
   - Verify only the assigned household and learner are visible.
   - Verify Parent categories and no Admin controls.

5. **Student activation on Device C**
   - Use a separate Student credential and session.
   - Verify only that Student’s Today, Library, Class Helper, Progress, Questions, and Updates surfaces.
   - Verify no sibling, household-administration, billing-control, or Admin data.

6. **Approved playback**
   - Use candidate-local synthetic/provider-off content for one exact occurrence.
   - Approve/publish through Device A.
   - Open first-party protected playback on Device C.
   - Verify captions, authorization, no raw provider URL, and no unrelated content.

7. **Revocation**
   - Revoke or pause the exact pilot access projection.
   - Verify existing and fresh Student playback requests fail metadata-safely.
   - Verify Parent/Student access state reflects the revocation.
   - Do not delete identities or history.

8. **Final readback**
   - Re-read `/version`, `/health`, `/ready`, worker heartbeat, migration ledger, provider modes, outbox counts, active access count, and broad-enrollment count.
   - Confirm customer sends, GHL actions, Zoom calls, payment actions, and external content-provider calls equal zero.

## Required proof

- sanitized screenshots from all three devices;
- no secrets, private destinations, credentials, login codes, Student details, or provider identifiers;
- exact source and artifact hashes;
- exact route/status matrix;
- access projection and revocation counts;
- provider/outbox zero counts;
- no broad enrollment;
- rollback still available.

---

# 8. What must wait for Zoom

| Item | Classification | Why it must wait |
|---|---|---|
| Provider deletion of the existing disposable non-Tisha meeting and signed terminal tombstone | **CONFIRMED CURRENT TRUTH** | The current cleanup state is incomplete. |
| Any second Zoom meeting or provisioning retry | **CONFIRMED CURRENT TRUTH** | Explicitly forbidden until the preserved meeting is reconciled. |
| Normal Student/host join and bounded control canary in isolated staging | **UNPROVEN** | No accepted join/control proof exists. |
| Zoom SDK/S2S/origin/host/meeting values in persistent staging or production | **CONFIRMED CURRENT TRUTH** | Provider gates must remain off. |
| Production candidate branch execution | **CONFIRMED CURRENT TRUTH** | The Board’s current next action queues it only after the normal-Student Zoom path and staging canary are accepted. |
| Production promotion | **CONFIRMED CURRENT TRUTH** | It depends on the candidate and all release proofs. |
| Claim that the controlled-live-pilot milestone is complete | **CONFIRMED CURRENT TRUTH** | The milestone outcome includes one real Zoom class on separate devices. |
| Broad customer enrollment for live class access | **CONFIRMED CURRENT TRUTH** | The initial cohort remains one operator-owned free household and Zoom is not accepted. |

---

# 9. What may be prepared before Zoom

These are preservation/assignment activities only.

| Preparation | Classification | Allowed scope |
|---|---|---|
| Commit this audit report | **NEW FINDING** | Audit path only; conductor-owned commit. |
| Freeze exact source references `a22009f4...` and `0d69de15...` | **CONFIRMED CURRENT TRUTH** | No branch or code change. |
| Obtain fresh read-only public production/staging root and `/version`/`health`/`ready` readbacks | **UNPROVEN** | No authentication or mutation. |
| Prepare a three-way semantic diff manifest | **NEW FINDING** | Base `5ddd7b60...`, accepted staging `a22009f4...`, production reference `0d69de15...`; no candidate branch. |
| Prepare the provider-off variable-name/value manifest | **CONFIRMED CURRENT TRUTH** | Names and expected states only; no secret values. |
| Prepare the migration preflight query list and sanitized evidence schema | **NEW FINDING** | No production DB access yet. |
| Select the operator-owned Admin, Parent, Student, and three physical-device roles privately | **UNPROVEN** | No credentials or destinations in Git. |
| Prepare the candidate Codex prompt and promotion Work prompt | **NEW FINDING** | Both remain gated; promotion prompt is explicitly not runnable. |
| Request Board assignments for Zoom cleanup/canary, then candidate, then promotion | **CONFIRMED CURRENT TRUTH** | Assignment only; no execution implied. |

**[CONFIRMED CURRENT TRUTH]** Do not create a release branch, edit product files, deploy, authenticate, take a production backup, apply migrations, or invoke providers under this audit.

---

# Recommended task ledger

Every task below is separately scoped. No task inherits authority from this report.

## A02-T1 — Fresh runtime readback

- **Dependency:** canonical goal files; public production/staging URLs
- **Owner/writer slot:** read-only runtime auditor; no production writer; conductor only if committing sanitized evidence
- **Exact write scope:** one sanitized readback evidence file under the assigned audit/evidence path; no application, Board, registry, runtime, or provider changes
- **Stop condition:** exact current root metadata and `/version`, `/health`, `/ready` bodies for production and staging are captured, or the first inaccessible endpoint is recorded as unproven
- **Required proof:** UTC timestamp, HTTP status, sanitized response body, exact commit/source fields, latest migration, blockers, no form submission/authentication
- **Board assignment required:** **No** for read-only retrieval; **Yes** if a conductor commit changes current evidence/status

## A02-T2 — Zoom disposable cleanup tombstone

- **Dependency:** PR #105 exact cleanup head; preserved signed journal; exact one-shot provider authorization
- **Owner/writer slot:** sole Zoom provider writer; conductor owns any Board status update
- **Exact write scope:** provider-only reconciliation of the already-created disposable non-Tisha meeting; append-only signed cleanup journal/tombstone; no product code, persistent staging, production, protected event, or recurring meeting mutation
- **Stop condition:** one canonical absence readback and signed terminal deletion tombstone, or first guard mismatch before mutation
- **Required proof:** sanitized command result, canonical absence code, valid journal chain, protected meeting untouched, no second DELETE, no second meeting
- **Board assignment required:** **Yes**

## A02-T3 — Normal-Student Zoom staging canary

- **Dependency:** A02-T2 complete; normal-Student path code accepted; isolated staging config; exact operator authorization
- **Owner/writer slot:** sole Zoom provider writer plus persistent-staging conductor for readback; Board status only by conductor
- **Exact write scope:** one distinct disposable isolated meeting; one operator host; one test Student; bounded join/control/reset/replay/expiry/sibling proof; cleanup of only that meeting
- **Stop condition:** accepted controls plus terminal cleanup, or first identity/scope/provider mismatch
- **Required proof:** exact-source `/version`, host/Student joins, mute/request-unmute/spotlight/reset, replay/expiry/sibling denial, zero customer notifications, signed cleanup tombstone
- **Board assignment required:** **Yes**

## A02-T4 — Semantic production candidate

- **Dependency:** A02-T1 and A02-T3 accepted; Board assigns `production_pilot`; accepted source remains `a22009f4...`; exact current production source is read back
- **Owner/writer slot:** one Codex production-candidate writer; no provider or production writer
- **Exact write scope:** one new candidate branch from the accepted staging product source; semantic residual port of current production-only Tisha behavior; migrations preserved; tests/evidence/handoff only; no Board edit by the candidate writer
- **Stop condition:** one immutable candidate commit with clean tree and full required gates, or first unresolved semantic/migration conflict
- **Required proof:** release diff, exact migrations/checksums, Node/PG16/PG18, browser/mobile, provider-off, secret scan, source manifest, no external effects
- **Board assignment required:** **Yes**

## A02-T5 — Production restore/rollback rehearsal

- **Dependency:** A02-T4 immutable candidate; protected production read authority; exact provisional rollback artifacts
- **Owner/writer slot:** one protected database/release-proof writer; conductor owns status update
- **Exact write scope:** fresh production backup, isolated restore clone, apply `2221`–`2227`, candidate and rollback compatibility proof, sanitized evidence only; no production migration/deploy
- **Stop condition:** candidate and rollback both pass against the upgraded clone, or first migration/data/runtime mismatch
- **Required proof:** backup/restore success, pre/post counts, checksum ledger, constraint/index readback, provider zero, exact candidate/rollback health/readiness, clone destruction
- **Board assignment required:** **Yes**

## A02-T6 — Narrow production promotion

- **Dependency:** A02-T1 through A02-T5 accepted; exact Board promotion assignment; operator-owned cohort and devices ready
- **Owner/writer slot:** sole production Work executor; separate from general conductor and candidate writer
- **Exact write scope:** exact candidate web/worker promotion; exact forward migrations; one real Admin; one operator-owned Parent/Student free-pilot household; separate-device playback; no Zoom activation or broad provider/customer action
- **Stop condition:** complete `PROD-PILOT-001`, or first stop trigger followed by exact rollback
- **Required proof:** pre/post source, migrations, backup, rollback, provider-off readback, three-device journey, revocation, health/readiness, zero broad actions, sanitized handoff
- **Board assignment required:** **Yes**

No standalone landing hotfix task is recommended. If the operator chooses immediate removal before the full candidate, that requires a new operator decision and a separate Board-assigned narrow production track.

---

# 10. Smallest production-candidate Codex prompt

> **GATED — NOT RUNNABLE until A02-T3 is accepted and the Board assigns `production_pilot`.**

```text
TASK: OT-LAUNCH-01 production_pilot semantic candidate.
MODE: Repository-only. No deploy, provider call, production access, authentication,
form submission, backup, migration apply, customer message, or Board edit.

Read AGENTS.md, ops/goals/CURRENT.yaml, and the complete OT-LAUNCH-01 goal files.
Use:
- accepted candidate base:
  a22009f4dce6bae6b0553ea9007ff40eceaffd25
- production reference only after fresh /version confirms it:
  0d69de15e3c5e7a5e51f2b9262c992ea153c51fb
- merge-base reference:
  5ddd7b604c01744dd562050ae9b51124f7732594

Create one clean candidate branch from the accepted base. Do not merge or replace it
with the production branch. Perform a three-way semantic review and port only
production behavior still missing from the accepted source, especially the current
Tisha public/event fixes. Preserve the accepted main landing, including removal of
the Offline readiness / assistant-being-connected helper; preserve Launch Status,
Admin IA, access projection, adult contact operations, Parent/Student portals,
content factory, protected playback, Rabbi communications, GHL held-outbox
contracts, Zoom provider-off gates, and the canonical goal files.

Preserve every migration byte and prefix. The shared boundary is exact migration
2220; include exact accepted 2221 through 2227 without rename, rewrite, replay, or
reorder. Do not add a migration unless a proven candidate defect requires one and
the task stops for review first.

Set/test fail-closed defaults: HighLevel event/actions disabled, canary budget zero
and no run/allowlist; delivery sink; event fallback disabled; public WhatsApp
autoreply disabled; Rabbi customer reply disabled; content processing synthetic;
Zoom disabled/sink/real-provider false/canary false with protected values absent;
payments disabled; no broad enrollment or messaging.

Required gates on the exact candidate: release diff review, migration uniqueness and
normalized checksums, Node 24, typecheck, build, lint, scoped formatting, secret and
marker scans, PG16, learner-seat, PG18 assurance/restore, focused Tisha/event/GHL,
access/contact/portal/content/playback/Rabbi/Zoom-provider-off tests, desktop/mobile
browser journeys, and rollback-compatibility test scaffolding. Prove no external
effects.

Return one immutable commit, changed-file manifest, semantic-delta ledger,
migration ledger, provider-off manifest, exact test results, sanitized handoff for
the restore/rollback task, and STOP. Do not deploy.
```

---

# 11. Separate production-promotion Work prompt

> # NOT RUNNABLE
>
> Do not run this prompt until the Board records exact acceptance of A02-T1 through
> A02-T5, assigns the promotion task to one production writer, and names the exact
> candidate commit and rollback artifacts.

```text
TASK: OT-LAUNCH-01 controlled production-pilot promotion.
EXECUTOR: Sole Board-assigned production Work writer.
AUTHORITY: Only the exact Board assignment for this candidate. This prompt itself
grants no authority.

Before any mutation, read the canonical goal files and verify:
1. exact immutable candidate commit and clean source;
2. exact current production /version, web source, worker source, /health, /ready,
   worker heartbeat, and migration ledger;
3. fresh protected production backup and successful restore-clone proof;
4. exact 2221-2227 migration/checksum and data-preflight proof;
5. exact current-runtime rollback artifacts tested against schema 2227;
6. provider-off manifest;
7. Zoom cleanup and isolated normal-Student canary accepted, while production Zoom
   activation remains excluded;
8. one operator-owned Admin and one operator-owned Parent/Student household;
9. separate physical devices ready;
10. broad enrollment and messaging authority absent.

STOP before mutation if any item is missing, stale, mismatched, or inferred.

Promotion scope:
- deploy only the exact candidate web and worker artifacts;
- apply only exact forward migrations 2221 through 2227 once;
- keep HighLevel event/actions disabled, budget zero, run/allowlist absent;
- keep generic/event/customer delivery held or sink;
- keep public WhatsApp autoreply, real Telegram, Rabbi GHL reply, external content
  providers, Zoom real provider/canary, and payment actions off;
- permit only the separately approved bounded account-security lifecycle-email path;
- activate exactly one real operator Administrator;
- create/link exactly one operator-owned adult Parent household locally;
- create exactly one local Student identity, never a GHL contact or message
  destination;
- apply one explicit expiring free_pilot access projection;
- prove Parent on Device B and Student on Device C;
- approve/publish one synthetic provider-off occurrence item and prove first-party
  protected playback, captions, sibling/role isolation, and no raw provider URL;
- revoke/pause the exact pilot projection and prove metadata-safe denial;
- do not enable Zoom in production and do not broaden the cohort.

After each stage, read back exact source, migrations, health/readiness, worker,
provider modes, outbox counts, access counts, and broad-action counts. STOP on the
first mismatch. Roll back exact web/worker artifacts immediately, leave forward
migrations in place, revoke only pilot access, keep all providers off, and do not
delete identity, audit, event-permission, or payment history.

Success requires:
- exact candidate web/worker source;
- /health and /ready pass;
- latest migration 2227 with exact checksums;
- three-device role/playback/revocation proof;
- zero broad enrollment, customer messaging, GHL actions, Zoom calls, payment
  actions, or external content-provider calls;
- sanitized promotion/rollback handoff;
- conductor-owned Board update after independent readback.

Never print or commit secrets, private destinations, credentials, login codes,
customer/Student data, protected provider identifiers, or raw private content.
```

---

# 12. Final audit determination

**[NEW FINDING]** The live public root has regressed relative to accepted staging by retaining the offline/assistant-being-connected helper.

**[CONFIRMED CURRENT TRUTH]** This does not justify bypassing the Board’s Zoom-first dependency or creating an unassigned production branch.

**[CONFIRMED CURRENT TRUTH]** The correct architecture is a semantic candidate from `a22009f4...`, with current production Tisha behavior used only as a reference.

**[NEW FINDING]** Because `2220` is byte-identical on both lines, schema convergence is a precise forward set: `2221`–`2227`.

**[UNPROVEN]** No current production backup/restore, `2221`–`2227` production-data rehearsal, exact rollback artifact, or real production Admin/Parent/Student separate-device journey exists.

**[CONFIRMED CURRENT TRUTH]** Promotion is blocked until Zoom cleanup/canary, Board assignment, immutable candidate, restore/rollback proof, provider-off readback, and the narrow real-role plan are all accepted.

---

# Source list

## Canonical repository and commits

- Repository: `shloimie-beep/onetimev2`
- Control checkpoint: `e986b5e6502b1168b3eb28e200fd49ac8de46477`
- Accepted staging product source: `a22009f4dce6bae6b0553ea9007ff40eceaffd25`
- Current PR #97 control/prompt descendant observed: `53a18e771488c61cf271cb33a0bcacee2c7135f4`
- Current production release branch head observed in PR #106: `0d69de15e3c5e7a5e51f2b9262c992ea153c51fb`
- Common release-line merge-base reference: `5ddd7b604c01744dd562050ae9b51124f7732594`
- Zoom cleanup code-ready head: `2d22f46a40364c670d20fa197e78ead2a2f79c8e`

## Canonical goal/control files

- `ops/goals/CURRENT.yaml`
- `ops/goals/OT-LAUNCH-01/GOAL.md`
- `ops/goals/OT-LAUNCH-01/SPEC.yaml`
- `ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml`
- `ops/goals/OT-LAUNCH-01/BOARD.yaml`
- `ops/goals/OT-LAUNCH-01/DECISIONS.yaml`
- `ops/goals/OT-LAUNCH-01/handoffs/production-pilot--persistent-staging-conductor.json`

## Application and release sources

- `scripts/build-public-pages.ts` at production head and accepted staging source
- `apps/web/src/server/app.ts` at production head and accepted staging source
- `.env.example` at accepted staging source
- `ops/releases/TISHA-BAV-2026-LIVE.md`
- PR #97 — canonical conductor
- PR #106 — narrow Tisha production release line
- PR #111 — Tisha registration/delivery repair, merged into release line
- PR #112 — Tisha false-success/visual hotfix, merged into release line
- PR #105 — Zoom isolated real-control cleanup/canary line
- PR #122 — event-service email permission source lane, semantically integrated into accepted staging

## Migration sources

- `packages/db/migrations/2220_tisha_bav_event_email_permission.sql`
- `packages/db/migrations/2221_video_to_classroom_e2e.sql`
- `packages/db/migrations/2222_content_factory_provider_constraint.sql`
- `packages/db/migrations/2223_account_product_access_projection.sql`
- `packages/db/migrations/2224_content_factory_publish_ready_constraint.sql`
- `packages/db/migrations/2225_parent_student_contact_operations.sql`
- `packages/db/migrations/2226_rabbi_telegram_communications.sql`
- `packages/db/migrations/2227_event_service_email_permission_convergence.sql`

## Public read-only surfaces checked

- Production public root: `https://join.onetimeonetime.com/`
- Production route paths requested but not freshly proven: `/version`, `/health`, `/ready`, `/tisha-bav`
- Staging route paths requested but not freshly proven: root, `/version`, `/health`, `/ready`

```yaml
CONTROL-TOWER-RETURN:
  audit_id: A02
  result_path: ops/audits/2026-07-26/parallel-control-tower/A02-result.md
  repository: shloimie-beep/onetimev2
  control_checkpoint: e986b5e6502b1168b3eb28e200fd49ac8de46477
  accepted_product_source: a22009f4dce6bae6b0553ea9007ff40eceaffd25
  audit_mode: READ_ONLY
  audit_status: COMPLETE
  production_mutation_performed: false
  provider_action_performed: false
  authentication_performed: false
  form_submission_performed: false
  release_branch_created: false
  overall_gate: BLOCKED_PREPARATION_ONLY
  new_findings:
    - live_public_home_still_contains_offline_readiness_and_assistant_being_connected_placeholder
    - shared_migration_boundary_is_exact_2220_and_forward_gap_is_2221_through_2227
    - old_pre_tisha_rollback_target_is_historical_not_current_default
    - current_production_pilot_handoff_heads_are_stale_but_semantic_rules_remain_valid
  confirmed_current_truth:
    - production_pilot_is_unclaimed
    - accepted_staging_product_source_is_a22009f4dce6bae6b0553ea9007ff40eceaffd25
    - current_git_production_release_head_is_0d69de15e3c5e7a5e51f2b9262c992ea153c51fb
    - zoom_cleanup_tombstone_and_normal_student_canary_are_not_accepted
    - highlevel_zoom_payment_and_broad_customer_effects_must_remain_off
  unproven:
    - fresh_current_production_version_health_ready_and_worker_source
    - fresh_current_staging_version_health_ready
    - fresh_production_backup_and_restore_at_current_state
    - production_data_upgrade_rehearsal_2221_through_2227
    - rollback_artifact_compatibility_with_schema_2227
    - real_production_admin_parent_student_separate_device_playback
  superseded_or_historical:
    - old_production_pilot_handoff_observed_heads
    - pre_tisha_ed77_rollback_target
    - production_pg18_restore_proof_only_through_2211
    - provider_state_claims_in_pr_descriptions_where_they_conflict_with_board
  next_execution_order:
    - fresh_read_only_runtime_readback
    - zoom_disposable_cleanup_tombstone
    - normal_student_zoom_isolated_staging_canary_and_cleanup
    - board_assignment_for_semantic_candidate
    - immutable_candidate_from_accepted_staging_source
    - protected_production_restore_and_rollback_rehearsal
    - separate_board_assigned_narrow_production_promotion
  next_task_board_assignment_required: true
  production_candidate_prompt_runnable_now: false
  production_promotion_prompt_runnable_now: false
  stop_reason: zoom_and_release_proofs_not_complete
```
