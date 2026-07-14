# OT-44 Status Mapping

Audited source: `onetime.outbox_events` at `571b18f36cdc645f757cc3be6b0519f1af3225f6`.

| Persisted status | Public local state | Public label | Rationale |
| --- | --- | --- | --- |
| `pending` | `intent_queued` | `Queued locally` | Producer inserts pending local intents. This proves only local persistence. |
| `sink_delivered` | `sink_processed` | `Processed in test mode` | Current worker uses the synthetic sink router; completion is test-mode processing, not provider delivery. |
| anything else | `status_unavailable` | `Status unavailable` | Other statuses are transient/internal, dormant provider paths, terminal worker outcomes, or schema-permitted unknown text. |

Forbidden user-facing labels for synthetic sink rows:

- `Sent`
- `Delivered`

Audited event/channel allowlist:

- `family_signup_email_ack.v1` + `email`
- `family_signup_whatsapp_confirmation.v1` + `whatsapp`
- `school_signup_email_ack.v1` + `email`
- `school_signup_whatsapp_receipt.v1` + `whatsapp`
- `internal_lead_alert` + `internal_email`

Unknown event types are normalized to `Communication intent unavailable`; raw event names are not echoed.
