# W13-10 Delivery Platform Contract

The default transport remains sink/provider-off. Provider invocation requires runtime environment, provider mode, provider identifier, isolated-staging proof for staging canaries, provider authorization, allowlisted destination/reference, per-run and per-provider budget, idempotency key, consent/suppression eligibility, timeout/lease safety, and redacted audit context.

Implemented code:

- packages/domain/src/delivery/activation-policy.ts
- apps/worker/src/delivery/provider-config.ts
- apps/worker/src/delivery/provider-router.ts
- packages/domain/src/delivery/retry.ts

The active worker still claims sink rows only. Lifecycle/auth email remain functional on their existing guarded paths; W13-90 must consume this activation policy before any provider merge.
