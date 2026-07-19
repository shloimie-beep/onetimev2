# Delivery Transport Integration Contract

This contract applies to lifecycle email, transactional email, WhatsApp,
Telegram, and future delivery channels before any provider adapter can send or
mutate an external resource.

## Default Mode

- `sink` is the default transport in every environment.
- Provider mode is not inferred from `NODE_ENV`.
- Provider mode requires the explicit delivery environment classification:
  `local`, `test`, `isolated_staging`, or `production`.
- Production provider mode is disabled until a later reviewed release changes
  the contract and implementation.

## Required Provider Gates

Provider dispatch must require all of these gates before adapter invocation:

1. Explicit provider transport mode.
2. Exact environment gate matching the classified delivery environment.
3. Staging isolation proof.
4. Per-provider authorization flag.
5. Exact destination or resource allowlist match.
6. Positive bounded canary budget.
7. Stable idempotency key equal to the delivery key.
8. Timeout plus safety margin less than the claim lease.
9. Suppression and channel consent evaluated before request construction.

Failure of any gate must stop before provider adapter invocation. A provider
failure must become a retry or typed terminal failure; it must not fall back to
silent sink success.

## Channel Requirements

- Lifecycle email must enqueue locally first, encrypt any token-bearing payload,
  and use the shared provider gate stack before any Resend canary.
- WhatsApp must require recorded channel consent, active suppression state, E.164
  destination normalization, Meta/WAPI provider authorization, and an allowlisted
  canary destination.
- Telegram must use its own bot credentials and webhook/polling single-consumer
  guard, then enter this transport contract before any outbound operator message
  or user reply.
- Future channels must add typed request and failure results before routing.
  Unsupported channels fail closed and do not reach adapters.

## Evidence And Readiness

Readiness outputs may include counts, statuses, environment names, safe
fingerprints, and budget numbers. They must not include secrets, raw provider
IDs, raw destinations, private URLs, message bodies, tokens, database URLs, or
student-sensitive data.
