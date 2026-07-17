# OT-105 Decisions

- Use the existing provider webhook route only: `/api/v1/billing/webhooks/provider`.
- Keep all canary behavior TEST/SANDBOX only and fail closed on any live-like key, live-mode resource, or missing explicit authorization.
- Treat valid but unknown webhook events as 2xx no-ops, while invalid signatures and stale signatures fail before durable receipt/projection.
- Use commercial policy as the source of truth for the allowed product, price, currency, monthly amount, provider scope, and required event set.
- Use canonical provider readback when subscription event order/freshness is ambiguous instead of trusting an older event payload.
- Do not add a database migration because existing billing receipt/projection storage supports the required evidence and dispositions.
- Publish operator instructions in a repo runbook and keep protected secret values out of run evidence.
