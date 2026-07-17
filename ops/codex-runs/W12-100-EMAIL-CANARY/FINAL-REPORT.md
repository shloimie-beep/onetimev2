# W12-100 Bounded Resend Email Lifecycle Canary Report

Generated: 2026-07-17T20:44:27.7605545+03:00

Status: `blocked_before_provider_invocation`

## Summary

The bounded Resend/email lifecycle canary was not run. The exact staging SHA
gate failed before any lifecycle or provider operation:

- Expected W12-100 candidate SHA:
  `ac02ce9cd4f690d3b305b30ec1eef4e18d48cd5c`
- Observed staging `/version`:
  `ops11-1197673`
- Observed staging SHA:
  `1197673fa409bfc4c649c2683f782e86775caa5e`

The local shell also did not contain protected canary destination, Resend
credential, or canary authorization environment variables. No destination,
token, activation/reset URL, API key, or webhook body was read, printed, or
committed.

## Not Executed

- Activation email provider acceptance
- Activation consumption and replay rejection
- Password-reset provider acceptance
- Reset completion, session revocation, and token replay rejection
- Different-destination rejection before provider invocation
- Third-message budget exhaustion
- Webhook readback
- Canary authorization disablement

## Safety

- Provider invocations: 0
- Provider mutations: 0
- Lifecycle mutations: 0
- Campaign or broad sends: 0
- Production mutations: 0
- Destinations printed: no
- Tokens or URLs printed: no
- API keys printed: no
- Raw webhooks printed: no

## Next Action

Deploy the exact W12-100 candidate SHA to isolated staging, verify staging
isolation and provider transport gates, provide the protected operator-owned
destination and Resend credential through the approved secret channel, then
rerun the bounded canary.
