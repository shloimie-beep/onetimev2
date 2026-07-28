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

Current exact next action: report the exact pushed verified integration head
to C00. Current takeover authority is control head
`beb72be5ba1f993c1806e9314146e88f951affdb`, claim
`89f23125-5016-49e5-968c-d886dfc979dc`, shared writer lease
`1c1c44d6-203b-4d77-a6a0-7157675a38b4` through
`2026-07-28T17:35:01Z`, and ready-entry digest
`2baec3cd42b79c9156c2202e23792d0072cc2009185b9dc5fbc4be5e4d6918b0`.
The exact pre-takeover integration head is
`80c281b7ae5826ed2c6abe95ba68a033ffa52174`.

Then consume only merge item `fb37db43-fe31-4f0b-a8d7-e726c435e4bd` /
digest `58c0311691b51a91699ececc551ed94446b07ca13085a80e5d72dde767db95d4`:
validate and ancestry-merge exact F07 interface head
`47a2bb6b76225951e0599683499a95f4dc9881be` from exact target/base
`80c281b7ae5826ed2c6abe95ba68a033ffa52174`, preserve source ancestry, verify
the allowed paths and interface artifact digest
`366a1b30f724afc35e525f3f3175a4c84a45b7c13681cea1a17060bee75e4188`,
run typecheck and focused contract checks, then push and report the exact
integration head.

Under the current `CLIENT_COMPOSER` and `CONFIG_DEPS` leases, process only
assigned immutable requests `F01-retired-client-002` /
`c0175c98589e6f37b917f32a49cc22caee7456b322a7592a930959044f65886d`
and `F01-config-retirement-003` /
`b26b5b4be82553859353a52ebd0a6588c97f1e748b908c7fefad09d872f86575`
from exact F01 head `e8b172c6a7da5003a82cfc8663df6d4159fa4092`.
Apply the approved central steward semantics once, verify no retired-surface or
security regression, and record schema-valid applied or rejected result
heads/digests in I36 runtime state and handoff before pushing the steward
checkpoint for C00.

Do not read or integrate any F02 checkpoint or migration; its replacement is
pending. Do not edit control files or perform provider/live effects. F01 source
`fa9e5c92231c4b92340d07945cc91d76c85bd444` must remain an ancestor and its
source merge commit is `34718371ee0ff26758120b11d0d4b788aa11be97`.
Typecheck and focused F01 seam verification passed.
