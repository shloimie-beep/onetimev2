# P25 Ready-for-Review Handoff

## Identity

- Branch: `codex/v21-p25-billing-commercial`
- Authorized start:
  `d075dc1839660205845e7da039a182bbe44778d2`
- Atomic claim:
  `3b322e3bf9f6206ea24e1cbea3451445f7e9ae1d`
- Implementation:
  `48994c58310f716aa847c544c161bffd0b306954`
- Final metadata commit: derive with `git rev-parse HEAD`; C00 records the
  observed remote head.
- Original controller:
  `2b29ce6ce75de10765f6f6c64d059e858c548281`
- Reconciled resume control:
  `86c4e9a640dbcff2f2de1ef85eb42ee433f22ae8`
- Reconciled control parent:
  `f98ee8e79018e5875e9c2be3d5961954b3c5ce04`
- Claim: `a4dcccb9-2058-44df-a72d-4b3e6f51bdd9`
- BILLING_COMMERCIAL lease:
  `bf5b157c-d452-44a8-991f-bea035e1fd82`
- Lease expiry: `2026-07-29T06:02:55Z`
- Lease released: `2026-07-29T05:37:19Z`
- Ready-entry digest:
  `30aec96a3b09178b89f322ba285b6216c2851039f9eab971edad7e248ce4fb87`

## Completed behavior

P25 implements the exact Family commercial contract: One Time Live + Library
at $67 USD monthly per independently billed household, with a hard maximum of
three active Students. The configured free-period source is
`family_free_period_v2_1`; it ends at
`2026-09-13T19:24:00+03:00` in `Asia/Jerusalem`.

Free signup creates only local `free` or `inactive` access state and never
collects a card or creates a provider intent. Standard pre-expiry Checkout
creates one idempotent HighLevel-hosted intent, schedules the first $67 charge
for the exact free-period end, keeps access `free`, and records that One Time
must not mutate Stripe. The immediate-charge exception requires a separate,
affirmative, versioned consent bound to actor, household, amount, currency,
displayed charge time, and acceptance time.

Parent billing actions require the exact server-resolved F04 household owner
context. Different-key duplicate Checkout and cross-household actions fail
closed. The hosted portal becomes available only after verified subscription
state. Cancellation creates a request state while preserving active paid
access until matching signed provider evidence confirms period-end
cancellation. Refunds are bounded manual exceptions available only from an
active Admin context and never delete learning data.

F05 transactional command persistence supplies canonical request hashing,
atomic outbox insertion, replay, and mismatch rejection. Every provider intent
targets `highlevel`, identifies Stripe only as financial truth, and carries
`providerMutationByOneTime: false`. Matching signed evidence is the only path
that changes verified paid access.

The Parent workspace presents the configured countdown, exact plan and seat
truth, approved GHL/Stripe-hosted surfaces, an unchecked separate consent
boundary, and no card fields.

## Exact dependencies

F04 remains bound to implementation
`81c0ee64072386db41aa5a40243c693762ab493a`, not the later non-ancestor
registry head. F05 is `1ade14c52e42e59bb8fd1d1de776b91406c45f15`,
F06 is `94281de13063203808ecabef8a818762e5ff1e2e`, and F07 is
`a90baae8cf69d6823af6d741161fe0e9e7441321`. Their exact task,
integration, source, checkpoint, packet, and context bindings remain in
`TASK-STATE.yaml`.

## Artifacts and verification

The 12 immutable implementation Git blobs have canonical ordinal manifest
digest:

`c20cf0c626e48deac01e004941babb365eb2c9347aced41a6264fefda9baed91`

The preimage is 1,444 UTF-8 bytes of ordinally sorted
`path=Git-blob-SHA-256` lines joined with LF and no final newline. Exact
per-artifact hashes are recorded in `TASK-STATE.yaml`.

- Focused Vitest: 3 files, 13 tests, all passed.
- Workspace TypeScript typecheck: passed.
- Focused ESLint and Prettier: passed.
- Exact 15-path scope and diff hygiene: passed.
- Repository secret scan: passed across 2,774 text files.

## Scope, effects, and next action

The branch changes only 12 files inside the five P25 owned globs plus the
three P25 runtime-memory files. No migration, provider mutation, steward
application, route or composer registration, canonical registry change, live
Stripe action, or external effect occurred.

External authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

I36 should independently reproduce the artifact digest, rerun the focused
invariants, and integrate exact implementation
`48994c58310f716aa847c544c161bffd0b306954`. C00 should record the exact final
remote head. Do not resume P25 without new exact authority.
