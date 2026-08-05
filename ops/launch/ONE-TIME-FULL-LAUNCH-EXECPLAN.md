# One Time Complete Production Launch — ExecPlan

## Authority and baseline

- Authoritative brief: `C:\Users\User\Downloads\ONE-TIME-FULL-PRODUCTION-LAUNCH-CODEX-GOAL.md`
- Integration branch: `codex/one-time-complete-production-launch-20260805`
- Current production source: `d53ffd2ee4d83263083aaed7c8538bf639e87673`
- Rollback branch: `rollback/one-time-pre-complete-launch-20260805`
- Current web deployment: `ed638ec9-2829-4194-8978-2c5b1a61c0af`
- Current worker deployment: `1895e2fd-8f7b-4caa-b067-0c79b0927b93`
- Current migration head: `2267_v21_parent_preferences`, readiness green

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

Milestone 1 is live and proven. Application-side portal, billing, privacy, notification, HighLevel projection, and provider-boundary contracts are now live at exact source `d53ffd2ee4d83263083aaed7c8538bf639e87673`. The Vimeo callback is mounted with provider-correct payload-secret verification and official event normalization, but fails closed until protected account/webhook values exist. All six PR checks passed; web/worker source messages and protected runtime identity bind the release to the exact source, migration `2267_v21_parent_preferences` is green, queues have zero ready/retry/dead-letter rows, and the fresh worker heartbeat is ready. Keyholder readback found a locally valid Zoom Meeting SDK pair and a Vimeo app token limited to `public`; it did not find the Drive service account/OAuth file or Vimeo webhook secret. Milestone 2 production acceptance, the Zoom/attendance remainder of Milestone 3, and Milestone 4 provider activation remain next without waiting on the separate GHL UI lane.

## Validation commands

Run focused package/unit/integration/E2E checks per slice, then `npm run brand:check`, `npm run lint`, `npm run typecheck`, `npm test`, build, migration verification, visual checks at 360x800/390x844/tablet/desktop, staging rollback/roll-forward, production canary, health/readiness/version/log readback.
