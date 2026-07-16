# OT-89A — Implement the One Time Subscriber Support Producer

You are implementing OT-89A. Use `OT-89A` everywhere.

## Find the shared packet, but keep working if it is missing

Search current attachments, `C:\Users\User\.codex\attachments`, and `C:\Users\User\Downloads` recursively for a valid OT-89 support packet; likely names include `OT-89-CODEX-PACKET.zip` and `OT89-support-bridge-codex-packets.zip`. Validate hashes and safe paths. Extract only after validation. If found, treat its `SUPPORT-EVENT-CONTRACT.json` as the frozen contract and record its SHA-256. If absent, create the same contract from this embedded specification and continue; do not stop.

## Base and durable state

Locate `webcraft-media/onetimev2` by origin, fetch remote, and dynamically resolve `origin/codex/ot84-telegram-action-gateway` (last audited `f98103ecc3660dbda871a91485656e17580940a8`). Create a clean isolated worktree and branch `codex/ot89a-subscriber-support-producer`. Never touch/reset another dirty worktree.

Before edits, persist `RECEIPT.json`, `ORIGINAL-PROMPT.md`, `INPUTS.json`, `STATE.json`, `RESUME.md`, and `LOG.jsonl` under `ops/codex-runs/OT-89A/`. Push a useful checkpoint when blocked later.

## Binding authorization rule

Only an authenticated account member with a currently active One Time subscriber entitlement can create a technical/complaint ticket. Anonymous users, leads, schools without entitlement, expired/canceled users, and non-subscribers must not see or call a public ticket page/API. Public users use the WhatsApp lead assistant. Remove, hide, or noindex any existing anonymous support-ticket UI.

BNA is the ticket system of record, but One Time must never synchronously load or wait for the BNA UI/runtime. Telegram is an alert/action transport, not a database.

## Implement

Build:

- branded authenticated support form/helper action;
- categories `bug`, `access_login`, `class_zoom`, `billing`, `content`, `complaint`, `other`;
- entitlement, account, role, rate-limit, CSRF, size/type, and abuse checks;
- safe attachment metadata/storage seam with allowlist/quarantine/limits and no executable content;
- durable local submission receipt, status identifier, audit, and outbox;
- signed, timestamped, nonce-protected, idempotent asynchronous event to BNA;
- retries/backoff/dead-letter/reconciliation and an honest delayed-delivery state;
- redacted structured diagnostic context without secrets, provider URLs, raw session data, or unrelated PII;
- status/deep-link seam that does not reveal BNA internals.

Freeze a versioned `SUPPORT-EVENT-CONTRACT.json` that OT-89B can consume. Include event ID/version, One Time account/product, opaque subscriber/contact/ticket IDs, verified entitlement snapshot reference, category, sanitized summary/body/evidence, occurrence timestamps, delivery attempt metadata, signature key ID (not key), idempotency key, and reply/status correlation. Define canonical serialization/signature verification and evolution rules.

Never pipe raw user text to a shell, Codex, SQL, or CLI. Do not automatically change code or deploy from a ticket.

## Verification

Test active subscriber success and rejection for anonymous, lead, school-only, expired/canceled entitlement, wrong account/role, CSRF, forged/replayed event, duplicate submission/delivery, malicious/oversized attachment, injection text, BNA outage, alert failure, worker restart, and eventual reconciliation. Prove a durable One Time receipt exists while BNA is unavailable and no duplicate ticket results later. Test mobile 360/390, keyboard/a11y/RTL/reflow, no dead actions, no BNA fanout, response no-store, secret/PII scans, PostgreSQL fresh/upgrade/concurrency, and full project checks.

No BNA product edit, production DB, provider send, deploy, DNS, live charge, or real-user mutation in OT-89A.

## Finish

Commit/push/open a draft PR. Put the exact shared contract and hash in the repo and `ops/codex-runs/OT-89A/FINAL-REPORT.md`; include base/head, migration checksums, tests, external mutations, readiness, and resume steps. Keep the worktree clean.

