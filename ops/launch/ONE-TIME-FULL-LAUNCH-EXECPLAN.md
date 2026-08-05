# One Time Complete Production Launch — ExecPlan

## Authority and baseline

- Authoritative brief: `C:\Users\User\Downloads\ONE-TIME-FULL-PRODUCTION-LAUNCH-CODEX-GOAL.md`
- Integration branch: `codex/one-time-complete-production-launch-20260805`
- Current production source: `7e3075b06e2b03b67168e59d7fcfb96d16324c7a`
- Rollback branch: `rollback/one-time-pre-complete-launch-20260805`
- Current web deployment: `f89c6bad-e8f2-4b7c-ae99-bc83fd7a3d95`
- Current worker execution: `0049c1d6-ece3-4cbb-a08d-bacd5220be85`
- Current migration head: `2264`, 95 applied, zero pending

## Milestones

1. Customer journey: landing assets and copy, real Family signup/session, recovery, GHL adult/household projection, exactly one confirmation.
2. Complete Admin, Parent, and Student persistent product surfaces and authorization boundaries.
3. Canonical class, rolling occurrences, embedded Zoom, live console, and attendance.
4. Direct/Drive ingest, OT-VIDEO-1 processing, review, Vimeo publication, and protected library.
5. Learning, questions, notifications, adult/Student support, and safe Telegram routing.
6. $67 hosted billing, Stripe/GHL lifecycle, access/grace/cancel/reactivate, no pre-cutoff charge.
7. Required GHL/email workflows, website bot, sender/DNS/reply routing, and suppression.
8. Policies, security, accessibility, operations, recovery, cutover, and full acceptance.

## Dependencies and choices

- Local Family identity/access commits before provider work; provider failure queues and never rolls back access.
- `join.onetimeonetime.com` remains the funnel and app-origin signup owns the authenticated session.
- Provider state is reconciled before every mutation; ambiguous/unknown effects are held for readback.
- Minor-choice rule: use the simplest production-safe option consistent with the black/yellow/white brand and existing architecture.

## Current checkpoint

Milestone 1 is live and proven. The public journey creates canonical local access before provider work; the preserved canary produced exactly one adult contact, one household opportunity, and one confirmation email. Canonical password recovery is deployed, invalidates existing sessions, succeeds once, and rejects replay. The Parent created three display-once Student credentials, the fourth seat was rejected, and a Student username/password session reached the protected Student app. Web/worker version variables agree with the deployed commit, health/readiness are green, and the pre-launch rollback branch remains immutable. Milestone 2 portal completion and Milestones 3-4 class/media provider gates are next.

## Validation commands

Run focused package/unit/integration/E2E checks per slice, then `npm run brand:check`, `npm run lint`, `npm run typecheck`, `npm test`, build, migration verification, visual checks at 360x800/390x844/tablet/desktop, staging rollback/roll-forward, production canary, health/readiness/version/log readback.
