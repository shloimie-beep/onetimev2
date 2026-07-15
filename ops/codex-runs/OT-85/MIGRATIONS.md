# OT-85 Migrations

Added `packages/db/migrations/2000_ot85_whatsapp_assistant.sql`.

Tables:

- `whatsapp_conversations`
- `whatsapp_inbox_events`
- `whatsapp_outbox_messages`
- `whatsapp_consent_events`
- `whatsapp_suppressions`
- `whatsapp_account_link_requests`
- `whatsapp_verified_grants`
- `whatsapp_lead_events`
- `whatsapp_delivery_events`
- `whatsapp_canary_budget`

Local pg-mem migration verification:

```json
{
  "applied": 15,
  "last": {
    "id": "2000_ot85_whatsapp_assistant",
    "checksum": "dc0498438b6cf3f06c733d9d2494bb88a1a55f188bc8a5f27b54faedbfdf0270",
    "status": "applied"
  }
}
```

`npm run db:verify` was also attempted and blocked because no `DATABASE_URL` is configured in this local worktree.
