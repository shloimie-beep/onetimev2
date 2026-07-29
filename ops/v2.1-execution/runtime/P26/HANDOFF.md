# P26 Atomic Claim Handoff

## Identity

- Branch: `codex/v21-p26-billing-access`
- Start SHA: `d075dc1839660205845e7da039a182bbe44778d2`
- Implementation SHA before this handoff metadata commit:
  `d075dc1839660205845e7da039a182bbe44778d2`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the
  observed pushed head.
- Task packet digest:
  `434c882a79d7931479310acc1d77a257213a704726ddf4b38db0cc3c1b31e5c2`
- Context digest:
  `8446bca73c9134afd103cb74cce8a94c3ce09aeaebda8a7b673c2587cb518cc6`
- Source package digest:
  `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `1c659f83-31c3-4404-9488-c26ad4826922`
- Writer: `codex-p26-worker-1c659f83`
- Containing control authorization:
  `2b29ce6ce75de10765f6f6c64d059e858c548281`
- Ready-entry parent control:
  `9e04eda2275f3b6a92066670d878a3e1c62361ca`
- Ready-entry digest:
  `ec58cc73ed98e8137cc652ad838f2300f0e498db536d21c39ad7837d82ca2ddb`
- BILLING_ACCESS lease:
  `1bcd6b13-bf89-4000-a653-35a8afdcb9c3`
- Lease issue / expiry:
  `2026-07-29T05:02:55Z` / `2026-07-29T06:02:55Z`

## Completed behavior

Verified the exact containing control authorization and acquisition parent,
authorized integration start, absent branch, canonical ready-entry digest,
package/task/context/source digests, F03/F04/F05/F06 dependency bindings and
ancestry, sole writer lease, and zero effect locks. The F04 binding uses exact
integrated implementation `81c0ee64072386db41aa5a40243c693762ab493a`.
All 200 locked and 15 source-package Git blobs matched. Created the isolated
P26 branch from the exact start. This atomic checkpoint contains only the
three P26 runtime files; product, source, provider, steward, and effect work
has not started.

## Remaining work

After C00 reconciliation and explicit continuation authorization, implement
the minimum signed billing-event projection, verified access winners,
seven-day grace, recovery ordering, inactive route authorization, and
household-scoped access inside P26-owned paths.

## Exact next action

Stop after the normal push and exact remote verification. Resume product work
only after C00 records this atomic claim head and explicitly authorizes
continuation.

## Coverage

- Requirements: nine assigned and claimed; implementation not started.
- Acceptance cases: ten assigned; none run.

## Changed files and migrations

- `ops/v2.1-execution/runtime/P26/HANDOFF.md`
- `ops/v2.1-execution/runtime/P26/NEXT-PROMPT.md`
- `ops/v2.1-execution/runtime/P26/TASK-STATE.yaml`
- Migrations: none
- Steward requests: none

## Verification

- Exact remote repository/control/acquisition/start/branch identity: passed.
- Canonical ready-entry digest: passed.
- All locked/source/package/task/context digests: passed.
- F03/F04/F05/F06 dependency ancestry and exact bindings: passed.
- Claim, BILLING_ACCESS lease, and zero effect locks: passed.

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0.

## Security, privacy, and data handling

No secrets, provider payloads, customer data, live sends, provider mutation,
deletion, deployment, or other external effect was accessed or performed.

## Blockers, deviations, and recovery

None. Recovery base is exact integration head
`d075dc1839660205845e7da039a182bbe44778d2`.
