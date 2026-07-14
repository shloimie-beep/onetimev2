# OT-24 PR2 Hardening Gate

Date: 2026-07-14

Repository: `webcraft-media/onetimev2`

Branch: `codex/crm-core-v1`

PR: https://github.com/webcraft-media/onetimev2/pull/2

Scope: release-train reconciliation and hardening audit only. This file records the
PR2 release blockers found after merging the updated foundation branch into the CRM
branch. No production deployment, production database change, external send, payment
change, access grant, or PR merge was performed.

## Release-Train State

- PR1 foundation branch head merged into PR2 with an ordinary merge commit:
  `merge: bring foundation release gates into CRM core`.
- The merge preserves the Toronto image/content commit from PR1 and brings the
  foundation CI, secret scan, landing screenshot proof, and strengthened landing
  tests into the PR2 branch.
- This audit did not rewrite PR1 or PR2 history.

## Verdict Summary

| # | Gate item | Verdict | Evidence | Release note |
|---|---|---|---|---|
| 1 | MFA is only a boolean readiness flag, not verified second-factor auth. | CONFIRMED | `packages/domain/src/auth/service.ts:112-120` stores `mfa_capable`; `packages/domain/src/auth/service.ts:174-180` reads it with password hash; `packages/domain/src/auth/service.ts:207-217` only blocks production owner/admin login when the flag is false. | Release should not claim MFA enforcement until a challenge/verification flow exists. |
| 2 | Authenticated write CSRF can accept the CSRF cookie itself rather than requiring an explicit submitted token. | CONFIRMED | `apps/web/src/server/app.ts:236`, `apps/web/src/server/app.ts:283`, and `apps/web/src/server/app.ts:324` call `requireSessionCsrf`; `apps/web/src/server/app.ts:373-381` falls back to `getCookie(req, CSRF_COOKIE)`. | Require header/body token for unsafe methods; cookie-only fallback weakens the double-submit boundary. |
| 3 | Login rate limiting is process-local and restartable. | CONFIRMED | `packages/domain/src/auth/service.ts:22` uses a module-level `Map`; `packages/domain/src/auth/service.ts:463-482` reads/writes it; `packages/domain/src/auth/service.ts:41-42` clears it for tests. | Release should not present this as durable distributed protection. |
| 4 | Nonexistent-account login skips Argon2 verification. | CONFIRMED | `packages/domain/src/auth/service.ts:174-180` fetches a row and runs `verifyPassword` only when `row` exists. | Adds user-enumeration timing risk; consider a constant dummy hash path. |
| 5 | Login/CSRF page lacks explicit `no-store`. | CONFIRMED | `apps/web/src/server/app.ts:103-111` serves `/login` and sets the CSRF cookie without a cache-control header; `apps/web/src/server/app.ts:124` and `apps/web/src/server/app.ts:253` show `no-store` exists on other authenticated/session responses. | Add no-store to pages and responses carrying CSRF or auth-sensitive state. |
| 6 | CRM cursors are unsigned and not bound to account/filter/sort. | CONFIRMED | `packages/domain/src/crm/service.ts:90` decodes the cursor; `packages/domain/src/crm/service.ts:155` encodes only sort/value/contact id; `packages/domain/src/crm/service.ts:459-475` base64url encodes/decodes JSON with no signature and returns only value/contact id. | Treat cursors as tamperable until signed and bound to the active query/account context. |
| 7 | `assigned_user_key` lacks same-account/product membership enforcement. | CONFIRMED | `packages/contracts/src/index.ts:147` and `packages/contracts/src/index.ts:164` accept a raw string; `packages/domain/src/crm/service.ts:85-87` filters by that string; `packages/domain/src/crm/service.ts:127` and `packages/domain/src/crm/service.ts:174` join only on `users.user_key`; `packages/domain/src/crm/service.ts:205` and `packages/domain/src/crm/service.ts:281-284` assign without validating membership. | Validate assignee existence and scope before create/update/list joins. |
| 8 | Manual contacts default to email/reminder eligibility without consent. | CONFIRMED | `packages/domain/src/crm/service.ts:212-218` inserts `reminder_preference = 'email'`, `suppression_state = 'active'`, and `source = 'manual_crm'`; `packages/domain/src/crm/service.ts:413-415` reports consent as `not_recorded` when `consent_recorded_at` is empty. | Manual CRM records should default to no outreach eligibility unless consent is recorded. |
| 9 | Lead idempotency keys are not checked against stored request hashes. | CONFIRMED | `packages/domain/src/lead/service.ts:58-66` looks up only by idempotency key and returns the previous response; `packages/domain/src/lead/service.ts:74-83` stores `request_hash` but no replay path compares it. | Reusing a key with a different payload should return a conflict, not a replay success. |
| 10 | Duplicate/replay responses can report the wrong prior result when a key is reused with different input. | CONFIRMED | `packages/domain/src/lead/service.ts:64-66` returns the prior `response_json` with `duplicate_submission: true` without comparing the current payload hash. | Same root cause as item 9; release tests only cover same-payload replay. |
| 11 | Shared-phone/different-email public signup can produce a 500. | CONFIRMED | `packages/db/migrations/0001_onetime_lead_slice.sql:25-27` creates a unique phone identity index; `packages/domain/src/lead/service.ts:106-120` handles only email conflict upserts; `apps/web/src/server/app.ts:128-148` converts unhandled lead errors into `SERVER_ERROR`. | Add explicit duplicate-phone handling on public lead capture before release hardening. |
| 12 | Leading-zero international numbers are forced to `+972`. | CONFIRMED | `packages/domain/src/lead/normalize.ts:8-14` strips non-digits and maps any value starting with `0` to `+972...`. | This is Israel-friendly but not international-safe. |
| 13 | Public signup can reopen archived contacts and overwrite CRM-owned fields. | CONFIRMED | `packages/domain/src/lead/service.ts:106-120` updates an existing email match and sets display/location/timezone/phone/reminder fields; `packages/domain/src/lead/service.ts:119` changes archived leads back to `new`. | Separate public lead capture from archived/CRM-owned contact state or require explicit reopen policy. |
| 14 | Performance evidence is not throttled-mobile p75 proof. | CONFIRMED | `tests/performance/public-performance.spec.ts:3-17`, `tests/performance/public-performance.spec.ts:21-30`, and `tests/performance/public-performance.spec.ts:45-77` use local single-run usable timing; `ops/evidence/ot-12/FINAL-REPORT.md:64-66` reports local usable-mark budgets; no p75 or throttling evidence is recorded. | Keep current tests as smoke gates, but do not treat them as release-grade mobile performance proof. |
| 15 | Touch-target proof uses height OR width instead of both. | CONFIRMED | `tests/e2e/crm-core.spec.ts:72-78` maps visible controls and asserts `target.height >= 44 || target.width >= 44`. | Use `&&` or per-control exceptions before claiming full touch-target compliance. |

## Required Hardening Before Release Claim

1. Implement real MFA verification or downgrade claims to an MFA-readiness guard.
2. Require explicit CSRF header/body tokens for unsafe authenticated writes.
3. Move login throttling to durable storage and add constant-work invalid-login behavior.
4. Add `no-store` to login and any auth/CSRF-bearing responses.
5. Sign and bind CRM cursors to account, product, query filters, and sort.
6. Enforce assignee account/product membership.
7. Default manual contacts to no-send/no-reminder eligibility until consent is recorded.
8. Compare idempotency replay hashes and reject mismatched replays.
9. Handle phone duplicate conflicts intentionally in public lead capture.
10. Define archived-contact public signup behavior before allowing reopen/update.
11. Add throttled-mobile p75 performance evidence if that claim is release blocking.
12. Fix touch-target assertions to require both dimensions or documented exceptions.

## Verification

- Source audit completed against the PR2 branch after the foundation merge.
- Local and GitHub CI results are recorded in the OT-24 closeout response.
