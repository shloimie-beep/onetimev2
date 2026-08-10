# One Time Launch Status

Snapshot: 2026-08-10 (Asia/Jerusalem)

## Current source

- Repository/branch: `shloimie-beep/onetimev2` / `codex/one-time-complete-production-launch-20260805`
- Deployed source: `e3a7a6b80b29dfa027565602f94d9ce591065069` (merged PR #158; unified-agreement documentation is merged in PR #159).
- Web/worker: `c62679e8-a95d-4585-802a-119cc8f7b6c3` / `8a09c0f6-319f-45d1-a4b3-997dffab758e`, both SUCCESS/RUNNING.
- Readback: app and join health, readiness, and version HTTP 200; protected web diagnostics match `e3a7a6b8`; worker heartbeat was fresh (7.1 seconds).
- Migration verifier: 107 files, 107 ledger rows, 107 applied, zero pending or issues.
- Queues: delivery, support, and account-lifecycle each have zero ready, leased, expired, retry, and dead-letter items.
- Preserved rollback source: `9c54591ce11b133eb773ccbd9c5e7003c515f782`. The prior dcdc web/worker deployments were superseded and removed; do not auto-rollback.

## Deployed, awaiting operator smoke

- The host-first session repair now covers Communications and the shared protected-session path. A normal human browser pass is still required; this is not yet operator accepted.
- Parent-to-Student creation and its atomic enrollment path are deployed. Verify through one real Parent-to-Student journey; do not infer acceptance from deployment.
- The single required Family agreement is deployed: initially unchecked, versioned, and records the unified legal/consent facts without creating SMS, call, WhatsApp, Student-contact, or credential effects.
- The launch product is one recurring 7:00 PM class, shown through Next Class. Rabbi Eli has full Admin access.

## Current state

`READY_FOR_OPERATOR_SMOKE`

One human operator must perform the normal browser journey on this exact source: sign in, use Communications and other protected pages, switch role where available, create one Parent-owned Student through the intended flow, refresh/deep-link, log out, and sign in again. Record outcomes before calling any capability `OPERATOR ACCEPTED`.

## Still unproven / not part of this smoke

- Recording publication/protected library and the minimal adult-only GHL signup/email flow remain unproven. Family GHL synchronization remains disabled.
- The immediate teaching loop is scoped as private Rabbi-moderated prompts, one worksheet round trip, three simple badges, and protected Vimeo playback. Initial launch succeeds without Zoom.

## Protected / off

- `FAMILY_SIGNUP_GHL_MODE=disabled`; no Student GHL contacts; no broad campaigns, billing, nurture, newsletters, former-member reactivation, recording notices, or other GHL workflows.
- Zoom canary false; media is unset and therefore follows the source default OFF; live billing false. Resend is bound.
- Embedded Zoom is `LATER — FREE MONTH`: basic role-scoped access to one pre-created recurring meeting is the first target; Stage Host and OBS controls are optional later enhancements.
- BNA task management and Telegram monitoring are outside the initial-launch critical path.
- No points economy, rewards, public/class leaderboard, parent goals, editable badge rules, extra launch levels, Student-to-Student chat, or launch month grid.
- A deployed surface or provider configuration is never `OPERATOR ACCEPTED` without its real journey on this exact source.
