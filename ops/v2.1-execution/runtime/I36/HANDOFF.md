# I36 F06/F07/P16 Full-Integration Release

## Identity

- Branch: `codex/v21-integration`
- Atomic claim target:
  `fd791eea49d0a77c3e0f95c3bead0ea522b9f829`
- Authorizing transaction:
  `9586d9eea5fd1c17918237c453b6ff933b2a4fe8`
- Sole acquisition parent:
  `a6b48636d225609222bf96f90cf8a76da023380c`
- READY I36 digest:
  `9c6a4746e100cd0f1d9a057e1096836c0cd517138871c5b3050cd92f2b4bf56e`
- Claim: `b1773fcc-0219-4d5e-a80c-e388b4ac7f3b`
- RELEASE_INTEGRATOR lease: `b2a36214-721d-4224-a50d-8c21b20f4e11`
- Lease window: `2026-07-29T13:54:38Z` through
  `2026-07-29T15:09:38Z`
- Lease released: `2026-07-29T14:17:00Z`
- Phase scope: `F06_F07_P16_full_integration_atomic_claim_only`
- Release head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed remote head and its sole parent.

## Ordered queue

1. F06 merge `c18d0378-5a3f-466e-a218-f464dee63316`, source
   `ce061ca5b208cfb2a41e0c2f439a7a4b91e8ca57`, payload
   `f4a8f0206977cf9ca1a3d0787bfc4a78d0817e44fb65f4fbfbbb0a7ed280e6ec`.
2. F07 merge `2efaeeff-7088-4a5d-9b70-3cb334469693`, source
   `2c451d7b1f59eece1ae8df505d4eeec19f42e1ef`, payload
   `94aa0664d0fdc90c832a63e363516fafd6fbe6366637fe21358affc288af7121`.
3. P16 merge `41399648-7a65-497c-8c99-0c7fdfee49f6`, source
   `72fca16b3a9cd82c666e293f8bfd7d84c30722a1`, payload
   `a35518d9e4eee8dad70d9b343349b131a227b3295568b10047538c3bc79b1bd0`.

## Merge results

1. F06 merged at `a9b8404451246246fdcd2ffdde99ee72bb096d2f`
   from parents `fd791eea49d0a77c3e0f95c3bead0ea522b9f829` and
   `ce061ca5b208cfb2a41e0c2f439a7a4b91e8ca57`.
2. F07 merged at `64c70e49737d94d2f327f2bff0215791bdf69dc7`
   from parents `a9b8404451246246fdcd2ffdde99ee72bb096d2f` and
   `2c451d7b1f59eece1ae8df505d4eeec19f42e1ef`.
3. P16 merged at `66c8a987ea227dce08612bfe0ac81e758e028b42`
   from parents `64c70e49737d94d2f327f2bff0215791bdf69dc7` and
   `72fca16b3a9cd82c666e293f8bfd7d84c30722a1`.

Each first-parent delta is exactly that task's `HANDOFF.md`, `NEXT-PROMPT.md`,
and `TASK-STATE.yaml`. The complete atomic-claim delta is exactly those nine
admitted runtime paths.

## Verification

The fetched integration and control refs matched the exact target and
authorization. Canonical READY and all three merge-item payloads recomputed
exactly. Each source ref, required merge base, three-path tail, task and
state-handoff binding, and 0/0/0 effect record passed. F04/F05/F01 prerequisites
and P15 full head `c96b8c55c07e5283e762537934a6bf948833700e`
are already ancestors; queued order satisfies F06 before F07 and F07 before
P16.

All 200 locked blobs and 15 source-package blobs passed. Full lint and build
passed, as did 31 focused F06/F07/P16 tests, exact-path formatting, diff
hygiene, the repository secret scan, merge-parent checks, and scope checks.
The full unit, integration, and repository-wide formatting commands retain
baseline failures only in paths unchanged by this nine-file metadata wave; the
details are recorded in `TASK-STATE.yaml`.

This release checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. No steward request was applied, no product or test code was
edited, and no product, provider, send, or external effect was performed.

## Next action

C00 must reconcile the exact pushed release head and its sole parent. I36 must
stop after reporting it.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
