# I36 Handoff

## Identity

- Branch: `codex/v21-integration`
- Start SHA: `ae02b193f67bf9ef04887a7b0aebb449d3fb8bc0`
- Implementation SHA before this handoff metadata commit: `ae02b193f67bf9ef04887a7b0aebb449d3fb8bc0`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `55e261760baac780e9a4db48c328480c6f98172261ef990e563a00b25c467fc7`
- Context digest: `7f47da82267dec5dafe9ad53da7ece7618c331645f0591982851c47987d06813`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim ID: `b847548e-4655-4711-ba68-384d87aa6cb3`
- Writer: `codex-i36-worker-b847548e`
- Controller authorization: `7ccacffa6e460d5e3c1daff66c33a6a73d1b77dc`
- Lease expiry: `2026-07-28T16:33:58Z`

## Completed behavior

Verified the exact repository, remote control head, bootstrap integration head,
F01 source head, I36 ready entry, queued merge item, leases, canonical payload
digests, and all checksum-locked committed blobs. Prepared the required
three-file bootstrap adoption checkpoint without changing product or control
files.

## Remaining work

Push the bootstrap adoption checkpoint by a normal fast-forward update. Then
scope-check and merge only the exact queued F01 interface checkpoint, run its
contract/type checks, update this durable runtime state, and push the resulting
integration checkpoint.

## Exact next action

Atomically fast-forward this claim checkpoint to
`origin/codex/v21-integration`, then verify and merge queued F01 interface item
`da4bef5a-c064-4fb8-96c4-09a34aa61603`.

## Coverage

- Requirements: none owned by I36
- Acceptance cases: none owned by I36

## Changed files and migrations

- `ops/v2.1-execution/runtime/I36/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/I36/HANDOFF.md`
- `ops/v2.1-execution/runtime/I36/NEXT-PROMPT.md`
- Migrations: none

## Verification

- Repository URL matched `shloimie-beep/onetimev2`.
- Remote heads matched control authorization exactly.
- Ready payload digest recomputed as
  `4b429a919e258b635c3c713c023bf83ecb8b28711c63e192d97d52567afa17a1`.
- Merge payload digest recomputed as
  `39e877291294ccb17eb773beedbc7b17a7a85d0e18079841908c35687267abe8`.
- All 200 locked Git blobs and all 15 source-package Git blobs passed SHA-256
  verification.

## External effects

No external-effect authority was requested or used. Attempted: 0; succeeded: 0;
reconciled: 0.

## Security, privacy, and data handling

No secrets, provider payloads, learner data, URLs, or bearer material were
accessed or recorded.

## Blockers, deviations, and recovery

No blocker or deviation is present. The branch remains recoverable from the
authorized bootstrap SHA until the atomic claim push succeeds.
