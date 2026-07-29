# P24 Support Atomic Claim

## Identity

- Branch: `codex/v21-p24-support`
- Authorized start: `408b21afa4b9ac6f100b3ce33ea87984d18d4bf7`
- Current atomic-claim commit: derive with `git rev-parse HEAD`; C00 must record
  and reconcile the exact observed remote head
- Task packet digest:
  `a0b763435e1c23e670b5894e56037735b4bfb74bfae247ebfa70145d86b89383`
- Task context digest:
  `dc0b18db7b0e5a8eac1d02f6bf0d482ea58ab2b8efecaf8d214e05006b2f2427`
- Prompt digest:
  `1cf9d6f343ea49b8c7399864280f5bcdb24616199c2a6591bbb5f4f909fbee99`
- Source package digest:
  `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Package lock digest:
  `3d13585587ab64d063c09dd8ef37b2ffe1c40034d3f8dddf93299092a0ea8e4a`
- Claim: `ff79d0ab-10d4-481b-ae90-48bb8bd9631a`
- SUPPORT lease: `4d0115d1-571f-4ca7-8b04-3fc79b43bcdf`, issued
  `2026-07-29T12:23:30Z`, expiring `2026-07-29T13:38:30Z`, phase scope
  `P24_atomic_claim_only`
- Containing control authorization:
  `6d0278d46789b6d746c58effa6c5f182ff4a7741`
- Sole acquisition/READY parent:
  `8bb4680887b2ea320f914cf046184655601fade9`
- READY payload digest:
  `57d6b0bb804527dfd218860202b9bec3f66ee24a424fb4815d6308816cab5b75`

## Dependency bindings

- F03: task/source `7c638131a0cab757657e95c4d2229a1573e4cde1`,
  integration `9782a4164662b8059a557c0969de9c35f54d0cf7`, implementation
  `56fa990c5d4a6cb7b602b5f68fe0d2402a0ee71e`, checkpoint
  `66464e9a769c717dfdfda082bb8a26030da1681d601d6752fb04b10d812db111`
- F04: task `54a0ac28b51d271aacab60003451dbcc66ffcac8`, source
  `4cc95c29c6012174595ba1821e0554aca8572e08`, integration
  `9782a4164662b8059a557c0969de9c35f54d0cf7`, implementation
  `8ba3f6c83ed3d7239ae672e938829ec9c572cd6b`, checkpoint
  `a57837379bfc8210188887ff31937ed7882befe10b80941499dc7ba305e7984d`
- F05: task `9174d845e1c04916e2f1884cfadfaef624ac6862`, source
  `0656380bcfc50cc464dcea7588448dc724049599`, integration
  `9782a4164662b8059a557c0969de9c35f54d0cf7`, implementation
  `1ade14c52e42e59bb8fd1d1de776b91406c45f15`, checkpoint
  `fd17c478bfc851dcb434b8e0c2750701605b80dfdf880833a6a2993e8fad6329`
- F07: task `2c451d7b1f59eece1ae8df505d4eeec19f42e1ef`, source
  `47a2bb6b76225951e0599683499a95f4dc9881be`, integration
  `91349fc1fa9a474ae31cf408ae0364aa10520385`, implementation
  `a90baae8cf69d6823af6d741161fe0e9e7441321`, checkpoint
  `366a1b30f724afc35e525f3f3175a4c84a45b7c13681cea1a17060bee75e4188`

The exact task/context dependency digests are recorded in `TASK-STATE.yaml`.
Every named interface source is an ancestor of the authorized start.

## Completed scope

Validated the exact P24 first-run authorization, branch absence, unexpired
claim and SUPPORT lease, authorized integration start, package/task/context
identities, READY payload, dependency bindings, and zero effect-lock leases.
This checkpoint contains only task-local durable claim memory.

## Exact next action

C00 must reconcile the exact pushed P24 atomic-claim head. Stop until a new
exact control authorization identifies that head and explicitly permits resume.

## Changed files

Only `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md` under the P24 runtime
directory are added. No product, test, request, registration, steward,
migration, or provider file changed.

## External effects

Authority is `none`; no effect lock was claimed; attempted 0, succeeded 0,
reconciled 0. No Telegram or other provider state was inspected.

## Blockers and recovery

Implementation is intentionally paused pending C00 reconciliation of this exact
atomic claim.
