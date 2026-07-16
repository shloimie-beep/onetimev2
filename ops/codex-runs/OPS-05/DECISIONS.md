# OPS-05 Decisions

## Scope

- Kept the lane provider-neutral and feature-local: contracts, readiness projection, webhook conformance helpers, owner-only internal routes, tests, and ops artifacts.
- Did not mount live external provider webhooks beyond the narrow owner-only internal operations API. The final conductor owns shared runtime wiring and provider activation.
- Inspected PRs #42 through #48 by fetched PR heads and inventories only; none were merged wholesale into this branch.

## Resend Webhooks

- Replaced the unsafe custom Resend HMAC assumption with Svix/raw-body verification semantics.
- The verifier requires exact raw bytes, `svix-id`, `svix-timestamp`, and `svix-signature`, verifies HMAC-SHA256 over the documented signed payload shape, enforces a timestamp tolerance, and classifies replay, duplicate, digest mismatch, and out-of-order cases.
- The base branch still has no mounted Resend webhook endpoint. The endpoint registry records this explicitly so no operator points Resend at the site root.

## Provider Matrix

- Used provider-specific verification schemes instead of inventing one shared webhook signature format.
- Emitted required and configured variable names only, never values.
- Separated queue acceptance, provider acceptance, and delivered/published status in the matrix contract.
- Marked rollback/disable actions as local control-plane actions, not provider configuration mutations.

## Owner-Only Control Plane

- Added an internal owner-only GET endpoint for the provider matrix and endpoint registry.
- Added an internal owner-only POST endpoint that only plans a dry-run canary. It requires same-origin, CSRF, owner role, a recent email assurance timestamp, and an exact allowlisted target.
- The dry-run plan always returns `external_mutation_allowed: false` and `real_provider_send_allowed: false`.

## Email Readiness

- Added non-secret checks for verified sender/domain, SPF, DKIM, DMARC, return-path/bounce, reply-to/support mailbox, suppression/bounce/complaint readback, lifecycle encryption key, canary allowlist, and guarded provider flags.
- The matrix never claims inbox delivery from API acceptance.

## Deferred To Final Conductor

- Mounting the actual Resend raw-body route before JSON parsing.
- Connecting provider webhook handlers to durable queues/workers.
- Running bounded staging canaries after exact owner approval and protected staging configuration.
