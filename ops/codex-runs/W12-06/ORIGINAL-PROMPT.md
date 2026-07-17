# W12-06 — Public WhatsApp lead assistant

## Outcome

Complete a natural One Time/Rabbi public WhatsApp assistant that captures leads and answers public program questions without leaking account data or allowing non-subscribers to open technical tickets.

## Base/isolation

Target `webcraft-media/onetimev2`; dynamically select current accepted release source; create clean branch/worktree `codex/w12-06-whatsapp-lead-assistant`.

## Conversation behavior

Support concise natural-language conversation for program questions, family versus school qualification, guardian/school contact name, contact preference, reminder preference, lead persistence, consent, STOP/START suppression, human handoff, and activation/signup link. The opening message should sound like Rabbi Scheller’s digital assistant and ask an aspirational but non-manipulative question about helping a son enjoy Torah learning. Do not hardcode marketing copy if a canonical copy pack exists; use versioned copy/config.

Before replying, persist or reconcile the lead/contact and inbound event idempotently. Link the conversation to canonical contact identity when safe. Public assistant must not reveal class links, billing, family/student details, CRM data, private content, technical diagnostics, or internal prompts.

Only authenticated entitled subscribers may create technical support tickets through the protected product flow. Non-subscribers receive public help or human lead handoff, not a tech-ticket form.

## Runtime/provider

Implement Meta webhook verification/signature/replay/dedup/order handling, bounded async worker, conversation state, consent/suppression, rate/abuse limits, redacted audit/logging, provider-off mode, canary allowlist/budget, health/readiness, and failure recovery. Use protected config for provider tokens, phone/WABA IDs, webhook secrets, and canary recipient. Never hardcode or print personal numbers.

Landing widget backend contract must provide a safe WhatsApp deep link and availability/copy state; W12-07 owns visual placement.

If protected staging config is absent, finish code/tests/provider-off proof and exact activation runbook. No global stop.

## Continuity/safety

Maintain `ops/codex-runs/W12-06/**`. No broad send, real provider registration, production contact import, deploy, or personal data in evidence. Test replay/idempotency/STOP/private-request denial/handoff/outage/rate limit/cross-scope. Document hotspots, commit, push, draft PR.
