# I36 Handoff

## Identity

- Branch: `codex/v21-integration`
- Start SHA: `ae02b193f67bf9ef04887a7b0aebb449d3fb8bc0`
- Implementation SHA before this handoff metadata commit: `34718371ee0ff26758120b11d0d4b788aa11be97`
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
three-file bootstrap adoption checkpoint and pushed it atomically at
`3277915caf862bdaa79776794862e6bdbc5762d5`. After C00 rebound the queue CAS,
verified control head `0e4b4c0688b57899493447e85a03a7aa9aab7df2` and merge
payload digest `1db016597e3e76f5213fb775f2fce031401f6f530dc6f7e89716fbf2c65c4bf5`.
Admitted the exact 14-path F01 delta and merged source head
`fa9e5c92231c4b92340d07945cc91d76c85bd444` with ancestry preserved at
`34718371ee0ff26758120b11d0d4b788aa11be97`.

## Remaining work

Push this post-merge checkpoint, install the locked dependencies, run the
contract/type and focused F01 seam checks, update this durable runtime state,
and push the verified integration checkpoint.

## Exact next action

Push this ancestry-preserving merge checkpoint, install locked dependencies,
run typecheck and focused F01 seam verification, then publish the verified
integration head to C00.

## Coverage

- Requirements: none owned by I36
- Acceptance cases: none owned by I36

## Changed files and migrations

- `ops/v2.1-execution/runtime/I36/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/I36/HANDOFF.md`
- `ops/v2.1-execution/runtime/I36/NEXT-PROMPT.md`
- Exact allowlisted F01 interface delta at
  `fa9e5c92231c4b92340d07945cc91d76c85bd444`
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
- Rebased merge entry, expected target, source base, merge base, task state and
  handoff, and all six interface artifact digests matched.
- F01 is an ancestor of merge commit
  `34718371ee0ff26758120b11d0d4b788aa11be97`.

## External effects

No external-effect authority was requested or used. Attempted: 0; succeeded: 0;
reconciled: 0.

## Security, privacy, and data handling

No secrets, provider payloads, learner data, URLs, or bearer material were
accessed or recorded.

## Blockers, deviations, and recovery

No blocker or deviation is present. The merge is locally recoverable at
`34718371ee0ff26758120b11d0d4b788aa11be97`; verification remains pending.
