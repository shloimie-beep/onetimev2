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

Current P15-interface-only authority is containing control head
`0341f6303937bebc64e4d3cae6905168183dbb77`, controller authorization
`0341f6303937bebc64e4d3cae6905168183dbb77`, ready-entry parent control head
`f2ace0993937a020a31c364f079bcf52b8c65350`, claim
`15bcce0c-16b9-4c00-b422-ba5053554f14`, RELEASE_INTEGRATOR lease
`c6b4b8e0-ae22-4e59-bdbe-dfeca334dc51` through
`2026-07-28T20:36:08Z`, and ready-entry digest
`3006897b48df8f678f1c70815e6fb053fea7c1894e6f1b1b4473deb36f944aaf`.
The exact pre-claim integration head is
`9782a4164662b8059a557c0969de9c35f54d0cf7`.

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

F02 merge item `95985f2c-410b-461b-9360-549591ef624e` was rebound by control
`e8e1cfe8b69266535f3413e4cebe22c1b7ca1970` with payload digest
`45e33d239f3d26a8e998ee6a82387d8e725e27b912ce8d988ade34e4cf83428e`.
Exact F02 source `e4673ff1c2e621e26ac93034be245b280c4da4fa` was independently
verified and ancestry-merged at pushed integration head
`e6b49dff79911f3f11b6d2c0ce6a9a52d50bf7f4`. Typecheck, focused domain
guard assertions, and the native PGlite PostgreSQL migration proof passed.

Control `44202fc53db9781c91e4015d6af004bac4ab037b` rebound F03, F04, and F05
with exact payload digests `3c6f286577e102784c485a1d15d66d2a5efc142c2106d42a842dc071a3d58d6a`,
`728e72ad164c3620e1655da1e4818d0330c669cab58f7316bfe9772212d9f531`, and
`2bda976047376b4a865abe5e6c07897502123995890a0c8570a0f8c0b15a80c0`.
Exact F03 source `7c638131a0cab757657e95c4d2229a1573e4cde1`, F04 interface-only source
`4cc95c29c6012174595ba1821e0554aca8572e08`, and F05 source
`0656380bcfc50cc464dcea7588448dc724049599` were independently verified and
ancestry-merged in order. The pushed micro-batch head is
`e88121cb6ddd5023eb75496b25c3ee7281c07621`; typecheck and 49 focused tests
passed. No steward request was applied and no later F04 head was merged.

Control `5530d24379a31383d19c172bbd3b3b18d9eef5a6` rebound P15 item
`22ea97a2-e2db-4a49-9e2b-7649d3a0e069` with canonical payload digest
`617e791e254208a1d5d760e27a8455d6ebe7c6834de23ce5f25fabc53c31e62d`.
Exact P15 source `c96b8c55c07e5283e762537934a6bf948833700e` was independently verified
and ancestry-merged at pushed integration head
`eae9c62adb6711034bbd31bc4aea469c2c65fc21`. Contract digest
`2ebe108d2aa39a90908889bf9cf8f96cffb93d296e7ee9614e0d1bb5b351c3eb`
was reproduced from the semantic version line plus sorted plain artifact-path
lines, with no literal `path=` prefix. Typecheck, full quiet lint, 12 focused
tests, and provider-surface absence passed. No steward request was applied.

Current exact next action: report the pushed P15 integration metadata
checkpoint to C00, then stop and wait for a new exact control authorization.
No unrelated merge, steward, evidence, control, or live-effect work is
authorized.

Do not edit control files or perform provider/live effects. F01 source
`fa9e5c92231c4b92340d07945cc91d76c85bd444` must remain an ancestor and its
source merge commit is `34718371ee0ff26758120b11d0d4b788aa11be97`.
Typecheck and focused F01 seam verification passed.
