# P17 — Zoom Preparation, Settings, Registrants, and Access Delivery — Locked Context

**Outcome:** Implement Zoom occurrence preparation, locked participant settings, per-Student registrant identity, secure short-lived bootstrap delivery, retries, and reconciliation.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `ZOOM_PREPARATION`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- No raw Zoom join bearer may appear in browser URLs, email, GHL, logs, or handoffs.
- Live Zoom mutation requires an explicit provider lock and authority record.

## Dependency gates

- Start after: `F05, F06, P16`
- Full merge after: `F05, F06, P16`
- Candidate integration partners (non-ordering): `P23, P28`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/server/features/classroom/zoom-preparation/**`
- `apps/worker/src/runners/zoom-preparation/**`
- `packages/contracts/src/classroom/zoom-preparation/**`
- `packages/db/src/classroom/zoom-preparation/**`
- `packages/domain/src/classroom/zoom-preparation/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/classroom/zoom-preparation/** except migrations and central index
- Zoom preparation/reconciliation tests
- steward requests for config/dependency/worker/server/migration changes

## Deliverables

- 24-hour/manual preparation flow
- participant controls and muted-on-join enforcement
- Student-specific registrant and bootstrap issuance
- provider readback/retry/quarantine

## Relevant locked decisions (4)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-063 | LOCKED | The classroom is an embedded Zoom experience inside the authenticated Student portal. |
| DEC-064 | LOCKED | Each Student receives a Student-specific, single-use 60-second embedded-class bootstrap and no transferable join bearer. No raw Zoom join URL is stored in browser-visible URLs, email, GHL, logs, or UI. |
| DEC-065 | LOCKED | Waiting room, participant renaming, participant screen sharing, participant file transfer, and participant chat are disabled for the canonical class. Students are muted on join. |
| DEC-067 | INFERRED | Only one concurrent live classroom session is allowed per Student. Its device lease heartbeats every 30 seconds and expires after 90 seconds without heartbeat; reconnect on the same device/session is permitted. A second device is denied with a clear message; an Admin may revoke/reset the lease. |

## Acceptance requirements and exact cases (10 requirements)


### OTV2-CLASSROOM-068

Prepare Class & Send Access validates occurrence and roster.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-068-AC01
  kind: concurrency
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
  - Prepare Class & Send Access validates occurrence and roster.
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

### OTV2-CLASSROOM-069

One app-owned Zoom meeting is created per occurrence.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-069-AC01
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
  - One app-owned Zoom meeting is created per occurrence.
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

### OTV2-CLASSROOM-070

One separate Zoom registrant is created per Student.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-070-AC01
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
  - One separate Zoom registrant is created per Student.
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

### OTV2-CLASSROOM-071

Student portals receive secure Join Class state.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-071-AC01
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
  - Student portals receive secure Join Class state.
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

### OTV2-CLASSROOM-072

Parent class reminders label affected Students and use safe app links without authenticating a Student or exposing a raw Zoom URL.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-072-AC01
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
  - Parent class reminders label affected Students and use safe app links without authenticating a Student or exposing
    a raw Zoom URL.
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

### OTV2-CLASSROOM-074

Students join muted.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-074-AC01
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
  - Students join muted.
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

### OTV2-CLASSROOM-076

Three separate tablet joins pass.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-076-AC01
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
  - Three separate tablet joins pass.
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

### OTV2-CLASSROOM-077

Sibling/cross-household join is denied.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-077-AC01
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
  - Sibling/cross-household join is denied.
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

### OTV2-CLASSROOM-079

Old disposable Zoom canary cleanup does not block normal classroom use.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-079-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - student
  fixtures:
  - admin_shloimie
  - student_operator_canary_1
  preconditions:
  - production route/action/job inventory is generated from the exact candidate
  steps:
  - inspect navigation and visible controls
  - attempt direct route and API access
  - inspect workers, webhooks, configuration, and scheduled jobs
  - confirm historical records are outside runtime
  expected_results:
  - Old disposable Zoom canary cleanup does not block normal classroom use.
  forbidden_effects:
  - hidden-but-callable mutation
  - stale navigation
  - provider action from a retired subsystem
  evidence_profile: absence_inventory
  cleanup: remove only disposable operator-owned probe records; absence must remain
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CLASSROOM-188

Canonical Zoom settings disable waiting room, participant rename, participant chat, participant screen sharing, and participant file transfer.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-188-AC01
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
  - Canonical Zoom settings disable waiting room, participant rename, participant chat, participant screen sharing,
    and participant file transfer.
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
