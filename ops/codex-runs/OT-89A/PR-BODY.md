# OT89A: add One Time subscriber support producer

## Summary

Draft pending implementation.

## Architecture

Pending discovery and implementation.

## Security Model

- Subscriber-only support entry and API.
- Repeated server-side authentication, account, entitlement, CSRF, and rate-limit checks.
- Immutable signed event delivery to BNA through the frozen OT89 contract.
- No synchronous BNA dependency in subscriber request paths.
- Private attachments only, no public URLs or bearer locators.

## Migrations

Pending.

## Tests

Pending.

## Rollout

Deployment state: `NOT_DEPLOYED`.

## Risks And Exclusions

- No BNA repo edits.
- No production deploy or production configuration mutation.
- No provider send, payment, DNS, account grant, or real-user mutation.

## Acceptance

Pending.
