# OT-105 Resume

1. Pull the draft PR branch `codex/ot105-stripe-test-billing-canary`.
2. Review `STRIPE-TEST-OPERATOR-RUNBOOK.md` and confirm the staging webhook endpoint is exactly `https://ot99-web-staging.up.railway.app/api/v1/billing/webhooks/provider`.
3. Configure only Stripe TEST/SANDBOX credentials and resource IDs in the protected environment.
4. Run a read-only readiness check:

   ```bash
   npm run stripe:test:canary -- --output ops/codex-runs/OT-105/canary/readiness.json
   ```

5. When explicitly authorized for sandbox mutations, run:

   ```bash
   OT105_STRIPE_TEST_CANARY_AUTHORIZED=true npm run stripe:test:canary -- --apply --output ops/codex-runs/OT-105/canary/apply.json
   ```

6. Complete a sandbox checkout and confirm webhook delivery to the corrected route before marking the external canary complete.
