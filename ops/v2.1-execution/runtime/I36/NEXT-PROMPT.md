MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: PAUSE_FOR_C00_P21_P22_CAS_REBIND

Audit and consume the exact pushed I36 P21/P22 source-microbatch resume claim
checkpoint. Do not merge either source head from the stale queue target and do
not perform candidate, steward, provider, deployment, or external work.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Exact claim-checkpoint parent: `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`
Containing control: `ddd36a461481504219ac663cf464417eb2e6658b`
Authority/control basis: `0a2e8c390d48da157be35a2f9d06f876a70b5e62`
Canonical READY: `102533576903c248ec018c2806191d6fbc055ef2a2dcd2438042e5129e815e89`
Claim: `f7a26569-d4d1-4b42-9d5c-7b98377bd235`
Writer: `codex-i36-p21-p22-source-f7a26569`
RELEASE_INTEGRATOR lease: `5e0cd656-e4eb-492d-88d8-50c792fa1a20`
Lease issued: `2026-07-31T10:20:00Z`
Lease expiry: `2026-07-31T12:20:00Z`
Lease release: none; lease remains live
Lease phase: `P21_then_P22_accepted_source_microbatch_only`

Confirm the checkpoint has the sole parent above and changes exactly:

- `ops/v2.1-execution/runtime/I36/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/I36/HANDOFF.md`
- `ops/v2.1-execution/runtime/I36/NEXT-PROMPT.md`

Confirm no P21/P22 source merge occurred, all product/test/migration/steward,
control, provider, candidate, deployment, and external bytes/state are
unchanged, the lease is unreleased and unexpired, effects are `0/0/0`, and
local/tracking/live integration refs are equal at the pushed claim head.

Confirm P21 terminal `c11dec418fa3de896e96c348f87928c92c9f86b9` and
P22 terminal `347a08b29b801de0a74b242d962c42a886dcd717` remain exact live remote
source heads. Confirm canonical merge-item digests
`a14e9343278833e48657fc6cf428a968fc1293d243097d908ac70dd562bc324d`
and `db8d1e7841f7343f8d1a0a6d8d82e42268e11cb27fb6413dec1cf7fe61c7e8d1`.

C00 must consume the current READY and publish descendant control that rebinds
both P21 and P22 `expected_target_head_sha` CAS fields to the exact verified
claim-checkpoint head while preserving the same claim, lease, source heads,
fixed source bases, order, scopes, digests, zero effects, and prohibitions.
Only after that descendant authorization is live may I36 merge P21 first and
P22 second. Stop after reconciliation/rebind.
