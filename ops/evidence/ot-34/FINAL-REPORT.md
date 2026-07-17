# OT-34 / OT-27 Addendum Evidence

Date: 2026-07-14

Repository: `webcraft-media/onetimev2`

Branch: `codex/crm-core-v1`

Starting head before this local patch set: `a73458d1884b8fcb4843c4852425009577f59ef7`

Source intake: `ops/audit-inputs/ot-34/OT-27-ADDENDUM.md`

Source SHA-256: `FE94E1DBA87A06F72ED4EE723D8212FCF7CAEDE4AFF083FD005B7DA42453B3E5`

No production deployment, production database migration, external send, payment,
access grant, DNS change, or PR merge was performed.

## Implemented Coverage

- Removed unauthenticated `Server-Timing` disclosure. Internal timing remains available
  to request-scoped logs; caller-visible timing is exposed only after a valid private
  session.
- Moved login and public-lead throttling to durable database-backed budgets with IP,
  identifier, account/product, and global scopes. The `/api/v1/leads` and
  `/api/one-time/interest` aliases share the same lead budget.
- Configured explicit trusted proxy hops through `TRUSTED_PROXY_HOPS`.
- Added session security-version binding, user-agent hash enforcement, bounded
  `last_seen_at` writes, and user-session family revocation helpers.
- Applied private `no-store` controls to login, session, MFA, and CRM private API
  responses, including errors.
- Hardened `return_to` canonicalization against control characters, backslashes,
  scheme-relative values, other origins, API paths, and encoded backslash tricks.
- Added migration `0003_ot27_security_crm_repair` for security/session/MFA/rate-limit
  tables, random public contact IDs, idempotency metadata, indexes, and deterministic
  PostgreSQL-only signup repair.
- Replaced mutable-email-derived contact identity for new contacts with random internal
  contact keys and random public contact IDs while keeping legacy lookup compatibility.
- Added request-hash idempotency conflict handling for public leads and manual CRM create.
- Required manual CRM create idempotency keys and guarded creation with an advisory lock
  plus database constraints.
- Added validated CRM response DTOs, IANA timezone validation, same-account/product
  assignee discovery, and normal UI assignment through discovered users.
- Moved CRM search PII out of query strings through CSRF-protected
  `POST /api/v1/crm/contacts/search`; `GET /api/v1/crm/contacts?search=...` now fails
  with `SEARCH_POST_REQUIRED`.
- Implemented owner/admin TOTP challenge login with encrypted secrets, hashed expiring
  enrollment tokens, limited pre-auth challenge state, replay protection, recovery-code
  login, recovery-code replacement, MFA revocation, session assurance method, and
  session-family revocation on MFA policy changes.
- Fixed authenticated unsafe CSRF validation so the CSRF cookie alone is not accepted.
- Moved the browser MFA prompt to the login flow and supports either authenticator code
  or recovery code.

## Negative Matrix Consumed Locally

- Hostile `return_to` is rejected and login failures do not expose `Server-Timing`.
- Login CSRF is required and failed logins hit durable rate limits.
- Authenticated unsafe methods reject cookie-only CSRF.
- Session API uses `no-store`; security-version bumps invalidate existing sessions.
- Owner/admin password success returns a limited MFA challenge, not a full session.
- TOTP time-step replay is rejected.
- Recovery codes work once, old codes fail after replacement, and replacement revokes
  the active session family.
- CRM URL search is rejected; private POST search succeeds with CSRF.
- Manual CRM create requires idempotency, same-key replay returns the same contact, and
  same email duplicate returns a privacy-safe duplicate response.
- Viewer writes are forbidden and cross-account contacts remain hidden from list/search.
- CRM detail/create/update responses are parsed through response DTO schemas.
- Public lead aliases share one durable budget.

## Verification

- `npm run secret:scan` - pass.
- `npx prettier --check --ignore-unknown <OT-34 touched files>` - pass.
- `npm run lint` - pass.
- `npm run unit` - pass, 7/7.
- `npm run build` - pass, including client bundles, static page build, and typecheck.
- `npm run integration -- --run tests/integration/auth-crm.test.ts tests/integration/api-rate-limit.test.ts tests/integration/lead-capture.test.ts` - pass, 15/15.
- `git diff --check` - pass.

## Open Evidence Blockers

- Real PostgreSQL migration repair fixtures and EXPLAIN/latency evidence were not run in
  this local session. `DATABASE_URL` is not set, `docker` is unavailable, and `psql` is
  unavailable. The migration keeps PostgreSQL-only repair SQL behind explicit markers so
  pg-mem tests can still run without misrepresenting pg-mem as release-grade database
  proof.
- No PR merge or deployment smoke was performed because the addendum explicitly keeps the
  branch as a draft stacked PR.
