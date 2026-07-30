# I36 P16/P32/F02 Compatibility Integration Atomic Claim

## Identity

- Branch: `codex/v21-integration`
- Exact existing target:
  `1798f31b5f698c80ee2babbd6414e9934745a178`
- Containing authorizing control:
  `061edb43af223773874a36c0ca1b4f48165ab6e3`
- Sole acquisition parent:
  `15cddddabd145da14b99e29b251f50a39c0a90c9`
- READY I36 digest:
  `ac622e744953504c52a7250aadcf75ba4b2b73126c42c4a0c6e2463a470500c9`
- Claim: `d2ba6c12-e7c2-49b1-b4cd-883a1c394adb`
- RELEASE_INTEGRATOR lease: `6c88e2a7-e2fc-48be-acae-4b4a5e9839ad`
- Lease window: `2026-07-30T01:54:35Z` through
  `2026-07-30T03:54:35Z`
- Phase scope: `P16_P32_F02_compatibility_integration_atomic_claim_only`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed head, its sole parent, and the I36 triplet digests.

## Ordered queue

1. P16 merge `d9416368-7897-4bf1-8619-619d4af6ba47`, source
   `55544f557f5b7aee01d264fba688fc56b971ad4b`, base
   `72fca16b3a9cd82c666e293f8bfd7d84c30722a1`, five paths, payload
   `ed66b040353720ec945dc5595afd26ee70a6a1a866fc487683765c542415f324`.
2. P32 merge `33382081-0f72-4904-a2a7-cda6cb519eb1`, source
   `92a7ee6377d9507140def1159a440fbfd1733123`, base
   `f4ae1c03c60917a23a825d46a4d0ec63ff4fc125`, thirteen paths, payload
   `3f4bbb741cb52ae8a437a6e8400e7670c08700e7dd71af0149f6482f78794d2e`.
3. F02 merge `92977f14-9d4c-42f5-b574-208e7f67885b`, source
   `cd2d7c2fe3bfeb250c320bc02c9bfebb3bd04911`, base
   `e156003b243221f97f938a0aca16164c1dd86d2d`, ten paths, payload
   `f1a0838c6a6a51dc2e6f3562516e5fe456b1fd13fdc0a864d571deca67b902a1`.

All three optimistic merge targets remain
`1798f31b5f698c80ee2babbd6414e9934745a178` until C00 reconciles this claim
and rebinds them.

## Verification

The final corrected remote control, acquisition parent, integration ref, claim,
lease, and zero effect locks matched exactly. The canonical READY entry and
all three ordered merge items recomputed to their sibling-map digests.

Exact source refs, source/base ancestry, 5/13/10-path inventories, raw Git-byte
manifests, task/context values, state/handoff and runtime-triplet digests,
interface/artifact/proposal bindings, migration checksum pairs, merge-after
dependencies, canonical payloads, and hex shapes passed.

This checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. No source was merged. No product, SQL, steward, control,
provider, deployment, send, or external-effect state changed.

## Next action

C00 must reconcile the exact pushed atomic claim head and sole parent, consume
the READY entry, and rebind all three optimistic merge targets. I36 must stop
after reporting the claim and I36 triplet digests.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
