# I36 Wave C Part 2 Atomic Claim

## Identity

- Branch: `codex/v21-integration`
- Exact existing target:
  `9f4c70189a742d54c5822e4a91f4895a4002334c`
- Authorizing control:
  `e70c5c1d3d9b96f7a2a1c0635fed22494e4dfab6`
- Sole acquisition parent:
  `a6f90c2fbe0412fd7c32e1455843b7b832a267ab`
- READY I36 digest:
  `5be9619627c178bf4fd685c2378889abaeec53e4cbba715cdfd4b1b80936410b`
- Claim: `9059c2e9-a57d-412f-ac96-8d921365a3fb`
- RELEASE_INTEGRATOR lease: `7015ba41-a825-4a18-9b0b-0a026682730d`
- Lease window: `2026-07-29T15:14:08Z` through
  `2026-07-29T16:29:08Z`
- Phase scope: `P17_P21_P24_full_integration_atomic_claim_only`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed head, its sole parent, and the I36 state/handoff digests.

## Ordered queue

1. P17 merge `524f5ca9-6503-4b6c-b2ee-63f8755b5543`, source
   `78af71603713b6fc73fe755995bdf56193eb199a`, fixed base
   `49431959f58f284bdc13ca931acf09f980fc483a`, 18 paths, payload
   `245bef77c9d24435b7bf1db2c1eecc1a3142d580e77bdd3cbca1d0df3bf204df`.
2. P21 merge `387d09ef-6bef-4d60-885f-b18a794d96f3`, source
   `cecdad0989e861254987970cfa3d222319369f52`, fixed base
   `088b40476bd5ceeb0af901b6f78a4cb8c556671b`, 21 paths, payload
   `71dfa51630fef99a01d3404e6ab00c3508bbebb1e6cace4bbf69955eb2ff79af`.
3. Corrected P24 merge `30db2187-a2f2-4ef2-991f-c72283e8b878`,
   source `501c7a8b32864e4218a5325b8a755bb0a37a8ce6`, fixed base
   `408b21afa4b9ac6f100b3ce33ea87984d18d4bf7`, 20 paths, payload
   `b48855594a53addc04b6211c182b159fef2a8ddc6d9d2702526649e04d8cba27`.

All queue-declared merge-after heads and recorded bases are ancestors of the
exact target.

## Verification

The remote control and integration refs matched exactly. The canonical READY
entry and all three merge items recomputed to their sibling-map digests. All
200 locked blobs, all 15 source-package blobs, package/task/context/
control-state bindings, and the prior I36 state/handoff digest passed.

The exact P17, P21, and corrected P24 branch refs were verified by `ls-remote`
without fetching source content. Their 18/21/20-path declarations, bases,
merge-after prerequisites, order, claim, unexpired sole lease, and 0/0/0
effects passed.

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
