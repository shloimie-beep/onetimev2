# I36 Handoff

## Identity

- Branch: `codex/v21-integration`
- Start SHA: `ae02b193f67bf9ef04887a7b0aebb449d3fb8bc0`
- Expected existing SHA before this takeover checkpoint: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Preserved F01 source merge commit: `34718371ee0ff26758120b11d0d4b788aa11be97`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `55e261760baac780e9a4db48c328480c6f98172261ef990e563a00b25c467fc7`
- Context digest: `7f47da82267dec5dafe9ad53da7ece7618c331645f0591982851c47987d06813`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim ID: `89f23125-5016-49e5-968c-d886dfc979dc`
- Writer: `codex-i36-worker2-89f23125`
- Shared writer lease: `1c1c44d6-203b-4d77-a6a0-7157675a38b4`
- Controller authorization: `beb72be5ba1f993c1806e9314146e88f951affdb`
- Ready-entry payload digest: `2baec3cd42b79c9156c2202e23792d0072cc2009185b9dc5fbc4be5e4d6918b0`
- Lease expiry: `2026-07-28T17:35:01Z`

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
`34718371ee0ff26758120b11d0d4b788aa11be97`. C00 then authorized takeover of
the stale prior writer at exact integration head
`80c281b7ae5826ed2c6abe95ba68a033ffa52174`. This checkpoint binds the new
claim, lease, control head, ready-entry digest, and unchanged expected branch
head. No F02 checkpoint, migration, or registry entry was read or integrated.

## Remaining work

Report this exact takeover checkpoint to C00. Then consume only merge item
`fb37db43-fe31-4f0b-a8d7-e726c435e4bd` / digest
`58c0311691b51a91699ececc551ed94446b07ca13085a80e5d72dde767db95d4`
for exact F07 source head `47a2bb6b76225951e0599683499a95f4dc9881be`.
After the F07 checkpoint, process only the assigned immutable F01 steward
requests `F01-retired-client-002` and `F01-config-retirement-003` from exact
F01 head `e8b172c6a7da5003a82cfc8663df6d4159fa4092`.

## Exact next action

Report the exact pushed takeover head to C00, then validate and
ancestry-merge only the exact F07 queue item. Do not read or integrate F02.

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
- Current takeover ready payload digest recomputed as
  `2baec3cd42b79c9156c2202e23792d0072cc2009185b9dc5fbc4be5e4d6918b0`.
- Merge payload digest recomputed as
  `39e877291294ccb17eb773beedbc7b17a7a85d0e18079841908c35687267abe8`.
- All 200 locked Git blobs and all 15 source-package Git blobs passed SHA-256
  verification.
- Rebased merge entry, expected target, source base, merge base, task state and
  handoff, and all six interface artifact digests matched.
- F01 is an ancestor of merge commit
  `34718371ee0ff26758120b11d0d4b788aa11be97`.
- `npm ci`: passed against the committed lockfile.
- `npm run typecheck`: passed.
- Focused F01 smoke: passed server registration/pre-mount duplicate rejection,
  client role resolution/duplicate rejection, sequential worker
  execution/duplicate rejection, and steward-schema parse/invariants.
- Remote control head matched
  `beb72be5ba1f993c1806e9314146e88f951affdb`; remote integration head matched
  `80c281b7ae5826ed2c6abe95ba68a033ffa52174`.
- Resume claim, expected branch head, three writer slots, and lease matched the
  C00-issued takeover; no live foreign writer or ref change was present.

## External effects

No external-effect authority was requested or used. Attempted: 0; succeeded: 0;
reconciled: 0.

## Security, privacy, and data handling

No secrets, provider payloads, learner data, URLs, or bearer material were
accessed or recorded.

## Blockers, deviations, and recovery

No blocker or deviation is present. The verified source merge is recoverable at
`34718371ee0ff26758120b11d0d4b788aa11be97`; its pushed pre-verification
checkpoint is `201bf33a9ba532c696432c707145a798d1f07f9f`. The exact
pre-takeover integration head is
`80c281b7ae5826ed2c6abe95ba68a033ffa52174`.
