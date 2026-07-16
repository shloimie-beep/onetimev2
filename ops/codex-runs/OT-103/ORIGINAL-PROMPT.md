# OT-103 - Zoom Classroom and Daily-Class Fulfillment

## Mission

Turn the existing learner entitlement, consent, class occurrence, launch-grant and question foundations into a production-shaped Zoom module while leaving shared app/config/deployment wiring to the later OPS-04 overlay.

The $67 family entitlement permits at most three active learner identities. It does not create three reusable raw Zoom URLs. Every learner receives a separate short-lived occurrence-scoped launch grant through the authenticated student portal.

Use current official Zoom Meeting SDK, Meetings API and webhook documentation; record the exact current requirements used.

## Source

- Repository: `webcraft-media/onetimev2`
- Exact base SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Branch: `codex/ot103-zoom-classroom-fulfillment`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Optional additive migration reservation: `2130_ot103_zoom_provider.sql`, only if existing schema is insufficient.
- Clean isolated worktree only.

Persist `ops/codex-runs/OT-103/{ORIGINAL-PROMPT.md,STATE.json,PROGRESS.md,DECISIONS.md,BLOCKERS.md,RESUME.md,FINAL-REPORT.md}` before edits. Missing credentials block only provider canary.

## Collision Boundary

Own Zoom/classroom contracts, provider ports/client, occurrence/grant/reminder/webhook services, classroom-only UI modules, task tests/scripts/evidence. Do not edit shared app/router, global config, shared worker main, `.env.example`, root manifests/lockfiles, auth/landing/CRM/other providers/Railway/BNA. Export factories and record exact later wiring in `OPS04-INTEGRATION-DELTA.md`.

## Implementation

- Typed server-side Zoom REST client using protected credentials and bounded fetch/timeouts.
- Support a fixed daily 19:00 `Asia/Jerusalem` class, recurring occurrence resolution and learner registrant creation/readback.
- Never expose/log host `start_url`, reusable passcodes, access tokens, SDK secret, ZAK or private provider URLs.
- Meeting SDK authorization/signature service: learner role `0`; owner-only host/start capability remains separate and protected.
- If the SDK dependency already exists, add a classroom-only lazy adapter. If it does not, implement the port/fake and record the dependency addition for OPS-04 instead of changing root manifests.
- Issue learner-bound launch grants with a maximum five-minute redemption window; enforce active entitlement, one of at most three active learners, guardian consent, learner access, account/product scope and replay rules.
- Durable idempotent 30-minute reminder intents per occurrence/household/learner/preference; no duplicate after retry and none when entitlement/consent/suppression/schedule is invalid.
- Export reminder job/handler without editing shared worker main.
- Export a webhook router factory: raw-body signature/timestamp verification, URL-validation response, stale/replay rejection, event dedupe, and attendance projection by meeting UUID + occurrence + registrant rather than display name.
- Preserve the One Time question/moderation flow. Questions may appear in the Rabbi's Telegram queue through the later overlay. Do not automatically forward child text into public Zoom chat, expose a child's camera/audio, or claim automated pinning/featuring in V1.
- Modes: off, deterministic sink, staging. Default off/sink and fail closed without secrets while leaving schedule/status usable.

## Verification And Canary

Test wrong role/account/product, sibling access, fourth learner, missing consent, expired/replayed grant, secret leakage, duplicate registrant/reminder/webhook, invalid/stale signatures, Israel-time/DST rollover, out-of-order join/leave and provider 401/403/404/429/5xx/timeouts.

E2E: student sees next class, can redeem only their own grant, Zoom code loads only on classroom route, errors work at 360x800/390x844, and landing/CRM/parent billing make zero Zoom calls.

Always run sink proof. Only when protected staging Zoom credentials and explicit `OT103_STAGING_CANARY_AUTHORIZED=true` already exist, use one fictional learner and one synthetic non-recorded test meeting/occurrence. Register/read it, mint role-0 launch data and verify webhook signature handling. Do not invite real users, start/record a class or mutate production.

Run scoped format/lint/typecheck/tests/build/secret scan and `git diff --check`; push a clean branch and draft PR. Final report includes exact SHA/PR, schema/checksum, role/URL leakage proof, tests, canary truth, config names, OPS-04 delta, rollback and blockers.
