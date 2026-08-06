# One Time Complete Production Launch — ExecPlan

## Authority and baseline

- Authoritative brief: `C:\Users\User\Downloads\ONE-TIME-FULL-PRODUCTION-LAUNCH-CODEX-GOAL.md`
- Integration branch: `codex/one-time-complete-production-launch-20260805`
- Current production source: `e457f93ec51830791eb9853db01b34a8c6167d01`
- Rollback branch: `rollback/one-time-pre-complete-launch-20260805`
- Current web deployment: `2f9b2032-f656-446b-9684-d769084facff`
- Current worker deployment: `08ee19b4-aab9-4836-bc59-393ccf153681`
- Current migration head: `2269_billing_verified_event_processing_state`, readiness green

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
- Live GHL, DNS, sender, mailbox, and email-provider UI belongs exclusively to the separate browser-control lane; this lane consumes only its committed result artifact.
- BNA-Keyholder credentials remain read-only source material and are not copied into Railway or activated without explicit operator instruction.
- Minor-choice rule: use the simplest production-safe option consistent with the black/yellow/white brand and existing architecture.

## Current checkpoint

Milestone 1 is live and proven. Application-side portal, billing, privacy, notification, HighLevel projection, and provider-boundary contracts are live at exact source `e457f93ec51830791eb9853db01b34a8c6167d01`. This release adds durable adult-only billing-to-GHL lifecycle intents and lease-safe recovery of interrupted signed Stripe TEST webhook projections; it preserves no Student HighLevel contacts and keeps payment transport and live-charge authorization disabled. All six PR checks passed. Successful web deployment `2f9b2032-f656-446b-9684-d769084facff` and worker deployment `08ee19b4-aab9-4836-bc59-393ccf153681` bind protected runtime identity and the fresh worker heartbeat to the exact source. Migration `2269_billing_verified_event_processing_state` is green, queues have zero ready/retry/dead-letter/expired-lease rows, and diagnostics report no blockers. Public `app` and `join` health/readiness return HTTP 200; unauthenticated protected diagnostics return HTTP 403.

The Vimeo callback is mounted with provider-correct payload-secret verification and official event normalization, but remains fail-closed with `VIMEO_WEBHOOK_DISABLED`. Read-only BNA-Keyholder reconciliation found Zoom Server-to-Server artifacts and a distinct Meeting SDK candidate; the current Vimeo token is accepted with full account scopes, and the account has zero configured webhooks. It did not find a Drive service-account/OAuth artifact or Vimeo webhook shared secret. No credential was copied or activated. The separate browser-control lane exclusively owns live GHL/DNS/sender/email-provider UI and must return `integrations/highlevel/agent-mode/results/GHL-UI-COMPLETE-LAUNCH-20260805.result.json`; until then this lane makes no speculative provider-ID or acceptance update. Milestone 2 production acceptance, the Zoom/attendance remainder of Milestone 3, and Milestone 4 provider activation remain next without waiting on that external lane.

## Validation commands

Run focused package/unit/integration/E2E checks per slice, then `npm run brand:check`, `npm run lint`, `npm run typecheck`, `npm test`, build, migration verification, visual checks at 360x800/390x844/tablet/desktop, staging rollback/roll-forward, production canary, health/readiness/version/log readback.
