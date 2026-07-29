# P08 Atomic Correction Claim Handoff

## Identity

- Branch: `codex/v21-p08-family-signup`
- Exact correction parent and expected existing head:
  `59b43a601225d6f86a929621c89402d06ada39e4`
- Prior implementation:
  `7e20798c1161da0594cea363d1047335c9ae4fbe`
- Correction claim: `e9148002-e9ff-4b7c-ab6e-63080c66bd00`
- Writer: `codex-p08-worker-e9148002`
- Containing controller:
  `5cc06e9a3692f1833be737b53d92595bc2bf3e95`
- Ready-entry parent control:
  `f28533a2bc55672cedd86cd556d1ad396aa3db4c`
- Canonical ready digest:
  `898063c08637b54f42567e21db5acb5dfe1a25410068c7d9b3a1530ae8917ac5`
- FAMILY_SIGNUP lease:
  `23274fa2-66cc-4cfd-8d6c-ba659d70a323`
- Lease issued: `2026-07-29T01:18:05Z`
- Lease expires: `2026-07-29T02:18:05Z`
- External effects: authority none; attempted 0; succeeded 0; reconciled 0

## This checkpoint

This commit consumes only the P08 bounded-correction claim. It preserves the
exact prior branch state and changes only `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`.

No product, contract, test, steward request, interface checkpoint, migration,
route, registration, provider, or external-effect change is included.

## Exact next action

Push and report this three-file atomic correction claim checkpoint. Then stop
until C00 reconciles claim `e9148002-e9ff-4b7c-ab6e-63080c66bd00` and explicitly
authorizes the bounded product correction.
