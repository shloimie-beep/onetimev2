# Summary

Implements OT-85: a public WhatsApp lead/help assistant for One Time with durable raw-byte webhook intake, encrypted WhatsApp inbox/outbox records, deterministic intent handling, consent/suppression, family/school lead capture, hash-only account-link verification, and a short-lived safe-status seam.

# Product Boundaries

This branch implements the public WhatsApp assistant only. It does not implement private account reads, child/student data reads, billing reads, class-link delivery, support-ticket creation, portal access creation, Telegram runtime reuse, payment mutations, or external provider mutations.

# Architecture

- Adds `2000_ot85_whatsapp_assistant.sql` for WhatsApp conversations, durable inbox, outbox, consent, suppression, account-link requests, verified grants, lead events, delivery events, and canary budget.
- Adds `packages/contracts/src/whatsapp` for packet-aligned state, intent, provider, message, and delivery contracts.
- Adds `packages/domain/src/whatsapp` for crypto, intent compilation, public facts, Meta/sink adapters, webhook ingestion, lead flow, account-link consumption, outbox processing, and canary readiness.
- Mounts `GET/POST /api/v1/whatsapp/meta/webhook` before global JSON parsing so Meta signatures use exact raw bytes.
- Mounts `POST /api/v1/whatsapp/account-link/consume` behind existing authenticated session and CSRF checks.

# Safety Notes

- E.164 values and message bodies are encrypted at rest.
- Sender/recipient keys and provider refs are HMAC-derived.
- Phone number alone never authenticates a user.
- Account-link token is stored hash-only and grants only `safe_status_only` for 15 minutes after household authorization.
- School leads are lead-only and do not create households, subscribers, portals, class access, reminders, or class links.
- Archived matching contacts are not reactivated.
- STOP/START are processed before ordinary intent handling.

# Tests

- `npm run typecheck`
- `npm run lint`
- `npm run secret:scan`
- `npm run test`
- `npm run build`
- Touched-file Prettier check
- pg-mem migration chain through `2000_ot85_whatsapp_assistant`

# Canary

No canary send occurred. Local readiness is `WAITING_FOR_WHATSAPP_CANARY_SECRET` because `ONETIME_CANARY_WHATSAPP_RECIPIENT_E164` is not configured. The recipient value was not printed or stored.

# Known Validation Notes

- `npm run db:verify` requires `DATABASE_URL`; local pg-mem migration verification passed.
- Repository-wide `npm run format` reports pre-existing formatting warnings from the OT83 base; touched parser-supported files pass Prettier.
