# OT-87 Phase Ledger - Policy And Config

Status: locally verified; waiting for protected Stripe TEST resources.

- Commercial policy copied to `ops/commercial/ot87/family-plan.v1.json`.
- Strict policy loader/schema added in `packages/domain/src/billing/commercial-policy.ts`.
- OT-87 TEST-only config parser rejects live-like keys and requires `LIVE_STRIPE_CHARGES_AUTHORIZED=NO` before transport surfaces.
- Read-only validation command reports protected resources absent without storing values.
