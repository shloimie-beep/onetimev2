# OT-38 Final Report

## Scope

Task: complete the real privileged MFA and residual security correction on top of `codex/ot34-first-slice-core-hardening`.

Base branch: `codex/ot34-first-slice-core-hardening`  
Required base SHA verified: `87f9b315c54e32e918912cc100610e2c561b68ac`  
Required ancestor verified: `3465bd7d4c6b6829a6be6e4b4f8a003d608f3680`  
Work branch: `codex/ot38-real-mfa-security-correction`

Note: the final commit SHA is the Git commit containing this report and is recorded in PR metadata / `git rev-parse HEAD` after commit.

## Changed Files

- `apps/web/src/server/app.ts`
- `apps/web/src/client/public/public-entry.ts`
- `apps/web/src/client/app/crm-entry.tsx`
- `packages/config/src/index.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/auth.ts`
- `packages/contracts/src/search.ts`
- `packages/contracts/src/timezone.ts`
- `packages/db/migrations/0005_privileged_mfa_security_completion.sql`
- `packages/domain/src/auth/service.ts`
- `packages/domain/src/auth/totp.ts`
- `packages/domain/src/crm/service.ts`
- `packages/domain/src/index.ts`
- `packages/domain/src/lead/normalize.ts`
- `packages/domain/src/lead/service.ts`
- `playwright.config.ts`
- `tests/accessibility/public-a11y.spec.ts`
- `tests/e2e/crm-core.spec.ts`
- `tests/integration/auth-crm.test.ts`
- `tests/integration/lead-capture.test.ts`
- `tests/performance/public-performance.spec.ts`
- `tests/support/mfa-login.ts`
- `tests/support/test-server.ts`
- `tests/unit/totp.test.ts`
- `ops/evidence/ot-38/FINAL-REPORT.md`

## Migration

Migration: `packages/db/migrations/0005_privileged_mfa_security_completion.sql`  
SHA-256: `2DED1860079FE959EC7B57C9A4E5FB314A867A7EBC5AA6741464B1CDE5F79BB5`

Adds MFA pre-auth/factor/recovery/throttle tables, session credential/session versions, MFA session assurance columns, random contact `public_id`, CRM create idempotency records, and supporting indexes.

## Dependency Decision

No dependency was added. TOTP/HOTP, Base32, HMAC, AES-256-GCM, token generation, and password/session hashing use Node's built-in cryptographic primitives. RFC 6238 SHA-1 vectors are covered in unit tests.

## MFA Threat Model

- Password success for owner/admin creates only a short-lived product/account-scoped pre-auth transaction.
- Pre-auth cookies/tokens cannot call CRM APIs and never create a privileged app session by themselves.
- Enrollment secrets are random, emitted only in the enrollment step as an `otpauth://` URI, encrypted at rest with versioned AES-256-GCM config, and not returned after enrollment completes.
- TOTP verification uses a narrow +/-1 time-step window, persists last accepted counter, and rejects same/older counter replay.
- Recovery codes are displayed once, stored only as hashes, consumed atomically, audited without the code value, and trigger session-family revocation/version advancement.
- Privileged sessions are created only after password plus MFA, with `mfa_verified=true` and `auth_assurance=mfa`.
- Session reads validate user status, credential version, session version, revocation, expiry, and privileged MFA assurance.
- Login/session/CRM/auth responses are `Cache-Control: no-store`.
- Login and session CSRF proofs are HMAC proofs independent from the cookie secret.

## Negative-Test Matrix

Covered locally:

- RFC TOTP vectors, invalid code, drifted code, expired code, replayed counter.
- Privileged password-only pre-auth cannot call CRM.
- Viewer remains password-only and capability-scoped.
- MFA encryption config missing fails privileged login closed.
- Encrypted factor row does not contain the Base32 or Base64URL plaintext secret.
- Recovery code single-use replay is rejected.
- Password change invalidates an existing privileged session.
- Nonexistent-account password verification uses the dummy path.
- Login CSRF required; session CSRF body/header proof required; cookie-only and cross-session CSRF fail.
- Return-path matrix rejects external/protocol-relative/login-loop/API/backslash/encoded-separator values.
- GET CRM search with PII is rejected; POST body search is used instead.
- Browser e2e asserts the searched email is absent from requested URLs.
- Cursor signatures reject tampering, stale version, expiry, and wrong account/product/filter context.
- Contact public IDs are random, stable, and not the deterministic internal identity key.
- Manual CRM create requires idempotency, replays same payload, conflicts changed payload, and emits no outbox writes.
- Assignee scope remains account/product/status-bound.
- IANA timezone validation is shared by public lead and CRM contact contracts.
- Session `last_seen_at` refresh is bounded by config.

Not fully covered / not production-ready:

- Fresh and upgrade migration plus EXPLAIN evidence on real non-production PostgreSQL is blocked here because no safe `DATABASE_URL`/PG env is available.
- Factor replacement/disablement and recovery-code regeneration settings endpoints are not exposed in the current CRM surface; the underlying session-family revocation/version primitives exist, but the user-facing re-auth flows remain future work.
- Concurrent recovery-code double-use is covered by atomic update semantics and sequential replay tests locally, but not proven under real PostgreSQL concurrency in this environment.

## Commands And Results

- `npm install` - passed, 0 vulnerabilities reported by install.
- `npm run typecheck` - passed.
- `npm run unit` - passed, 2 files / 10 tests.
- `npm run integration` - passed, 3 files / 25 tests.
- `npm run lint` - passed.
- `npm run secret:scan` - passed across 85 repo text files.
- `npm run build` - passed.
- `npm run e2e` - passed, 7 tests.
- `npm run accessibility` - passed, 3 tests.
- `npm run performance` - passed, 3 tests; bundle check: `public_js_bytes=7295`, `public_css_bytes=10626`, `crm_js_bytes=204657`.
- `npx prettier --check <touched files>` - passed.
- `git diff --check` - passed.
- `npm run db:verify` - blocked: `DATABASE_URL is required for PostgreSQL-backed runtime.`
- `npm run format` - blocked by pre-existing repo-wide formatting baseline across untouched files; touched files pass Prettier.

## External Mutations

No production data, real users, secrets, provider calls, sends, payments, or live third-party authentication providers were used.

## Current Git Status At Report Time

The worktree contains the OT-38 implementation and this evidence report, pending stage/commit/push on `codex/ot38-real-mfa-security-correction`.
