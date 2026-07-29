# I36 Wave D Atomic Claim

## Identity

- Branch: `codex/v21-integration`
- Exact existing target:
  `b06321b8e4b393fe546bb5251df5115d9b4a0dd3`
- Authorizing control:
  `f148cf704fb149e281d833cd5037cb0be1525b47`
- Sole acquisition parent:
  `18b0d8eafac9417901a72149e4eff48cba13a24d`
- READY I36 digest:
  `a7e35893457ba55bb957959b47a475a30232181fb525f951d898a9bc3771af28`
- Claim: `60998dcd-f3e9-45a8-a03a-9c1f4589b0ae`
- RELEASE_INTEGRATOR lease: `de1ad066-2cc3-45bd-aa48-6d2d985e219c`
- Lease window: `2026-07-29T15:51:20Z` through
  `2026-07-29T17:06:20Z`
- Phase scope: `P28_P18_P20_full_integration_atomic_claim_only`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed head, its sole parent, and the I36 state/handoff digests.

## Ordered queue

1. P28 merge `be7c79b0-3861-41bd-bef7-9c9189f0c397`, source
   `f891f16eb13593d0eb3bbe53c076513d12b07c23`, fixed base
   `aaedc3f2ec0a857658c943ea6e00dc6c1e97c46c`, 3 paths, payload
   `c455cd775a2950bc233586f2ff19751ae57938a4e3b5038ab765881794182c37`.
2. P18 merge `904ca7b0-a13b-498d-ad66-d7b452015724`, source
   `0a384577dec2ea58cbeaf22a247f7c05f6333c27`, fixed base
   `9ba92b070eedfa3756eff4f78fd328de72507a96`, 23 paths, payload
   `544ad42415b78e9125edfb21c03d1651fd0d953f61d4bf0f7f5806dde4fa4c19`.
3. P20 merge `11727ded-ed12-4f92-a9eb-735a215da2bd`, source
   `3d75b57e91c12ab3e0cad78b1a6a63497838f46f`, fixed base
   `ebf88c8e422a6ad40202fc2b0249810d312edc30`, 17 paths, payload
   `e870b85b765ee2dbe1408ddab83655f08827e5a57ffd0c4aaccde67d50101043`.

All queue-declared merge-after heads are ancestors of the exact target.

## Verification

The remote control and integration refs matched exactly. The canonical READY
entry and all three merge items recomputed to their sibling-map digests. The
raw-Git-blob execution-package validator passed with 200 locked files, all
46 tasks/contexts/prompts, 16 source-spec files, 243 requirements, 265 cases,
107 decisions, and 35 implementation tasks. Package, task, context,
control-state, and prior I36 state/handoff bindings passed.

The exact P28, P18, and P20 branch refs were verified by `ls-remote` without
fetching source content. Their recorded bases, 3/23/17-path declarations,
merge-after prerequisites, order, claim, unexpired sole lease, zero effect
locks, and 0/0/0 effects passed.

This checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. No queued source was fetched, read, or merged. P17 reminder
routing and every migration, registration, config, and projection request
remain unapplied. No provider inspection, send, deployment, or external effect
was performed.

## Next action

C00 must reconcile the exact pushed atomic claim head and its sole parent. I36
must stop after reporting the claim and I36 state/handoff digests. Source
admission and ordered merges require a subsequent explicit resume.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
