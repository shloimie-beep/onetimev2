# A03 — Zoom cleanup and next-canary audit

**Commit target:** `ops/audits/2026-07-26/parallel-control-tower/A03-result.md`
**Repository:** `shloimie-beep/onetimev2`
**Control checkpoint:** `e986b5e6502b1168b3eb28e200fd49ac8de46477`
**Original canary execution head:** `96e54d9688ff174ac8265ce3b3a6216abb6292dc`
**Cleanup repair head:** `2d22f46a40364c670d20fa197e78ead2a2f79c8e`
**Zoom branch / PR:** `codex/zoom-real-control-activation` / draft PR `#105`
**Audit mode:** Read-only GitHub evidence review. No Zoom, Railway, browser, shell, provider, or repository mutation performed.
**Verdict:** **CLEANUP ONLY IS CURRENTLY AUTHORIZED. A NEW MEETING OR HOST/STUDENT CANARY IS NOT AUTHORIZED.**

`OT-LAUNCH-01` remains the canonical current One Time goal, and its current Board is still the sole status map. The Board blob on the current conductor branch is unchanged from the supplied control checkpoint.

The expected `A01-result.md` and `A02-result.md` files were not present at their contract paths on the canonical control branch when checked. Their parallel prompts were not treated as completed audit evidence. Cross-audit convergence is therefore classified **UNPROVEN**, not assumed.

---

## 1. Executive determination

### Current execution phase

**CONFIRMED CURRENT TRUTH —** One disposable, operator-owned, non-Tisha meeting exists. Its private signed schema-v3 journal is at:

```text
sequence: 4
phase: cleanup_required
failure_category: registration_outcome_ambiguous
registrants: []
registration_disabled_for_sdk_join: absent
```

The meeting has not been deleted; no sequence-6 tombstone exists; no host or Student join/control was completed. The original cleanup attempt made one OAuth request and one meeting GET, then stopped before any POST, PATCH, or DELETE because Zoom’s readback normalization did not match the original exact-scope cleanup logic.

### Current allowed provider action

**CONFIRMED CURRENT TRUTH —** The only permitted live continuation is the repaired reconciliation command:

```bash
npm run zoom:real-control:disposable:reconcile-cleanup
```

It may operate only on the meeting identifier already sealed inside the current signed journal. It may not select another meeting, provision, register, patch, join, control, invite, or create anything.

### New-canary authority

**CONFIRMED CURRENT TRUTH —** Deleting this meeting does not regenerate the consumed creation authority. The governing decision authorized **exactly one** new disposable meeting, and that one meeting was already created. A later host/Student canary requires both:

1. a newly reviewed successor job assigned by the Board; and
2. fresh, explicit, bounded operator/provider authority.

The Board states that only after cleanup may another bounded canary be **proposed**. Healthy code, a deleted old meeting, or an available Zoom app does not itself authorize that canary.

---

## 2. Classified findings

| ID     | Classification              | Conclusion                                                                                                                                                                                                                                        | Execution effect                                                                                                                                                                                                   |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A03-N1 | **NEW FINDING**             | The later canary has a source-convergence prerequisite. The accepted normal fictional-Student route is on the converged PR #97/product line, while the cleanup repair is an isolated PR #105 source. Git ancestry comparison returned `diverged`. | A successor job must designate a new immutable source containing the accepted normal Student route and an appropriate canary lifecycle. It must not merely restart PR #105 or mechanically merge its stale branch. |
| A03-N2 | **NEW FINDING**             | The repair at `2d22f46...` is a one-time reconciliation for the old sequence-4 journal. It does **not** make the generic future-canary cleanup path normalization-safe.                                                                           | No second meeting should be created until a successor design prospectively handles Zoom’s documented start-time and notification normalization and defines journal semantics for pre-cleanup absence.              |
| A03-N3 | **NEW FINDING**             | Exact provider-call counts can be derived for each permitted starting phase and should be made an acceptance condition.                                                                                                                           | The cleanup and post-cleanup audit prompts below bind acceptance to exact call counts, not merely “provider counts were shown.”                                                                                    |
| A03-C1 | **CONFIRMED CURRENT TRUTH** | The existing journal-bound disposable meeting is the only allowed Zoom target.                                                                                                                                                                    | Any other target, including Tisha, recurring Rabbi, customer, or arbitrarily selected meeting, is forbidden.                                                                                                       |
| A03-C2 | **CONFIRMED CURRENT TRUTH** | Cleanup reconciliation is the only permitted provider operation.                                                                                                                                                                                  | No provisioning, registration, patch, join, control, origin expansion, customer notification, or persistent/production activation.                                                                                 |
| A03-C3 | **CONFIRMED CURRENT TRUTH** | The exact journal progression is `1 create_intent → 2 meeting_created → 3 registration_in_flight → 4 cleanup_required → 5 cleanup_delete_in_flight → 6 deleted`.                                                                                  | Sequence 5 must be durably appended before DELETE. Sequence 6 requires canonical absence.                                                                                                                          |
| A03-C4 | **CONFIRMED CURRENT TRUTH** | Only a meeting-resource HTTP 404 with Zoom code `3001` proves absence.                                                                                                                                                                            | OAuth 404, generic 404, timeout, provider ambiguity, and “not visible in UI” are not deletion proof.                                                                                                               |
| A03-C5 | **CONFIRMED CURRENT TRUTH** | SDK and S2S acceptance remain false after cleanup.                                                                                                                                                                                                | The tracks remain `provider_off` until an independently authorized human-cleared Student consent/join and host-control canary passes.                                                                              |
| A03-H1 | **SUPERSEDED/HISTORICAL**   | `ZOOM-CLASSROOM-HANDOFF.md`, the class-link rotation runbook’s old activation flow, `ZOOM-UI-01.md`, the provisioning command, and the generic cleanup command are not current authority for this meeting.                                        | Current execution must use the updated PR body, reconciliation section, and repaired command only.                                                                                                                 |
| A03-H2 | **SUPERSEDED/HISTORICAL**   | The old exactly-one-meeting creation decision remains evidence of why the existing meeting was allowed, but is consumed for provisioning purposes.                                                                                                | It cannot be reused after deletion.                                                                                                                                                                                |
| A03-U1 | **UNPROVEN**                | Live DELETE, canonical provider absence, sequence-6 tombstone, and canary-infrastructure removal have not occurred.                                                                                                                               | Cleanup remains the immediate next action.                                                                                                                                                                         |
| A03-U2 | **UNPROVEN**                | No reviewed successor-canary job, immutable successor source, prospective cleanup contract, or fresh authority exists.                                                                                                                            | The later Work prompt is explicitly not runnable.                                                                                                                                                                  |
| A03-U3 | **UNPROVEN**                | No committed A01/A02 result was found at the required paths.                                                                                                                                                                                      | This report does not claim cross-audit agreement.                                                                                                                                                                  |

### A03-N1 — Source convergence is required before another canary

The Board records the normal Student route fix at product checkpoint `4d484c167ab332a6f82b97c7fc4f758c58bb391b`, while the current cleanup repair remains PR #105 head `2d22f46a40364c670d20fa197e78ead2a2f79c8e`. The former closes the prior diagnostic-harness gap; the latter repairs cleanup of the already-created meeting.

The canary contract present on the control checkpoint remains explicitly PR-#105-bound in its origin, attestation, purpose, and topic prefix.

Therefore, a later canary intended to prove the **normal Student experience** needs a reviewed successor source. Running another isolated PR #105 meeting would not, by itself, prove the accepted normal Student path.

### A03-N2 — The current repair cannot be reused as a future cleanup contract

The repaired reconciliation is expressly limited to the existing journal created at original head `96e54d...`, exact sequence 4, exact failure category, and exact meeting. It cannot create or select another meeting.

The generic cleanup still calls `deleteExactMeeting`, whose ordinary scope requires exact start-time equality and all three notification flags to read explicitly false. That is the same strict model that failed against the existing provider-normalized meeting.

The generic path also treats an already-absent meeting as success before invoking its journal-before-delete callback, allowing a direct transition to `deleted`. The repaired path instead rejects unexpected pre-delete absence and requires the repair-bound sequence-5/sequence-6 chain.

That does not prove the generic behavior is inherently wrong for every future design. It proves it is **not equivalent** to the repaired safety contract and must be reviewed before a second meeting is authorized.

### A03-N3 — Exact provider-count acceptance

For the currently recorded sequence-4 start, the successful path is deterministically:

```text
OAuth token request: 1
meeting GET:         2
meeting DELETE:      1
meeting POST:        0
meeting PATCH:       0
```

The first GET validates scope, DELETE removes the exact journal target, and the second GET proves canonical absence. The access token is cached within the command process.

The two other permitted terminal-resumption cases are:

| Starting signed phase                  | Expected provider counts                    |
| -------------------------------------- | ------------------------------------------- |
| Sequence 5, `cleanup_delete_in_flight` | `oauth=1, get=1, post=0, patch=0, delete=0` |
| Sequence 6, `deleted`                  | `oauth=0, get=0, post=0, patch=0, delete=0` |

A sequence-5 rerun performs absence verification only and cannot issue a second DELETE. A completed sequence-6 tombstone returns without loading provider context.

---

## 3. Direct answers to the required questions

| Question                                                          | Determination                                                                                                                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the existing disposable meeting still the only allowed target? | **Yes.** The target must come from the signed journal. There is no arbitrary meeting selector.                                                                                        |
| Is cleanup the only permitted provider action?                    | **Yes.** OAuth, exact-target GET, at most one exact-target DELETE, and exact-target absence GET are the entire permitted provider graph.                                              |
| What signed journal must exist?                                   | Exact schema-v3 HMAC chain ending at sequence 4 `cleanup_required`, failure `registration_outcome_ambiguous`, zero registrants, no registration-disabled marker.                      |
| What must be written before DELETE?                               | Sequence 5, `cleanup_delete_in_flight`, carrying the exact repair head and chained to sequence 4. The append must complete before DELETE starts.                                      |
| What provider response proves absence?                            | A meeting-resource GET for the signed target returning HTTP 404 with Zoom response code `3001`.                                                                                       |
| What tombstone must be written?                                   | Signed private sequence 6, `deleted`, repair-head-bound, with `deleted_at`, empty registrants, and no meeting ID, passcode, registration state, or failure category.                  |
| When may the runner and volume be removed?                        | Only after sanitized deleted output, successful signed sequence-6 readback, canonical 3001 absence, accepted provider counts, and a zero-provider-call idempotent tombstone readback. |
| What remains forbidden after cleanup?                             | A new meeting, new provisioning operation, host/Student join or control under the old job, Tisha/recurring/customer access, and persistent-staging or production activation.          |
| Does a new host/Student canary need new authority?                | **Yes. It needs a new reviewed successor job, Board assignment, immutable source, and fresh explicit operator/provider authority.**                                                   |

The acceptance contract itself keeps `ZOOM_REAL_CONTROL` false until a human-cleared exact Student consent/join canary and scoped host-control proof pass. Cleanup is not that proof.

---

## 4. Exact pre-DELETE gate

### 4.1 Source binding

**CONFIRMED CURRENT TRUTH —** All of the following must match simultaneously:

```text
journal execution_head:
  96e54d9688ff174ac8265ce3b3a6216abb6292dc

ZOOM_REAL_CONTROL_EXPECTED_SOURCE_SHA:
  96e54d9688ff174ac8265ce3b3a6216abb6292dc

ZOOM_DISPOSABLE_CANARY_REPAIR_EXPECTED_SOURCE_SHA:
  2d22f46a40364c670d20fa197e78ead2a2f79c8e

RAILWAY_GIT_COMMIT_SHA:
  2d22f46a40364c670d20fa197e78ead2a2f79c8e
```

The repair head must be a full SHA, must differ from the original execution head, and must equal the deployed Railway source. The public version label remaining pinned to the original execution head is expected; deployment metadata, not that public label, is authoritative for the repair source.

### 4.2 Runtime and isolation gates

The runner must retain:

```text
ONE_TIME_RUNTIME_ENVIRONMENT=isolated_staging
ZOOM_CLASSROOM_ENABLED=true
ZOOM_CLASSROOM_PROVIDER_MODE=sink
ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=false
ZOOM_CLASSROOM_CANARY_ENABLED=false
ZOOM_CLASSROOM_CANARY_LEARNER_KEY=full_app_preview_student_1
```

`PUBLIC_BASE_URL`, `ZOOM_MEETING_SDK_ALLOWED_ORIGIN`, and every journal record must equal the exact `ZOOM_DISPOSABLE_CANARY_ORIGIN` constant. The keyholder and state file must be absolute, private, outside Git, and the state path must be inside the One Time keyholder directory. No BNA keyholder may be bound.

These protected-target inputs must be absent:

```text
ONE_TIME_PROTECTED_CLASS_TARGET_URL
ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL
ZOOM_REAL_CONTROL_MEETING_ID
ZOOM_REAL_CONTROL_MEETING_PASSCODE
```

The exact meeting must come only from the signed journal.

### 4.3 Authorization gates

The exact non-secret control assertions are:

```text
ZOOM_DISTINCT_DISPOSABLE_ISOLATED_CANARY_ATTESTATION=
  CREATE_ONE_DISTINCT_PR105_MEETING_TISHA_UNTOUCHED_DELETE_AFTER_PROOF

ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION=
  DELETE_ONE_CREATED_PR105_DISPOSABLE_MEETING_ONCE

ZOOM_DISPOSABLE_CANARY_RECONCILIATION_AUTHORIZATION=
  RECONCILE_DELETE_ONE_EXISTING_PR105_96E54D_MEETING_ONCE
```

`ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION` must be absent. Wrong, missing, drifted, or generic authorization values fail before provider context.

### 4.4 Journal and HMAC gates

The journal must satisfy all of the following:

* Schema version `3`.
* Complete newline-delimited records; an incomplete final record is invalid.
* HMAC-SHA256 over canonical JSON using a state secret of at least 32 characters.
* Constant-time MAC comparison.
* Contiguous sequence numbers starting at 1.
* Each record’s `previous_state_mac` equals the prior record’s MAC.
* The operation ID, execution head, and origin are unchanged through the chain.
* The environment operation ID exactly matches the private journal operation ID.
* The exact operation-bound topic is reproduced from the operation ID and signed start time.
* No unknown fields or forbidden raw provider material.
* Current state is exactly sequence 4, `cleanup_required`, `registration_outcome_ambiguous`, zero registrants, and no `registration_disabled_for_sdk_join`.

### 4.5 Provider identity gate

The pre-delete meeting GET must match the signed journal on:

* exact meeting identifier;
* meeting type `2`;
* exact protected host identity;
* exact operation-bound topic;
* fixed isolated-canary agenda;
* duration `60`;
* `join_before_host=false`;
* no alternative host;
* original deterministic creation source.

The report and Work return must never print the meeting identifier, host identifier, topic, passcode, operation ID, or protected paths.

### 4.6 Time normalization gate

The provider’s parsed start time may differ from the signed requested time by an absolute maximum of **60 seconds**, inclusive.

The following fail:

* 61 seconds or more;
* invalid/unparseable start time;
* missing start time;
* any attempt to broaden the tolerance.

Tests accept a 45-second normalization and reject a 61-second or malformed value.

### 4.7 Notification gate

Both registrant notification fields must be explicitly boolean `false`:

```text
registrants_confirmation_email=false
registrants_email_notification=false
```

General `email_notification` must be:

* explicitly `false`; or
* omitted only when there is no alternative host and the journal proves the exact original deterministic creation head.

The following fail before journal transition and DELETE:

* either registrant flag missing;
* either registrant flag true;
* `email_notification=true`;
* an unknown non-boolean value;
* omitted general notification with an alternative host;
* a non-empty alternative host;
* `join_before_host` anything other than false.

### 4.8 Journal-before-DELETE gate

Only after all preceding gates pass may the command append:

```text
sequence: 5
phase: cleanup_delete_in_flight
reconciliation_repair_head:
  2d22f46a40364c670d20fa197e78ead2a2f79c8e
previous_state_mac: <sequence-4 MAC>
state_mac: <new valid HMAC>
```

If the append or fsync fails, DELETE must not run. The focused test explicitly proves zero DELETE calls when the pre-delete journal append fails.

---

## 5. DELETE, absence proof, and tombstone

### Successful sequence-4 path

```text
1. Validate preflight and signed sequence-4 journal.
2. OAuth.
3. GET the exact signed meeting.
4. Validate identity, time, notifications, source, operation, and origin.
5. Append signed sequence 5: cleanup_delete_in_flight.
6. DELETE the exact signed meeting once.
7. GET the same exact meeting once.
8. Accept only meeting-resource HTTP 404 / Zoom code 3001.
9. Append signed sequence 6: deleted.
10. Return sanitized result.
```

The provider client rejects a generic 404 as `ZOOM_HTTP_404`. It also rejects an OAuth endpoint 404, even if its body happens to contain code `3001`, because no meeting-resource GET was started.

### Ambiguous DELETE path

If DELETE times out or its result is ambiguous after sequence 5:

* preserve sequence 5;
* write no tombstone;
* do not issue another DELETE;
* do not remove the runner or state;
* return the blocker.

A later invocation from the same repair head may perform one absence GET. If the meeting still exists, it stops with sequence 5 intact. If canonical 3001 absence is returned, it may write sequence 6.

### Exact tombstone

The private sequence-6 tombstone must:

* have `phase=deleted`;
* have `sequence=6`;
* chain to the sequence-5 MAC;
* retain the original operation/source/origin bindings;
* retain the exact repair-head binding;
* include a valid `deleted_at`;
* set `registrants=[]`;
* remove `meeting_id`;
* remove `passcode`;
* remove `registration_disabled_for_sdk_join`;
* remove `failure_category`;
* have a new valid HMAC.

The sanitized result must report, at minimum:

```text
phase: deleted
deleted_tombstone_written: true
reconciliation_cleanup_only: true
original_execution_head_verified: true
repair_head_verified: true
normalization_policy_verified: true
tisha_target_bound: false
protected_class_target_bound: false
persistent_staging_changed: false
production_changed: false
customer_invites_sent: false
protected_values_printed: false
provider_counts: <exact accepted counts>
```

The common sanitized fields are source-defined, and the reconciliation command adds the repair-specific verification fields.

### Runner and state-volume removal

The preserved runner and its state volume may be removed only after all of the following:

1. the cleanup command returns sanitized `phase=deleted`;
2. the returned provider counts match the permitted starting path;
3. the same command is invoked once more for idempotent tombstone readback;
4. that readback again returns `phase=deleted`;
5. the idempotent readback reports zero OAuth, GET, POST, PATCH, and DELETE calls;
6. no protected value appeared in either output;
7. only the canary-specific runner and state volume are selected for removal.

The General app, S2S app, persistent staging, production, protected Tisha target, recurring meetings, and customer resources must remain untouched.

---

## 6. Required execution order

```text
A03 audit
  ↓
Existing-meeting cleanup Work task
  ↓
Signed sequence-6 and canonical-absence post-cleanup audit
  ↓
Conductor assignment for successor-canary design
  ↓
Design-only Codex task resolves source convergence and prospective cleanup
  ↓
Separate reviewed implementation job, if the design proves code changes necessary
  ↓
New immutable source and tests accepted
  ↓
Fresh Board assignment and explicit one-canary authority
  ↓
Later Work canary
```

Deletion of the old meeting skips none of these gates.

Real Zoom production activation is still downstream of a successful staging canary and a narrow occurrence/cohort rollback gate.

---

## 7. Recommended task packets

| Task                                | Dependency                                                                                | Owner / writer slot                                                        | Exact write scope                                                                                                                                                                       | Stop condition                                                                                                       | Required proof                                                                                                                      | Board assignment                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| T1 — Existing-meeting cleanup       | Authenticated provider-only session; preserved exact runner/journal; repair head deployed | Existing provider-only Work owner. No Git writer.                          | Exact isolated runner controls, private sequence 5/6 journal, one exact Zoom DELETE, exact runner/volume removal after proof                                                            | Any source, HMAC, operation, origin, phase, identity, time, notification, authorization, response, or count mismatch | Sanitized first result, zero-call idempotent readback, canonical 3001 absence, sequence-6 implication, exact infrastructure removal | **No new assignment.** Existing Board owner covers cleanup only.        |
| T2 — Post-cleanup audit             | T1 sanitized return                                                                       | Read-only Chat/GitHub auditor; conductor-assigned writer only if committed | `ops/audits/2026-07-26/parallel-control-tower/A03-post-cleanup-result.md` only                                                                                                          | Missing or contradictory proof                                                                                       | Classified audit and exact proposed Board delta                                                                                     | **No** for read-only return; **yes** before committing or editing Board |
| T3 — Successor-canary design        | T2 accepted; old runner/volume absent                                                     | Conductor-assigned Codex writer                                            | `ops/provider-actions/ZOOM-HOST-STUDENT-SUCCESSOR-CANARY-DESIGN.md` and `ops/goals/OT-LAUNCH-01/handoffs/zoom_real_control_operator_change_set--zoom-successor-canary-design.json` only | Cleanup unproven, source convergence unresolved, prospective cleanup undefined                                       | Design, source map, new authority request, test matrix, separate implementation packet                                              | **Yes**                                                                 |
| T4 — Later host/Student Work canary | Reviewed successor job, accepted implementation/source, Board assignment, fresh authority | Provider-only Work executor. No Git writer.                                | Only the exact provider actions in the successor job                                                                                                                                    | Any missing gate or placeholder, old authority reuse, unsafe target, incomplete cleanup guarantee                    | One bounded canary, sanitized join/control proof, terminal cleanup/tombstone                                                        | **Yes, plus fresh explicit operator authority**                         |

Repository coding agents are prohibited from performing provider mutations, so the provider-only executor and repository writer must remain separate.

---

# 8. Exact Work prompt — cleanup only

```text
WORK TASK — ONE TIME ZOOM EXISTING-MEETING RECONCILIATION CLEANUP ONLY

MODE
- Provider-only execution.
- No repository checkout, code edit, commit, branch, PR, or Board edit.
- Do not open or manipulate the Zoom UI.
- Do not create, register, patch, join, control, invite to, or select a meeting.
- Never expose a secret, private path, operation ID, meeting ID, passcode, host ID,
  token, private destination, protected provider identifier, or customer/Student data.

AUTHORITY
This task resumes the existing Board assignment:
OT-LAUNCH-01-ZOOM-PROVIDER-ONLY-BROWSER-CANARY

Its authority is now narrowed to cleanup reconciliation of the one already-created
disposable non-Tisha meeting. It does not authorize a second meeting or a join/control
attempt.

IMMUTABLE SOURCE
Repository: shloimie-beep/onetimev2
Branch: codex/zoom-real-control-activation
PR: #105
Original journal execution head:
96e54d9688ff174ac8265ce3b3a6216abb6292dc
Repair/deployed head:
2d22f46a40364c670d20fa197e78ead2a2f79c8e

Do not proceed until the existing Railway/GitHub session is authenticated through
the normal human sign-in flow. Never request credentials, bypass MFA, or use another
account or project.

EXPECTED CURRENT PRIVATE STATE
- schema version 3
- sequence 4
- phase cleanup_required
- failure category registration_outcome_ambiguous
- zero registrants
- no registration_disabled_for_sdk_join field
- original execution head exactly 96e54d9688ff174ac8265ce3b3a6216abb6292dc
- exact existing operation, origin, private keyholder path, and private state path

PREFLIGHT — FAIL CLOSED
Verify without printing protected values:

1. ONE_TIME_RUNTIME_ENVIRONMENT=isolated_staging
2. ZOOM_CLASSROOM_ENABLED=true
3. ZOOM_CLASSROOM_PROVIDER_MODE=sink
4. ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=false
5. ZOOM_CLASSROOM_CANARY_ENABLED=false
6. ZOOM_CLASSROOM_CANARY_LEARNER_KEY=full_app_preview_student_1
7. PUBLIC_BASE_URL, ZOOM_MEETING_SDK_ALLOWED_ORIGIN, and journal origin all equal
   the source-defined ZOOM_DISPOSABLE_CANARY_ORIGIN.
8. ZOOM_REAL_CONTROL_EXPECTED_SOURCE_SHA is exactly
   96e54d9688ff174ac8265ce3b3a6216abb6292dc.
9. ZOOM_DISPOSABLE_CANARY_REPAIR_EXPECTED_SOURCE_SHA is exactly
   2d22f46a40364c670d20fa197e78ead2a2f79c8e.
10. RAILWAY_GIT_COMMIT_SHA is system-reported as exactly
    2d22f46a40364c670d20fa197e78ead2a2f79c8e.
    Do not set or spoof this value manually.
11. ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION is exactly
    DELETE_ONE_CREATED_PR105_DISPOSABLE_MEETING_ONCE.
12. ZOOM_DISPOSABLE_CANARY_RECONCILIATION_AUTHORIZATION is exactly
    RECONCILE_DELETE_ONE_EXISTING_PR105_96E54D_MEETING_ONCE.
13. ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION is absent.
14. The Tisha, protected-class, external meeting-ID, and external meeting-passcode
    inputs forbidden by the plan are all absent.
15. The private journal validates its complete schema-v3 HMAC chain, exact operation,
    original source, origin, sequence, previous-state MACs, current phase, failure
    category, and zero-registrant scope.
16. The provider readback matches the signed meeting/type/host/topic/agenda/duration,
    join-before-host=false, no alternative host, start-time delta <=60 seconds, both
    registrant notification fields explicitly false, and general email notification
    false or safely omitted under the exact reviewed rule.

Do not change any protected credential, origin, operation, path, provider gate,
persistent-staging variable, production variable, General app, or S2S app.
If any required guard is missing or mismatched, stop and return a sanitized blocker.
Do not improvise a variable change.

ONLY ALLOWED COMMAND
Run only:

npm run zoom:real-control:disposable:reconcile-cleanup

Do not run:
- zoom:real-control:disposable:provision
- zoom:real-control:disposable:cleanup
- zoom:real-control:provision
- any ad hoc Zoom API command
- any manual Zoom deletion
- any database or repository mutation command

EXPECTED CURRENT SUCCESS PATH
Starting from the documented sequence-4 state, require:

phase=deleted
deleted_tombstone_written=true
reconciliation_cleanup_only=true
original_execution_head_verified=true
repair_head_verified=true
normalization_policy_verified=true
provider_counts.oauth=1
provider_counts.get=2
provider_counts.post=0
provider_counts.patch=0
provider_counts.delete=1
persistent_staging_changed=false
production_changed=false
customer_invites_sent=false
protected_values_printed=false

The command must have durably appended signed sequence 5 /
cleanup_delete_in_flight before DELETE and signed sequence 6 / deleted only after
the exact meeting-resource GET returned HTTP 404 with Zoom code 3001.

AMBIGUOUS OUTCOME
If the command fails after sequence 5, times out, receives an ambiguous provider
response, or cannot prove canonical 3001 absence:
- stop immediately;
- preserve the runner, journal, keyholder, and state volume;
- do not issue another DELETE;
- do not write or force a tombstone;
- do not remove infrastructure;
- return a sanitized blocker.

A later invocation from the same exact repair head may verify absence only. It may
not repeat DELETE.

IDEMPOTENT TOMBSTONE READBACK
After the first command returns an accepted deleted result, run the same exact command
one additional time and no other command.

The second result must again report phase=deleted and must report:

provider_counts.oauth=0
provider_counts.get=0
provider_counts.post=0
provider_counts.patch=0
provider_counts.delete=0

This second result proves that the signed sequence-6 journal is accepted and that the
completed tombstone loads no provider context.

INFRASTRUCTURE REMOVAL
Only after both accepted results:
- remove only the exact preserved canary runner and its exact state volume;
- confirm those two canary-specific resources are absent;
- do not remove the PR web preview, General app, S2S app, persistent staging,
  production, or any unrelated resource.

FORBIDDEN EVEN AFTER SUCCESS
- no second meeting;
- no new operation or journal;
- no provisioning retry;
- no host or Student join/control;
- no Tisha, recurring Rabbi, customer, or other meeting access;
- no persistent-staging or production activation;
- no claim that ZOOM-SDK-001 or ZOOM-S2S-001 is accepted.

RETURN ONLY SANITIZED EVIDENCE
Return:

CLEANUP-WORK-RETURN
repository: shloimie-beep/onetimev2
repair_head: 2d22f46a40364c670d20fa197e78ead2a2f79c8e
starting_signed_phase: <sequence-4 | sequence-5 | sequence-6>
first_result:
  phase: <deleted or blocker>
  canonical_meeting_resource_3001_absence: <true|false|unproven>
  signed_sequence_6_tombstone: <true|false|unproven>
  provider_counts:
    oauth: <number>
    get: <number>
    post: <number>
    patch: <number>
    delete: <number>
idempotent_readback:
  phase: <deleted|not_run>
  signed_journal_accepted: <true|false|unproven>
  provider_counts:
    oauth: <number>
    get: <number>
    post: <number>
    patch: <number>
    delete: <number>
infrastructure:
  exact_runner_removed: <true|false>
  exact_state_volume_removed: <true|false>
safety:
  new_meeting_created: false
  host_or_student_join_attempted: false
  control_attempted: false
  tisha_or_recurring_or_customer_target_touched: false
  customer_notifications: 0
  persistent_staging_changed: false
  production_changed: false
  protected_values_printed: false
remaining_blocker: <null or sanitized category>

Never include raw identifiers or protected values.
```

---

# 9. Exact post-cleanup audit prompt

```text
A03 POST-CLEANUP AUDIT — READ ONLY

Set: Chat · GPT-5.6 Pro · GitHub connected · Work off

AUDIT-ONLY OVERRIDE
- Do not open Zoom or Railway.
- Do not run a command.
- Do not call a provider.
- Do not edit a repository or Board.
- Do not attempt another DELETE.
- Do not expose protected values or provider identifiers.

REPOSITORY
shloimie-beep/onetimev2

CANONICAL SOURCES
- control checkpoint:
  e986b5e6502b1168b3eb28e200fd49ac8de46477
- original execution head:
  96e54d9688ff174ac8265ce3b3a6216abb6292dc
- repair head:
  2d22f46a40364c670d20fa197e78ead2a2f79c8e
- PR #105 body
- current OT-LAUNCH-01 Board, decisions, specification, and acceptance
- ops/provider-actions/ZOOM-MEETING-SDK-APP-SETUP.md
- repaired plan/state/reconciliation source
- focused reconciliation and provider tests
- the complete sanitized CLEANUP-WORK-RETURN supplied with this audit

REQUIRED VERIFICATION
Classify each conclusion as NEW FINDING, CONFIRMED CURRENT TRUTH,
SUPERSEDED/HISTORICAL, or UNPROVEN.

Verify all of the following:

1. The first cleanup result reports phase=deleted.
2. The first result reports:
   - deleted_tombstone_written=true
   - reconciliation_cleanup_only=true
   - original_execution_head_verified=true
   - repair_head_verified=true
   - normalization_policy_verified=true
3. For a documented sequence-4 start, provider counts are exactly:
   - oauth=1
   - get=2
   - post=0
   - patch=0
   - delete=1
4. If the documented start was sequence 5, counts are exactly:
   - oauth=1
   - get=1
   - post=0
   - patch=0
   - delete=0
5. The accepted absence was a meeting-resource HTTP 404 with Zoom code 3001,
   not an OAuth 404, generic 404, UI absence, timeout, or textual assertion.
6. The successful command logically implies the private journal validator accepted
   exact sequence 6 / deleted with the original execution head, exact repair head,
   exact operation/origin/HMAC chain, empty registrants, and deleted_at.
7. The idempotent second readback reports phase=deleted and all provider counts zero.
8. No second DELETE occurred.
9. Only the canary runner and canary state volume were removed.
10. No new meeting, join, control, notification, persistent-staging change, production
    change, General-app mutation, S2S-app mutation, Tisha access, recurring-meeting
    access, or customer access occurred.
11. No protected value or raw provider identifier appears in the evidence.
12. ZOOM-SDK-001 and ZOOM-S2S-001 remain unaccepted because no human-cleared
    host/Student canary occurred.

FAIL-CLOSED RULES
- Missing evidence is UNPROVEN.
- Contradictory counts are a blocker.
- Do not recommend another DELETE when the journal is sequence 5 or 6.
- Do not infer a new-meeting authorization.
- Do not mark host-control acceptance from cleanup.
- Do not edit BOARD.yaml. Return an exact proposed conductor delta instead.

PROPOSED BOARD EFFECT IF ALL PROOF PASSES
- Record the exact old disposable meeting cleanup and sequence-6 tombstone as complete.
- Remove the provider-deletion blocker.
- Preserve zoom_meeting_sdk and zoom_s2s_host_control as provider_off.
- Preserve ZOOM-SDK-001 and ZOOM-S2S-001 as unaccepted.
- Replace the old cleanup next action with:
  conductor assignment for a source-converged, prospective-cleanup-safe
  successor-canary design.
- State explicitly that no new meeting is authorized.

RETURN
A complete Markdown report suitable for committing as:

ops/audits/2026-07-26/parallel-control-tower/A03-post-cleanup-result.md

End with a CONTROL-TOWER-RETURN block.
```

---

# 10. Proposed later canary-design Codex prompt

```text
CODEX TASK — DESIGN A SOURCE-CONVERGED SUCCESSOR ZOOM HOST/STUDENT CANARY

STATUS
DESIGN ONLY. NO PROVIDER ACTION. NO MEETING CREATION.

BOARD GATE
Do not start unless the conductor has assigned this exact design task after:
- accepted A03 post-cleanup audit;
- signed sequence-6 tombstone proof;
- canonical absence proof;
- removal of the old canary runner and state volume.

A chat instruction alone is not Board assignment.

REPOSITORY
shloimie-beep/onetimev2

READ FIRST
- current OT-LAUNCH-01 CURRENT/GOAL/SPEC/ACCEPTANCE/BOARD/DECISIONS
- A03-result.md
- A03-post-cleanup-result.md
- PR #105 body and repair head
  2d22f46a40364c670d20fa197e78ead2a2f79c8e
- accepted normal Student route source recorded by the Board
- current conductor-assigned product head
- scripts/zoom-disposable-canary-plan.ts
- scripts/zoom-disposable-canary-state.ts
- scripts/zoom-disposable-canary-provision.ts
- scripts/zoom-disposable-canary-cleanup.ts
- scripts/zoom-disposable-canary-reconcile-cleanup.ts
- packages/domain/src/providers/zoom-rest.ts
- all focused Zoom canary/provider tests
- ops/provider-actions/ZOOM-MEETING-SDK-APP-SETUP.md
- all current and historical sanitized Zoom handoffs

PROBLEM TO SOLVE
The old repair is source-bound to the already-cleaned PR #105 journal and cannot be
used as authority for another meeting.

The accepted normal Student route and the PR #105 cleanup repair are on divergent
source lines.

The generic cleanup path still uses stricter exact start-time/general-notification
readback than the one-time repaired reconciliation, and its initial-absence journal
semantics are not equivalent to the repaired sequence-5/sequence-6 contract.

Do not mechanically merge PR #105, reactivate its old job, or reuse its consumed
one-meeting authorization.

EXACT WRITE SCOPE
Write only:

1. ops/provider-actions/ZOOM-HOST-STUDENT-SUCCESSOR-CANARY-DESIGN.md

2. ops/goals/OT-LAUNCH-01/handoffs/
   zoom_real_control_operator_change_set--zoom-successor-canary-design.json

Do not edit BOARD.yaml.
Do not edit application code, scripts, tests, configuration, migrations, or provider
state in this design task.

DESIGN REQUIREMENTS

1. IMMUTABLE SOURCE
   - Identify the exact current product source containing the accepted normal fictional
     Student 1 Classroom launch path.
   - Identify the minimal semantically required Zoom canary lifecycle code.
   - Do not import stale or unrelated PR #105 commits.
   - Propose one exact successor source strategy and explain why it proves the normal
     Student route rather than an Owner/Admin diagnostic harness.

2. NEW VERSIONED CANARY CONTRACT
   Propose a new, distinct:
   - purpose;
   - attestation;
   - operation namespace;
   - authorization names;
   - state/journal version or explicitly reviewed compatible version;
   - isolated origin/deployment binding;
   - cleanup deadline;
   - source binding;
   - learner binding.

   The old PR #105 purpose, old operation, old journal, old state path, old origin
   authority, and old provisioning authorization must not be reused merely because
   they remain in source.

3. PROSPECTIVE CLEANUP SAFETY
   The successor contract must guarantee before any meeting is created:
   - provider-normalized start-time handling is reviewed and bounded;
   - both registrant notification flags are explicitly false;
   - general notification omission rules are explicit;
   - alternative hosts are prohibited;
   - exact meeting/type/host/topic/agenda/duration scope is enforced;
   - a durable journal transition precedes DELETE;
   - at most one DELETE is possible;
   - timeout recovery performs absence reconciliation only;
   - only meeting-resource HTTP 404 / Zoom code 3001 proves absence;
   - generic and OAuth 404 are rejected;
   - handling of a meeting already absent before cleanup is explicitly designed,
     rather than inherited accidentally;
   - a terminal tombstone strips protected meeting material;
   - a terminal rerun loads no provider context;
   - cleanup remains mandatory even when join/control proof fails.

4. NORMAL STUDENT PROOF
   The proposed canary must use the normal fictional Student 1 Classroom route,
   single-use grant, role-0 Meeting SDK launch, consent, and sibling/replay denial.
   It must not substitute an Admin-only diagnostic harness.

5. HOST CONTROL PROOF
   Bound only the minimum reviewed host operations:
   - exact protected host join;
   - exact fictional Student 1 join;
   - consent before request-unmute/video action;
   - bounded mute/request-unmute;
   - bounded spotlight replace/remove;
   - Done/reset;
   - one replay/idempotency rejection;
   - explicit stop.

6. SAFETY BOUNDARY
   - exactly one new disposable meeting only if later separately authorized;
   - no Tisha, recurring Rabbi, customer, or pre-existing meeting;
   - no customer invite or notification;
   - no Students 2 or 3 in the real canary;
   - no persistent-staging or production activation unless the successor job
     explicitly chooses and proves that environment;
   - no raw IDs, links, credentials, passcodes, tokens, ZAK, participant data, or
     private destinations in Git or evidence.

7. AUTHORITY
   Draft the exact new Board decision and operator authorization required for:
   - one successor source;
   - one new meeting;
   - one operation;
   - one host;
   - fictional Student 1;
   - one bounded control sequence;
   - mandatory cleanup;
   - exact stop and rollback conditions.

   State that the prior exactly-one-meeting decision is consumed and cannot satisfy
   this requirement.

8. TEST PLAN
   Provide exact focused tests covering:
   - source drift;
   - origin drift;
   - operation drift;
   - HMAC tampering;
   - phase/sequence drift;
   - Student/sibling drift;
   - protected-target binding;
   - notification drift;
   - start-time boundary 60/61 seconds;
   - alternative host;
   - journal append failure;
   - DELETE timeout;
   - second-DELETE prevention;
   - OAuth/generic 404 rejection;
   - already-absent handling;
   - terminal tombstone idempotency;
   - zero secret leakage;
   - normal Student path versus diagnostic harness.

9. SEPARATE FOLLOW-ON JOBS
   Produce:
   - one proposed implementation job with exact code/test write scope;
   - one proposed deployment/readback job;
   - one proposed provider-only Work job;
   - their dependencies and Board-assignment requirements.

STOP CONDITIONS
Stop with UNPROVEN and do not propose execution if:
- cleanup evidence is incomplete;
- the old runner or state remains;
- source convergence is unresolved;
- the normal Student path is not in the proposed source;
- prospective cleanup cannot be proven before creation;
- a protected target could be selected;
- a new authority decision is absent.

REQUIRED PROOF
- exact source/ancestry map;
- no provider or deployment action;
- no code/config/migration changes;
- only the two authorized design/handoff files changed;
- secret scan and diff review;
- handoff names dependency, owner/writer, exact write scope, stop condition,
  required proof, and Board assignment.

RETURN
A concise terminal design report plus the exact proposed implementation and provider
job packets. Do not claim the successor canary is runnable.
```

---

# 11. Later canary Work prompt — **NOT RUNNABLE**

```text
NOT RUNNABLE — FUTURE ONE TIME ZOOM HOST/STUDENT CANARY WORK PROMPT

DO NOT EXECUTE THIS PROMPT NOW.

It becomes runnable only when the current OT-LAUNCH-01 Board references:
1. an accepted A03 post-cleanup audit;
2. a reviewed successor-canary job;
3. an immutable successor source SHA;
4. accepted prospective cleanup implementation and focused tests;
5. a new exact provider-action packet;
6. a new Board assignment to a provider-only executor;
7. fresh explicit operator authorization for exactly one new disposable meeting.

The deletion of the prior meeting does not satisfy any of these gates.

PRE-RUN BOARD CHECK
Read the current Board and successor job. Stop immediately unless every required
source, operation, origin, learner, host, command, cleanup, deadline, and authorization
value is populated by the reviewed successor job.

Do not accept values from:
- this A03 report;
- the old PR #105 decision;
- the old journal;
- the old operation;
- the old runner or state path;
- historical handoffs;
- uncommitted chat text.

If no reviewed successor job exists, return:

NOT_RUNNABLE
reason: REVIEWED_SUCCESSOR_JOB_AND_FRESH_AUTHORITY_ABSENT
provider_calls: 0
meetings_created: 0
mutations: 0

WHEN THE GATE EVENTUALLY PASSES

MODE
- Provider-only Work execution.
- No repository edit or Board edit.
- Use only the exact commands and source named by the successor job.
- Never expose protected values or provider identifiers.

PRECONDITIONS
- The previous sequence-6 cleanup is accepted.
- The old runner and old state volume are absent.
- A new private operation and state path exist.
- The new source contains the normal fictional Student 1 Classroom route.
- The new source contains the reviewed prospective cleanup contract.
- All real/provider/canary gates remain off until the final explicit canary gate.
- The exact target classifier proves no Tisha, recurring Rabbi, customer, or
  pre-existing meeting is bound.
- The new authorization permits exactly one meeting and one bounded lifecycle.

ALLOWED LIFECYCLE
Only as enumerated by the reviewed successor job:
1. create one distinct disposable meeting;
2. durably journal creation;
3. create only the permitted fictional Student 1 binding;
4. disable registration and prove notification suppression;
5. join the exact protected host;
6. join fictional Student 1 through the normal Student route;
7. perform only the reviewed consent and bounded control checks;
8. stop controls;
9. disable all real/canary gates;
10. run mandatory cleanup even if join/control proof failed;
11. prove canonical meeting-resource 3001 absence;
12. write the reviewed terminal tombstone;
13. perform a zero-provider-call tombstone readback;
14. remove only successor-canary infrastructure after proof.

FAIL CLOSED
- Never create a second meeting.
- Never substitute the old operation or old authorization.
- Never use the Admin diagnostic participant harness as Student proof.
- Never use Students 2 or 3.
- Never use a customer.
- Never invite or notify anyone.
- Never touch Tisha, recurring Rabbi, customer, production, or an unclassified target.
- Never retry DELETE after an ambiguous outcome.
- Never remove state before a terminal tombstone.
- Never claim acceptance from code health, meeting creation, or cleanup alone.

RETURN
Return only the sanitized evidence contract defined by the reviewed successor job,
including exact provider counts, normal-Student-route proof, bounded host-control proof,
terminal cleanup proof, zero secret leakage, and all forbidden-action counters.

Until the reviewed successor job and authority exist, this prompt must only return
NOT_RUNNABLE with zero provider effects.
```

---

## 12. Negative-test checklist

The repaired test suite already proves the principal source, journal, provider-scope, timeout, no-second-DELETE, generic/OAuth-404, and tombstone-idempotency cases.

### Current cleanup

* [ ] Wrong original execution head fails before OAuth.
* [ ] Missing or wrong repair expected SHA fails before provider context.
* [ ] Deployed SHA different from repair expected SHA fails.
* [ ] Repair SHA equal to original execution SHA fails.
* [ ] Missing or wrong cleanup authorization fails.
* [ ] Missing or wrong reconciliation authorization fails.
* [ ] Provision authorization present fails.
* [ ] Runtime other than `isolated_staging` fails.
* [ ] Provider mode other than `sink` fails.
* [ ] Real-provider gate true fails.
* [ ] Canary gate true fails.
* [ ] Public origin, SDK origin, or journal origin mismatch fails.
* [ ] Invalid or mismatched operation ID fails.
* [ ] BNA keyholder binding fails.
* [ ] Keyholder/state path inside Git fails.
* [ ] State path outside the exact keyholder fails.
* [ ] Tisha/protected/external meeting target input present fails.
* [ ] Incomplete journal line fails.
* [ ] Unknown journal field fails.
* [ ] Raw email, URL, token, access token, ZAK, or other forbidden state field fails.
* [ ] HMAC mismatch fails.
* [ ] Broken `previous_state_mac` chain fails.
* [ ] Noncontiguous sequence fails.
* [ ] Journal source, operation, or origin changes between records fail.
* [ ] Current phase other than exact sequence-4 `cleanup_required` fails, except exact repair-bound sequence 5 or 6 resumption.
* [ ] Failure category other than `registration_outcome_ambiguous` fails.
* [ ] Nonzero registrants fail.
* [ ] Unexpected registration-disabled marker fails.
* [ ] Protected host mismatch fails before sequence 5.
* [ ] Meeting identifier mismatch fails before sequence 5.
* [ ] Meeting type other than 2 fails.
* [ ] Topic mismatch fails.
* [ ] Agenda mismatch fails.
* [ ] Duration other than 60 fails.
* [ ] Invalid start time fails.
* [ ] Start-time delta of 61 seconds fails.
* [ ] Start-time delta of exactly 60 seconds is accepted.
* [ ] Missing registrant-confirmation flag fails.
* [ ] Missing registrant-email-notification flag fails.
* [ ] Either registrant flag true fails.
* [ ] General email notification true fails.
* [ ] Unknown notification type fails schema validation.
* [ ] Omitted general notification with an alternative host fails.
* [ ] Non-empty alternative host fails.
* [ ] `join_before_host` not explicitly false fails.
* [ ] Meeting already absent while still at sequence 4 fails as unexpected absence.
* [ ] Sequence-5 journal append failure produces zero DELETE.
* [ ] DELETE timeout leaves sequence 5 and writes no tombstone.
* [ ] Provider still reporting the meeting after DELETE writes no tombstone.
* [ ] A sequence-5 rerun performs one GET and zero DELETE.
* [ ] OAuth 404 never proves meeting absence.
* [ ] Generic meeting-resource 404 never proves absence.
* [ ] Only HTTP 404 plus Zoom code 3001 from the meeting-resource GET proves absence.
* [ ] Sequence-6 rerun loads no provider context and emits all-zero provider counts.
* [ ] Current sequence-4 success counts are exactly `1 OAuth / 2 GET / 0 POST / 0 PATCH / 1 DELETE`.
* [ ] Sanitized output contains no meeting, host, operation, passcode, token, email, URL, or protected-path value.
* [ ] Infrastructure removal before sequence-6/idempotent readback fails acceptance.
* [ ] Removal of anything other than the exact canary runner and state volume fails acceptance.

### Later successor canary

* [ ] Old one-meeting decision used as new authority causes `NOT_RUNNABLE`.
* [ ] No current Board successor job causes `NOT_RUNNABLE`.
* [ ] Old operation, old journal, old state path, or old runner reuse fails.
* [ ] PR #105 hard-coded purpose/authority reused without explicit successor review fails.
* [ ] Proposed source lacks the accepted normal Student route fails.
* [ ] Admin/Owner diagnostic harness substituted for normal Student route fails.
* [ ] Stale PR #105 branch mechanically merged into current product line fails review.
* [ ] Prospective cleanup still relies only on strict exact-time/general-notification behavior fails before creation authorization.
* [ ] Already-absent cleanup semantics are unspecified fails design review.
* [ ] New canary can issue a second DELETE fails design review.
* [ ] New canary can create a second meeting fails design review.
* [ ] Cleanup is optional after a failed join/control sequence fails design review.
* [ ] Protected Tisha, recurring, customer, or pre-existing target can pass classification fails.
* [ ] Students 2 or 3 can reach the real provider canary fails.
* [ ] Customer invite or provider notification is possible fails.
* [ ] Persistent-staging or production activation is implied rather than explicitly job-bound fails.
* [ ] Fresh operation, deadline, source, origin, state, and authority are incomplete causes `NOT_RUNNABLE`.
* [ ] Terminal tombstone cannot be read back with zero provider calls fails.
* [ ] Any raw provider material can enter Git, logs, screenshots, or return evidence fails.

---

## 13. Source list

### Canonical control plane

* `ops/goals/CURRENT.yaml` at `e986b5e6502b1168b3eb28e200fd49ac8de46477`
* `ops/goals/OT-LAUNCH-01/GOAL.md`
* `ops/goals/OT-LAUNCH-01/SPEC.yaml`
* `ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml`
* `ops/goals/OT-LAUNCH-01/BOARD.yaml`, blob `87a6c01f893d01a92af056ac26ae3b42923f435a`
* `ops/goals/OT-LAUNCH-01/DECISIONS.yaml`
* `ops/goals/OT-LAUNCH-01/RAMBLE-PROTOCOL.md`
* `ops/previews/current.json`

The ramble/handoff protocol confirms that the conductor assigns tracks and non-conductors write bounded handoffs rather than editing the Board.

### PR and commits

* Draft PR `#105`, branch `codex/zoom-real-control-activation`
* PR base: `9dfabade8b9cff9dfa3edd6d0677deb4d07b8e18`
* Original disposable-canary execution head: `96e54d9688ff174ac8265ce3b3a6216abb6292dc`
* Cleanup repair head: `2d22f46a40364c670d20fa197e78ead2a2f79c8e`
* Repair commit message: `fix zoom disposable cleanup reconciliation`
* Accepted normal-Student product checkpoint recorded by Board: `4d484c167ab332a6f82b97c7fc4f758c58bb391b`
* Control checkpoint: `e986b5e6502b1168b3eb28e200fd49ac8de46477`
* GitHub ancestry comparison: repair head and control checkpoint returned `diverged`

PR #105 is still open and draft, and its body explicitly describes cleanup-only reconciliation of the already-created meeting.

### Current repair source

* `ops/provider-actions/ZOOM-MEETING-SDK-APP-SETUP.md`
* `package.json`
* `packages/domain/src/providers/zoom-rest.ts`
* `scripts/zoom-disposable-canary-plan.ts`
* `scripts/zoom-disposable-canary-state.ts`
* `scripts/zoom-disposable-canary-provision.ts`
* `scripts/zoom-disposable-canary-cleanup.ts`
* `scripts/zoom-disposable-canary-reconcile-cleanup.ts`

The only repaired command registered in `package.json` is the reconciliation-cleanup command used above.

### Focused verification

* `tests/unit/classroom/ot103-zoom-provider.test.ts`
* `tests/unit/classroom/zoom-disposable-canary-plan.test.ts`
* `tests/unit/classroom/zoom-disposable-canary-reconcile-cleanup.test.ts`
* `tests/unit/classroom/zoom-disposable-canary-state.test.ts`

PR evidence reports 59 focused tests, 355 full unit tests, typecheck, lint, formatting, build, secret scan, and five passing GitHub suites. The connected workflow readback independently shows all five workflows completed successfully at the repair head.

### Sanitized Zoom handoffs reviewed

* `ops/codex-runs/OT-LAUNCH-01/ZOOM-CLASSROOM-HANDOFF.md`
* `ops/codex-runs/OT-LAUNCH-01/ZOOM-SDK-CREDENTIAL-INCIDENT.md`
* `ops/codex-runs/OT-LAUNCH-01/ZOOM-STAGING-CLASS-LINK-ROTATION-CANARY-RUNBOOK.md`
* `ops/codex-runs/RABBI-LIVE-CONSOLE-ZOOM-OBS/ZOOM-UI-01.md`
* Current PR #105 body
* Current provider-action runbook
* Current Board evidence

The Board explicitly classifies the old classroom handoff as historical and the updated PR body/provider-action runbook as current authority.

```yaml
CONTROL-TOWER-RETURN:
  audit_id: A03
  result_path: ops/audits/2026-07-26/parallel-control-tower/A03-result.md
  repository: shloimie-beep/onetimev2
  control_checkpoint: e986b5e6502b1168b3eb28e200fd49ac8de46477
  zoom_branch: codex/zoom-real-control-activation
  pr: 105
  original_execution_head: 96e54d9688ff174ac8265ce3b3a6216abb6292dc
  repair_head: 2d22f46a40364c670d20fa197e78ead2a2f79c8e

  verdict: CLEANUP_ONLY
  current_phase:
    sequence: 4
    phase: cleanup_required
    failure_category: registration_outcome_ambiguous
    registrants: 0
    meeting_exists: true
    deletion_proven: false
    tombstone_proven: false
    host_student_canary_proven: false

  classifications:
    new_findings:
      - A03-N1_SOURCE_CONVERGENCE_REQUIRED_FOR_SUCCESSOR_CANARY
      - A03-N2_CURRENT_REPAIR_NOT_REUSABLE_AS_FUTURE_CLEANUP_CONTRACT
      - A03-N3_EXACT_PROVIDER_COUNTS_REQUIRED_FOR_ACCEPTANCE
    confirmed_current_truth:
      - EXISTING_SIGNED_DISPOSABLE_IS_ONLY_ALLOWED_TARGET
      - RECONCILIATION_CLEANUP_IS_ONLY_ALLOWED_PROVIDER_ACTION
      - SEQUENCE_5_REQUIRED_BEFORE_DELETE
      - ONLY_MEETING_RESOURCE_404_CODE_3001_PROVES_ABSENCE
      - SEQUENCE_6_REQUIRED_BEFORE_INFRASTRUCTURE_REMOVAL
      - SDK_AND_S2S_ACCEPTANCE_REMAIN_FALSE_AFTER_CLEANUP
    superseded_historical:
      - OLD_PROVISIONING_AND_ACTIVATION_HANDOFFS
      - GENERIC_CLEANUP_COMMAND_FOR_CURRENT_TARGET
      - CONSUMED_EXACTLY_ONE_MEETING_CREATION_AUTHORITY
    unproven:
      - LIVE_DELETE
      - CANONICAL_PROVIDER_ABSENCE
      - SIGNED_SEQUENCE_6_TOMBSTONE
      - RUNNER_AND_STATE_VOLUME_REMOVAL
      - SUCCESSOR_CANARY_JOB
      - SUCCESSOR_CANARY_SOURCE
      - FRESH_SUCCESSOR_AUTHORITY
      - A01_A02_COMMITTED_AUDIT_CONVERGENCE

  next_executable_task:
    task: EXISTING_MEETING_RECONCILIATION_CLEANUP
    owner_slot: EXISTING_PROVIDER_ONLY_WORK_EXECUTOR
    board_assignment_required: false
    command: npm run zoom:real-control:disposable:reconcile-cleanup
    target: EXACT_SIGNED_EXISTING_DISPOSABLE_ONLY
    new_meeting_allowed: false
    join_or_control_allowed: false
    expected_sequence_4_counts:
      oauth: 1
      get: 2
      post: 0
      patch: 0
      delete: 1
    terminal_required:
      phase: deleted
      sequence: 6
      canonical_absence: MEETING_RESOURCE_HTTP_404_ZOOM_CODE_3001
      idempotent_readback_provider_calls: 0

  removal_gate:
    runner_volume_removal_allowed_only_after:
      - SANITIZED_DELETED_RESULT
      - EXACT_PROVIDER_COUNTS
      - SIGNED_SEQUENCE_6_ACCEPTANCE
      - CANONICAL_3001_ABSENCE
      - ZERO_PROVIDER_CALL_IDEMPOTENT_READBACK

  successor_canary:
    currently_runnable: false
    deletion_of_old_meeting_grants_authority: false
    requires:
      - ACCEPTED_POST_CLEANUP_AUDIT
      - NEW_BOARD_ASSIGNED_SUCCESSOR_JOB
      - SOURCE_CONVERGENCE
      - PROSPECTIVE_NORMALIZATION_SAFE_CLEANUP_CONTRACT
      - REVIEWED_IMMUTABLE_SOURCE
      - FRESH_EXPLICIT_OPERATOR_PROVIDER_AUTHORITY
    forbidden_until_then:
      - CREATE_MEETING
      - REGISTER_STUDENT
      - HOST_JOIN
      - STUDENT_JOIN
      - MUTE_UNMUTE_SPOTLIGHT_CONTROL
      - PERSISTENT_STAGING_ACTIVATION
      - PRODUCTION_ACTIVATION

  audit_actions:
    repository_changed: false
    zoom_opened: false
    railway_opened: false
    browser_session_opened: false
    command_run: false
    provider_request_made: false
    secrets_or_protected_ids_returned: false
```
