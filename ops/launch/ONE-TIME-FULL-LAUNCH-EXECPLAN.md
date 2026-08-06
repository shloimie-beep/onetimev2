# One Time Complete Production Launch — ExecPlan

## Authority and baseline

- Authoritative brief: `C:\Users\User\Downloads\ONE-TIME-FULL-PRODUCTION-LAUNCH-CODEX-GOAL.md`
- Integration branch: `codex/one-time-complete-production-launch-20260805`
- Current production source: `9e4ceb035cf0707de8a5e49d007a6d3b583fa1ce`
- Rollback branch: `rollback/one-time-pre-complete-launch-20260805`
- Current web deployment: `3516f735-211c-4e34-a6c6-27fc6ee57c1b`
- Current worker deployment: `edfcf7d1-9896-4909-b0e2-9a99f8eb1a5b`
- Current migration head: `2271_ot16_f05_dispatch_context`, 102/102 verified

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

Milestone 1 is live and proven. Application-side portal, billing, privacy, notification, HighLevel projection, and provider-boundary contracts are live at exact source `9e4ceb035cf0707de8a5e49d007a6d3b583fa1ce`. The release includes durable adult-only billing-to-GHL lifecycle intents, lease-safe recovery of interrupted signed Stripe TEST webhook projections, deterministic OT-03 local abandonment checkpoints, and the guarded OT-16 application path: canonical due/eligibility/suppression readers, exact F06 authority, deterministic F05 jobs, send-time adult identity/suppression rechecks, retry/dead-letter finalization, and acceptance-unknown quarantine. It preserves no Student HighLevel contacts and keeps OT-16 transport, general HighLevel sync, payment transport, and live-charge authorization disabled. All six exact-head PR checks passed. Successful web deployment `3516f735-211c-4e34-a6c6-27fc6ee57c1b` and worker deployment `edfcf7d1-9896-4909-b0e2-9a99f8eb1a5b` bind protected runtime identity and a fresh ready worker heartbeat to the exact source. The production migration ledger is 102/102 through `2271_ot16_f05_dispatch_context`, checksum `3fdfc7f5a162ce04687fd4c6fb6cc790f333a8e9a5a2e876adf2dd8095a3fbe4`; queues have zero ready/retry/dead-letter/expired-lease rows, diagnostics report no blockers, and OT-16 F05 context/job/provider-binding counts are all zero. Public health/readiness return HTTP 200 and unauthenticated protected diagnostics return HTTP 403.

The Vimeo callback is mounted with provider-correct payload-secret verification and official event normalization, but remains fail-closed with `VIMEO_WEBHOOK_DISABLED`. Read-only BNA-Keyholder reconciliation found Zoom Server-to-Server artifacts and a distinct Meeting SDK candidate; the current Vimeo token is accepted with full account scopes, and the account has zero configured webhooks. A wider filename-only scan found four generic/BNA Google OAuth client-definition JSON files in Downloads, but none satisfies One Time's `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` contract or provides its required folder binding. No Drive service-account artifact, authorized Drive refresh credential, or Vimeo webhook shared secret was found, and no credential was copied or activated. The separate browser-control lane exclusively owns live GHL/DNS/sender/email-provider UI and must return `integrations/highlevel/agent-mode/results/GHL-UI-COMPLETE-LAUNCH-20260805.result.json`; until then this lane makes no speculative provider-ID or acceptance update. OT-16 additionally remains fail-closed until an app-owned adult identity-link writer supplies exact linked identities. Milestone 2 production acceptance, the Zoom/attendance remainder of Milestone 3, and Milestone 4 provider activation remain next without waiting on that external lane.

## Validation commands

Run focused package/unit/integration/E2E checks per slice, then `npm run brand:check`, `npm run lint`, `npm run typecheck`, `npm test`, build, migration verification, visual checks at 360x800/390x844/tablet/desktop, staging rollback/roll-forward, production canary, health/readiness/version/log readback.
