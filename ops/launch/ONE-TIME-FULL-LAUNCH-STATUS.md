# One Time Launch Status

Snapshot: 2026-08-11 (Asia/Jerusalem)

## Current source

- Repository/branch: `shloimie-beep/onetimev2` / `codex/one-time-complete-production-launch-20260805`
- Deployed source: `06c67372e0735c9f997550db1bd72670fea33b6a` (merged PR #162; its exact validated head was `26ee1c19d1cc8671799f8816f5ef844185689f4d`).
- Web/worker: `a7639ee4-821e-4b63-91b8-52dcc4f6cefd` / `6792a401-9896-411c-9af8-3277abf94124`, both SUCCESS/RUNNING.
- Readback: app and join health, readiness, and version HTTP 200; protected deployment diagnostics match `06c67372`; worker heartbeat is healthy.
- Migration verifier: 108 files, 108 ledger rows, 108 applied through migration 2277, with zero pending or issues.
- Queues: delivery, support, and account-lifecycle each have zero ready, leased, expired, retry, and dead-letter items.
- Preserved rollback source: `afcad0aead6f86b54051e38c8679a1253e5352e9` with its prior successful web/worker deployments. Do not auto-rollback.

## Production proof and current acceptance

- Parent-to-Student creation is production-functionally proven: one active Student persists with one active canonical enrollment in the sole recurring 7:00 PM class. The bounded correction and proof created no GHL, provider, billing, Zoom, or media effect.
- The live Parent Student desktop interface is agent-accepted on this source: an active Parent session reached the Student route; the 1-of-3 seat state, recurring 7:00 PM outcome, correct Sunday–Thursday text, responsive desktop hierarchy, and collapsed access/password controls rendered correctly. Disposable short and mismatched credential submissions produced accessible field errors and sent zero requests; fields were cleared with no mutation.
- Mobile viewport acceptance was not independently obtained and remains unproven. Separate Student login is also unproven because no Student credential was safely available for an agent-owned sign-in.
- Logout and second-login behavior remain unproven on this exact source. The passed agent smoke is not broader human operator acceptance.
- Core adult session and Communications have an AGENT-SMOKE PASS on this source: an existing Parent session switched through the supported Admin path; Communications shell, auth session, CRM assignees, workflows, and history each returned HTTP 200. Dashboard, CRM, Content (including the Admin content workspace), and Support also stayed authenticated with their checked endpoints at HTTP 200. The supported Admin-to-Parent path returned authenticated `/app/parent`. No 401, 403, or 5xx response, login/signup redirect, or global client-state clear was observed.
- The smoke submitted no form and created no business, provider, GHL, Zoom, billing, or media effect. Screenshot capture timed out, so no screenshot artifact exists.
- The single required Family agreement is deployed: initially unchecked, versioned, and records unified legal/consent facts without SMS, call, WhatsApp, Student-contact, or credential effects.
- The launch product remains one recurring 7:00 PM class, shown through Next Class. Rabbi Eli has full Admin access.

## Current state

`READY_FOR_REMAINING_ACCEPTANCE`

The deployed Parent Student flow is functionally proven and its desktop UX is agent-accepted. Core adult session and Communications have a bounded agent-smoke pass. Remaining acceptance is limited to the unproven journeys listed below; deployment alone never substitutes for them.

## Still unproven / next acceptance

- Logout and second login on this exact source, followed by broader human operator acceptance of the adult session journey.
- Separate Student sign-in, only when a legitimate Student credential is available without exposing or resetting it in chat.
- Mobile visual acceptance of the Parent Student page.
- Recording publication/protected library and the minimal adult-only GHL signup/email flow. Family GHL synchronization remains disabled.

The immediate teaching loop is still scoped as private Rabbi-moderated prompts, one worksheet round trip, three simple badges, and protected Vimeo playback. Initial launch succeeds without Zoom.

## Protected / off

- `FAMILY_SIGNUP_GHL_MODE=disabled`; no Student GHL contacts; no broad campaigns, billing, nurture, newsletters, former-member reactivation, recording notices, or other GHL workflows.
- Zoom canary false; media is unset and therefore follows the source default OFF; live billing false. Resend is bound.
- Embedded Zoom is `LATER — FREE MONTH`: basic role-scoped access to one pre-created recurring meeting is the first target; Stage Host and OBS controls are optional later enhancements.
- BNA task management and Telegram monitoring are outside the initial-launch critical path.
- No points economy, rewards, public/class leaderboard, parent goals, editable badge rules, extra launch levels, Student-to-Student chat, or launch month grid.
- A deployed surface or provider configuration is never `OPERATOR ACCEPTED` without its real journey on this exact source.
