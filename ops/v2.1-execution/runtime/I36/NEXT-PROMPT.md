MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task I36 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/I36.yaml
Task context: ops/v2.1-execution/contexts/I36-CONTEXT.md
Task state: ops/v2.1-execution/runtime/I36/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/I36/HANDOFF.md

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read I36's exact registry and ready/resume entry
from that remote ref, verify its expected branch head, canonical entry payload
digest, lease/claim, package/task/context/dependency digests, and reject a live
foreign lease or non-fast-forward collision. Check out the exact integration
branch and resume `TASK-STATE.yaml:next_action` without restarting valid work.

Current F02-interface-only authority is control head
`3df0ee05af64db67af02e1e64d37ded4810d2cd9`, parent control state
`55c5605acf834318627d54bd3e94eb90d6429a80`, claim
`8d31181a-cfe8-493e-b7ce-4ea867da9581`, RELEASE_INTEGRATOR lease
`9b0d2541-b765-4a2b-af44-014f842efa1a` through
`2026-07-28T18:38:47Z`, and ready-entry digest
`9758c3f53dcecec282041590350bdf8ec2ac2283357fa5893b72786824703aa4`.
The exact pre-claim integration head is
`eefca0644e57dca48609682cbc3e1b01992d286d`.

F07 interface head `47a2bb6b76225951e0599683499a95f4dc9881be`
has been ancestry-merged and pushed at exact integration head
`91349fc1fa9a474ae31cf408ae0364aa10520385`. Rebound control head was
`136f5f54520e44415c10b83108314fab4503a42e`, merge-item payload
digest was `fc8a9a3401d327d21bf1c716bcecb63323436031ff893b40221b7bdff052d6c0`,
and typecheck plus all three focused F07 contract tests passed.

The assigned immutable requests `F01-retired-client-002` /
`c0175c98589e6f37b917f32a49cc22caee7456b322a7592a930959044f65886d`
and `F01-config-retirement-003` /
`b26b5b4be82553859353a52ebd0a6588c97f1e748b908c7fefad09d872f86575`
were evaluated from exact F01 head
`e8b172c6a7da5003a82cfc8663df6d4159fa4092` and rejected without
product edits. The client request cannot achieve its public-bundle retirement
within its exact path list because named HTML paths are absent and remaining
retired assets are outside scope. The config request assumes F01's unmerged
`protectedPayloadEncryptionKey` state, so applying it would synthesize
unqueued implementation. Their canonical rejected-result payload digests are
`a86c6296a8a9acb6e94b52fa0e33a86be682a7d54061ff7d6640e1616c214f3a`
and `a55f5be6369a8b2952a4a1eaa3961d94cc48f2117a3d5ad61ae2d7884585dd0f`.

P31 merge item `e354aedf-1e25-4d05-b917-3f568dcf048e` was rebound by control
`d9bb5fd42ad43ccb121d2d749f6176908cac8e9a` with payload digest
`7a7373c66621981772391947f00778fec9ded1726b8f0b5068cf46cc7aa66c32`.
Exact P31 source `ba811b3b2682ab46de1859334f5aa4ad5d7f5f0d` was independently
verified and ancestry-merged at pushed integration head
`42b09dc598e0dfc17ada53b441e4cd487e126573`. Typecheck and focused P31
catalog/approval/security assertions passed.

Current exact next action: report the pushed F02-interface-only claim head to
C00, then stop and wait. C00 must rebind item
`95985f2c-410b-461b-9360-549591ef624e` from its old target
`eefca0644e57dca48609682cbc3e1b01992d286d` to the exact claim head before
I36 reads or merges F02 source `e4673ff1c2e621e26ac93034be245b280c4da4fa`.
No unrelated merge, steward, evidence, control, or live-effect work is
authorized.

Do not read or integrate any F02 checkpoint or migration; its replacement is
pending. Do not edit control files or perform provider/live effects. F01 source
`fa9e5c92231c4b92340d07945cc91d76c85bd444` must remain an ancestor and its
source merge commit is `34718371ee0ff26758120b11d0d4b788aa11be97`.
Typecheck and focused F01 seam verification passed.
