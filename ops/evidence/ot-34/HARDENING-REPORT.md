# OT-34 First-Slice Core Hardening Report

Date: 2026-07-14

Branch: `codex/ot34-first-slice-core-hardening`

Base: `a73458d1884b8fcb4843c4852425009577f59ef7`

Stacked base branch: `codex/crm-core-v1`

Scope: standalone One Time auth, lead, CRM API, contracts, config, migration,
and focused tests. No client UI files, workflows, production database, deploy,
external transport, provider mutation, BNA runtime, or PR #1/#2 branch update was
performed.

## Preflight

- Confirmed source worktree: `C:\Users\User\OneTimeOneTime-crm-core-v1`.
- Created dedicated worktree:
  `C:\Users\User\OneTimeOneTime-ot34-core-hardening`.
- Confirmed origin: `https://github.com/webcraft-media/onetimev2.git`.
- Confirmed required base: `a73458d1884b8fcb4843c4852425009577f59ef7`.
- Confirmed foundation ancestor:
  `3465bd7d4c6b6829a6be6e4b4f8a003d608f3680`.
- Confirmed `merge-base --is-ancestor` passed for foundation -> base.
- Read `AGENTS.md` and `ops/evidence/ot-24/PR2-HARDENING-GATE.md`.

## Implementation Summary

- Authenticated unsafe writes now require an explicit submitted CSRF header/body
  token; the CSRF cookie alone is not accepted as proof.
- `/login` and `/api/v1/auth/*` responses are `Cache-Control: no-store`.
- Login throttling is persisted in PostgreSQL via
  `onetime.login_throttle_buckets`, using hashed email/IP buckets and atomic
  failure increments.
- Nonexistent-account login verifies a fixed dummy Argon2 hash and returns the
  same generic invalid-credential result.
- Session user output now truthfully reports `auth_assurance: password_only` and
  `mfa_verified: false`; `AUTH_REQUIRE_VERIFIED_MFA=true` fails owner/admin login
  closed until a real factor exists.
- CRM list cursors are HMAC-signed, versioned, time-bounded, and bound to
  account, product, sort, limit, search, classification, status, source, and
  assignee filters.
- CRM assignee create/update/filter/join use is restricted to active users in the
  same account and product.
- Manual CRM contacts default to `reminder_preference=none` and
  `suppression_state=suppressed_no_consent`; edits do not enqueue outbox sends.
- Lead idempotency compares canonical request hashes. Same key + same payload
  replays the original response with `duplicate_submission=true`; same key +
  different payload returns a safe conflict before writes.
- Public duplicate-phone/different-email submissions return a generic conflict
  with no existing contact key or PII and no partial writes.
- Archived exact-email public signups reactivate the contact, clear
  `archived_at`, set `lead_status=new`, update only newly consented
  communication/consent/activity fields, preserve CRM-owned fields, and append a
  public reactivation audit event.
- Phone normalization accepts explicit E.164 `+country...` and leading `00`
  international prefixes; ambiguous local/national numbers fail with a field
  instruction.

## Migration

New migration:

- `packages/db/migrations/0003_first_slice_hardening.sql`

SHA-256:

- `f77336ec15c385d8177e23371ef22d3de89eccbf3fe00300ef4cdb83325ec42e`

Fresh in-memory migration readback:

```json
{
  "0001_onetime_lead_slice": "c6290bffe0fd832332d6c72f44c7499bf4ab56155e70875ff1d2c76d9fa667c0",
  "0002_crm_auth_core": "be47978a67c11f058bea4e2216305ca76e3eeb4e52af4cf2e931b3d9b7c3b09c",
  "0003_first_slice_hardening": "f77336ec15c385d8177e23371ef22d3de89eccbf3fe00300ef4cdb83325ec42e"
}
```

Readback also inserted and selected a synthetic
`onetime.login_throttle_buckets` row with hashed bucket columns only.

## OT-24 Finding Disposition

| # | Finding | OT-34 disposition | Evidence |
|---|---|---|---|
| 1 | MFA is readiness metadata, not verified second factor. | Truthfully downgraded / activation blocked. Output now says password-only and `mfa_verified=false`; verified-MFA env fails owner/admin closed. | `tests/integration/auth-crm.test.ts` MFA and role-label tests. |
| 2 | Authenticated write CSRF accepted cookie-only proof. | Fixed. | Explicit CSRF happy/body-only and cookie-only/mismatch/cross-session negative tests. |
| 3 | Login throttling process-local. | Fixed. | Migration `0003`, durable throttle test across a second app instance, concurrency test. |
| 4 | Nonexistent-account login skipped Argon2. | Fixed. | Dummy verification-path test hook proves `dummy` branch. |
| 5 | Login/CSRF responses lacked no-store. | Fixed. | Header assertions for `/login`, login response, and session response. |
| 6 | CRM cursors unsigned and unbound. | Fixed. | Valid/tampered/wrong-query/wrong-account/wrong-product/stale-version/expired cursor tests. |
| 7 | `assigned_user_key` lacked same-scope enforcement. | Fixed. | Active same-scope success and cross-account/cross-product/disabled-user negative tests. |
| 8 | Manual contacts defaulted to outreach eligibility. | Fixed. | Manual create test asserts `none` and `suppressed_no_consent`; outbox count remains zero. |
| 9 | Idempotency keys did not compare request hashes. | Fixed. | Same-payload replay and mismatched-payload conflict tests with row-count proof. |
| 10 | Reused key with different input replayed old response. | Fixed. | Same as #9; API returns `IDEMPOTENCY_CONFLICT`. |
| 11 | Same phone/different email could 500. | Fixed. | Domain and API duplicate-phone conflict tests, no partial rows. |
| 12 | Leading-zero numbers forced to `+972`. | Fixed. | Unit normalization matrix for `+`, `00`, local ambiguous, and raw national formats. |
| 13 | Archived public signup overwrote CRM-owned fields. | Fixed. | Archived reactivation preservation and audit-event test. |
| 14 | Performance evidence was not throttled-mobile p75 proof. | Truthfully downgraded / still release-blocked for p75 claim. | Local performance regression suite passed, but no p75 release claim was added. |
| 15 | Touch-target proof used height OR width. | Still blocked/out of OT-34 edit scope. | `tests/e2e/**` was outside exclusive ownership; no touch-target compliance claim added. |

## Query Discipline

`tests/integration/auth-crm.test.ts` instruments the test pool and asserts:

- synthetic CRM list path: `<= 3` SQL calls for request/session/list.
- synthetic CRM detail path: `<= 3` SQL calls for request/session/detail.

This covers bounded request behavior and avoids per-row assignee lookup on list
and detail paths.

## Verification

Passed:

- `npm ci`
- `npm run secret:scan`
- scoped Prettier check on touched TypeScript files
- `npm run lint`
- `npm run typecheck`
- `npm run unit` - 1 file, 7 tests passed
- `npm run integration` - 3 files, 22 tests passed
- `npm run e2e` - 7 Playwright tests passed
- `npm run accessibility` - 3 Playwright/axe tests passed
- `npm run performance` - 3 Playwright tests passed and bundle check reported:
  `public_js_bytes=5646`, `public_css_bytes=10626`, `crm_js_bytes=204369`
- `git diff --check`
- fresh in-memory migration checksum/readback

Known verification blocker:

- `npm run format` and therefore `npm run verify` fail on baseline files outside
  OT-34 ownership, including workflows, client files, package metadata, scripts,
  and existing tests. Touched OT-34 TypeScript files pass scoped Prettier. The
  format blocker was not mass-fixed because OT-34 explicitly forbids editing many
  of the failing baseline files.

## External Mutations

At report-writing time:

- No deploy.
- No live database migration.
- No production data access.
- No email, WhatsApp, Telegram, payment, provider, Railway, DNS, or BNA
  mutation.
- Expected remaining external mutation: push
  `codex/ot34-first-slice-core-hardening` and open one draft stacked PR.

## Unresolved Decisions

- Real verified MFA provider/challenge flow remains an explicit activation
  blocker.
- Release-grade throttled-mobile p75 performance proof remains outside this
  core-hardening implementation.
- Touch-target assertion repair remains outside this lane's exclusive edit
  ownership.
