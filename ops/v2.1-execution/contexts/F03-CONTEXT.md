# F03 — Adult and Student Authentication — Locked Context

**Outcome:** Deliver exact email/password adult authentication and username/password Student authentication with the locked password, setup, reset, session, rate-limit, revocation, and no-MFA policy.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `IDENTITY_AUTH_ACCESS`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F02`
- Full merge after: `F02`
- Candidate integration partners (non-ordering): `F07`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/auth/**`
- `apps/web/src/server/features/auth/**`
- `packages/contracts/src/identity/auth/**`
- `packages/domain/src/auth/**`

Scope notes below explain intent but do not grant additional path authority:

- apps/web/src/client/auth/** except shared shell/global CSS
- auth/security focused tests
- steward requests for central registration/config/migrations

## Deliverables

- adult and Student credential/session services
- setup/reset/revocation flows
- generic enumeration-safe responses and rate limits
- removal of routine MFA/email-challenge behavior from the current product path

## Relevant locked decisions (10)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-012 | LOCKED | Routine Admin and Parent authentication is email plus password through one adult credential per normalized email. Routine Student authentication is username plus password. |
| DEC-013 | LOCKED | MFA is not a launch capability—mandatory or optional—and no routine six-digit email challenge exists. Admin and Parent login use email plus password. |
| DEC-014 | LOCKED | Students never require or receive an email address. No Student is created as a HighLevel contact. |
| DEC-015 | LOCKED | A Parent creates and manages up to three active Student seats and can set or reset each Student username/password. Existing passwords are never displayed. |
| DEC-023 | INFERRED | Admin/Parent passwords are 12–128 characters and Student passwords are 8–64. There is no composition rule; compromised/common values and values equivalent to the relevant email/username/name are rejected. Passwords use a versioned Argon2id hash and are never transformed silently. |
| DEC-024 | INFERRED | Admin sessions idle at 30 minutes and expire absolutely at 12 hours; Parent sessions idle at 24 hours and expire at 30 days; Student sessions idle at 7 days and expire at 30 days. Login allows five failures per account+IP per 15 minutes and 50 per IP; reset allows five/account/hour and 20/IP/hour; setup resend allows three/account/hour. Responses are generic and no permanent lockout exists. |
| DEC-052 | INFERRED | A legacy invitation, Admin-created adult, ownership-transfer acceptance, or other passwordless claim uses a single-use setup link valid for seven days. A fresh link may be requested at any time; issuing it invalidates earlier unused links. Fresh public Family signup sets a password directly and does not depend on setup email. |
| DEC-053 | INFERRED | Password-reset links are single-use and valid for 60 minutes. Reset expiry does not affect the account; the user can request another link. |
| DEC-092 | LOCKED | Resend sends account setup, password recovery, and security messages. |
| DEC-120 | INFERRED | Human account lifecycle is `invited`, `active`, `disabled`, `archived`. “Archived” is retained history and cannot log in; “disabled” is reversible access suspension. |

## Acceptance requirements and exact cases (16 requirements)


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
