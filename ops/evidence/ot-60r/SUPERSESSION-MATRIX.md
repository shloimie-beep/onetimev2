# OT-60R Supersession Matrix

## Verdict

PR #3 / OT-34 and PR #9 / OT-38 remain superseded as implementation trains.
Do not merge their migrations, alternate credential/session/public-ID/MFA model,
or whole-file auth/CRM changes into OT-60R.

One narrow security property was missing from canonical base `4ac2889`: the
HMAC-derived login-CSRF proof pattern from PR #9. That property was intentionally
ported as an OT-60R integration change with tests, without importing PR #9's
alternate migration/model.

## Feature Comparison

| Security property | Canonical PR #2 base `4ac2889` | PR #3 / OT-34 | PR #9 / OT-38 | OT-60R decision |
| --- | --- | --- | --- | --- |
| Canonical migration namespace | Has `0002_crm_auth_core.sql` and `0003_ot27_security_crm_repair.sql`. | Adds divergent `0003_first_slice_hardening.sql`. | Based on PR #3 and adds `0005_privileged_mfa_security_completion.sql`. | Keep PR #2 canonical migrations; do not import PR #3/#9 migrations. |
| `security_version` session invalidation | Present in migration and auth service. | Divergent older session/security model. | Alternate model. | Keep PR #2. |
| `public_contact_id` cursor/public ID model | Present in `0003_ot27_security_crm_repair.sql` and CRM service. | Divergent contact changes. | Alternate model. | Keep PR #2. |
| Real owner/admin TOTP and recovery-code MFA | Present via `mfa_factors`, `mfa_challenges`, `mfa_recovery_codes`, TOTP/recovery services and tests. | Older/partial model. | Adds stronger MFA line but through alternate train. | Keep PR #2. |
| POST-body CRM search | Present at `/api/v1/crm/contacts/search` and used by CRM client/tests. | Not the canonical target. | Alternate train overlaps. | Keep PR #2. |
| Session CSRF | Present as stored session CSRF hash. | Older simple session token shape. | HMAC proof for session CSRF as part of larger alternate train. | Leave PR #2 session model unchanged for now. |
| Login CSRF | Base used cookie/submitted equality in `apps/web/src/server/app.ts`. | Older equality pattern. | HMAC proof token generated from CSRF cookie, nonce, scope, and `AUTH_CSRF_SECRET`. | Port only this property. |

## Ported Files

- `.env.example`
- `apps/web/src/server/app.ts`
- `packages/config/src/index.ts`
- `packages/domain/src/auth/service.ts`
- `packages/domain/src/index.ts`
- `tests/integration/auth-crm.test.ts`

## Verification

- `npm ci`: PASS, 348 packages installed, 0 vulnerabilities reported.
- `npm run typecheck`: PASS.
- `npx prettier --check <touched supported files>`: PASS.
- `npm run secret:scan`: PASS.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.

## Explicit Non-Imports

- Did not import `0003_first_slice_hardening.sql`.
- Did not import `0005_privileged_mfa_security_completion.sql`.
- Did not replace PR #2's auth/session/MFA/session invalidation/public contact model.
- Did not ordinary-merge PR #3 or PR #9 ancestry.
