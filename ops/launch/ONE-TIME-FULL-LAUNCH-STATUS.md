# One Time Launch Status

> **Historical status snapshot — superseded on 2026-08-20.** For current authority,
> use [ONE-TIME-AUTHORITY-INDEX.md](./ONE-TIME-AUTHORITY-INDEX.md), OpenSpec, and
> the linked GitHub Issue/PR. The retained body below is not current deployment,
> provider, acceptance, or task-routing truth.

Snapshot: 2026-08-11 (Asia/Jerusalem)

## Current Parent-first decision (2026-08-16)

The 2026-08-11 snapshot below is retained as historical status. For the active candidate, the operator has superseded the old Parent-as-nonlearner rule: a successful Family signup must immediately establish one Parent learner under the Parent login, plus capacity for three separate child Students. Parent classroom, entitled-library, progress, and private-question facts are separately attributed and never borrow a child identity or seat. The exact authority and acceptance boundary is [2026-08-16-parent-first-learning-decision.md](./2026-08-16-parent-first-learning-decision.md).

Current capability state: `BUILT` while local integration and release gates are still running. Current production is M5 `4a5a6e2058848b9513bc53ef733c78d02fe075bb`; web deployment `d83d0a70…` and worker deployment `81cec56c…` were reconciled `SUCCESS/RUNNING` on that exact source before this candidate began. Production remains unchanged until a reviewed immutable successor is merged and deployed. The approved Parent welcome asset is grounded privately but is not uploaded or bound yet.

## Current source

- Repository/branch: `shloimie-beep/onetimev2` / `codex/one-time-complete-production-launch-20260805`
- Deployed source: `06c67372e0735c9f997550db1bd72670fea33b6a` (merged PR #162; its exact validated head was `26ee1c19d1cc8671799f8816f5ef844185689f4d`).
- Latest integration head: PR #166 merged as `9b987dabdd45266dde63cdf4e55b17947152ae11`; it is not deployed. Production remains the source above.
- Web/worker: `a7639ee4-821e-4b63-91b8-52dcc4f6cefd` / `6792a401-9896-411c-9af8-3277abf94124`, both SUCCESS/RUNNING.
- Readback: app and join health, readiness, and version HTTP 200; protected deployment diagnostics match `06c67372`; worker heartbeat is healthy.
- Migration verifier: 108 files, 108 ledger rows, 108 applied through migration 2277, with zero pending or issues.
- Queues: delivery, support, and account-lifecycle each have zero ready, leased, expired, retry, and dead-letter items.
- Preserved rollback source: `afcad0aead6f86b54051e38c8679a1253e5352e9` with its prior successful web/worker deployments. Do not auto-rollback.

## Production proof and current acceptance

- Parent-to-Student creation is production-functionally proven: one active Student persists with one active canonical enrollment in the sole recurring 7:00 PM class. The bounded correction and proof created no GHL, provider, billing, Zoom, or media effect.
- The live Parent Student desktop interface is agent-accepted on this source: an active Parent session reached the Student route; the 1-of-3 seat state, recurring 7:00 PM outcome, correct Sunday–Thursday text, responsive desktop hierarchy, and collapsed access/password controls rendered correctly. Disposable short and mismatched credential submissions produced accessible field errors and sent zero requests; fields were cleared with no mutation.
- Parent and Student sign-in are now human-proven. The Student sees Questions, Calendar, Library, and the one recurring 7:00 PM class. This proof is an acceptance fact, not a deployment or provider mutation.
- Classroom entry is currently unavailable and Library has zero approved lessons. Both basic protected Zoom entry and one real protected library video are immediate-launch requirements and remain unproven.
- Logout and second-login behavior remain unproven on this exact source. The passed agent smoke is not broader human operator acceptance.
- Core adult session and Communications have an AGENT-SMOKE PASS on this source: an existing Parent session switched through the supported Admin path; Communications shell, auth session, CRM assignees, workflows, and history each returned HTTP 200. Dashboard, CRM, Content (including the Admin content workspace), and Support also stayed authenticated with their checked endpoints at HTTP 200. The supported Admin-to-Parent path returned authenticated `/app/parent`. No 401, 403, or 5xx response, login/signup redirect, or global client-state clear was observed.
- The smoke submitted no form and created no business, provider, GHL, Zoom, billing, or media effect. Screenshot capture timed out, so no screenshot artifact exists.
- A bounded Parent navigation smoke also passed: Calendar, Progress, Updates, Preferences, Support, and Account remained authenticated. Billing was intentionally unavailable/off, not an authentication failure. No action was submitted.
- The single required Family agreement is deployed: initially unchecked, versioned, and records unified legal/consent facts without SMS, call, WhatsApp, Student-contact, or credential effects.
- The launch product remains one recurring 7:00 PM class, shown through Next Class. Rabbi Eli has full Admin access.

## Current state

`READY_FOR_REMAINING_ACCEPTANCE`

The deployed Parent Student flow is functionally proven and its desktop UX is agent-accepted. Core adult session and Communications have a bounded agent-smoke pass. Remaining acceptance is limited to the unproven journeys listed below; deployment alone never substitutes for them.

## Still unproven / next acceptance

- Logout and second login on this exact source, followed by broader human operator acceptance of the adult session journey.
- Basic protected Zoom classroom entry and one real protected library video, each with its required protected/negative access evidence.
- Mobile visual acceptance of the Parent Student page.
- The minimal adult-only GHL signup/email flow. Family GHL synchronization remains disabled.

The immediate teaching loop is private Rabbi-moderated prompts, one worksheet round trip, three simple badges, basic protected Zoom classroom entry, and one real protected library video. Stage Host and OBS remain later.

## Protected / off

- `FAMILY_SIGNUP_GHL_MODE=disabled`; no Student GHL contacts; no broad campaigns, billing, nurture, newsletters, former-member reactivation, recording notices, or other GHL workflows.
- Zoom canary false; media is unset and therefore follows the source default OFF; live billing false. Resend is bound.
- Basic protected Zoom entry to the one recurring class is an immediate-launch requirement and is currently unavailable. Stage Host and OBS controls remain later.
- BNA task management remains outside the initial-launch critical path. The private Rabbi Telegram console is an initial operational priority under `OT-CTRL-20260813-RABBI-OPS-CONTACTS-COMMS`; its bounded communications and source-only local-agent transport are BUILT in draft PR #192, but they are not merged, deployed, provider-activated, or operator-accepted.
- Admin Content currently has a false `content.view` denial and unrelated CRM controls; this is a documented application defect, not an authorization to change CRM or providers in this reconciliation.
- Buffer/Social is OFF.
- Student credentials remain locked to an exactly six-digit numeric PIN. The active Parent-first candidate aligns adult password surfaces to 6–128 characters with no composition rule; production retains its prior validator until the reviewed candidate is deployed.
- No points economy, rewards, public/class leaderboard, parent goals, editable badge rules, extra launch levels, Student-to-Student chat, or launch month grid.
- A deployed surface or provider configuration is never `OPERATOR ACCEPTED` without its real journey on this exact source.
