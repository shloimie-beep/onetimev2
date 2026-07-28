# V37 — Identity, Public Entry, and Admin Verification — Locked Context

**Outcome:** Verify authority convergence, retired-surface absence, adult/Student authentication, identity/tenant isolation, Family/School entry, and Admin directory/search against the immutable candidate.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `VERIFY_IDENTITY_ADMIN`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `I36`
- Full merge after: `None`
- Candidate integration partners (non-ordering): `None`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `ops/v2.1-execution/results/<candidate-digest>/V37/**`
- `ops/v2.1-execution/verification-harness/V37/**`

Scope notes below explain intent but do not grant additional path authority:

- verification-only branch codex/v21-verify-<candidate-short-sha>-v37

## Deliverables

- one schema-valid candidate-bound result record per assigned acceptance case
- lane summary with exact pass/fail/blocked counts
- zero unrecorded external effects
- reproduction packet for every failure

## Relevant locked decisions (45)

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
| DEC-012 | LOCKED | Routine Admin and Parent authentication is email plus password through one adult credential per normalized email. Routine Student authentication is username plus password. |
| DEC-013 | LOCKED | MFA is not a launch capability—mandatory or optional—and no routine six-digit email challenge exists. Admin and Parent login use email plus password. |
| DEC-014 | LOCKED | Students never require or receive an email address. No Student is created as a HighLevel contact. |
| DEC-015 | LOCKED | A Parent creates and manages up to three active Student seats and can set or reset each Student username/password. Existing passwords are never displayed. |
| DEC-017 | LOCKED | An adult who wants to learn may use one of the household’s three Student seats by creating a separate Student profile and separate Student credentials for themselves. This is not a Parent “Learner Mode.” |
| DEC-018 | LOCKED | One Parent/account-owner login is permitted per household. There is no simultaneous co-guardian access at launch. |
| DEC-019 | LOCKED | The same adult identity may own multiple separate household subscriptions. Each household has its own billing/access state and up to three Student seats. |
| DEC-020 | INFERRED | One normalized email maps to one adult identity and one HumanAccount/login with role memberships `admin`, `parent`, or both. A dual-role adult uses an explicit Admin/Parent context switcher; a multi-household Parent then uses the household switcher. Household transfer to an existing Admin adds Parent membership and never creates a duplicate adult or credential. |
| DEC-021 | INFERRED | Household ownership may be transferred through an Admin-assisted, verified email transfer. Transfer cannot complete while the outgoing adult has an active `self` Student in that household: it must first be archived or moved, with identity/history preserved, to another household the outgoing adult owns with an available seat. It is never auto-converted or given to the replacement. Dependent Students remain only after the replacement records current authority and required recording consent for each. The replacement accepts current policies and prior-owner household sessions are revoked. |
| DEC-023 | INFERRED | Admin/Parent passwords are 12–128 characters and Student passwords are 8–64. There is no composition rule; compromised/common values and values equivalent to the relevant email/username/name are rejected. Passwords use a versioned Argon2id hash and are never transformed silently. |
| DEC-024 | INFERRED | Admin sessions idle at 30 minutes and expire absolutely at 12 hours; Parent sessions idle at 24 hours and expire at 30 days; Student sessions idle at 7 days and expire at 30 days. Login allows five failures per account+IP per 15 minutes and 50 per IP; reset allows five/account/hour and 20/IP/hour; setup resend allows three/account/hour. Responses are generic and no permanent lockout exists. |
| DEC-030 | LOCKED | Learner age is not restricted by product rules. The account owner decides whom to create as a Student. |
| DEC-032 | LOCKED | Public signup classifies the inquiry as `family` or `school`. |
| DEC-033 | LOCKED | Before the fixed free-expiry instant, a Family signup receives immediate free access from the email/password submitted on the public form, creates one Parent/account-owner identity, and may create up to three Student seats. At or after expiry it creates an inactive account and continues to standard Checkout. |
| DEC-034 | LOCKED | A School submission is a sales lead. It does not enter a nurture sequence or receive automatic product access. The operator contacts the school manually. |
| DEC-035 | LOCKED | Once approved, a School uses the same application experience: one adult account manager and separate Student accounts. There is no school-specific role, portal, bulk roster, or organization administration at launch. |
| DEC-036 | INFERRED | School price, seat allowance, billing start, and terms are configured manually per approved school account. The normal household default remains three Students unless an Admin explicitly grants a contracted school allowance. |
| DEC-041 | LOCKED | Family signup never collects a card in the signup form. Before the fixed free expiry it produces free access and no automatic charge. At or after expiry it creates the adult account and household in `inactive` access and continues to standard Checkout; it grants no new rolling trial. |
| DEC-050 | LOCKED | An existing HighLevel lead who signs up is matched to the same adult contact; no duplicate GHL contact is created. One GHL contact represents the adult, while each household uses a separately keyed GHL household opportunity/account record and a household-scoped Stripe Customer. Adult suppression/consent never gets overwritten by one household’s lifecycle. |
| DEC-051 | INFERRED | Adult matching order is verified provider link, normalized email, then manual CRM-link quarantine. Name or phone alone may not silently merge adults. An ambiguous GHL match blocks only GHL synchronization/workflows/billing; it does not block local Family account creation/login, applicable Resend security delivery, or pre-expiry free product access. |
| DEC-052 | INFERRED | A legacy invitation, Admin-created adult, ownership-transfer acceptance, or other passwordless claim uses a single-use setup link valid for seven days. A fresh link may be requested at any time; issuing it invalidates earlier unused links. Fresh public Family signup sets a password directly and does not depend on setup email. |
| DEC-053 | INFERRED | Password-reset links are single-use and valid for 60 minutes. Reset expiry does not affect the account; the user can request another link. |
| DEC-054 | INFERRED | Duplicate signup for an active account returns a safe “Sign in or reset your password” path without exposing whether unrelated addresses exist. |
| DEC-055 | INFERRED | Local account creation commits first with a durable outbox. Resend and unambiguous GHL effects retry asynchronously. GHL ambiguity is a visible CRM-link quarantine; provider failure must not create duplicate accounts, silently broaden access, or lose the local signup. |
| DEC-092 | LOCKED | Resend sends account setup, password recovery, and security messages. |
| DEC-095 | LOCKED | There is no WhatsApp lead assistant at launch. |
| DEC-097 | LOCKED | School leads receive an immediate acknowledgment only and no automated nurture sequence. The operator follows up manually. |
| DEC-112 | INFERRED | Launch includes an in-app notification center, unread badge, and an optional audible cue while the Student portal is open. Background mobile push/PWA notification is deferred. |
| DEC-120 | INFERRED | Human account lifecycle is `invited`, `active`, `disabled`, `archived`. “Archived” is retained history and cannot log in; “disabled” is reversible access suspension. |
| DEC-130 | LOCKED | One Time uses its black, white, yellow, and restrained cyan identity. BNA branding and navigation do not appear. |
| DEC-132 | LOCKED | Global Admin search is launch-required. |
| DEC-133 | LOCKED | Every visible interactive control works against persistent data or is absent. No placeholder controls or “coming soon” cards appear in production. |
| DEC-135 | INFERRED | Full Admin mutation workflows are supported on desktop and tablet. Mobile Admin supports urgent status, search, class/live controls, and simple edits; dense configuration may require tablet/desktop with clear messaging. |
| DEC-141 | LOCKED | Existing adult GHL leads/contacts are deduplicated and updated when they sign up again. |
| DEC-143 | LOCKED | Fictional/demo/test customer records and product surfaces are removed from production. Historical evidence may be retained outside runtime and outside current acceptance status. |
| DEC-144 | DEFERRED | Class Helper, Buffer/social publishing, demos, preview routes, test lanes, Parent-created goals, editable badge rules, favorites, PWA push, and school-specific administration are not launch features. |
| DEC-151 | LOCKED | Rabbi Eli performs or approves the real Admin/teacher classroom and content journey. |

## Acceptance requirements and exact cases (48 requirements)


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

### OTV2-AUTH-007

Admin and Parent login use email plus password.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-007-AC01
  kind: positive
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Admin and Parent login use email plus password.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-008

Student login uses username plus password.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-008-AC01
  kind: positive
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Student login uses username plus password.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-009

Routine login does not require a six-digit email challenge.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-009-AC01
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Routine login does not require a six-digit email challenge.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-010

MFA is not part of the launch product and no MFA enrollment or challenge surface appears.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-010-AC01
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - MFA is not part of the launch product and no MFA enrollment or challenge surface appears.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-011

Admin invitation and setup work through Resend.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-011-AC01
  kind: positive
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Admin invitation and setup work through Resend.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-012

Parent invitation and setup work through Resend.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-012-AC01
  kind: positive
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Parent invitation and setup work through Resend.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-013

Adult password-reset links are single-use and valid for 60 minutes; expiry leaves the account unchanged and a newly requested link supersedes every earlier unused link.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-013-SINGLE-USE-TTL
  kind: negative
  environment: &id001
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - parent
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - an active Parent account and an active Admin account exist
  - the acceptance clock and Resend delivery evidence are controllable
  - no reset token value is written to logs, URLs outside the reset request, analytics, or third-party referrers
  steps:
  - request a password-reset link for each adult role and record issued-at and expires-at readback
  - redeem the link before 60 minutes and verify the credential change and session revocation
  - attempt to redeem the same link again
  - issue another link, advance the acceptance clock to 60 minutes and one second after issuance, and attempt redemption
  - sign in with the unchanged current credential after the expired-link denial
  expected_results:
  - each link expires exactly 60 minutes after issuance and succeeds at most once
  - reuse and expiry return a safe denial with no credential or account-state change
  - the account remains active after reset-link expiry
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
- case_id: OTV2-AUTH-013-RENEWAL
  kind: recovery
  environment: *id001
  actors:
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - an active Parent account exists
  - one unexpired unused reset link has already been issued
  steps:
  - request a second password-reset link
  - attempt the first link and verify it is superseded
  - redeem the second link once
  - sign in with the new credential and verify the old credential and old sessions are rejected
  expected_results:
  - the newest link supersedes every earlier unused link
  - the newest link changes the credential exactly once and leaves an auditable issuance/revocation record
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-014

Parent/Admin can change Student username.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-014-AC01
  kind: positive
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Parent/Admin can change Student username.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-015

Parent/Admin can set/reset Student password.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-015-AC01
  kind: positive
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Parent/Admin can set/reset Student password.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-016

Existing passwords are never displayed.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-016-AC01
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Existing passwords are never displayed.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-017

Credential changes revoke relevant sessions.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-017-AC01
  kind: positive
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Credential changes revoke relevant sessions.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-018

Disable/reactivate and session revocation work.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-018-AC01
  kind: positive
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Disable/reactivate and session revocation work.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-019

Role routing and safe return-to work.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-019-AC01
  kind: positive
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Role routing and safe return-to work.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-020

CSRF, rate limits, secure cookies, and session rotation remain active.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-020-CSRF
  kind: negative
  environment: &id001
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - state-changing same-origin requests reject missing or invalid CSRF proof
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
- case_id: OTV2-AUTH-020-RATE
  kind: negative
  environment: *id001
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - public and authenticated sensitive actions enforce the configured rate limits without partial writes
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
- case_id: OTV2-AUTH-020-COOKIE
  kind: negative
  environment: *id001
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - session cookies have the exact secure attributes and remain isolated from legacy/BNA origins
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
- case_id: OTV2-AUTH-020-ROTATE
  kind: negative
  environment: *id001
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - login and privilege/credential changes rotate or revoke sessions as specified
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-AUTH-180

Legacy invitation, Admin-created-account, ownership-transfer, and other passwordless-claim setup links are single-use, valid for seven days, renewable, and superseded by a newly issued link.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003`
- Source references: `03-DECISION-REGISTER-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-180-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - parent
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Legacy invitation, Admin-created-account, ownership-transfer, and other passwordless-claim setup links are single-use,
    valid for seven days, renewable, and superseded by a newly issued link.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-AUTH-227

Adult and Student password, compromised-password, rate-limit, generic-response, session-lifetime, token, classroom-lease, playback-grant, OAuth-state, webhook-envelope, and worker retry policies use the exact v2.1 values; MFA and permanent lockout are absent.

- Area: `AUTH`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-FOUNDATION-003, OTV2-AUTH-007, OTV2-AUTH-008, OTV2-AUTH-010, OTV2-AUTH-013, OTV2-AUTH-020`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-AUTH-227-PASSWORDS-RATE-LIMITS
  kind: security_matrix
  environment: &id001
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
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - adult and Student identities contain names used for name-equivalent rejection probes
  - the configured compromised/common-password corpus revision and Argon2id parameter version are recorded
  - rate-limit clocks and account/IP fixture identities are isolated
  steps:
  - prove Adult passwords accept 12–128 characters and Student passwords accept 8–64 characters without composition
    rules
  - attempt too-short, too-long, common, compromised, and name-equivalent passwords for each applicable role
  - inspect stored hashes and exercise transparent rehash from the prior approved Argon2id version
  - exercise login at 5 attempts per account+IP per 15 minutes and 50 per IP per 15 minutes
  - exercise reset at 5 per account per hour and 20 per IP per hour, plus setup resend at 3 per account per hour
  - verify generic responses, window recovery, and absence of permanent lockout
  expected_results:
  - all length and rejection boundaries match the contract exactly and no composition requirement is invented
  - only versioned Argon2id hashes are stored and valid old hashes upgrade after successful authentication
  - every threshold is enforced without account enumeration, partial mutation, or permanent lockout
  forbidden_effects:
  - plaintext/reversible password
  - MFA challenge
  - permanent lockout
  - account enumeration
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-AUTH-227-SESSIONS-TOKENS-LEASES
  kind: time_boundary
  environment: *id001
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - prove Admin idle/absolute expiry at 30 minutes/12 hours, Parent at 24 hours/30 days, and Student at 7 days/30
    days
  - prove setup, reset, class bootstrap, playback grant, and OAuth state expire at 7 days, 60 minutes, 60 seconds,
    5 minutes, and 10 minutes respectively
  - prove classroom heartbeat every 30 seconds maintains a 90-second lease, same-session reconnect succeeds, and
    second-device acquisition is denied
  - prove credential/role/ownership changes revoke the affected sessions and tokens
  expected_results:
  - every boundary succeeds immediately before expiry and fails immediately after expiry using the authoritative
    server clock
  - replay, reuse, wrong actor, wrong Student, and second-device use fail without protected-data or provider-link
    disclosure
  - no MFA or recovery-code state exists
  forbidden_effects:
  - sliding absolute expiry
  - reusable bootstrap
  - two live device leases
  - raw bearer exposure
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-AUTH-227-WEBHOOK-WORKER
  kind: failure_recovery
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - submit signed provider envelopes immediately below, at, and above 2 MiB and timestamps inside/outside the 5-minute
    tolerance
  - run a worker job under a 5-minute lease with 60-second heartbeat, then simulate worker loss
  - observe at most 8 attempts with full-jitter exponential backoff from 30 seconds capped at 30 minutes
  - exhaust attempts and inspect dead-letter quarantine and governed reprocess
  expected_results:
  - oversize, stale, invalid-signature, and replayed envelopes are rejected before domain mutation
  - worker fencing prevents an expired owner from completing and retries occur at most 8 times before DLQ
  - governed reprocess preserves the original idempotency identity
  forbidden_effects:
  - unbounded body
  - unfenced completion
  - ninth automatic attempt
  - blind retry with a new key
  evidence_profile: api_job_saga
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-ACCOUNT-181

One adult identity may own multiple independent households and switches household context after authentication.

- Area: `ACCOUNT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-PARENT-031`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ACCOUNT-181-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - One adult identity may own multiple independent households and switches household context after authentication.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-ACCOUNT-182

Each household has exactly one active account owner; verified transfer replaces the owner and revokes old sessions.

- Area: `ACCOUNT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-PARENT-031`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ACCOUNT-182-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - perform the authorized setup/login/credential journey
  - exercise expired, reused, wrong-role, and rate-limited branches as applicable
  - refresh and re-authenticate
  - read back session revocation and audit
  expected_results:
  - Each household has exactly one active account owner; verified transfer replaces the owner and revokes old sessions.
  forbidden_effects:
  - credential disclosure
  - partial write after denial
  - cross-role or cross-household access
  - token in logs or third-party referrer
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-ACCOUNT-183

An adult learner uses one of the three Student seats with separate Student credentials; Parent role never enters learning surfaces.

- Area: `ACCOUNT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-PARENT-031`
- Source references: `03-DECISION-REGISTER-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ACCOUNT-183-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - An adult learner uses one of the three Student seats with separate Student credentials; Parent role never enters
    learning surfaces.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-ACCOUNT-230

One normalized adult email maps to one AdultIdentity and one HumanAccount whose role set is admin, parent, or both; a dual-role adult explicitly selects context and ownership transfer to an Admin adds parent without a second login.

- Area: `ACCOUNT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `identity`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-PARENT-031, OTV2-ACCOUNT-181, OTV2-ACCOUNT-182`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ACCOUNT-230-IDENTITY-ROLE-CONTEXT
  kind: identity_matrix
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - approved real role identity exists
  - token/session policy version is recorded
  steps:
  - create a Parent, then grant Admin to the same normalized email and inspect identity/login counts
  - sign in and select Parent context, then switch to Admin context and back
  - attempt a Parent route while in Admin context and an Admin route while in Parent context
  - with an outgoing-owner self Student, attempt transfer and prove it is blocked; archive it or move it to another
    owned household with a free seat
  - transfer the household to an Admin-only adult, record current authority/recording consent for each remaining
    dependent, and accept through the seven-day link
  expected_results:
  - one AdultIdentity and one HumanAccount exist per normalized email with role set {admin,parent} where applicable
  - context is explicit, navigation is never combined, and each request enforces the selected role
  - an outgoing-owner self Student is never converted or assigned to the replacement; archive/move preserves the
    specified history
  - transfer adds parent to the existing Admin login, retains dependents only after current replacement-owner attestations,
    and creates no second login
  forbidden_effects:
  - duplicate adult/login
  - implicit route-based context elevation
  - combined navigation
  - old-owner residual session
  - self Student silently transferred or converted
  evidence_profile: auth_security
  cleanup: revoke temporary sessions/tokens and preserve redacted audit evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-176

Public intake requires Family or School classification.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-176-FAMILY-OR-SCHOOL-BRANCH
  kind: public_journey
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - open the public landing page signed out and inspect the two intake choices
  - choose Family and verify navigation to the Family account form with email/password and no School fields
  - return signed out, choose School, and verify navigation to the School inquiry form with no password, card, household,
    or Student fields
  - submit an omitted, unsupported, and hybrid classification directly to the public API
  expected_results:
  - public intake offers exactly Family signup and School inquiry as mutually exclusive branches
  - Family is the only branch that can create a Parent account/household; School creates an inquiry only
  - missing, unsupported, or hybrid classification is rejected without a local or provider write
  forbidden_effects:
  - implicit classification
  - hybrid household/inquiry
  - School password or access creation
  - partial provider effect
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-177

Before the fixed free-expiry instant, Family signup creates immediate free Parent access from a submitted email and password with no card; fresh public signup does not require a setup email.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-177-AC01
  kind: negative
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - typed route/job contract and stable idempotency key are defined
  steps:
  - submit the authorized operation
  - double-submit and send a stale version
  - inject timeout/acceptance-unknown
  - reconcile or safely reprocess through governed controls
  expected_results:
  - Before the fixed free-expiry instant, Family signup creates immediate free Parent access from a submitted email
    and password with no card; fresh public signup does not require a setup email.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-179

Existing GHL adults are matched by provider link or normalized email without duplicate contact creation.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-179-AC01
  kind: negative
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - typed route/job contract and stable idempotency key are defined
  steps:
  - submit the authorized operation
  - double-submit and send a stale version
  - inject timeout/acceptance-unknown
  - reconcile or safely reprocess through governed controls
  expected_results:
  - Existing GHL adults are matched by provider link or normalized email without duplicate contact creation.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-213

Duplicate and interrupted signup is idempotent and provides safe sign-in, resend, or recovery paths without duplicate household or GHL contact.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-213-AC01
  kind: negative
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - typed route/job contract and stable idempotency key are defined
  steps:
  - submit the authorized operation
  - double-submit and send a stale version
  - inject timeout/acceptance-unknown
  - reconcile or safely reprocess through governed controls
  expected_results:
  - Duplicate and interrupted signup is idempotent and provides safe sign-in, resend, or recovery paths without
    duplicate household or GHL contact.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-228

The public Family form and CTA change exactly at 2026-09-13T19:24:00+03:00: before it creates immediate cardless free access; at or after it creates an inactive account and continues to hosted checkout, with no rolling trial.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007, OTV2-SIGNUP-176, OTV2-SIGNUP-177, OTV2-BILLING-224`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-228-BEFORE-EXPIRY
  kind: time_boundary
  environment: &id001
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - server clock is one second before 2026-09-13T19:24:00+03:00
  - submitted email controls no active local household
  steps:
  - open /signup signed out and inventory the exact fields, CTA, helper, legal links, and absent fields
  - submit adult first/last name, email, password, timezone, required Terms/privacy acceptance, and no optional
    marketing permissions
  - sign in with the submitted email/password and read back household/access state
  - attempt Student creation without entering any card
  expected_results:
  - the form has no phone, country, Student, learner relationship, guardian/recording/recognition consent, reminder
    preference, or card field
  - CTA is “Create my free family account” and helper is “No credit card. Free access ends September 13, 2026 at
    7:24 p.m. Jerusalem time.”
  - one free Family household is immediately usable and no setup email or charge is required
  forbidden_effects:
  - rolling trial
  - card collection
  - setup-token dependency
  - duplicate adult or household
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-SIGNUP-228-AT-AND-AFTER-EXPIRY
  kind: time_boundary
  environment: *id001
  actors:
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - isolated signups exist exactly at and one second after 2026-09-13T19:24:00+03:00
  steps:
  - open /signup at each clock instant and inspect copy and CTA
  - submit the exact Family fields without a card
  - read back local account, household, access, checkout continuation, and financial effects
  - attempt Student creation and learning before then after verified checkout
  expected_results:
  - CTA is “Create account and continue to checkout” at and after the instant
  - the account and one inactive household persist; the form itself creates no charge and grants no rolling trial
  - Student creation/learning remain blocked until the household-scoped paid projection is verified
  forbidden_effects:
  - free access at the boundary
  - form-side charge
  - Student access before payment
  - rolling trial
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-178

School submission creates one adult sales lead and acknowledgment but no automatic access, nurture, or subscription.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-178-SCHOOL-INQUIRY-NO-ACCESS
  kind: public_journey
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - submit school name, contact first name, contact last name, and email with optional phone/note omitted
  - read back the durable acknowledgment and safely matched GHL adult lead/manual-follow-up record
  - repeat the normalized email and inspect deduplication
  - inspect local accounts, households, Students, subscriptions, access projections, campaigns, and workflow enrollments
  expected_results:
  - one adult School lead and one acknowledgment exist, and repeat submission does not create a duplicate adult
    contact
  - no Parent login, passwordless claim, household, Student, subscription, or product access is created
  - no Family, newsletter, conversion, reactivation, or other automated nurture workflow begins
  forbidden_effects:
  - automatic product access
  - automatic subscription
  - Family conversion
  - nurture enrollment
  - duplicate GHL contact
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-229

The public School form collects exactly school/contact fields, displays the approved CTA and success copy, and creates only a deduplicated adult lead plus manual follow-up—never product access or nurture.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007, OTV2-SIGNUP-176, OTV2-SIGNUP-178`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-229-PUBLIC-SCHOOL-INQUIRY
  kind: public_journey
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - open /school signed out and inventory required, optional, and absent fields
  - submit school name, contact first/last name, and email with phone/note empty
  - inspect the durable success screen and provider/local readback
  - repeat the same normalized email and inspect dedupe and follow-up behavior
  expected_results:
  - required fields are exactly school name, contact first name, contact last name, and email; phone and note are
    optional
  - CTA is “Send school inquiry” and success is “Thanks—we received your school inquiry. We’ll be in touch shortly.”
  - one safely matched adult lead and manual follow-up exist with no password, household, Student, subscription,
    access, Family conversion, or nurture enrollment
  forbidden_effects:
  - product account
  - automatic access
  - subscription
  - nurture enrollment
  - duplicate adult contact
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SCHOOL-200

Approved School accounts reuse the Parent/Student product model while pricing and seat allowance are set manually.

- Area: `SCHOOL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `sales_and_accounts`
- Semantic acceptance dependencies: `OTV2-SIGNUP-176, OTV2-GHL-119`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SCHOOL-200-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Approved School accounts reuse the Parent/Student product model while pricing and seat allowance are set manually.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SCHOOL-214

No School authorization role, school-specific portal, bulk roster, or automated school nurture exists at launch.

- Area: `SCHOOL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `sales_and_accounts`
- Semantic acceptance dependencies: `OTV2-SIGNUP-176, OTV2-GHL-119`
- Source references: `04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SCHOOL-214-AC01
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
  - No School authorization role, school-specific portal, bulk roster, or automated school nurture exists at launch.
  forbidden_effects:
  - hidden-but-callable mutation
  - stale navigation
  - provider action from a retired subsystem
  evidence_profile: absence_inventory
  cleanup: remove only disposable operator-owned probe records; absence must remain
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-ADMIN-022

Admin can create/edit/archive/restore adult contacts.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-022-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Admin can create/edit/archive/restore adult contacts.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-023

Admin can create/edit/archive/restore households.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-023-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Admin can create/edit/archive/restore households.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-024

Admin can assign or transfer the sole household account owner through verified ownership transfer.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-024-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Admin can assign or transfer the sole household account owner through verified ownership transfer.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-025

Admin can create additional Admin accounts.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-025-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Admin can create additional Admin accounts.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-026

Admin can create Parent accounts.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-026-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Admin can create Parent accounts.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-027

Admin can create/edit/archive/restore Students.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-027-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Admin can create/edit/archive/restore Students.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-028

Admin can manage Student credentials.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-028-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Admin can manage Student credentials.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-030

All Admin mutations persist after refresh and re-login.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-030-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - All Admin mutations persist after refresh and re-login.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-021

Admin Dashboard contains real operational data only.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-021-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Admin Dashboard contains real operational data only.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-029

Admin can view communications, tickets, billing/access, audit, integrations, and operations.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-029-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Admin can view communications, tickets, billing/access, audit, integrations, and operations.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-205

Global Admin search finds authorized adults, households, Students, classes, content, questions, and tickets without placing private search terms in URLs.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-205-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Global Admin search finds authorized adults, households, Students, classes, content, questions, and tickets
    without placing private search terms in URLs.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
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
