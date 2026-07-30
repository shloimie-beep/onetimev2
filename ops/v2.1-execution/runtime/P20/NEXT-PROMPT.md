MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

P20 is in a runtime-triplet-only metadata-correction atomic claim on branch
`codex/v21-p20-media-processing`.

The exact parent is the rejected metadata head
`dc438725fb6bb8779c2d816d5e28d3b73227b6d4`. Canonical control
`9e3eb50afbd1232bc83729f281bd82c12a14ab8e` has sole state-basis parent
`6fec4000f1e31d608f8fc41488a9befab903aae8` and READY digest
`f10eafc49cd2665bd6bf1b8ae5e804fd880799e4ca734c9e88954957e0f7ff91`.

Fresh claim `162924fc-86b1-466b-8836-9e6fcc2a1326` holds CONTENT_PROCESSING
lease `3da95218-b815-434a-ae63-154220c083b0` through
`2026-07-30T08:32:00Z`.

This first push changes exactly:

- `ops/v2.1-execution/runtime/P20/HANDOFF.md`
- `ops/v2.1-execution/runtime/P20/NEXT-PROMPT.md`
- `ops/v2.1-execution/runtime/P20/TASK-STATE.yaml`

It records the claim, lease, READY binding, rejected-head state/handoff digest
`945f2ab3c7230fdfb2db00a3801e2e435ad22c43f48eaeccda220bbca6ca2727`,
and runtime-triplet digest
`38723f2ea2c464938250dcb46231d739ff4d3a7eefdd9e58fc59109db02ca53b`.

The current contract Git-blob SHA-256 is
`cdeff6161a052fb78b3282c7db336d037c8f553938ed4abc3632bf45b95b7fe9`.
The corrected twelve-artifact aggregate is
`9b4cfb269a3869ee86143348b7514ea18053494d034ad75f68f0915afd84c370`.
The existing stale `contract_digest` and `implementation_artifact_digest`
fields remain unchanged. No actual digest correction is authorized before C00
reconciles this atomic claim.

C00 next action:

1. Verify the claim is the sole child of
   `dc438725fb6bb8779c2d816d5e28d3b73227b6d4`.
2. Verify its delta is exactly the P20 runtime triplet.
3. Recompute the READY, prior pair/triplet, current contract blob, and corrected
   twelve-artifact bindings.
4. Reconcile this claim before P20 resumes the metadata correction.

Every source, test, acceptance, request, migration, P21, provider, deployment,
manifest, lockfile, and effect byte remains unchanged. External effects remain
attempted `0`, succeeded `0`, reconciled `0`. P20 must stop after the normal
claim push and remote verification.
