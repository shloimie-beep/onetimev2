# I36 P18 Correction Micro-Integration Atomic Claim

## Identity

- Branch: `codex/v21-integration`
- Exact existing target:
  `f947c01f6047f129b18dcf7a13e992eef10a9fe3`
- Authorizing control:
  `3d11ce7b7a892e36602f107f439276795ec47b41`
- Sole acquisition parent:
  `7359ed26bd1990b4c4cd3a0d9d864e51694f5c49`
- READY I36 digest:
  `a4f8bb88b14a039a87c8f71365639b084b677bce82174bd03e80c7f27f5269c8`
- Claim: `31d2abc1-bdee-4297-b5d7-b89719cd9dc6`
- RELEASE_INTEGRATOR lease: `b39bd286-c061-45cf-bcbe-cb38eb9b4032`
- Lease window: `2026-07-29T17:06:49Z` through
  `2026-07-29T18:21:49Z`
- Phase scope: `P18_collision_correction_micro_integration_atomic_claim_only`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed head, its sole parent, and the I36 triplet digests.

## Queue

P18 correction merge `2f2547a1-3526-4aa7-a902-8382f36038d5`, source
`b9ad947405de53c138561fd47b9d5c65a25f6b8b`, fixed source-delta and merge
base `0a384577dec2ea58cbeaf22a247f7c05f6333c27`, seven unique declared paths,
and payload
`636a9bf0ed1db29127cc785c21e1cf7bc2421db73d8764a747b4bd6c04cf4352`.
Both the fixed base and Wave D release prerequisite are ancestors of the exact
target.

## Verification

The remote control and integration refs matched exactly. The canonical READY
entry and P18 merge item recomputed to their sibling-map digests. The
raw-Git-blob execution-package validator passed with 200 locked files, all 46
tasks/contexts/prompts, 16 source-spec files, 243 requirements, 265 cases, 107
decisions, and 35 implementation tasks. Package, source-package, task,
context, control-state, and prior I36 state/handoff bindings passed.

The exact P18 branch ref was verified by `ls-remote` without fetching or
reading source content. The fixed base, seven-path declaration, merge-after
prerequisites, claim, unexpired sole lease, zero effect locks, and 0/0/0
effects passed.

This checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. No P18 source was fetched, read, or merged. The P18
migration request remains unapplied. No provider inspection, send, deployment,
or external effect was performed.

## Next action

C00 must reconcile the exact pushed atomic claim head and its sole parent. I36
must stop after reporting the claim and I36 triplet digests. P18 source
admission and merge require a subsequent explicit resume.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
