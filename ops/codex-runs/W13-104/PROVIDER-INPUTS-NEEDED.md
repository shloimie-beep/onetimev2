# W13-104 Provider Inputs Needed

Status: `blocked_pending_private_authorization`

Required private manifest:

- `C:\Users\User\.onetime-w13-104-private\CANARY-AUTHORIZATION.private.json`

Lane-level blockers from the last sanitized provider-readiness snapshot:

| Lane                  | Missing or blocking names                                                                                                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transactional email   | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `ONE_TIME_EMAIL_FROM`, `ONE_TIME_EMAIL_REPLY_TO`                                                                                                                                                                            |
| WhatsApp              | `ONE_TIME_WHATSAPP_PROVIDER_ACCOUNT_KEY`, `ONE_TIME_WHATSAPP_PROVIDER_ENV`, `ONE_TIME_WHATSAPP_STAGING_ISOLATED`, `ONE_TIME_WHATSAPP_WEBHOOK_SECRET`, `ONE_TIME_WHATSAPP_VERIFY_TOKEN`, `ONETIME_CANARY_WHATSAPP_RECIPIENT_E164`, `ONETIME_WHATSAPP_CANARY_AUTHORIZED` |
| BNA support bridge    | `OT89_SUPPORT_ENABLED`, `OT89_SUPPORT_DELIVERY_MODE`, `OT89_SUPPORT_BNA_BASE_URL`, `OT89_SUPPORT_HMAC_KEY_ID`, `OT89_SUPPORT_HMAC_SECRET`, `OT89_BNA_TO_ONETIME_HMAC_KEY_ID`, `OT89_BNA_TO_ONETIME_HMAC_SECRET`                                                        |
| Stripe TEST           | `LIVE_STRIPE_CHARGES_AUTHORIZED`, `ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET`, `ONE_TIME_STRIPE_TEST_ACCOUNT_REF`                                                                                                                                                            |
| Zoom                  | `ZOOM_CLASSROOM_ENABLED`, `ZOOM_CLASSROOM_PROVIDER_MODE`, `ZOOM_MEETING_SDK_KEY`, `ZOOM_MEETING_SDK_SECRET`, `ZOOM_ACCOUNT_ID`                                                                                                                                         |
| Vimeo                 | `VIMEO_ACCESS_TOKEN`, `VIMEO_ACCOUNT_ID`, `VIMEO_WEBHOOK_SECRET`                                                                                                                                                                                                       |
| Telegram              | `ONE_TIME_TELEGRAM_WEBHOOK_ENABLED`, `ONE_TIME_TELEGRAM_WEBHOOK_SECRET`, `ONE_TIME_TELEGRAM_BOT_KEY`, `ONE_TIME_TELEGRAM_ENVIRONMENT`                                                                                                                                  |
| OpenAI student helper | `OPENAI_API_KEY`, `ONE_TIME_HELPER_RUNTIME_ENABLED`                                                                                                                                                                                                                    |
| Buffer                | `BUFFER_ACCESS_TOKEN`, `BUFFER_ORGANIZATION_ID`, `BUFFER_DESTINATION_IDS`                                                                                                                                                                                              |

No W13-104 provider canary, external send, meeting creation, upload, social
draft publication, live charge, or BNA ticket creation was run.
