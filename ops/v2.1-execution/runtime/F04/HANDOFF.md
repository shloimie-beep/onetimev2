# F04 Handoff

## Identity

- Branch: `codex/v21-f04-household-identity`
- Start SHA: `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`
- Implementation SHA before this handoff metadata commit: `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head.
- Task packet digest: `8129731ba92e32991ceda7c9e729196e82c4d9c8ac2cb8dfbee33a7c169d81f5`
- Context digest: `ee9e067b17a172c1a9c9886bffa7798e228359c08dbad4d8692b4d36518c1367`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Controller authorization: `398ebf34ec72892d354370af11af297d45302888`
- Claim: `38e6f374-86dc-4b78-9846-4c328455443c`

## Completed behavior

The exact F04 ready entry, dependency, immutable inputs, claim, and writer lease were independently verified. The isolated task branch was created from the authorized integration head. No product behavior has been implemented yet.

## Remaining work

Implement and verify the adult identity, exact role membership, explicit role and household contexts, safe ownership transfer, session revocation, self-Student transfer block, dependent-attestation gate, and cross-household isolation within F04-owned paths.

## Exact next action

Inspect only the named account/access implementation paths and locked F04 source sections, then implement the smallest coherent contract and domain vertical.

## Coverage

- Requirements: `OTV2-ACCOUNT-181`, `182`, `183`, and `230` pending.
- Acceptance cases: all four assigned cases pending task-owned verification.

## Changed files and migrations

Only F04 runtime metadata was added. No migrations were created or changed.

## Verification

Remote control/head, ready payload, input digests, dependency interface proof, absent remote branch, and lease validity passed.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No secrets, provider payloads, child data, credentials, or external effects were used.

## Blockers, deviations, and recovery

None. Resume from the exact action above if this checkpoint is interrupted.
