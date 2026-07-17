# OT-101R - One Time admin Telegram runtime and action gateway

## Mission

Turn the existing One Time Telegram command contracts into a real isolated admin bot runtime. The bot is for One Time owner/admin operation of the Rabbi product. It is not the Academy bot, must not load BNA/platform context, and must never silently execute an ambiguous or high-impact mutation.

## Source and branch

- Repository: `webcraft-media/onetimev2`
- Exact base: `codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`
- Inspect existing integrated OT-84 semantics and PR #29 head `310bb5ca8cc8c01e2218051367c5cc2e3414a719`.
- New branch: `codex/ot101r-telegram-admin-runtime`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Clean isolated worktree only; no BNA edits.

## Ownership boundary

Own feature-local Bot API sender/webhook or polling runtime, Telegram identity mapping, inbox/lease/deduplication, application-service adapters, tests, and evidence. Avoid shared navigation and broad web-shell edits. Expose one narrow runtime registration function for later convergence.

## Identity and authorization

- Use a dedicated One Time bot token from protected secret storage. Never reuse or infer the Academy token.
- Map Telegram user/chat identity server-side to exact One Time account membership and capabilities. Telegram handles/usernames alone are not authorization.
- Fixed scope: standalone One Time product and Rabbi workspace only. Reject BNA, Academy, platform-wide, cross-account, or arbitrary workspace requests.
- Owner/admin may read only what their web capabilities allow. Rabbi/admin and owner are ordinary memberships; do not implement `view as Rabbi` or impersonation.
- Unknown/unmapped chats receive a generic denial and a safe connection instruction; never reveal whether another identity exists.

## Required actions

Implement natural-language intent routing plus explicit commands for:

- CRM/contact lookup with redacted summaries and safe pagination;
- current/new leads and recent signup status;
- class schedule and protected join/access status, never raw reusable provider URLs;
- content pipeline status, content item status, transcript/knowledge readiness, and retry request;
- tasks create/list/update;
- subscriber support-ticket list/detail/status and decision-needed notifications;
- student-question queue list/detail/feature/resolve, respecting privacy boundaries;
- social draft status and approval request links; complex editing/prompt patching opens the authenticated web route.

All writes require a preview and explicit confirmation tied to the initiating identity, exact target, payload hash, short expiry, and idempotency key. High-impact operations such as bulk sends, Buffer publishing, billing changes, provider configuration, exports, deletion, or role changes must not execute directly from Telegram in V1; return a secure web deep link requiring recent email assurance.

## Runtime safety

- Constant-time webhook-secret comparison, request-size/content-type validation, update deduplication by bot key/update ID, async ingress/worker separation, bounded retry/backoff/dead-letter, single-consumer lease, graceful drain, and polling/webhook mutual exclusion.
- Redact PII and provider IDs in bot replies and logs. Do not send full email/phone lists.
- Do not let model-generated text directly invoke tools. Resolve a typed intent, authorize capability, validate parameters, preview, confirm, then call the application service.
- Deterministic mock/sink mode must cover every action. Real sender is off by default.

## Canary

If protected staging token, webhook secret, and exact allowlisted operator Telegram identity mapping exist, run one narrowly scoped canary: `/status`, one fictional CRM lookup, and one reversible fictional task create with confirmation. Do not message Rabbi/customers or mutate production. Missing bot variables block only live canary; finish implementation/PR/checkpoint.

## Verification and persistence

Test identity spoofing, unmapped chat, cross-account denial, stale/replayed confirmation, duplicated updates, two-worker lease behavior, denied commands, redaction, provider-off behavior, webhook/polling conflict, and safe shutdown. Run full applicable CI, secret scan, and disposable PostgreSQL proof.

Persist `ops/codex-runs/OT-101R/{ORIGINAL-PROMPT.md,STATE.json,DECISIONS.md,RESUME.md,FINAL-REPORT.md}`. Commit/push/open a draft PR. Final report must include exact heads, application-service coverage, commands/actions, tests, missing protected variable names, redacted canary result, convergence instructions, and confirmation of zero BNA/Academy/production/broad-send/live-charge mutations.
