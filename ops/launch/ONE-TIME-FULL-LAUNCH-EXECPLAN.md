# One Time Complete Production Launch — ExecPlan

## Authority and baseline

- Authoritative brief: `C:\Users\User\Downloads\ONE-TIME-FULL-PRODUCTION-LAUNCH-CODEX-GOAL.md`
- Integration branch: `codex/one-time-complete-production-launch-20260805`
- Verified production source: `a157c388d8dc292699f7cd1a1ef178918ee30885`
- Rollback branch: `rollback/one-time-pre-complete-launch-20260805`
- Verified web deployment: `976d8203-d962-4c13-94d5-b3221eceb65f`
- Verified worker deployment: `99f6471b-f7d7-4fd5-a405-383ceadcbe60`
- Verified migration baseline: `2260`, 91 applied, zero pending

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

Orientation complete. Live source/deployments are unchanged from the brief, the rollback and integration branches are published, and three bounded lanes are starting from this checkpoint. Milestone 1 is active.

## Validation commands

Run focused package/unit/integration/E2E checks per slice, then `npm run brand:check`, `npm run lint`, `npm run typecheck`, `npm test`, build, migration verification, visual checks at 360x800/390x844/tablet/desktop, staging rollback/roll-forward, production canary, health/readiness/version/log readback.
