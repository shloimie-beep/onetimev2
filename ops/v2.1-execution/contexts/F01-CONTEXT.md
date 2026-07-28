# F01 — Repository Convergence, Architecture Seams, and Retired-Surface Closure — Locked Context

**Outcome:** Make the exact v2.1 package the sole current authority, create low-conflict server/client/worker composition seams, and unmount prohibited production surfaces without deleting immutable migration history.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `SERVER_COMPOSER, CLIENT_COMPOSER, WORKER_COMPOSER, CONFIG_DEPS, BARREL_REGISTRAR, RETIRED_SURFACES`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Preserve all non-retired behavior while extracting seams.
- Do not delete or edit applied historical migrations.
- Publish interface_ready as soon as route/runner/registration contracts are stable so Wave 2 can begin.

## Dependency gates

- Start after: `C00`
- Full merge after: `None`
- Candidate integration partners (non-ordering): `None`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/crm-entry.tsx`
- `apps/web/src/client/app/live-entry.tsx`
- `apps/web/src/client/app/portal-entry.tsx`
- `apps/web/src/client/app/router/**`
- `apps/web/src/client/features/portals/PortalFeatures.tsx`
- `apps/web/src/server/app.ts`
- `apps/web/src/server/features/registry/**`
- `apps/web/src/server/index.ts`
- `apps/worker/src/main/index.ts`
- `apps/worker/src/runners/registry/**`
- `ops/v2.1-execution/runtime/F01/steward-requests/schema/**`
- `packages/config/src/index.ts`

Scope notes below explain intent but do not grant additional path authority:

- packages/config/src/index.ts seam only
- packages/contracts/src/index.ts registration seam only
- packages/domain/src/index.ts registration seam only
- new feature-router, client-router, runner-registry, and steward-request infrastructure
- current runtime mounts/navigation/tests for explicitly retired surfaces

## Deliverables

- thin server feature-router registration
- thin Admin/Parent/Student/live shell and route composition
- separate Parent and Student client feature roots
- worker runner registry
- central-file steward request mechanism
- retired surfaces absent from current runtime and current acceptance
- early interface_ready contract checkpoint

## Relevant locked decisions (16)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-001 | LOCKED | The sole current product repository is `shloimie-beep/onetimev2`. Older repositories and BNA-hosted One Time implementations are historical only. |
| DEC-002 | LOCKED | One Time is standalone. It has its own application, database, sessions/cookies, provider configuration, failure domain, and release authority. It must not depend on BNA runtime state. |
| DEC-003 | LOCKED | The v2.1 package supersedes the old One Time launch board, old acceptance IDs, fictional/demo acceptance paths, and incompatible control-plane semantics. |
| DEC-004 | LOCKED | Product-path work has priority. Historical cleanup or evidence work may not block a real Admin, Parent, Student, billing, class, calendar, content, or communication journey unless it prevents safe production operation. |
| DEC-005 | LOCKED | `https://app.onetimeonetime.com` is the production application. `https://join.onetimeonetime.com` is the public/transition funnel until cutover is complete. |
| DEC-006 | LOCKED | No preview mode, experience demo, fictional customer, demo account, product test lab, Class Helper, Buffer integration, or test lane appears in the production product. |
| DEC-010 | LOCKED | Assignable authorization roles are exactly `admin`, `parent`, and `student`. |
| DEC-011 | LOCKED | Shloimie Dratler and Rabbi Eli Scheller have identical full One Time Admin authority. Rabbi Eli may also have teacher identity/profile data without creating a fourth role. |
| DEC-013 | LOCKED | MFA is not a launch capability—mandatory or optional—and no routine six-digit email challenge exists. Admin and Parent login use email plus password. |
| DEC-095 | LOCKED | There is no WhatsApp lead assistant at launch. |
| DEC-112 | INFERRED | Launch includes an in-app notification center, unread badge, and an optional audible cue while the Student portal is open. Background mobile push/PWA notification is deferred. |
| DEC-130 | LOCKED | One Time uses its black, white, yellow, and restrained cyan identity. BNA branding and navigation do not appear. |
| DEC-133 | LOCKED | Every visible interactive control works against persistent data or is absent. No placeholder controls or “coming soon” cards appear in production. |
| DEC-143 | LOCKED | Fictional/demo/test customer records and product surfaces are removed from production. Historical evidence may be retained outside runtime and outside current acceptance status. |
| DEC-144 | DEFERRED | Class Helper, Buffer/social publishing, demos, preview routes, test lanes, Parent-created goals, editable badge rules, favorites, PWA push, and school-specific administration are not launch features. |
| DEC-151 | LOCKED | Rabbi Eli performs or approves the real Admin/teacher classroom and content journey. |

## Acceptance requirements and exact cases (8 requirements)


### OTV2-FOUNDATION-001

The production product runs at app.onetimeonetime.com.

- Area: `FOUNDATION`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `None`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-FOUNDATION-001-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_read_only
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - immutable candidate is deployed
  - DNS/TLS and version endpoints are observable
  steps:
  - resolve the production origin
  - open the canonical route in a real browser
  - read back candidate and runtime identity
  - verify wrong/legacy origins cannot share sessions
  expected_results:
  - The production product runs at app.onetimeonetime.com.
  forbidden_effects:
  - wrong application or preview content
  - web/worker identity mismatch
  - legacy/BNA cookie reuse
  evidence_profile: deployment_runtime
  cleanup: none; preserve redacted readback
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-FOUNDATION-003

The One Time application exposes only admin, parent, and student roles.

- Area: `FOUNDATION`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-FOUNDATION-003-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_read_only
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - immutable candidate is deployed
  - DNS/TLS and version endpoints are observable
  steps:
  - resolve the production origin
  - open the canonical route in a real browser
  - read back candidate and runtime identity
  - verify wrong/legacy origins cannot share sessions
  expected_results:
  - The One Time application exposes only admin, parent, and student roles.
  forbidden_effects:
  - wrong application or preview content
  - web/worker identity mismatch
  - legacy/BNA cookie reuse
  evidence_profile: deployment_runtime
  cleanup: none; preserve redacted readback
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-FOUNDATION-004

Shloimie and Rabbi Eli have identical full Admin permissions.

- Area: `FOUNDATION`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-FOUNDATION-004-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_read_only
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - immutable candidate is deployed
  - DNS/TLS and version endpoints are observable
  steps:
  - resolve the production origin
  - open the canonical route in a real browser
  - read back candidate and runtime identity
  - verify wrong/legacy origins cannot share sessions
  expected_results:
  - Shloimie and Rabbi Eli have identical full Admin permissions.
  forbidden_effects:
  - wrong application or preview content
  - web/worker identity mismatch
  - legacy/BNA cookie reuse
  evidence_profile: deployment_runtime
  cleanup: none; preserve redacted readback
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-FOUNDATION-005

No fictional/demo/test customer data appears in production UI.

- Area: `FOUNDATION`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-FOUNDATION-005-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - production route/action/job inventory is generated from the exact candidate
  steps:
  - inspect navigation and visible controls
  - attempt direct route and API access
  - inspect workers, webhooks, configuration, and scheduled jobs
  - confirm historical records are outside runtime
  expected_results:
  - No fictional/demo/test customer data appears in production UI.
  forbidden_effects:
  - hidden-but-callable mutation
  - stale navigation
  - provider action from a retired subsystem
  evidence_profile: absence_inventory
  cleanup: remove only disposable operator-owned probe records; absence must remain
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-FOUNDATION-006

Every visible interactive element is passed or removed.

- Area: `FOUNDATION`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-FOUNDATION-006-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - production route/action/job inventory is generated from the exact candidate
  steps:
  - inspect navigation and visible controls
  - attempt direct route and API access
  - inspect workers, webhooks, configuration, and scheduled jobs
  - confirm historical records are outside runtime
  expected_results:
  - Every visible interactive element is passed or removed.
  forbidden_effects:
  - hidden-but-callable mutation
  - stale navigation
  - provider action from a retired subsystem
  evidence_profile: absence_inventory
  cleanup: remove only disposable operator-owned probe records; absence must remain
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-FOUNDATION-208

Preview, experience, demo, fictional, Class Helper, Buffer, WhatsApp assistant, test-lane, Parent-created goal, editable badge-rule, favorites, background PWA/push, MFA, and school-specific administration surfaces are absent from production routes, UI, APIs, jobs, configuration, and flags.

- Area: `FOUNDATION`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-FOUNDATION-208-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - production route/action/job inventory is generated from the exact candidate
  steps:
  - inspect navigation, direct routes, API/actions, workers, configuration, and production UI
  - attempt direct access to the absent surface
  expected_results:
  - Preview, experience, demo, fictional, Class Helper, Buffer, WhatsApp assistant, test-lane, Parent-created goal,
    editable badge-rule, favorites, background PWA/push, MFA, and school-specific administration surfaces are absent
    from production routes, UI, APIs, jobs, configuration, and flags.
  forbidden_effects:
  - hidden-but-callable mutation
  - stale navigation
  - provider action from a retired subsystem
  evidence_profile: absence_inventory
  cleanup: remove only disposable operator-owned probe records; absence must remain
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-FOUNDATION-215

The v2.1 package is the sole product and acceptance authority; old launch acceptance and Board semantics cannot drive release status.

- Area: `FOUNDATION`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-FOUNDATION-215-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - production route/action/job inventory is generated from the exact candidate
  steps:
  - inspect navigation, direct routes, API/actions, workers, configuration, and production UI
  - attempt direct access to the absent surface
  expected_results:
  - The v2.1 package is the sole product and acceptance authority; old launch acceptance and Board semantics cannot
    drive release status.
  forbidden_effects:
  - hidden-but-callable mutation
  - stale navigation
  - provider action from a retired subsystem
  evidence_profile: absence_inventory
  cleanup: remove only disposable operator-owned probe records; absence must remain
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-FOUNDATION-216

One Time has no BNA runtime, database, session, cookie, navigation, or provider-workspace dependency.

- Area: `FOUNDATION`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-FOUNDATION-216-AC01
  kind: negative
  environment:
  - persistent_staging
  - production_read_only
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - immutable candidate is deployed
  - DNS/TLS and version endpoints are observable
  steps:
  - resolve the production origin
  - open the canonical route in a real browser
  - read back candidate and runtime identity
  - verify wrong/legacy origins cannot share sessions
  expected_results:
  - One Time has no BNA runtime, database, session, cookie, navigation, or provider-workspace dependency.
  forbidden_effects:
  - wrong application or preview content
  - web/worker identity mismatch
  - legacy/BNA cookie reuse
  evidence_profile: deployment_runtime
  cleanup: none; preserve redacted readback
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
