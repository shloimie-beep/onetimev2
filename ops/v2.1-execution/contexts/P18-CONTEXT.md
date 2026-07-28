# P18 — Embedded Classroom Join, Session Leases, Consent, and Attendance — Locked Context

**Outcome:** Implement embedded authenticated Zoom join, one concurrent live session per Student, reconnect semantics, consent gating, occurrence windows, and attendance truth.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `EMBEDDED_CLASSROOM`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F05, P16, P32`
- Full merge after: `F05, P16, P32`
- Candidate integration partners (non-ordering): `F03, P17`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/student/classroom/**`
- `apps/web/src/server/features/classroom/embedded/**`
- `packages/contracts/src/classroom/embedded/**`
- `packages/db/src/classroom/attendance/**`
- `packages/domain/src/classroom/embedded/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/classroom/attendance/** except migrations and central index
- apps/web/src/client/classroom/** feature modules
- lease/reconnect/attendance/consent tests
- steward requests for config/dependency/route/migration changes

## Deliverables

- embedded SDK authorization boundary
- single-session lease with same-session reconnect
- join-window and consent enforcement
- reconciled attendance truth

## Relevant locked decisions (6)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-060 | LOCKED | The launch catalog has exactly one active published recurring 60-minute class, Sunday through Thursday at 7:00 p.m. `Asia/Jerusalem`. Occurrences generate on a rolling 90-day horizon, prepare automatically 24 hours before start (or manually earlier), open Student join 10 minutes before start, and auto-close 15 minutes after scheduled end unless an Admin closes or extends. Additional Admin-created series start `draft`, enroll nobody, and remain invisible until explicit activation. |
| DEC-064 | LOCKED | Each Student receives a Student-specific, single-use 60-second embedded-class bootstrap and no transferable join bearer. No raw Zoom join URL is stored in browser-visible URLs, email, GHL, logs, or UI. |
| DEC-066 | LOCKED | A Student may join while the occurrence is open; there is no product-level “too late” rejection while the live occurrence remains open. |
| DEC-067 | INFERRED | Only one concurrent live classroom session is allowed per Student. Its device lease heartbeats every 30 seconds and expires after 90 seconds without heartbeat; reconnect on the same device/session is permitted. A second device is denied with a clear message; an Admin may revoke/reset the lease. |
| DEC-068 | LOCKED | Student voice and video may be captured only after versioned account-owner consent. OBS is the sole launch recording source and Zoom cloud recording is disabled. Admin verifies the consent-gated roster and visible/verbal recording notice, starts/stops OBS, transfers the encrypted local file by direct upload or dedicated Drive within 24 hours, and deletes the local copy only after durable checksum readback. |
| DEC-069 | LOCKED | Attendance is recorded and visible in appropriate Admin, Parent-summary, and Student views. Reconnects are merged; manual corrections require Admin audit. |

## Acceptance requirements and exact cases (5 requirements)


### OTV2-CLASSROOM-073

An authorized Student can join while the live occurrence remains open; no product-level late rejection occurs.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-073-AC01
  kind: negative
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_2
  - student_operator_canary_3
  - denial_household
  preconditions:
  - operator-owned occurrence and up to three real Student fixtures exist
  - Zoom live/sandbox authority is explicit
  steps:
  - prepare the roster and confirm it
  - read back meeting and per-Student registration
  - join through embedded portals on separate tablets
  - exercise sibling, second-device, timeout, and reconnect branches
  expected_results:
  - An authorized Student can join while the live occurrence remains open; no product-level late rejection occurs.
  forbidden_effects:
  - raw Zoom URL exposure
  - shared bearer credential
  - duplicate meeting
  - cross-Student join
  - blind retry after unknown acceptance
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CLASSROOM-075

Participant video is available, camera guidance is shown, and recorded Student audio/video requires versioned account-owner consent.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-075-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_2
  - student_operator_canary_3
  - denial_household
  preconditions:
  - operator-owned occurrence and up to three real Student fixtures exist
  - Zoom live/sandbox authority is explicit
  steps:
  - prepare the roster and confirm it
  - read back meeting and per-Student registration
  - join through embedded portals on separate tablets
  - exercise sibling, second-device, timeout, and reconnect branches
  expected_results:
  - Participant video is available, camera guidance is shown, and recorded Student audio/video requires versioned
    account-owner consent.
  forbidden_effects:
  - raw Zoom URL exposure
  - shared bearer credential
  - duplicate meeting
  - cross-Student join
  - blind retry after unknown acceptance
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CLASSROOM-078

Attendance minutes and percentage are recorded.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-078-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_2
  - student_operator_canary_3
  - denial_household
  preconditions:
  - operator-owned occurrence and up to three real Student fixtures exist
  - Zoom live/sandbox authority is explicit
  steps:
  - prepare the roster and confirm it
  - read back meeting and per-Student registration
  - join through embedded portals on separate tablets
  - exercise sibling, second-device, timeout, and reconnect branches
  expected_results:
  - Attendance minutes and percentage are recorded.
  forbidden_effects:
  - raw Zoom URL exposure
  - shared bearer credential
  - duplicate meeting
  - cross-Student join
  - blind retry after unknown acceptance
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CLASSROOM-187

Only one concurrent embedded classroom session is allowed per Student; same-session reconnect works and second-device join is denied.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `03-DECISION-REGISTER-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-187-AC01
  kind: negative
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - student
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_2
  - student_operator_canary_3
  - denial_household
  preconditions:
  - operator-owned occurrence and up to three real Student fixtures exist
  - Zoom live/sandbox authority is explicit
  steps:
  - prepare the roster and confirm it
  - read back meeting and per-Student registration
  - join through embedded portals on separate tablets
  - exercise sibling, second-device, timeout, and reconnect branches
  expected_results:
  - Only one concurrent embedded classroom session is allowed per Student; same-session reconnect works and second-device
    join is denied.
  forbidden_effects:
  - raw Zoom URL exposure
  - shared bearer credential
  - duplicate meeting
  - cross-Student join
  - blind retry after unknown acceptance
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CLASSROOM-232

The canonical 60-minute occurrence uses the 90-day horizon, 24-hour preparation, 30-minute reminder, 10-minute join opening, end-plus-15-minute close, 60-second join bootstrap, and 30-second heartbeat/90-second single-device lease.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032, OTV2-CLASSROOM-184, OTV2-CLASSROOM-187, OTV2-CLASSROOM-188`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-232-TIMING
  kind: time_boundary
  environment: &id001
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_2
  - student_operator_canary_3
  - denial_household
  preconditions:
  - operator-owned occurrence and up to three real Student fixtures exist
  - Zoom live/sandbox authority is explicit
  steps:
  - generate the rolling horizon and prove it contains the canonical Sunday–Thursday 7 p.m. Jerusalem occurrences
    through 90 days
  - observe automatic preparation at 24 hours, reminder at 30 minutes, Join opening at 10 minutes, 60-minute scheduled
    end, and closure at end plus 15 minutes
  - exercise a manual earlier preparation and repeat every scheduler delivery
  expected_results:
  - all boundaries use the authoritative occurrence/Jerusalem clock and occur at most once
  - manual earlier preparation is allowed but does not duplicate resources or notifications
  - a Student may join any time the occurrence remains open; there is no product-level late rejection
  forbidden_effects:
  - rolling local-time drift
  - duplicate occurrence/resource/reminder
  - join before window
  - join after close
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-CLASSROOM-232-BOOTSTRAP-LEASE
  kind: concurrency
  environment: *id001
  actors:
  - admin
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_2
  - student_operator_canary_3
  - denial_household
  preconditions:
  - operator-owned occurrence and up to three real Student fixtures exist
  - Zoom live/sandbox authority is explicit
  steps:
  - issue a Student-bound class bootstrap and redeem it before then after 60 seconds
  - join one tablet and send 30-second heartbeats while reading the 90-second lease
  - attempt a second-device join, then stop heartbeats and reconnect after lease expiry
  - perform an audited Admin reset and reconnect
  expected_results:
  - the bootstrap is single-use, bearer-free outside the exchange, and expires at 60 seconds
  - one device owns the 90-second renewable lease; same-session reconnect works and second-device join is denied
  - lease expiry or Admin reset permits a new authorized acquisition without overlapping active leases
  forbidden_effects:
  - raw Zoom URL
  - reusable bootstrap
  - two concurrent Student devices
  - unbounded lease
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

## Cross-cutting invariants

- Exact assignable roles are `admin`, `parent`, and `student`.
- Students have username/password credentials and no required email; no Student is a GHL contact.
- A Parent never becomes a learner session; an adult learner uses a separate Student seat.
- One adult identity may own multiple independently billed households; authorization remains household-scoped.
- No preview/demo/test product lane, fictional customer, Class Helper, Buffer/social publisher, public WhatsApp assistant, or active Tisha funnel route.
- GHL is adult CRM/campaign/operator billing workflow; Stripe is financial truth; One Time stores a minimum verified access projection and never mutates financial objects.
- Email must complete launch workflows even while WhatsApp is dormant.
- Zoom and Vimeo bearers/URLs never appear in UI URLs, email, GHL, logs, handoffs, or evidence.
- Production evidence must bind one immutable candidate; each case uses only an environment allowed by its acceptance contract and records exact environment/runtime/deployment/provider identity. The 265 cases are not required to share one environment.
- Automated production-safety verification is required even though demo/test product surfaces are prohibited.
