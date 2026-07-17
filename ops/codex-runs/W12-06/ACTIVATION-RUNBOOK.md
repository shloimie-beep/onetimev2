# W12-06 Activation Runbook

This branch is safe with protected staging config absent. Runtime defaults keep provider actions off unless explicit protected config and operator authorization are supplied.

## Protected Config

Set these only in the protected staging environment, not in code or evidence:

- `ONE_TIME_WHATSAPP_PROVIDER_ACCOUNT_KEY`
- `ONE_TIME_WHATSAPP_PROVIDER_ENV=STAGING`
- `ONE_TIME_WHATSAPP_STAGING_ISOLATED=true`
- `ONE_TIME_WHATSAPP_WEBHOOK_SECRET`
- `ONE_TIME_WHATSAPP_VERIFY_TOKEN`
- `ONE_TIME_PUBLIC_WHATSAPP_DEEP_LINK`
- `ONE_TIME_PUBLIC_WHATSAPP_PREFILL_TEXT` if overriding the default prefill
- `ONE_TIME_WHATSAPP_ASSISTANT_COPY_VERSION` if pinning a copy version
- `WHATSAPP_ASSISTANT_RATE_LIMIT_WINDOW_MS`
- `WHATSAPP_ASSISTANT_SENDER_RATE_LIMIT_MAX`
- `WHATSAPP_ASSISTANT_ACCOUNT_RATE_LIMIT_MAX`
- `ONETIME_CANARY_WHATSAPP_RECIPIENT_E164`
- `ONETIME_WHATSAPP_CANARY_AUTHORIZED=false` until an exact canary send is approved
- `ENABLE_REAL_WHATSAPP_TRANSPORT=false` until staging canary readiness is proven

## Safe Activation Sequence

1. Deploy code to an isolated staging environment with real WhatsApp transport still disabled.
2. Confirm `GET /api/v1/whatsapp/public-assistant` returns `success: true`, safe copy, a configured deep link, and no raw canary recipient.
3. Register or update the Meta webhook only after staging URL, verify token, and webhook secret are protected-configured.
4. Verify Meta challenge against `GET /api/v1/whatsapp/meta/webhook`.
5. Post a signed fixture payload to the staging webhook and confirm encrypted inbox/outbox rows, replay dedupe, STOP/START, private-data denial, abuse suppression, and rate-limit behavior.
6. Run the canary readiness command with protected staging config present. Do not print the recipient value in logs or evidence.
7. After explicit operator approval for a single canary recipient, set `ONETIME_WHATSAPP_CANARY_AUTHORIZED=true` and enable real WhatsApp transport only for isolated staging.
8. Send exactly one canary message through the existing canary path. Review provider receipt, redacted audit, and no-broad-send proof.
9. Keep production transport disabled until a separate production launch approval exists.

## Not Performed In This Run

- No broad send.
- No real provider registration.
- No canary send.
- No deployment.
- No production contact import.
- No personal phone number committed or printed in evidence.
