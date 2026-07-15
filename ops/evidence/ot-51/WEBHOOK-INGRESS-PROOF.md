# OT-51P Webhook Ingress Proof

## Handler

Direct-import hook:
`apps/telegram-bot/src/ingress.ts#createTelegramWebhookHandler`.

## Controls

- POST only.
- Exact `application/json` content type.
- Official `x-telegram-bot-api-secret-token` header compared through a
  constant-time digest comparison.
- Bounded request body.
- Bounded JSON depth, string length, and array length.
- Supported update subset: `message`, `edited_message`, `callback_query`.
- Provider user IDs and chat IDs are converted to hashed opaque refs at ingress.
- Username, display name, phone, raw provider IDs, and unsupported fields are not
  retained.
- Message text and callback payload are stored only inside the injected
  `SensitivePayloadCodec` reference.
- Ingress performs durable dedupe/enqueue only. It calls no application adapter
  and makes no business decision.

## Focused Proof

`tests/unit/telegram/telegram-foundation.test.ts` covers:

- wrong method;
- wrong content type;
- missing/wrong secret;
- constant-time comparator boolean contract;
- oversized JSON;
- over-deep JSON;
- duplicate update acknowledgement;
- opaque ID hashing;
- no raw provider ID/username in stored inbox fixture.
