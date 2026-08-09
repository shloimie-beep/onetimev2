# One Time Complete Production Launch — Status

Snapshot date: 2026-08-09 (Asia/Jerusalem)

## Executive status

The current production release is deployed and healthy at exact source
`dcdc0756ac248466c1671f681f8605d1757f9b0c`. It includes the cross-page
v2.1 session repair: a valid host-only adult session is now recognized by the
protected shells and APIs that previously produced false `401` / “Session
expired” states. A fresh, normal operator sign-in and short protected-page
smoke is the remaining acceptance step for this release.

This is not a declaration that every launch area is complete. Zoom remains
fail-closed after a cleaned disposable canary, Family-signup HighLevel sync is
disabled pending its one bounded proof, and media/Drive and live billing remain
separate disabled workstreams.

## Current production identity and health

| Item                            | Current truth                                                                                                                                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository / integration branch | `shloimie-beep/onetimev2` / `codex/one-time-complete-production-launch-20260805`                                                                                                                                                                                  |
| Exact deployed source           | `dcdc0756ac248466c1671f681f8605d1757f9b0c`                                                                                                                                                                                                                        |
| Production web                  | Successful Railway deployment `41dd0e58-e111-4499-8ddd-01b81cad532b`                                                                                                                                                                                              |
| Production worker               | Successful Railway deployment `df76d339-7b88-42c0-a72b-76f9c2219da2`                                                                                                                                                                                              |
| Health and readiness            | App and Join `/health`, `/ready`, and `/version` all returned HTTP 200                                                                                                                                                                                            |
| Database migrations             | Remote read-only verification: 106 migration files, 106 ledger rows, 106 applied, zero pending, no issues; latest file `2275_family_signup_inactive_support_projection`                                                                                           |
| Worker and queues               | Fresh worker heartbeat; observed delivery, support, and account-lifecycle batches reported `claimed=0`, `delivered=0`, `retried=0`, `dead_lettered=0`                                                                                                             |
| Safety modes                    | Family-signup GHL disabled; Zoom classroom canary false; live billing flags false; media defaults off; Resend webhook-secret binding present on web and worker                                                                                                    |
| Rollback                        | Do not roll back automatically: this release is healthy. Retained preceding source is `9c54591ce11b133eb773ccbd9c5e7003c515f782`; prior successful web/worker deployment IDs are `8c2743a4-7a76-406f-a7ea-c55150a8d8c9` / `098c2077-a9d9-4977-a068-84e168d4afd8`. |

## Authentication and protected pages

PRs #150, #151, and #155 are integrated in the current release. Together they
repair the native Admin-session SQL defect and extend the shared v2.1/legacy
session resolver to the owner shells, CRM, live-console/Zoom routes, Content,
Learning, contact operations, directory, approved-schools, diagnostics, and
the relevant CSRF paths.

Expected behavior now:

- One normal Admin or Parent sign-in establishes the secure host-only session;
  protected pages must not ask for the password again.
- Admin-to-Parent and Parent-to-Admin switching replaces the active role
  session cleanly. An access-limited page should show access denied (`403`),
  not “Session expired” or a sign-in redirect.
- Student is a separate login/session. Use a private browser/profile for a
  Student journey if the adult session must remain open.

The post-deploy acceptance smoke is intentionally short: sign in once, open
Dashboard, Content, Contacts, Classes/Learning, Support, and Operations; switch
to Parent and check Parent calendar/support; switch back to Admin; refresh a
deep link; then log out and sign in again. Do not reuse or transmit a password,
cookie, or reset link in chat.

## UI scope map

| Area              | State                            | Current scope                                                                                                                                                                          |
| ----------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin portal      | Built and deployed               | Dashboard, contacts, content, classroom, communications, billing/access, and operations surfaces exist. Authentication smoke remains.                                                  |
| Parent portal     | Built and deployed               | Overview, Students, calendar, class detail, progress, billing, updates, preferences, support, account, and privacy routes exist.                                                       |
| Student portal    | Built and deployed               | Today, calendar, class detail, embedded classroom, library, progress, questions, updates, notifications, support, account, and privacy routes exist. Separate Student sign-in applies. |
| Calendars         | Built, not final-polish complete | Parent and Student schedules are chronological/list/card views (Student is Asia/Jerusalem-aware), rather than a finished month-grid calendar.                                          |
| Zoom classroom UI | Built, provider proof blocked    | Admin Live Console and embedded join surfaces exist, but live Zoom proof is not accepted; see below.                                                                                   |

## Provider and canary truth

### Zoom

The 2026-08-09 disposable production canary failed closed at Zoom registration
readback and was fully reconciled. Two disposable meetings were created and
deleted; provider inventory now has zero meetings and zero registrants. There
were zero embedded launches, attendance records, active enrollments, GHL
Student-contact changes, notifications, or lasting temporary access effects.
`ZOOM_CLASSROOM_CANARY_ENABLED=false` is deployed.

The remaining Zoom work is narrow: use an allowed provision/delete path (or an
isolated-staging runtime), prove the selected Zoom host/account can create a
registration-enabled meeting, then run one new disposable embedded proof. Do
not treat the presence of the embedded UI as live-class launch acceptance.

### Family signup → HighLevel

The bounded bridge implementation (PR #146) and OT-01 sender/workflow evidence
are preserved, but `FAMILY_SIGNUP_GHL_MODE=disabled` remains the production
state. No Family-signup provider canary or broad synchronization has run. Once
the operator login smoke is green, only one explicitly bounded operator-owned
Family signup may be used for the three-effect/replay proof; general enrollment
and Student GHL contacts remain disabled.

### Media, Drive, and billing

Media/Vimeo and Drive remain separate unbound launch work. Live Stripe/billing
is intentionally off; no billing flag, charge, or subscription path is enabled
by this release. These tracks must not delay the authentication acceptance
smoke.

## Historical corrections preserved

- PR #152 corrected the public `cancelled` / stored `canceled` cleanup boundary.
- PR #154 aligned the remaining enrollment and class-access guards with the
  canonical stored `canceled` state.
- The earlier 2026-08-07 baseline at `f804980…` is retained as historical
  evidence only; it is not the current deployed identity.

## Launch order from here

1. Complete the one normal operator sign-in and protected-page/role-switch
   smoke against `dcdc0756…`.
2. Record the result in this document and address only a reproduced remaining
   route delta, if any.
3. If login acceptance is green, choose the next bounded proof deliberately:
   the one Family-signup GHL canary or the corrected Zoom disposable proof.
4. Keep Family sync, Zoom canary, media processing, and live billing disabled
   until their own proof is accepted.
