# W12-06 Resume

Branch: `codex/w12-06-whatsapp-lead-assistant`

Worktree: `C:/Users/User/.w12-20260717-worktrees/W12-06`

Base: `origin/release/ops10-full-staged-production-launch-20260717T050800Z` at `c7d46066517d7a458d189f2c782cc06200f7861c`.

## Implemented

- Added versioned public WhatsApp assistant copy in `packages/domain/src/whatsapp/copy.ts`.
- Added protected-config names for public deep link, prefill text, copy version, and assistant rate budgets.
- Added safe read-only public contract at `GET /api/v1/whatsapp/public-assistant`.
- Added deep-link construction for approved WhatsApp hosts only (`wa.me` and `api.whatsapp.com`) with configured/default prefill text.
- Added safe canary readiness projection that reports blockers without exposing the canary recipient.
- Routed standard assistant replies through the versioned copy module.
- Added durable assistant rate limiting with sender and provider-account budgets.
- Changed abuse handling to suppress the conversation, suppress pending queued replies, write redacted audit metadata, and enqueue a safe suppression notice.
- Extended integration coverage for opening copy, rate limit, abuse suppression, safe public assistant status, webhook signature/challenge regression, replay, STOP/START, private request denial, and provider runtime.

## Safety State

- Personal canary recipient remains protected config only.
- No broad sends.
- No provider registration.
- No canary send.
- No deployment.
- No production contact import.

## Validation

See `ops/codex-runs/W12-06/TESTS.md`.
