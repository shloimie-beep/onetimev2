# W13-104 Email Inputs Needed

Status: `blocked_pending_private_inputs`

Required private manifest:

- `C:\Users\User\.onetime-w13-104-private\EMAIL-INPUTS.private.json`

Required protected Railway/config names before an inbox-delivery canary may run:

- `ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED`
- `ONE_TIME_RESEND_TRANSPORT_ENABLED`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `ONE_TIME_EMAIL_FROM`
- `ONE_TIME_EMAIL_REPLY_TO`
- `ONE_TIME_DELIVERY_TEST_CANARY_EMAIL`

Currently known missing names from the last sanitized provider-readiness
snapshot:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `ONE_TIME_EMAIL_FROM`
- `ONE_TIME_EMAIL_REPLY_TO`

No email canary was sent in W13-104. Broad campaigns remain disabled, passwords
were not emailed, and no provider secret value is stored in this repo.
