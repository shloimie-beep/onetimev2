# One Time Complete Production Launch — ExecPlan

## Authority and baseline

- Authoritative brief: `C:\Users\User\Downloads\ONE-TIME-FULL-PRODUCTION-LAUNCH-CODEX-GOAL.md`
- Integration branch: `codex/one-time-complete-production-launch-20260805`
- Current production source: `5866a625adc103876c27a650a9bc8c986783a9a2`
- Rollback branch: `rollback/one-time-pre-complete-launch-20260805`
- Current web deployment: `05aed5e8-7499-412f-9b39-c01e34a6f63d`
- Current worker deployment: `d0a150fc-7b8c-46c9-8b75-548f15c3f3de`
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

Milestone 1 remains live and proven, and the durable v2.1 support slice is now live at exact source `5866a625adc103876c27a650a9bc8c986783a9a2`. Application-side portal, billing, privacy, notification, HighLevel projection, and provider-boundary contracts remain intact. Parent and Student support now use durable requester-scoped conversations; Admin `/app/support` provides persistent list, assign, lifecycle, and in-app reply operations; replay/version conflicts fail closed; Student Rabbi questions remain private; notification intents are local and redacted; and no Student HighLevel contact or provider write is created. The guarded OT-16 path still provides canonical due/eligibility/suppression readers, exact F06 authority, deterministic F05 jobs, send-time adult identity/suppression rechecks, retry/dead-letter finalization, and acceptance-unknown quarantine. Accepted Family readbacks persist exact-scope, hash-only adult identity and household mappings, while mismatches fail closed. OT-16 transport, general HighLevel sync, payment transport, and live-charge authorization remain disabled. All six exact-head PR checks passed. Successful web deployment `05aed5e8-7499-412f-9b39-c01e34a6f63d` and worker deployment `d0a150fc-7b8c-46c9-8b75-548f15c3f3de` bind protected runtime identity and a fresh ready worker heartbeat to the exact source. The unchanged production migration ledger remains 102/102 through `2271_ot16_f05_dispatch_context`, checksum `3fdfc7f5a162ce04687fd4c6fb6cc790f333a8e9a5a2e876adf2dd8095a3fbe4`; delivery, support, and account-lifecycle queues have zero ready/retry/dead-letter/expired-lease rows and diagnostics report no blockers. Both public domains return HTTP 200 for health/readiness/version; unauthenticated protected diagnostics return HTTP 403.

The Vimeo callback is mounted with provider-correct payload-secret verification and official event normalization, but remains fail-closed with `VIMEO_WEBHOOK_DISABLED`. Read-only BNA-Keyholder reconciliation found Zoom Server-to-Server artifacts and a distinct Meeting SDK candidate; the current Vimeo token is accepted with full account scopes, and the account has zero configured webhooks. A wider sweep found four Google OAuth client definitions plus a complete WebCraftMedia/AI-OS OAuth trio whose source project uses Drive, Docs, Sheets, and Gmail. Its provenance and folder scope do not establish One Time authority, so it remains an inactive candidate. No One Time incoming-folder binding, Drive service-account artifact, or Vimeo webhook shared secret was found, and no credential was copied or activated. The separate browser-control lane exclusively owns live GHL/DNS/sender/email-provider UI and must return `integrations/highlevel/agent-mode/results/GHL-UI-COMPLETE-LAUNCH-20260805.result.json`; until then this lane makes no speculative provider-ID or acceptance update. OT-16 remains fail-closed until that external workflow readback and exact linked identities exist. Remaining role acceptance, Zoom/attendance, and media activation continue without waiting on that external lane.

## Validation commands

Run focused package/unit/integration/E2E checks per slice, then `npm run brand:check`, `npm run lint`, `npm run typecheck`, `npm test`, build, migration verification, visual checks at 360x800/390x844/tablet/desktop, staging rollback/roll-forward, production canary, health/readiness/version/log readback.
