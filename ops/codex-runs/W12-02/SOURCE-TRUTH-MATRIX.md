# W12-02 Source-Truth Matrix

| Source                                                | Truthful claim                                                                   | Forbidden claims                                                      | Implementation                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `onetime.outbox_events`                               | One Time stored an outbound intent or provider-off reply draft locally.          | Sent, delivered, read by recipient.                                   | Projected as `local_outbox_intent` or `crm_reply_draft`.                 |
| `onetime.outbox_events.status=sink_delivered`         | The synthetic sink processed the local intent in test mode.                      | Provider accepted, provider delivered.                                | Normalized as `draft_saved` with "Processed in test mode, not delivery." |
| `onetime.whatsapp_delivery_events`                    | A stored provider status event was received for a known WhatsApp outbox message. | Complete mailbox history, message body availability.                  | Projected as `stored_provider_delivery_event`.                           |
| `onetime.whatsapp_inbox_events`                       | An inbound WhatsApp webhook was durably stored with encrypted body data.         | Raw body is safe for evidence, all historical inbound messages exist. | Projected as `stored_whatsapp_webhook`.                                  |
| Redacted Resend or WhatsApp export fixture            | A redacted export row can be dry-run and deduped before import.                  | Production import completed, raw private body may be committed.       | `dryRunCommunicationHistoryBackfill()` adapter contract and CLI.         |
| Missing Resend or WhatsApp historical provider access | Provider history is unavailable until an export/API readback is supplied.        | History is empty, history is complete.                                | `unavailableProviderHistoryReport()` limitation record.                  |

## Notes

- Local intent is never labeled as delivered.
- Provider status labels are used only for stored provider event rows.
- Reply drafts remain draft-only with `transport_available=false`.
- Reports use fingerprints and redacted previews only.
