# OT-100 OPS04 Integration Delta

OT-100 keeps shared app and worker entrypoints untouched. The branch adds the
production-shaped WhatsApp provider runtime behind feature-local factories and
scripts.

## Added

- `packages/domain/src/whatsapp/provider.ts`
  - Meta Cloud API sender for `POST /v25.0/{phone-number-id}/messages`.
  - Redacted readiness inspection for protected staging config.
  - Exact staging fingerprint and canary gates.
- `packages/domain/src/whatsapp/service.ts`
  - Lease-safe WhatsApp outbox claims.
  - Encrypted provider message reference persistence.
  - Retry/dead-letter handling for Meta 429/5xx vs 401/403-style failures.
  - Delivery status dedupe by stable provider status event key.
- `packages/db/migrations/2100_ot100_whatsapp_provider_activation.sql`
  - WhatsApp outbox lease columns.
  - Encrypted provider ref columns.
  - Status event dedupe fields.
- `scripts/ot100/whatsapp-runtime-once.ts`
  - Feature-local one-shot runtime. It exits with a redacted blocker report
    unless all protected staging/canary gates are present.

## Later Shared Wiring

OPS04 can wire the feature-local pieces without changing this branch's safety
contract:

1. Use `createMetaWhatsAppCloudAdapterFromEnv(process.env)` only in a dedicated
   staging provider worker or canary runner.
2. Keep the existing webhook route before global JSON parsing. If strict phone
   number or WABA validation is enabled at the web edge, pass a configured
   `MetaWhatsAppCloudAdapter` into `receiveWhatsAppWebhook`.
3. Run `scripts/ot100/whatsapp-runtime-once.ts` only with:
   - `ONE_TIME_WHATSAPP_GRAPH_VERSION=v25.0`
   - protected access token, phone-number ID, and WABA ID
   - `ONE_TIME_WHATSAPP_REAL_STAGING_ENABLED=true`
   - `ONE_TIME_WHATSAPP_PROVIDER_ENV=STAGING`
   - `ONE_TIME_WHATSAPP_STAGING_ISOLATED=true`
   - `ONE_TIME_WHATSAPP_STAGING_ENV_FINGERPRINT=ot100-whatsapp-meta-cloud-staging-v1`
   - `ONETIME_WHATSAPP_CANARY_AUTHORIZED=true`
   - one protected allowlisted `ONETIME_CANARY_WHATSAPP_RECIPIENT_E164`
   - `ONE_TIME_WHATSAPP_CANARY_BUDGET=1`

## Still Out Of Scope

- Templates or campaigns.
- Shared worker main edits.
- Shared `app.ts` edits.
- `.env.example`, root manifest, lockfile, Railway descriptor, auth, landing,
  CRM, portal, or provider module edits.
- Production, DNS, Stripe, Telegram, Zoom, Vimeo, Buffer, BNA, or broad
  provider mutations.
