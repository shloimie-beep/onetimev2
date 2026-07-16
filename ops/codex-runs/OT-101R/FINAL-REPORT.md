# OT-101R Final Report

Status: implemented and locally verified.

Heads:

- Base ref: `origin/codex/ops03-staging-readiness-repair`
- Base SHA: `fb5f5eebc539afc9e93833e9417ee67524d62c36`
- OT-84 reference SHA: `310bb5ca8cc8c01e2218051367c5cc2e3414a719`
- Branch: `codex/ot101r-telegram-admin-runtime`
- Final pushed head SHA and draft PR URL are recorded in the Codex final response after commit/push/PR creation.

Implemented:

- Reused the OT-84 Telegram webhook, inbox, confirmation, lease, audit, and worker foundation for the One Time admin runtime.
- Added SQL-backed One Time admin reads for status, recent signups, redacted contacts/leads, content readiness, task/ticket views, class questions, and OT-86B social draft review/approval links.
- Added confirmed local writes for lead tags, class status, content retry requests, task create/update, support ticket assignment/status, and class question resolution.
- Changed Telegram write commands so every mutation previews first and requires explicit `/confirm`; confirmation execution verifies the stored payload digest before dispatch.
- Added protected Bot API send-message transport with bot token shape validation and exact allowlisted chat directory, while keeping sink/outbox transport as the default.
- Added OT-101R migration constraints, runtime exports, fixture coverage, and unit/integration tests.

Command/action coverage:

- Reads: `/help`, `/status`, `/whoami`, `/scope`, `/new-leads`, `/recent-signups`, `/contact`, `/lead-tags`, `/classes`, `/class`, `/content`, `/content-readiness`, `/tasks`, `/task`, `/tickets`, `/ticket`, `/ticket-decisions`, `/questions`, `/question`, `/social`, `/social-draft`, `/social-approval`, `/audit`.
- Confirmed writes: `/lead-tag add`, `/lead-tag remove`, `/class-status`, `/content-retry`, `/task-create`, `/task-update`, `/ticket-assign`, `/ticket-status`, `/question-select`, `/question-resolve`.
- Denied or redirected: ambiguous natural language, BNA/Academy/cross-workspace requests, provider publish/schedule/billing/export/delete/role/provider mutations, and raw provider-token/chat-id content.

Application-service coverage:

- CRM/contact service reads stay redacted and account/product scoped.
- Content service reads expose readiness and retry intent only.
- Class/question flows use existing class and classroom tables plus audit rows.
- Task/ticket flows write local One Time state and enqueue action-gateway events with stable idempotency.
- Social draft review reads OT-86B draft state and returns a secure web approval link; Telegram does not publish or schedule posts directly.

Verification:

- `npm run typecheck` passed.
- Targeted `npx prettier --check` passed on touched supported files.
- Targeted `npx eslint` passed on touched TypeScript files.
- Focused unit suite passed: 3 files, 16 tests.
- Focused integration suite passed: 2 files, 3 tests.
- `npm run secret:scan` passed.

Canary:

- Live Telegram canary was not run. It is blocked by missing protected staging bot token, webhook secret, and exact allowlisted Telegram identity/chat mapping.
- Missing protected/readiness inputs: protected One Time Telegram bot token, `ONE_TIME_TELEGRAM_WEBHOOK_SECRET`, `ONE_TIME_TELEGRAM_TOKEN_CONFIGURED=true`, `ONE_TIME_TELEGRAM_WEBHOOK_SECRET_CONFIGURED=true`, `ONE_TIME_TELEGRAM_OWNER_MAPPING_CONFIGURED=true`, `ONE_TIME_TELEGRAM_CANARY_CHAT_CONFIGURED=true`, active `telegram_bot_registry` row, and active `telegram_identity_mappings` row for the allowed operator.

Remaining blockers:

- Configure protected staging Telegram secrets and allowlisted operator mapping before live canary.
- Keep provider publishing, payments, broad sends, DNS/account actions, and unrelated provider mutations outside Telegram runtime approval.

Convergence instructions:

- After protected staging configuration exists, run one canary with the exact allowlisted operator only: `/status`, `/recent-signups`, one read-only social draft command, one safe confirmed local write against fixture/staging data, and one forbidden high-impact command.
- Record redacted canary output in this run folder before enabling any broader admin usage.

Safety confirmation:

- No BNA product code was modified.
- No Academy bot context or token was reused.
- No production deployment, DNS change, broad send, live charge, provider publish, or unrelated provider mutation was performed.
