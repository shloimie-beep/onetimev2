# F04 — Adult Identity, Household Ownership, Roles, and Context Switching — Locked Context

**Outcome:** Implement one normalized adult identity, exact roles, multi-household ownership, Admin/Parent context switching, household switching, and verified ownership-transfer invariants.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `ACCOUNT_HOUSEHOLD_IDENTITY`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F02`
- Full merge after: `F02`
- Candidate integration partners (non-ordering): `F03`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/server/features/accounts/**`
- `packages/contracts/src/access/**`
- `packages/contracts/src/accounts/**`
- `packages/db/src/accounts/**`
- `packages/domain/src/access/**`
- `packages/domain/src/accounts/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/accounts/** except migrations and central index
- account and tenant-isolation tests
- steward requests for central registration/migrations

## Deliverables

- adult identity and role membership contract
- household ownership and switching contract
- safe ownership transfer workflow
- cross-household isolation enforcement

## Relevant locked decisions (7)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-012 | LOCKED | Routine Admin and Parent authentication is email plus password through one adult credential per normalized email. Routine Student authentication is username plus password. |
| DEC-017 | LOCKED | An adult who wants to learn may use one of the household’s three Student seats by creating a separate Student profile and separate Student credentials for themselves. This is not a Parent “Learner Mode.” |
| DEC-018 | LOCKED | One Parent/account-owner login is permitted per household. There is no simultaneous co-guardian access at launch. |
| DEC-019 | LOCKED | The same adult identity may own multiple separate household subscriptions. Each household has its own billing/access state and up to three Student seats. |
| DEC-020 | INFERRED | One normalized email maps to one adult identity and one HumanAccount/login with role memberships `admin`, `parent`, or both. A dual-role adult uses an explicit Admin/Parent context switcher; a multi-household Parent then uses the household switcher. Household transfer to an existing Admin adds Parent membership and never creates a duplicate adult or credential. |
| DEC-021 | INFERRED | Household ownership may be transferred through an Admin-assisted, verified email transfer. Transfer cannot complete while the outgoing adult has an active `self` Student in that household: it must first be archived or moved, with identity/history preserved, to another household the outgoing adult owns with an available seat. It is never auto-converted or given to the replacement. Dependent Students remain only after the replacement records current authority and required recording consent for each. The replacement accepts current policies and prior-owner household sessions are revoked. |
| DEC-030 | LOCKED | Learner age is not restricted by product rules. The account owner decides whom to create as a Student. |

## Acceptance requirements and exact cases (4 requirements)


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
