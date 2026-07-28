# F05 Handoff

## Identity

- Branch: `codex/v21-f05-api-jobs-foundation`
- Start SHA: `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`
- Implementation SHA before this handoff metadata commit: `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `807393d09cb614e05625677818976930cf4a14e07e65bb488f647cdcd3b63ec3`
- Context digest: `95728a601338101ba550f5b63edfa9cd96bd2e96c1011cf214462f98bfa40f6a`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Completed behavior

The exact first-run authorization is validated. The canonical F05 ready payload,
control parent, task/context/package/source locks, F02 interface integration,
branch absence, claim, writer-slot lease, and expiry all match. Locked checksum
verification passed 200/200 plus 15/15 source files.

## Remaining work

Implement the F05-owned typed API/job contracts, durable job domain and runner
interfaces, PostgreSQL transactional outbox repository, interface checkpoint,
structured steward requests, and focused verification.

## Exact next action

Implement the typed command/query/error and job lifecycle contracts, followed by
the pure transition guards required for idempotency, fencing, bounded retry,
acceptance-unknown quarantine, governed recovery, and compensation.

## Coverage

- Requirements: OTV2-API-217, OTV2-JOBS-210, and OTV2-JOBS-211 in progress
- Acceptance cases: all three assigned cases planned

## Changed files and migrations

Only F05 runtime claim metadata is present. No migration or product source has
been changed.

## Verification

- Canonical ready payload digest: passed
- Locked execution manifest: 200/200 passed
- Source manifest: 15/15 passed
- F02 interface checkpoint ancestry and digest: passed

## External effects

Authority is `none`; attempted 0, succeeded 0, reconciled 0.

## Security, privacy, and data handling

No secret, bearer, private payload, child data, provider mutation, live send, or
deployment was accessed or attempted.

## Blockers, deviations, and recovery

No blocker. The remote branch created by the next atomic push is the durable
claim checkpoint.
