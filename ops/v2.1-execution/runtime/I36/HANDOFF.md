# I36 F06/F07/P16 Full-Integration Atomic Claim

## Identity

- Branch: `codex/v21-integration`
- Exact existing target:
  `09a248c90918afc3bd171e9f4990efc28b17ca5e`
- Authorizing transaction:
  `f9c40f4fab7193baa120380dfcf082d14dec5429`
- Sole acquisition parent:
  `62d535edb54710ac4f9cb035c2affb4a0845a95d`
- READY I36 digest:
  `9c6a4746e100cd0f1d9a057e1096836c0cd517138871c5b3050cd92f2b4bf56e`
- Claim: `b1773fcc-0219-4d5e-a80c-e388b4ac7f3b`
- RELEASE_INTEGRATOR lease: `b2a36214-721d-4224-a50d-8c21b20f4e11`
- Lease window: `2026-07-29T13:54:38Z` through
  `2026-07-29T15:09:38Z`
- Phase scope: `F06_F07_P16_full_integration_atomic_claim_only`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed remote head.

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

## Authority verification

The fetched integration and control refs matched the exact target and
authorization. Canonical READY and all three merge-item payloads recomputed
exactly. Each source ref, required merge base, three-path tail, task and
state-handoff binding, and 0/0/0 effect record passed. F04/F05/F01 prerequisites
and P15 full head `c96b8c55c07e5283e762537934a6bf948833700e`
are already ancestors; queued order satisfies F06 before F07 and F07 before
P16.

This checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. No source was merged, no steward request was applied, and no
product, provider, send, or external effect was performed.

## Next action

C00 must reconcile the exact pushed atomic claim head. I36 must stop after
reporting it; ordered F06/F07/P16 merges require a subsequent explicit resume.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
