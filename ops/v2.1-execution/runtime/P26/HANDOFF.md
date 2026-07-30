# P26 Ready-for-Review Handoff

## Identity

- Reconciled atomic claim:
  `abb053f65ef7bb238e163bb36f576980d8fa0d61`
- Reconciliation control / sole parent:
  `86c4e9a640dbcff2f2de1ef85eb42ee433f22ae8` /
  `f98ee8e79018e5875e9c2be3d5961954b3c5ce04`
- Authorized start: `d075dc1839660205845e7da039a182bbe44778d2`
- Implementation: `9096c2d63d0e68d7474984ae3b9cfad909253b03`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the
  observed pushed head.
- Claim: `1c659f83-31c3-4404-9488-c26ad4826922`
- Released BILLING_ACCESS lease:
  `1bcd6b13-bf89-4000-a653-35a8afdcb9c3`
- Lease release / expiry:
  `2026-07-29T05:36:54Z` / `2026-07-29T06:02:55Z`
- Task/context/source digests:
  `434c882a79d7931479310acc1d77a257213a704726ddf4b38db0cc3c1b31e5c2` /
  `8446bca73c9134afd103cb74cce8a94c3ce09aeaebda8a7b673c2587cb518cc6` /
  `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Exact 17-artifact digest:
  `a2208bbd9ca9bdc941432db73724407db85f90caca471d0ac102ce53b60db275`

## Completed behavior

P26 now provides a direct-import `1.0.0` billing-access contract and pure
projection for `free`, `active`, `grace`, and `inactive`. A newer unresolved
failure invalidates an older paid winner and starts one event-time-based
seven-day grace window. Replays and reordered older events do not extend
grace. A newer verified paid event restores active access; grace expiry and
explicit inactive truth project inactive idempotently.

Inactive authorization is household-scoped and fails closed before protected
rendering. Only the exact Parent overview, household switcher, billing,
reactivation, support list/detail, account, privacy, and data-rights
capabilities remain. All Student routes receive the exact locked inactive
copy. Cross-household and upstream-role denials never permit provider
bootstrap.

The server verifies bounded Stripe-style HMAC receipts with timestamp
tolerance, keeps only minimized event/idempotency data, rejects event-ID
conflicts, and stores no raw payload or parallel financial ledger. The
PostgreSQL repository uses an advisory household transaction lock, row
locking, projection version fencing, and a migration-only schema contract.
The worker accepts only mutation-prohibited Stripe readback bindings and
fails closed on household/customer mismatch.

## Verification

- Full repository TypeScript typecheck: passed.
- Focused ESLint over every P26 TypeScript artifact: passed.
- Focused Vitest: 4 files, 11 tests, all passed.
- Positive, negative, signature, stale-signature, replay, ordering,
  concurrency, grace-expiry, recovery, inactive authorization, exact Student
  copy, household isolation, and read-only reconciliation branches passed.
- Focused Prettier and `git diff --check`: passed.
- Exact SHA-256 recomputation from the 17 committed Git blobs produced
  `a2208bbd9ca9bdc941432db73724407db85f90caca471d0ac102ce53b60db275`.

## Scope and remaining integration

The implementation commit adds exactly 17 files beneath the five P26-owned
roots. This handoff commit updates only the three P26 runtime files. No
migration, package manifest, lockfile, central registry/composer, provider
configuration, steward application, or another task runtime changed.

All nine requirements and ten acceptance cases are implementation-ready.
Candidate-bound sandbox/canary evidence is not claimed because no external
authority or effect was used. C00 must reconcile the exact pushed
ready-for-review head. Migration and central registration, if activated, stay
with their designated stewards.

## External effects and security

Authority none; attempted/succeeded/reconciled `0/0/0`. No Stripe or other
provider call, mutation, charge, payload access, live send, deployment, secret,
customer data, raw financial object, or external effect occurred.

## Exact next action

C00 reconciles the exact pushed `ready_for_review` head. Reopen P26 only under
a new exact lease for reproduced P26-scoped review feedback.
