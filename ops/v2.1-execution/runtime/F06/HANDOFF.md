# F06 Handoff

## Identity

- Branch: `codex/v21-f06-provider-core`
- Start SHA: `9782a4164662b8059a557c0969de9c35f54d0cf7`
- Implementation SHA before this handoff metadata commit: `9782a4164662b8059a557c0969de9c35f54d0cf7`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Task packet digest: `f1a02ca5959cfb9087b68bf4d3bc06d6ace9d07cc0ac8dd464cfc748651f2e66`
- Context digest: `872493646ff10ab4f894b10b61c2125fdf61193bea1d518e0a153ccaa3a47ce3`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Completed behavior

The exact F06 ready claim and its `PROVIDER_CORE` and `PROVIDER_REGISTRY` writer leases were verified against authorizing control commit `0341f6303937bebc64e4d3cae6905168183dbb77`. The isolated branch starts at integration SHA `9782a4164662b8059a557c0969de9c35f54d0cf7`, which contains the exact integrated F04/F05 provider prerequisites.

## Remaining work

Implement the provider-operation/readback contract, idempotent mutation and reconciliation foundation, household-scoped provider mapping, ownership-transfer reassociation, and fail-closed GHL ambiguity quarantine. Add focused positive, negative, isolation, concurrency, retry, replay, and recovery verification, then publish the required interface checkpoint.

## Exact next action

Inspect only the F04/F05 exported interfaces and F06-owned provider paths, write the concise assigned gap map, and implement the stable provider contract first.

## Coverage

- Requirements: `OTV2-PROVIDER-209`, `OTV2-PROVIDER-231`, and `OTV2-PROVIDER-243` are planned.
- Acceptance cases: all three assigned cases are planned; no candidate-bound proof is claimed.

## Changed files and migrations

Only F06 durable runtime metadata is added in this claim checkpoint. No migration or central registry is changed.

## Verification

Origin identity, control/queue state, the canonical ready-entry payload digest, immutable task inputs, exact dependency interface digests/heads, branch absence, start SHA, and unexpired leases were verified.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider or live effect occurred.

## Security, privacy, and data handling

No secrets, provider payloads, customer data, child data, private questions, or bearer material were accessed or recorded.

## Blockers, deviations, and recovery

No blocker or deviation. Resume from `TASK-STATE.yaml` only if the exact claim remains current; otherwise obtain a C00-issued resume lease.
