# F03 Handoff

## Identity

- Branch: `codex/v21-f03-adult-student-auth`
- Start SHA: `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`
- Implementation SHA before this handoff metadata commit: `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `8474eeb85ea4c7991c1a42a798c1c3f6a3cda9f2b9a3b51b7c15617b5817ba27`
- Context digest: `9ccc41a037fe9163800d56e8b34991d46e63399a46f3b6f47c986fa200e2ce5e`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Controller authorization: `398ebf34ec72892d354370af11af297d45302888`
- Claim: `0b100424-7be3-4613-ae07-e7019d140a30`
- Writer lease: `IDENTITY_AUTH_ACCESS` / `82b0973d-b5b7-4ea6-9618-a5c50d3b14ba`

## Completed behavior

The first-run claim is seeded from the exact authorized integration head. Repository identity, the canonical ready payload, the F02 integrated interface, locked task/context/package digests, and the immutable F01 steward request were verified.

## Remaining work

Implement and verify all F03-owned authentication behavior, evaluate `F01-retired-auth-001` exactly, publish the required interface checkpoint, and finish at `ready_for_review`.

## Exact next action

Inspect the named F03-owned authentication paths and exact normative source sections, then implement the smallest coherent contract and domain behavior with focused tests.

## Coverage

- Requirements: 16 pending
- Acceptance cases: 22 pending

## Changed files and migrations

Only `ops/v2.1-execution/runtime/F03/{TASK-STATE.yaml,HANDOFF.md,NEXT-PROMPT.md}` are changed in this atomic claim checkpoint. No migrations.

## Verification

Exact ref checks, canonical ready-entry digest recomputation, dependency checkpoint verification, and locked file SHA-256 checks pass.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No secrets, tokens, child data, provider payloads, or live effects were accessed or introduced.

## Blockers, deviations, and recovery

None.
