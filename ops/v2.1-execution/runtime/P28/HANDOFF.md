# P28 Handoff

## Identity

- Branch: `codex/v21-p28-communication-foundation`
- Start SHA: `9ba92b070eedfa3756eff4f78fd328de72507a96`
- Implementation SHA before this handoff metadata commit: `9ba92b070eedfa3756eff4f78fd328de72507a96`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the pushed head
- Task packet digest: `3fd5a9c080e3a7695a415dc6fc289d095ad662d6ccfa598910f73014cf38c823`
- Context digest: `96152f74273391337a3c6b8dd576829e7ddf9467cc867fb3b35ec4cf2c3cc18c`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `16640fee-ca26-4885-9be7-14fb2baa682c`
- Writer: `codex-p28-worker-16640fee`
- Containing control authorization: `e847dd790ae2f99ae526b0edcbd41897474c8f18`
- Ready-entry parent control: `3cfe14a6e1171d002f7173c13776dc682fddd6a8`
- Ready-entry digest: `2801e38a195ad4c98ddd7305440bd3b67a21273118d0fc3865410ff0410b4285`
- GHL_REGISTRY lease: `f59eb149-ec9e-4d32-afd7-55ad5e32c899`
- COMMUNICATION_FOUNDATION lease: `d2cd17e1-c0d2-4dd9-ab21-62c1b2a24a30`
- Lease expiry: `2026-07-28T22:55:38Z`

## Completed behavior

The exact control, integration start, branch absence, ready-entry digest,
package/task/context/source-package digests, dependency bindings, claim, and
both writer leases were verified. All 200 locked and 15 source-package Git blobs
matched. No effect authority exists and no provider or external operation was
attempted. This atomic checkpoint contains only the three P28 runtime files.

## Remaining work

Implement the canonical GHL registry and isolated communication-foundation
contracts, domain behavior, persistence boundary, desired-state/readback
projection, and worker runner. Publish the exact interface checkpoint that
unlocks P29/P30, pass focused verification, and finish at `ready_for_review`.

## Exact next action

Push this three-file atomic claim from exact parent `9ba92b07`, then inspect the
named F06/P27/P31 dependency handoffs and artifacts and implement only P28-owned
paths with zero external effects.

## Coverage

- Requirements: nine assigned, pending implementation
- Acceptance cases: ten assigned, pending task-owned verification

## Changed files and migrations

- `ops/v2.1-execution/runtime/P28/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P28/HANDOFF.md`
- `ops/v2.1-execution/runtime/P28/NEXT-PROMPT.md`
- Migrations: none

## Verification

- Exact remote repository/control/integration/branch identity: passed
- Canonical ready-entry digest: passed
- Locked/source/package/task/context digests: passed
- F06/P27/P31 dependency bindings and P28 leases: passed

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0.

## Security, privacy, and data handling

No secrets, provider payloads, learner data, URLs, bearer material, live sends,
workflow mutations, enrollments, or deployments were accessed or performed.

## Blockers, deviations, and recovery

None. Recovery base is exact integration head
`9ba92b070eedfa3756eff4f78fd328de72507a96`.
