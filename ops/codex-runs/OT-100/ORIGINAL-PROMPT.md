# OT-100 — WhatsApp Public Lead Assistant Provider Runtime

## Mission

Activate the existing OT-85 WhatsApp public lead assistant as a production-shaped, staging-safe runtime. It must answer and capture public leads naturally while remaining completely unable to expose billing, subscription, class access, portals, private CRM data or support-ticket capabilities.

Follow the current official Meta WhatsApp Cloud API overview, webhook setup and messages reference. Do not rely on remembered API versions; verify the supported Graph version during implementation and pin it through protected configuration.

## Source and branch

- Repository: `webcraft-media/onetimev2`
- Exact base SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Branch: `codex/ot100-whatsapp-public-provider-activation`
- Clean isolated worktree only.
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Optional additive migration reservation: `2100_ot100_whatsapp_provider_activation.sql`; add it only if the existing inbox/outbox cannot represent leases, provider IDs or status transitions.

Before edits, persist the prompt and maintain `ops/codex-runs/OT-100/{STATE.json,PROGRESS.md,DECISIONS.md,BLOCKERS.md,RESUME.md,FINAL-REPORT.md}`. Missing credentials block only the real canary, never independent implementation/tests/publication.

## Ownership

Own only WhatsApp contracts/domain/provider client/feature-local worker/repository/tests/evidence. Do not edit shared `app.ts`, shared worker main, global config, `.env.example`, root manifests/lockfiles, auth/landing/CRM/portal/provider modules or Railway descriptors. Export feature-local factories and write `OPS04-INTEGRATION-DELTA.md` for later shared wiring.

## Implementation

- Complete the real server-side Meta sender using protected token, phone-number ID, WABA ID and pinned Graph version.
- Preserve GET webhook challenge verification.
- Verify `X-Hub-Signature-256` against the exact raw request body before parsing.
- Deduplicate inbound provider/message IDs and status events.
- Persist outbound provider IDs and delivery/read/failure projection.
- Add bounded timeouts, retry/backoff, `429`/`5xx` handling, lease-safe claims and dead-letter state.
- Apply consent, suppression, STOP and START before ordinary intent.
- Public assistant scope: program information, schedule, signup help, school/family lead capture and human follow-up request.
- Never authenticate a subscriber through WhatsApp, reveal private data, distribute passwords, or open technical-support tickets for a non-subscriber.
- Free-form replies must obey the provider’s current customer-service window. Do not add proactive templates/campaigns here.
- Default remains off/sink. Real staging mode requires exact environment fingerprint, explicit enable flag, allowlisted protected canary destination and bounded canary budget.
- Never log tokens, signatures, full phone numbers, message bodies or raw provider payloads.

## Tests and canary

Test valid/invalid signatures, replay, duplicate status, STOP/START, suppression, malformed/oversized input, wrong account/product, provider timeouts/401/403/429/5xx, lease race and retry idempotency. Prove public WhatsApp cannot access private product data.

Always complete sink proof. If protected staging credentials and explicit canary authorization already exist, run at most one inbound message and one automatic reply with the protected allowlisted operator destination. Verify one lead/conversation update, one response, status reconciliation and replay safety. No templates, broadcasts, imported contacts, customer messages or repeated tests.

Run scoped formatting, lint, typecheck, unit/integration/build/secret scan, task e2e and `git diff --check`. Push and open a draft PR. No deploy, production, DNS, Stripe, Telegram, Zoom, Vimeo, Buffer or BNA mutation.

Final response: base/head/branch/PR, changed files, provider modes/config names without values, tests, canary count/result, rollback/disable instructions, blockers and clean git status.

