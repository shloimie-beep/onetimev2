# OT-88 — Implement the Zoom Learner Classroom

You are implementing OT-88. Use `OT-88` everywhere.

## Packet discovery without a stop trap

First search current Codex attachments, `C:\Users\User\.codex\attachments`, and `C:\Users\User\Downloads` recursively for a ZIP/packet whose manifest task ID is OT-88; likely names include `OT-88-CODEX-PACKET.zip` and `OT88-zoom-classroom-codex-packet.zip`. Validate hashes, reject unsafe archive paths, and choose the highest valid revision if duplicates exist. Persist the selected packet/hash. If no valid packet is found, continue from the complete embedded specification below—do not stop and do not ask the user to find the old window.

## Repository/base/state

Locate `webcraft-media/onetimev2` by origin, fetch remote, and dynamically resolve `origin/codex/ot84-telegram-action-gateway`; audited head was `f98103ecc3660dbda871a91485656e17580940a8`, but fetched remote is authoritative. Confirm OT-83 portal ancestry. Create a clean isolated worktree and `codex/ot88-zoom-learner-classroom`. Never use or reset another dirty worktree.

Before product edits, save `RECEIPT.json`, `ORIGINAL-PROMPT.md`, `INPUTS.json`, `STATE.json`, `RESUME.md`, and `LOG.jsonl` under `ops/codex-runs/OT-88/`. Missing credentials/settings become a pushed `ready_for_zoom_canary` checkpoint after all provider-independent code/tests are complete—not a preflight stop.

## Product contract

The future $67/month family entitlement grants up to three named learner seats, not three reusable family links. Each learner has a separate profile/login and protected join action per class occurrence. Daily class default: 19:00 `Asia/Jerusalem`; optional T-30 reminder: 18:30. Treat schedule as protected product configuration, not hard-coded provider credentials.

Model household entitlement, class series, immutable occurrence, learner enrollment/seat, provider meeting/registrant reference, short-lived single-purpose launch grant, join/leave/attendance events, reminder intent, question queue, and readiness state.

Never return raw reusable Zoom URLs, passcodes, SDK secrets, host tokens, or registrant tokens in portal JSON/HTML state, logs, analytics, support data, or Telegram. Resolve short-lived launch material server-side only after authentication, learner scope, entitlement, occurrence window, revocation, and rate-limit checks.

## Portal experience

Build a protected classroom shell with next-class/readiness card, one clear Join Class action, waiting/host-not-started/device-permission/network/full/provider-down/expired/ended/reconnect states, and safe leave/return behavior. Use Zoom’s official Meeting SDK only where verified. Prefer full-page client view for mobile/tablet; component view on desktop only where supported, with secure fallback. Do not claim canary support without current official capability/readback.

## Questions and Rabbi flow

V1 uses an application-level One Time queue, not automatic Zoom chat injection:

1. Authenticated learner submits a short occurrence-scoped question.
2. One Time stores it with idempotency, moderation/rate limits, privacy, and audit.
3. OT-84 asynchronously alerts only the mapped Rabbi owner/admin Telegram identities using a redacted preview and opaque ID.
4. Rabbi actions: `Feature next`, `Answered`, `Dismiss`, and a Rabbi-only moderation deep link. Never open a child session.
5. Learner sees only their own safe status.

Do not promise automatic pin/spotlight. Keep any feature-participant provider port disabled until official support, host permissions, identity correlation, and settings pass a separate canary. `Feature next` selects the question and guides normal host controls. Do not inject child free text into Zoom chat by default.

## Automation and safety

Implement idempotent occurrence creation/reconciliation, per-learner registration/launch seams where supported, T-30 reminder intents, expiry/revocation, retry/dead-letter behavior, provider-off mode, redacted observability, and no BNA runtime fanout. Provider absence must not break login, CRM, portals, or library.

## Verification

Test three learners and fourth-seat denial; cross-household/sibling/school/no-entitlement denial; grant replay/expiry/revocation; occurrence windows/time zones/DST; reminder idempotency; raw-link leakage scans; mobile/desktop fallbacks; question privacy/moderation; Telegram retries; provider failure; accessibility/keyboard/RTL/reduced-motion/200% reflow; 30-sample join-shell performance; bundle/request budgets; disposable PostgreSQL fresh/upgrade/concurrency; and no BNA fanout. Use synthetic data.

No production Zoom mutation, broad reminders, deploy, DNS, live payment, or real user creation. If protected test credentials exist, prepare an exact canary plan but do not run externally unless the current task context gives explicit scoped authorization.

## Finish

Commit/push/open a draft PR. Write `FINAL-REPORT.md` with exact base/head, migration checksums, tests, UI evidence, configuration names without values, canary status, blockers, external mutations, and resume steps. Keep the worktree clean.

