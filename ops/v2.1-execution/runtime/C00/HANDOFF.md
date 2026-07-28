# C00 Handoff

## Identity

- Branch: `codex/v21-control`
- Start SHA: `73dda293079f602c83929d1bbccb8dd5b9d1a455`
- Task packet digest: `7c982879f3667c344a4c603b601ae3440bb9d429b45b24a2235c22ac9df2c970`
- Context digest: `ed58d8d92f8cd5ba75cb25dd3b5e801c6f2d7fb33ef58afcd3f507e91008ce96`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Completed behavior

Verified repository identity, PR #130's exact reviewed head, archive structure,
and every delivery checksum. Installed the complete v2.1 package, added the
v2.1 authority block to `AGENTS.md`, seeded the serialized controller claim,
validated that a fresh agent reaches v2.1 before historical status sources,
and passed the normal control-branch creation push permission canary.
The canonical verify baseline was measured in a detached worktree at the exact
reviewed head: secret scanning passed and Prettier reported 1,736 files before
the chained command stopped.
Independent package topology validation passed, and `codex/v21-integration`
was created and remotely verified at `ae02b193f67bf9ef04887a7b0aebb449d3fb8bc0`.
Control ledgers are initialized with migrations beginning at 2234, provider
locks unclaimed, empty merge/steward/blocker state, and non-overlapping initial
ready leases for F01 plus I36 bootstrap adoption.
The ready entries were rebound to the exact `control_initialized` parent,
validated, and the controller was advanced to `operational` with its lease
released.

## Remaining work

None for bootstrap. Future C00 invocations perform episodic controller refresh
after worker branches advance.

## Exact next action

Dispatch F01 from `ops/v2.1-execution/control/READY-QUEUE.yaml`. Keep I36
on-demand and use its bootstrap-adoption claim only when opening the merge
captain window.

## Verification

- Delivery manifest: 214/214 entries passed.
- Package inventory: 46 tasks, 46 contexts, 46 prompts, 16 source-spec files.
- Baseline failure fingerprint: `049be15daaa0ab5ff3bacc9743c60884002e6e856341feafcbc7a1a78cfc5d4b`.
- Independent package topology validation: PASS.
- Integration bootstrap SHA: `ae02b193f67bf9ef04887a7b0aebb449d3fb8bc0`.
- F01 ready payload: `f881a8419d7595828cf4dc5294c67e3e130453be2ff17a402ee98f7e5a8e61e5`.
- I36 ready payload: `c9ac0530657e7cc1e95b4afc309dc13308b3f0a1b2db8bef513de29502a57a03`.
- Control state digest: `70b008dd8bc46f9bcfdd95217ff08fc9b2ad3e949008b5f9e7f0ed29566b9a88`.
- Task registry digest: `2c839861d6b097189374d523620fc2600d095b541a3aca3298b6f5e3efaca133`.
- Ready queue digest: `8cb2774770421a0ab906c16479906bdeb54ab507ad444059476d72a309a1a9f6`.
- No provider or product effect was attempted.

## Blockers, deviations, and recovery

None. The attached `(1)` ZIP and the exact-basename ZIP were byte-identical;
the isolated staging area contains only the required exact-basename package.
