# OPS-04P Provider Matrix

Inventory date: 2026-07-16

Source and staging:

- Repository: `webcraft-media/onetimev2`
- Prompt source SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Inventory branch head when written: `f7647b9dad7b54e1e31fe38aa7a53c1b3a3b5e0b`
- Staging origin: `https://ot99-web-staging.up.railway.app`
- Railway project: `7c8eee26-7a6a-4684-826d-9f4377d67d46`

Read-only staging checks:

| Check | Result |
| --- | --- |
| `GET /health` | `200 {"ok":true,"service":"onetime-web"}` |
| `GET /version` | `200`, version `ops03-fb3c397`, commit `fb3c397ce8ece100cf7873fdddcd940a1552ea9b` |
| `GET /ready` | `200 {"ok":true}` |
| `ot99-web` flags | `NODE_ENV=production`, `PROCESS_TYPE=web`, `OUTBOX_TRANSPORT_MODE=sink`, `DELIVERY_TRANSPORT_MODE=sink` |
| `ot99-worker` flags | `NODE_ENV=production`, `PROCESS_TYPE=worker`, `OUTBOX_TRANSPORT_MODE=sink`, `DELIVERY_TRANSPORT_MODE=sink` |

No provider API identity/status call was made because the inspected provider credentials/resource ids were absent or because the provider mode was explicitly disabled. No provider or Railway mutation was performed.

## Summary

| Provider/workflow | Status | Current mode | Primary blocker owner |
| --- | --- | --- | --- |
| Resend/current email provider | `SINK_ONLY` | Provider transport and real email flags false; sink modes active | configuration/external account |
| Meta WhatsApp/WAPI/Whapi | `SINK_ONLY` | Provider label present, staging isolated, all real WAPI/WhatsApp flags false | configuration/operator decision/external account |
| Telegram Bot API | `UNCONFIGURED` | Webhook and real transport disabled; readiness presence flags absent | configuration/external account |
| Zoom | `SINK_ONLY` | Classroom UX enabled in sink mode; real provider/canary disabled | configuration/external account/operator decision |
| Vimeo | `UNCONFIGURED` | No Vimeo variables present | configuration/external account |
| Stripe TEST | `UNCONFIGURED` | Live-charge guard set to `NO`, all payment/test surfaces false, resources absent | configuration/external account |
| Buffer | `UNCONFIGURED` | No Buffer variables present | configuration/external account |
| OpenAI/provider-neutral helper | `UNCONFIGURED` | No OpenAI/provider runtime; local approved-content retrieval only | code/operator decision/configuration |
| BNA support-event ingress | `UNCONFIGURED` | Support disabled and delivery mode disabled | configuration/external BNA staging account/operator decision |
| BNA content-publication ingress | `UNCONFIGURED` | Signed routes exist; publish signing keys absent | configuration/external BNA staging account/operator decision |

## Resend/current One Time email provider

- Status: `SINK_ONLY`
- Account label: One Time staging email provider; external account not read because provider credentials are absent.
- Scope: One Time lifecycle/owner/customer email delivery only.
- Runtime owner: `ot99-worker` dispatch; `ot99-web` may enqueue.
- Present protected variable names: `ONE_TIME_EMAIL_FROM`, `ONE_TIME_EMAIL_REPLY_TO`, `ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED`, `ONE_TIME_RESEND_TRANSPORT_ENABLED`, `ONE_TIME_RESEND_WEBHOOK_ENABLED`, `ENABLE_REAL_EMAIL_TRANSPORT`, `DELIVERY_TRANSPORT_MODE`, `OUTBOX_TRANSPORT_MODE`.
- Missing protected variable names: `RESEND_API_KEY`, `ONE_TIME_DELIVERY_TEST_CANARY_EMAIL`, `ONE_TIME_OWNER_TEST_EMAIL`, `ONE_TIME_LIFECYCLE_DELIVERY_KEY`, Resend webhook signing secret.
- Mode evidence: `DELIVERY_TRANSPORT_MODE=sink`, `OUTBOX_TRANSPORT_MODE=sink`, `ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED=false`, `ONE_TIME_RESEND_TRANSPORT_ENABLED=false`, `ENABLE_REAL_EMAIL_TRANSPORT=false`.
- Code/evidence paths: `apps/worker/src/delivery/provider-config.ts`, `apps/worker/src/delivery/provider-router.ts`, `apps/worker/src/delivery/provider-webhooks.ts`, `ops/codex-runs/OPS-03A/FINAL-REPORT.md`.
- Webhook/destination: provider webhook normalizer exists, but no enabled staging Resend webhook destination was verified.
- Required capabilities: sender/domain verification, transactional canary send, webhook event readback.
- Read-only result: no external Resend call; credentials and canary destination absent.
- Safe canary prerequisite: protected Resend key, exact approved canary email, lifecycle delivery key, optional webhook secret, and one explicit canary authorization.
- Rollback: keep provider/real-email flags false and sink modes active.
- Data/logging: redact email addresses, message bodies, provider event payloads, and provider ids.

## Meta WhatsApp Cloud or selected WAPI/Whapi

- Status: `SINK_ONLY`
- Account label: staging provider account key present as a label only; no token, phone number, or personal recipient printed.
- Scope: One Time public lead/status WhatsApp channel and tightly scoped canary only.
- Runtime owner: `ot99-web` for Meta webhook ingress; `ot99-worker` for WAPI/Whapi dispatch if selected.
- Present protected variable names: `ONE_TIME_WHATSAPP_PROVIDER_ACCOUNT_KEY`, `ONE_TIME_WHATSAPP_PROVIDER_ENV`, `ONE_TIME_WHATSAPP_STAGING_ISOLATED`, `ONETIME_WHATSAPP_CANARY_AUTHORIZED`, `ONE_TIME_WAPI_TRANSPORT_ENABLED`, `ONE_TIME_WAPI_WEBHOOK_ENABLED`, `ONE_TIME_PUBLIC_WHATSAPP_AUTOREPLY_ENABLED`, `ENABLE_REAL_WHATSAPP_TRANSPORT`.
- Missing protected variable names: canary WhatsApp recipient, Meta access token, Meta phone id, Meta app/signature secret, Meta verify token, WAPI/Whapi token, WAPI/Whapi webhook secret.
- Mode evidence: `ONE_TIME_WHATSAPP_PROVIDER_ENV=STAGING`, `ONE_TIME_WHATSAPP_STAGING_ISOLATED=true`, all real transport/webhook/autoreply/canary flags false.
- Code/evidence paths: `apps/web/src/server/app.ts`, `apps/worker/src/delivery/provider-config.ts`, `apps/worker/src/delivery/provider-router.ts`, `apps/worker/src/delivery/provider-webhooks.ts`, `packages/domain/src/whatsapp/provider.ts`, `packages/domain/src/whatsapp/service.ts`, `scripts/ot85/canary-readiness.ts`, `ops/codex-runs/OT-85/PROVIDER-STATE.md`.
- Webhook/destination: code route is `GET/POST https://ot99-web-staging.up.railway.app/api/v1/whatsapp/meta/webhook`; external provider destination was not read because credentials/read scope were absent.
- Required capabilities: signed webhook receipt, provider config readback, one approved canary send, inbound event dedupe/classification.
- Read-only result: no external WhatsApp/WAPI call; provider is isolated and off.
- Safe canary prerequisite: choose Meta or WAPI/Whapi, configure corresponding protected token/secrets/verify token, exact recipient, and canary approval.
- Rollback: keep all WhatsApp/WAPI real transport/webhook/autoreply/canary flags false.
- Data/logging: redact phone numbers, message bodies, webhook payloads, profile names, and provider ids.

## Telegram Bot API

- Status: `UNCONFIGURED`
- Account label: bot key defaults in code; no token/chat/operator identity printed.
- Scope: One Time owner/operator bot notifications and command ingress.
- Runtime owner: `ot99-web` webhook ingress; future worker dispatch if enabled.
- Present protected variable names: `ONE_TIME_TELEGRAM_ENVIRONMENT`, `ONE_TIME_TELEGRAM_WEBHOOK_ENABLED`, `ENABLE_REAL_TELEGRAM_TRANSPORT`.
- Missing protected variable names: `ONE_TIME_TELEGRAM_WEBHOOK_SECRET`, `ONE_TIME_TELEGRAM_BOT_KEY`, `ONE_TIME_TELEGRAM_TOKEN_CONFIGURED`, `ONE_TIME_TELEGRAM_WEBHOOK_SECRET_CONFIGURED`, `ONE_TIME_TELEGRAM_OWNER_MAPPING_CONFIGURED`, `ONE_TIME_TELEGRAM_SINGLE_CONSUMER_GATE`, `ONE_TIME_TELEGRAM_CANARY_CHAT_CONFIGURED`, `ONE_TIME_TELEGRAM_TRANSPORT_ENABLED`, polling flags.
- Mode evidence: `ONE_TIME_TELEGRAM_ENVIRONMENT=staging`, `ONE_TIME_TELEGRAM_WEBHOOK_ENABLED=false`, `ENABLE_REAL_TELEGRAM_TRANSPORT=false`.
- Code/evidence paths: `apps/web/src/server/app.ts`, `apps/telegram-bot/src/ingress.ts`, `packages/domain/src/telegram/config.ts`, `packages/domain/src/telegram/transport.ts`, `ops/codex-runs/OT-84/CANARY.json`, `ops/codex-runs/OT-84/PROVIDER-MUTATIONS.json`.
- Webhook/destination: code route is `POST https://ot99-web-staging.up.railway.app/api/v1/telegram/one-time/webhook`; route is not active with webhook flag false, and provider destination was not configured/read.
- Required capabilities: Bot API identity read, secret-token webhook validation, single-consumer gate, owner/operator mapping, one approved canary message.
- Read-only result: no Telegram call; required presence flags absent.
- Safe canary prerequisite: configure token, webhook secret, mapping, single-consumer gate, exact canary chat, and approval; run `getMe`/`getWebhookInfo` before send.
- Rollback: keep webhook and transport disabled.
- Data/logging: hash/redact chat ids, user ids, message text, webhook payloads, and tokens.

## Zoom

- Status: `SINK_ONLY`
- Account label: no Zoom account/client/host id present or printed.
- Scope: One Time classroom launch, registrant, reminder, and SDK/join-grant flow.
- Runtime owner: `ot99-web` for portal/classroom UX; worker/background jobs later if enabled.
- Present protected variable names: `ZOOM_CLASSROOM_ENABLED`, `ZOOM_CLASSROOM_PROVIDER_MODE`, `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED`, `ZOOM_CLASSROOM_CANARY_ENABLED`, `ZOOM_CLASSROOM_COMPONENT_VIEW_ENABLED`.
- Missing protected variable names: Zoom OAuth account/client secret set, SDK/join credentials, webhook secret token, host/user id, canary meeting/template ids.
- Mode evidence: `ZOOM_CLASSROOM_ENABLED=true`, `ZOOM_CLASSROOM_PROVIDER_MODE=sink`, `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=false`, `ZOOM_CLASSROOM_CANARY_ENABLED=false`.
- Code/evidence paths: `packages/domain/src/providers/zoom.ts`, `ops/codex-runs/OT-88/packet/07-TEST-CANARY-PLAN.md`.
- Webhook/destination: no Zoom webhook route verified; real provider and canary disabled.
- Required capabilities: account/user/meeting readback, registrant management, SDK/join grants, reminder scheduling.
- Read-only result: no Zoom call; sink mode confirmed.
- Safe canary prerequisite: protected Zoom test account, host/test meeting or template, SDK credentials, webhook secret, allowlisted classroom, and read-only account/settings checks first.
- Rollback: set provider mode to sink and keep real provider/canary false.
- Data/logging: redact registrant data, join URLs, meeting IDs, host IDs, SDK signatures, and attendance data.

## Vimeo

- Status: `UNCONFIGURED`
- Account label: no Vimeo account/client/token present or printed.
- Scope: One Time content pipeline video identity/upload/privacy/playback/webhook readiness.
- Runtime owner: `ot99-web` signed content ingress and content views; future background reconciliation if enabled.
- Present protected variable names: none observed.
- Missing protected variable names: `VIMEO_ACCESS_TOKEN`, `VIMEO_CLIENT_ID`, `VIMEO_CLIENT_SECRET`, `VIMEO_WEBHOOK_SECRET`, `VIMEO_ACCOUNT_ID`, `OT86_ALLOW_VIMEO_CANARY_UPLOAD`.
- Mode evidence: no Vimeo variable names present in web or worker.
- Code/evidence paths: `bin/ot86-vimeo-canary`, `packages/domain/src/content/pipeline.ts`, `contracts/content-pipeline/v1/07-VIMEO-PROVIDER-CONTRACT.md`, `ops/codex-runs/OT-86A/VIMEO-READINESS.md`.
- Webhook/destination: none configured/read.
- Required capabilities: identity readback, upload/privacy/playback capability readback, private fixture upload only after later authorization, webhook verification.
- Read-only result: no Vimeo call; read-only canary cannot run without token.
- Safe canary prerequisite: configure protected Vimeo token/client/account/webhook variables and run read-only canary before any upload canary.
- Rollback: withhold Vimeo variables and upload authorization.
- Data/logging: redact video IDs, upload/playback URLs, webhook payloads, and private content metadata unless non-secret and explicitly needed.

## Stripe TEST

- Status: `UNCONFIGURED`
- Account label: no Stripe account/product/price/portal/webhook ids or keys printed.
- Scope: One Time TEST billing only.
- Runtime owner: `ot99-web` checkout/portal/webhook routes; future reconciliation worker if enabled.
- Present protected variable names: `LIVE_STRIPE_CHARGES_AUTHORIZED`, `ENABLE_PAYMENT_TRANSPORT`, `ENABLE_STRIPE_TEST_CHECKOUT`, `ENABLE_STRIPE_TEST_PORTAL`, `ENABLE_STRIPE_TEST_WEBHOOKS`, `ENABLE_STRIPE_TEST_RECONCILIATION`.
- Missing protected variable names: `ONE_TIME_STRIPE_TEST_SECRET_KEY`, `ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET`, `ONE_TIME_STRIPE_TEST_ACCOUNT_ID`, `ONE_TIME_STRIPE_TEST_PRODUCT_ID`, `ONE_TIME_STRIPE_TEST_PRICE_ID`, `ONE_TIME_STRIPE_TEST_PORTAL_CONFIGURATION_ID`, `ONE_TIME_STRIPE_TEST_WEBHOOK_ENDPOINT_ID`, `ONE_TIME_STRIPE_TEST_PUBLISHABLE_KEY`.
- Mode evidence: `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`, `ENABLE_PAYMENT_TRANSPORT=false`, all Stripe TEST surfaces false.
- Code/evidence paths: `apps/web/src/server/app.ts`, `packages/domain/src/billing/config.ts`, `packages/domain/src/billing/stripe-test-adapter.ts`, `packages/domain/src/billing/stripe-official-client.ts`, `scripts/ot87-stripe-test-resources.ts`, `ops/codex-runs/OT-87/STATE.json`.
- Webhook/destination: correct staging route is `https://ot99-web-staging.up.railway.app/api/v1/billing/webhooks/provider`. The known obsolete target `http://join.onetimeonetime.com` does not match staging and must be corrected later in Stripe TEST configuration. This task did not change it.
- Required capabilities: read account/product/price/portal/webhook endpoint; create checkout/portal sessions only in later approved TEST canary.
- Read-only result: no Stripe call; required test credentials/resource ids absent.
- Safe canary prerequisite: configure all Stripe TEST resource variables and webhook endpoint id targeting the correct staging route; run read-only validate before creating any session.
- Rollback: keep payment transport and all Stripe TEST flags false; keep `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`.
- Data/logging: never log Stripe secret keys, webhook secrets, customers, session URLs, payment methods, invoices, or personal billing data.

## Buffer

- Status: `UNCONFIGURED`
- Account label: no Buffer organization/profile/channel ids or token present or printed.
- Scope: One Time social publishing after approved content events.
- Runtime owner: `ot99-web` signed social-publishing ingress; future publisher worker if enabled.
- Present protected variable names: none observed.
- Missing protected variable names: `BUFFER_ACCESS_TOKEN`, `BUFFER_ORGANIZATION_ID`, `BUFFER_DESTINATION_IDS`.
- Mode evidence: no Buffer variable names present in web or worker.
- Code/evidence paths: `bin/ot86-buffer-canary`, `packages/domain/src/social/publishing.ts`, `contracts/social-publishing/v1/07-BUFFER-ADAPTER-CONTRACT.md`, `ops/codex-runs/OT-86B/BUFFER-READINESS.md`.
- Webhook/destination: Buffer is outbound; internal signed event route is `POST https://ot99-web-staging.up.railway.app/internal/social-publishing/v1/events`.
- Required capabilities: read profiles/channels/org mapping; draft/schedule/publish only later.
- Read-only result: no Buffer call; token/org/destination variables absent.
- Safe canary prerequisite: configure protected Buffer token, organization id, and destination ids; run read-only profiles canary before any draft/schedule/publish.
- Rollback: withhold Buffer variables.
- Data/logging: redact tokens, unpublished copy, private profile/account data, and unnecessary channel IDs.

## OpenAI/provider-neutral retrieval runtime

- Status: `UNCONFIGURED`
- Account label: no OpenAI account/project/model/key present or printed.
- Scope: student helper and approved-content retrieval only.
- Runtime owner: `ot99-web` portal/helper request path; local retrieval in domain package.
- Present protected variable names: none observed.
- Missing protected variable names: provider key/project/model, helper runtime enable flag, helper policy/safety config.
- Mode evidence: no `OPENAI_*` runtime configuration found; helper defaults unavailable and content retrieval is local SQL over approved sections.
- Code/evidence paths: `packages/domain/src/content/pipeline.ts`, `packages/domain/src/portals/services.ts`, `packages/domain/src/portals/schemas.ts`.
- Webhook/destination: not applicable.
- Required capabilities: approved-content retrieval only, citation-backed answers, student-safe scope boundaries, no private/adult notes exposure.
- Read-only result: no external AI provider call; no provider client configured.
- Safe canary prerequisite: define provider-neutral helper contract, configure protected provider/runtime/policy, load approved content, and pass citation/scope tests before external inference.
- Rollback: leave provider variables absent and helper unavailable.
- Data/logging: do not log raw student questions, private notes, family data, prompts, or model responses with private context.

## BNA signed support-event ingress

- Status: `UNCONFIGURED`
- Account label: no BNA receiver/signing key/account id present or printed.
- Scope: One Time to BNA support ticket/event sync only.
- Runtime owner: `ot99-web` internal signed ingress; support worker later if enabled.
- Present protected variable names: `OT89_SUPPORT_ENABLED`, `OT89_SUPPORT_DELIVERY_MODE`, `OT89_SUPPORT_DEPLOYMENT_ID`, `OT89_MOCK_BNA_ENABLED`.
- Missing protected variable names: `OT89_SUPPORT_HMAC_KEY_ID`, `OT89_SUPPORT_HMAC_SECRET`, `OT89_BNA_BASE_URL`, receiver path/mapping, attachment signing secret.
- Mode evidence: `OT89_SUPPORT_ENABLED=false`, `OT89_SUPPORT_DELIVERY_MODE=disabled`, `OT89_MOCK_BNA_ENABLED=false`.
- Code/evidence paths: `apps/web/src/server/features/support/router.ts`, `packages/domain/src/support/hmac.ts`, `packages/domain/src/support/delivery.ts`, `packages/domain/src/support/redaction.ts`, `ops/codex-runs/OT-89A/SUPPORT-EVENT-CONTRACT.json`.
- Webhook/destination: One Time route is `POST https://ot99-web-staging.up.railway.app/api/internal/integrations/onetime/support-events/v1`; external BNA receiver not configured/read.
- Required capabilities: signed support-event ingress, signed status ingress, attachment access, redacted delivery to BNA staging.
- Read-only result: no BNA call; support disabled and signing/receiver config absent.
- Safe canary prerequisite: configure BNA staging receiver URL/path, HMAC key id/secret, attachment signing, workspace mapping, and run a signed synthetic support event only after authorization.
- Rollback: keep support disabled and delivery mode disabled.
- Data/logging: redact ticket bodies, attachments, actor identifiers, raw signatures, and student/family/private notes.

## BNA content-publication ingress

- Status: `UNCONFIGURED`
- Account label: no BNA content publisher/signing key/account id present or printed.
- Scope: signed internal publication of approved One Time content manifests and social events.
- Runtime owner: `ot99-web` signed routes; domain content/social packages for validation/storage.
- Present protected variable names: none observed.
- Missing protected variable names: `OT86_PUBLISH_SIGNING_KEY_ID`, `OT86_PUBLISH_SIGNING_SECRET`, BNA content publisher mapping, source allowlist.
- Mode evidence: signing variables absent from web and worker.
- Code/evidence paths: `apps/web/src/server/app.ts`, `contracts/content-pipeline/v1/06-PUBLISH-HANDOFF-CONTRACT.md`, `contracts/social-publishing/v1/07-BUFFER-ADAPTER-CONTRACT.md`, `ops/codex-runs/OT-86A/DISCOVERY.md`, `ops/codex-runs/OT-86B/IMPLEMENTATION.md`.
- Webhook/destination: One Time signed routes are `POST https://ot99-web-staging.up.railway.app/internal/content-publications/v1/manifests` and `POST https://ot99-web-staging.up.railway.app/internal/social-publishing/v1/events`; publisher not configured/read.
- Required capabilities: raw-byte HMAC verification, approved content-only manifests, source allowlist/workspace mapping.
- Read-only result: no BNA publisher call; publish signing variables absent.
- Safe canary prerequisite: configure OT86 publish signing key id/secret and exact BNA staging publisher mapping; run synthetic signed non-sensitive fixture only after authorization.
- Rollback: withhold OT86 publish signing variables and mapping.
- Data/logging: do not log raw content bodies, private classroom notes, signing secrets, or cross-workspace identifiers.
