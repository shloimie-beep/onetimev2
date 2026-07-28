# P19 Handoff

## Identity

- Branch: `codex/v21-p19-content-ingest`
- Start SHA: `9ba92b070eedfa3756eff4f78fd328de72507a96`
- Implementation SHA before this handoff metadata commit: `9ba92b070eedfa3756eff4f78fd328de72507a96`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `ca7b34a49abb1b74cc1f2405f0614c84ecbf8036eba0e3d47ded110bc9760e06`
- Context digest: `f517475b52f50996ec6a2551daa091bbe5f3df982ee258d100ee11ffdbd7c7be`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `de624026-ff9a-4c35-ad02-bc6c1f28a3dc`
- CONTENT_INGEST lease: `318f7a4b-99c1-4e1f-aff6-960e5f14acfe`, expiring `2026-07-28T22:55:38Z`
- Containing control authorization: `e847dd790ae2f99ae526b0edcbd41897474c8f18`
- Ready-entry parent: `3cfe14a6e1171d002f7173c13776dc682fddd6a8`
- Ready payload digest: `21b9ce89c53779bac1c79373b18de9afe860c72511249d7cfd180ecf98a50374`

## Completed behavior

Validated the exact P19 first-run authorization, remote branch absence,
unexpired claim/lease, authorized integration start, and F05/F06/P16 dependency
bindings. This checkpoint contains only task-local durable claim memory.

## Remaining work

Verify/read the locked P19 context and dependencies, implement the bounded
direct-upload/Drive-intake/source-deduplication lane, run task-owned verification,
and publish interface plus final checkpoints.

## Exact next action

Verify immutable digests and read the exact dependency/source interfaces, then
record the streaming, Drive stability, checksum identity, and retry gap map.

## Coverage

- Requirements: pending locked-context read
- Acceptance cases: pending locked-context read

## Changed files and migrations

Only the three P19 runtime claim records are added.

## Verification

Remote identity, control/registry/queue entry, branch absence, claim, lease,
start SHA, and dependency bindings passed.

## External effects

Authority is `none`; attempted 0, succeeded 0, reconciled 0.

## Security, privacy, and data handling

No secret, customer/child data, provider record, file content, message,
deployment, or live effect was accessed or attempted.

## Blockers, deviations, and recovery

No blocker.
