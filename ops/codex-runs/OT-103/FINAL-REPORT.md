# OT-103 Final Report

Status: locally verified and draft PR opened. Real provider canary remains blocked for credentials/authorization only.

## Scope Completed

- Added a typed, bounded Zoom REST provider client for server-to-server OAuth, fixed daily 19:00 Asia/Jerusalem recurring meeting creation, occurrence resolution, learner registrant creation, and learner role-0 Meeting SDK signatures.
- Added webhook validation and projection helpers with raw-body signature verification, endpoint URL validation support, replay/stale rejection, event dedupe, and attendance projection by meeting UUID/occurrence/registrant or participant digest rather than display name.
- Added provider persistence helpers and migration `2130_ot103_zoom_provider.sql` for occurrences, registrants, webhook events, and attendance projection.
- Added a durable reminder job factory export without editing the shared worker entrypoint.
- Preserved the classroom sink launch path and moved its deterministic SDK panel behind a classroom-only adapter because the real SDK package is not present and root manifest edits are forbidden for OT-103.
- Capped learner launch grants to a maximum five-minute redemption window.
- Recorded OPS-04 wiring requirements in `OPS04-INTEGRATION-DELTA.md`.

## Official Zoom Requirements Recorded

- Meeting SDK auth requires server-side SDK JWT generation. Learner joins use role `0`; host start is separate and requires role `1` plus host ZAK.
- Meeting SDK web joins for registered meetings use the `tk` registrant token from the registrant join URL; registration-required joins include user email.
- Meetings API uses `https://api.zoom.us/v2`; fixed recurring meetings use type `8`; occurrence IDs identify recurring occurrences.
- Meeting creation can return host-sensitive `start_url`; OT-103 does not store or expose it.
- Webhook verification uses the `x-zm-signature` HMAC over `v0:{timestamp}:{rawBody}` with the webhook secret token and handles endpoint URL validation.
- Meeting UUIDs are occurrence-specific, so attendance projection is by UUID/occurrence/registrant or participant digest rather than display name.

Sources reviewed 2026-07-16:

- https://developers.zoom.us/docs/meeting-sdk/auth/
- https://developers.zoom.us/docs/meeting-sdk/web/component-view/meetings-webinars/
- https://developers.zoom.us/docs/api/meetings/
- https://developers.zoom.us/docs/api/using-zoom-apis/
- https://developers.zoom.us/docs/api/webhooks/
- https://developers.zoom.us/docs/meeting-sdk/web/browser-support/

## Leakage And Role Proof

- Learner Meeting SDK signatures are minted with role `0`.
- Unit tests assert generated SDK payloads do not contain the SDK secret.
- Registrant creation returns only a scoped token/ref/digests and never returns the raw join URL.
- REST provider responses call `assertNoZoomSecretLeak` for sensitive Zoom material including `start_url`, `access_token`, `zak`, reusable passcodes, and raw private URLs.
- `npm run secret:scan` passed.

## Verification

- Passed `npm run typecheck`.
- Passed `npm run lint`.
- Passed `npm run build`.
- Passed `npm run secret:scan`.
- Passed `git diff --check`.
- Passed touched-file Prettier check. Repository-wide `npm run format` reports baseline unrelated formatting drift, so no broad format churn was performed.
- Passed `npx vitest run --config vitest.unit.config.ts tests/unit/classroom/classroom-contracts.test.ts tests/unit/classroom/ot103-zoom-provider.test.ts`.
- Passed `npx vitest run --config vitest.integration.config.ts tests/integration/classroom/zoom-learner-classroom.test.ts`.
- Passed `npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts`.
- Passed `npx playwright test tests/e2e/ot88-zoom-classroom.spec.ts`.
- Passed `npx playwright test tests/accessibility/ot88-zoom-classroom-a11y.spec.ts tests/performance/ot88-zoom-classroom-performance.spec.ts`.

## Canary Truth

- Real Zoom staging canary was not run.
- Reason: protected staging Zoom credentials and explicit `OT103_STAGING_CANARY_AUTHORIZED=true` were not present.
- Scope impact: provider canary only. No real Zoom meeting, invite, recording, webhook, provider mutation, or external user action was performed.

## Config Names For OPS-04

- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_MEETING_SDK_KEY`
- `ZOOM_MEETING_SDK_SECRET`
- `ZOOM_WEBHOOK_SECRET_TOKEN`
- `ZOOM_HOST_USER_ID`
- `ZOOM_API_BASE_URL`
- `OT103_STAGING_CANARY_AUTHORIZED`

## OPS-04 Delta

See `OPS04-INTEGRATION-DELTA.md` for the later overlay: protected config registration, webhook route registration, real provider port injection, worker scheduler wiring, actual Meeting SDK dependency addition, and staging canary flow.

## Rollback

- Revert this branch or disable any future OPS-04 Zoom port injection to return to the deterministic sink/off classroom path.
- The migration is additive. If applied in a staging database and rollback is required, drop the four `onetime.classroom_zoom_*` tables added by `2130_ot103_zoom_provider.sql` after confirming no later migration depends on them.

## Blockers

- `BLOCK-OT103-001`: real provider canary is blocked until protected staging Zoom credentials and explicit `OT103_STAGING_CANARY_AUTHORIZED=true` are available.

## Push And PR

- Pushed implementation SHA: `3175611cb53db16220133ed6631e999d21b348da`.
- Draft PR: https://github.com/webcraft-media/onetimev2/pull/42.
- Note: the branch also includes a small closeout metadata commit after the implementation SHA so this report can record the PR URL.
