# I36 P35 Full-Integration Atomic Claim

## Identity

- Branch: `codex/v21-integration`
- Exact existing target:
  `255d35b2fb5e7db20d166bcf2b7c1a7eeba8f33d`
- Corrected authorizing control:
  `de5796105ee1636aa9ad007ef09fde6b96307466`
- Queue-correction acquisition parent:
  `944f7f4a192ac7b7522a9bcc19500870fa60e5d6`
- Original READY-containing authorization:
  `4e16b37f8f047388e8634874a51163c8128054b2`
- Original READY acquisition/state basis:
  `1813faba23ac5df2f6f6d7bbb03e35bfc20cd4f1`
- READY I36 digest:
  `70c2781a19242cd1b6bcc0452dd755c3b1964dd9b68b4694d5fa5a606d8ee4d9`
- Claim: `5f6577ac-9fcd-4558-8d8a-1318b5b002b5`
- RELEASE_INTEGRATOR lease: `11eac672-8eda-4188-baed-82e0a2a9ef8b`
- Lease window: `2026-07-29T14:23:14Z` through
  `2026-07-29T15:38:14Z`
- Phase scope: `P35_full_integration_atomic_claim_only`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed remote head, its sole parent, and the I36 state/handoff digests.

## Queued item

- Merge ID: `6754c434-bf7a-44ad-97e2-ea367ff38e1d`
- Payload digest:
  `6c0c90143d90e79835a4e7c9b7464a3678084fb87d8a41e122c335ca32e12dd5`
- Source: `a85aecc22b013d583589a67cf0cc9dfad6745aba`
- Fixed source/merge base:
  `eefca0644e57dca48609682cbc3e1b01992d286d`
- Required prior full head:
  F01 `b5344992a43a735a9c66047fecd83f951651de27`
- Exact allowed tail: 20 control-declared paths
- P35 recorded tail inventory digest:
  `7fa14f2f40c0949ab2fdbfb24ee1383bb1cb23c1d46669770825c308b09d8107`
- P35 recorded state/handoff digest:
  `e524a2756fecb4ab6816e972211d858a729872f349459b0863754f3a72d01475`

## Verification

The remote control and integration refs matched exactly. The canonical READY
entry and corrected merge item recomputed to their sibling-map digests. All 200
locked blobs, all 15 source-package blobs, and the package, task, context,
control-state, and prior I36 state/handoff digests passed.

The P35 branch ref was verified by `ls-remote` without fetching source content.
The fixed base and F01 full head are ancestors of the exact integration target.
The corrected item binds the exact source, base, 20 paths, target, prerequisite,
claim, unexpired sole lease, and 0/0/0 effects.

This checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. P35 source was not fetched, read, or merged. No P35 steward
request was applied, and no product, provider, send, or external effect was
performed.

## Next action

C00 must reconcile the exact pushed atomic claim head and its sole parent. I36
must stop after reporting the claim head and I36 state/handoff digests. P35
source admission and merge require a subsequent explicit resume.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
