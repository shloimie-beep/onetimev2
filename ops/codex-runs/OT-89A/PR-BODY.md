# OT89A: add One Time subscriber support producer

## Summary

- Implements the OT-89A One Time subscriber-support producer against the frozen immutable v1 support event contract.
- Adds subscriber-only support UI/API, durable local receipt/audit/attachment/outbox/status storage, async delivery, HMAC signing, retry/dead-letter/requeue, and deterministic mock BNA endpoints.
- Keeps real BNA delivery disabled/fail-closed; OT-89B is not required for this branch.

## Architecture

- `/app/support` is private/no-store/noindex and renders an accessible support form only for authenticated users with active One Time entitlement.
- Anonymous and non-subscriber users see only the public `/signup` WhatsApp lead path; submission rechecks active entitlement server-side inside the transaction.
- Submission creates local receipt, audit rows, private attachment blob rows, support outbox row, and cached status projection before returning 202.
- Worker delivery signs stored raw event bytes and sends asynchronously to the deterministic mock BNA endpoint only when `OT89_SUPPORT_DELIVERY_MODE=mock`.
- Mock BNA event/status and reverse-HMAC attachment endpoints implement the frozen contract without loading or depending on BNA UI/runtime.

## Security Model

- Subscriber-only support entry and API.
- Repeated server-side authentication, account, entitlement, CSRF, and rate-limit checks.
- Immutable signed event delivery to BNA through the frozen OT89 contract.
- No synchronous BNA dependency in subscriber request paths.
- Private attachments only, no public URLs or bearer locators.
- Private routes use `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`, and attachment responses force `Content-Disposition: attachment` plus `nosniff`.

## Migrations

- Added `packages/db/migrations/2100_ot89a_subscriber_support_producer.sql`.
- Clean pg-mem apply result: pass; last migration `2100_ot89a_subscriber_support_producer`.
- Migration SHA-256: `b928f174ff622b380e7ba609d16db90f28a53e304bd6789e013f6024e05960f0`.
- Existing migrations were not edited.

## Tests

- `npm run secret:scan`: pass.
- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass.
- `npm run brand:check`: pass after build.
- `npm run test`: pass; 19 files, 94 tests.
- `CI=1 npm run e2e`: pass; 22 tests.
- `CI=1 npm run accessibility`: pass; 6 tests.
- `CI=1 npm run performance`: pass; 6 tests plus bundle check.
- Targeted Prettier check on OT-89A-touched source/test files: pass.
- Local Windows `npm run format` still reports 377 pre-existing checkout files; OT-89A-touched files were formatted. Remote PR CI remains authoritative for repo-wide format.

## Rollout

Deployment state: `NOT_DEPLOYED`.

## Risks And Exclusions

- No BNA repo edits.
- No production deploy or production configuration mutation.
- No provider send, payment, DNS, account grant, or real-user mutation.
- Real BNA delivery remains disabled/fail-closed outside mock mode.

## Acceptance

- Covered in `ops/codex-runs/OT-89A/ACCEPTANCE-MATRIX.md` and `TEST-RESULTS.md`.
- Status before push: `IMPLEMENTED_LOCAL_GREEN_PENDING_PUSH_CI`.
