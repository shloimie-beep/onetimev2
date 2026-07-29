# I36 Wave C Part 1 Atomic Claim

## Identity

- Branch: `codex/v21-integration`
- Exact existing target:
  `fca55e6c2fbea008e4fc2b8e7e5edeb47c454b6d`
- Authorizing control:
  `6be130a490df6654e9a840a0dcf112b095bc97de`
- Sole acquisition parent:
  `f9b0ea273c6d0b21ccc841f1f675dc2c45a95c31`
- READY I36 digest:
  `276719a894ddcedafbe28c85e98ede89f7e47d0e93601dc4478f6b45e93dd1c1`
- Claim: `eeb23846-ea26-4d4e-9a96-54678160a0d2`
- RELEASE_INTEGRATOR lease: `b726b1c2-f572-474b-bf16-b9ca2959b2f8`
- Lease window: `2026-07-29T14:53:08Z` through
  `2026-07-29T16:08:08Z`
- Phase scope: `P19_P27_P32_full_integration_atomic_claim_only`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed head, its sole parent, and the I36 state/handoff digests.

## Ordered queue

1. P19 merge `8bd435bd-d5d6-4e40-b142-7cdeee817637`, source
   `306c26cfcb84672eb5e593d1bee847a0f3e01243`, fixed base
   `e420eb833feee26efd431afd93457a7e0bc4d228`, payload
   `b7848cda8ffc3f29da777716f1c82a2941d6474480e4e14acfb3b66af37ce4a5`.
2. P27 merge `09ce44f1-2b87-4f9f-8812-cb61539e1736`, source
   `e1933d640657835cde17ee23381399f5539fe3cd`, fixed base
   `e706587bfe581f881fb072271b15b4123f9aabe6`, payload
   `ce5ef0bc0cbe673c9de46212c37f50958aab1f321c70f34455617d4620e670ab`.
3. P32 merge `ebaf848d-ad8d-4c56-8d16-9c02809af62d`, source
   `f4ae1c03c60917a23a825d46a4d0ec63ff4fc125`, fixed base
   `6a33944a75e717041b2f951134459769b8fc2617`, payload
   `60456d1fd7256dbd8d4d54029171d81573c01bf55e7d636df29bfe2bc84dbf5b`.

Each queued tail is exactly that task's `HANDOFF.md`, `NEXT-PROMPT.md`, and
`TASK-STATE.yaml`. All queue-declared merge-after heads are ancestors of the
exact target.

## Verification

The remote control and integration refs matched exactly. The canonical READY
entry and all three merge items recomputed to their sibling-map digests. All
200 locked blobs, all 15 source-package blobs, the package/task/context/
control-state bindings, and prior I36 state/handoff digest passed.

The exact P19, P27, and P32 branch refs were verified by `ls-remote` without
fetching source content. Their recorded bases are target ancestors; order,
merge-after prerequisites, exact triplet tails, claim, unexpired sole lease,
and 0/0/0 effects all passed.

This checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. No queued source was fetched, read, or merged. No steward
request was applied, and no product, provider, send, or external effect was
performed.

## Next action

C00 must reconcile the exact pushed atomic claim head and its sole parent. I36
must stop after reporting the claim and I36 state/handoff digests. Source
admission and ordered merges require a subsequent explicit resume.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
