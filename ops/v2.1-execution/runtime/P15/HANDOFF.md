# P15 Handoff

## Identity

- Branch: `codex/v21-p15-calendar`
- Start SHA: `81602ccc44e134288d2e8cd8d6ad71a249553be2`
- Implementation SHA before this handoff metadata commit: `81602ccc44e134288d2e8cd8d6ad71a249553be2`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `cc6d395e0cb231a5180c9f927a64c814148b4946f869d68ee6afc1b74bc5c8df`
- Context digest: `0f4326a4a2c00120ae85466af822e8dc1304c2d6f6d975699991e8db75778a6a`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Completed behavior

The exact P15 first-run authorization is validated. The canonical ready payload,
control parent, task/context/package/source locks, branch absence, claim,
CALENDAR writer lease, and F02/F07 integrated interface ancestry all match.

## Remaining work

Read the locked prompt/context and named source sections, implement the bounded
calendar lane inside normalized owned paths, run task-owned verification, and
publish required durable checkpoints.

## Exact next action

Read the P15 prompt, packet, context, required normative sections, and integrated
F02/F07 interfaces, then record the exact calendar gap map.

## Coverage

- Requirements: pending locked-context read
- Acceptance cases: pending locked-context read

## Changed files and migrations

Only P15 runtime claim metadata is present. No migration or product source has
been changed.

## Verification

- Canonical P15 ready payload digest: passed
- F02/F07 implementation ancestry at authorized start: passed

## External effects

Authority is `none`; attempted 0, succeeded 0, reconciled 0.

## Security, privacy, and data handling

No secret, bearer, private payload, child data, provider mutation, live send, or
deployment was accessed or attempted.

## Blockers, deviations, and recovery

No blocker. The remote branch created by the atomic push is durable claim
memory.
