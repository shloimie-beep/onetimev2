# OT-85 Evidence

## Packet Intake

- Located `C:\Users\User\Downloads\OT85-whatsapp-assistant-codex-packet.zip`.
- Extracted to `C:\Users\User\Downloads\OT85-whatsapp-assistant-codex-packet-extracted-20260715-192025`.
- Verified `SHA256SUMS.txt`; all listed files passed.
- Read packet prompt and support files before implementation.
- Did not use a separate PRO factory file.

## Implementation Evidence

- Added WhatsApp state/intent/provider contracts.
- Added OT-85 migration-backed encrypted WhatsApp conversation, inbox, outbox, consent, suppression, account-link, grant, lead-event, delivery-event, and canary-budget records.
- Added deterministic intent compiler with private/account/technical/consent precedence.
- Added approved public fact registry.
- Added Meta raw webhook adapter and sink adapter.
- Added durable webhook ingestion and async-style processing entrypoints.
- Added STOP/START suppression and append-only consent events.
- Added family/school lead flow with archived-contact protection and school lead-only guardrails.
- Added hash-only account-link seam and short-lived safe-status grants.
- Added send-time suppression, bounded retry, and dead-letter handling for WhatsApp outbox.
- Mounted raw Meta webhook route and authenticated CSRF-protected account-link consume route.

## Verification Evidence

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run secret:scan`: passed.
- `npm run test`: passed.
- `npm run build`: passed.
- Touched-file Prettier check: passed.
- pg-mem migration chain: passed through `2000_ot85_whatsapp_assistant`.

## Canary Evidence

- `npx tsx scripts/ot85/canary-readiness.ts`: `WAITING_FOR_WHATSAPP_CANARY_SECRET`.
- No external provider send occurred.
