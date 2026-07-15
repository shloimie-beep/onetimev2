# OT-85 Provider State

- Meta webhook adapter exists for raw-byte signature verification and inbound event normalization.
- Meta outbound send is intentionally not configured in code for OT-85.
- Sink adapter is used for local and test dispatch.
- `ONE_TIME_WHATSAPP_PROVIDER_ENV`: local default `UNKNOWN`.
- `ONE_TIME_WHATSAPP_STAGING_ISOLATED`: local default `false`.
- `ONETIME_WHATSAPP_CANARY_AUTHORIZED`: local default `false`.
- `ONETIME_CANARY_WHATSAPP_RECIPIENT_E164`: not configured in this session.
- No external WhatsApp, Telegram, email, billing, DNS, CRM-provider, portal-provider, or payment mutation was performed.
