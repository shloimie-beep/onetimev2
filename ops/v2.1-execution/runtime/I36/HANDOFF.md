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
- Claim ID: `353f2868-2978-4cac-ac73-c56fa184f841`
- Writer: `codex-i36-worker2-353f2868`
- RELEASE_INTEGRATOR lease: `80afc839-dc09-4363-b440-d22757451415`
- Containing control head: `5217c299c2721a58bdb9ad1c1c0f68525008661a`
- Controller authorization / parent control state: `4d6bc306e542774b68179d9b440ceccd2d5b9967`
- Ready-entry payload digest: `02c03eb6b750186687cce74ea63c6546affd463973cf9dfbf7187914a9efe4e1`
- Lease expiry: `2026-07-28T19:50:38Z`
- F07 merge authorization: control `136f5f54520e44415c10b83108314fab4503a42e`,
  item digest `fc8a9a3401d327d21bf1c716bcecb63323436031ff893b40221b7bdff052d6c0`
- Pushed F07 integration head: `91349fc1fa9a474ae31cf408ae0364aa10520385`
- P31 merge authorization: control `d9bb5fd42ad43ccb121d2d749f6176908cac8e9a`,
  item digest `7a7373c66621981772391947f00778fec9ded1726b8f0b5068cf46cc7aa66c32`
- Pushed P31 integration head: `42b09dc598e0dfc17ada53b441e4cd487e126573`
- F02 merge authorization: control `e8e1cfe8b69266535f3413e4cebe22c1b7ca1970`,
  item `95985f2c-410b-461b-9360-549591ef624e`, item digest
  `45e33d239f3d26a8e998ee6a82387d8e725e27b912ce8d988ade34e4cf83428e`
- Pushed F02 integration head: `e6b49dff79911f3f11b6d2c0ce6a9a52d50bf7f4`

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

The rebound F07 queue item was verified against exact target `7fabdac2`, source
base/merge base `80c281b7`, exact source `47a2bb6b`, its 12-path allowlist,
state/handoff digest, and all artifact digests. It was ancestry-merged and
pushed at `91349fc1fa9a474ae31cf408ae0364aa10520385`; typecheck and all
three focused F07 contract tests passed.

The two assigned immutable F01 steward requests were evaluated at exact F01
head `e8b172c6a7da5003a82cfc8663df6d4159fa4092` and exact integration
head `91349fc1fa9a474ae31cf408ae0364aa10520385`. Both request blob
digests matched. Both were rejected without product edits: the client request's
named HTML paths are absent while remaining retired public assets fall outside
its exact path list; the config request assumes an unmerged
`protectedPayloadEncryptionKey` compatibility state. Partial application or
copying the F01 implementation would violate the assigned immutable semantics.

C00 recorded those steward results and authorized a P31-interface-only resume
from exact integration head `1976033cfdae1beb249642f0e28f6824b0fcbb8b`.
The new claim, lease, containing control head, and canonical ready payload were
verified and are bound by this atomic claim checkpoint.

C00 rebound the P31 item to exact claim head `cd4bb17a`. I36 independently
verified source/merge base `80c281b7`, the exact 8-path delta, state/handoff
digest `6ec2a92d...`, all three exported artifact hashes, and combined contract
digest `d66db410...`. Exact source
`ba811b3b2682ab46de1859334f5aa4ad5d7f5f0d` was ancestry-merged and
pushed at `42b09dc598e0dfc17ada53b441e4cd487e126573`. Typecheck and focused
catalog/approval/security checks passed.

C00 authorized an F02-interface-only resume from exact integration head
`eefca0644e57dca48609682cbc3e1b01992d286d`. The containing control head,
parent control state, exact branch head, new claim/lease, phase scope, and
canonical ready payload were verified. C00 then rebound the exact F02 item to
claim head `f922c1de`. I36 independently verified source/merge base
`80c281b7`, the exact 10-path delta, state/handoff digest `b848936b...`, all
six artifact blob hashes, contract digest `c03e01d7...`, migration checksum
`d1352c5e...`, and zero external effects. Exact source
`e4673ff1c2e621e26ac93034be245b280c4da4fa` was ancestry-merged and
pushed at `e6b49dff79911f3f11b6d2c0ce6a9a52d50bf7f4`. Typecheck, focused
domain guard assertions, and the native PGlite PostgreSQL migration proof
passed.

C00 authorized a new F03/F04/F05-interface-only resume from exact integration
head `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`. The containing control head,
parent controller state, exact branch head, package/task/context/dependency
digests, 200 locked Git blobs, claim/lease, phase scope, zero effect locks, and
canonical ready payload were verified. This atomic checkpoint consumes only
that claim; it does not read the merge queue or any F03/F04/F05 source.

## Remaining work

Push and report this exact F03/F04/F05-interface-only claim checkpoint to C00.
Wait for C00 to rebind all three queued items to the exact resulting claim head.

## Exact next action

Report the exact pushed F03/F04/F05-interface-only claim head to C00, then
pause. Do not read or merge queued source until all three expected target heads
are rebound by C00.

## Coverage

- Requirements: none owned by I36
- Acceptance cases: none owned by I36

## Changed files and migrations

- `ops/v2.1-execution/runtime/I36/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/I36/HANDOFF.md`
- `ops/v2.1-execution/runtime/I36/NEXT-PROMPT.md`
- Exact allowlisted F01 interface delta at
  `fa9e5c92231c4b92340d07945cc91d76c85bd444`
- Exact allowlisted F02 interface delta at
  `e4673ff1c2e621e26ac93034be245b280c4da4fa`
- Migration: `packages/db/migrations/2234_canonical_state_machines.sql`

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
- Rebound F07 item digest recomputed exactly; the source delta, artifact
  contract, no-effect count, source ancestry, typecheck, and focused tests all
  passed.
- F01 request files at exact head `e8b172c6` hashed to the assigned
  `c0175c98...` and `b26b5b4b...` digests.
- Canonical rejected-result payload digests are
  `a86c6296a8a9acb6e94b52fa0e33a86be682a7d54061ff7d6640e1616c214f3a`
  and `a55f5be6369a8b2952a4a1eaa3961d94cc48f2117a3d5ad61ae2d7884585dd0f`.
- Rebound P31 item digest, exact source/base/allowlist, state/handoff, three
  artifact hashes, combined contract digest, and zero-effect count matched.
- `npm run typecheck` and focused P31 catalog/approval/security assertions
  passed after the ancestry merge.
- Rebound F02 item digest, exact source/base/allowlist, state/handoff, six
  artifact hashes, contract digest, migration checksum, and zero-effect count
  matched.
- F02 source is an ancestor of integration head
  `e6b49dff79911f3f11b6d2c0ce6a9a52d50bf7f4`.
- `npm run typecheck`, focused F02 domain guard assertions, and native PGlite
  PostgreSQL migration execution passed after the ancestry merge.
- Remote containing control and integration heads matched
  `5217c299c2721a58bdb9ad1c1c0f68525008661a` and
  `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`.
- Canonical ready-entry payload digest recomputed exactly as
  `02c03eb6b750186687cce74ea63c6546affd463973cf9dfbf7187914a9efe4e1`.
- All 200 locked Git blobs and the entry-bound package, source-package, task,
  and context digests matched.
- Claim, sole RELEASE_INTEGRATOR lease, phase scope, and zero effect locks
  matched the C00-issued authorization.

## External effects

No external-effect authority was requested or used. Attempted: 0; succeeded: 0;
reconciled: 0.

## Security, privacy, and data handling

No secrets, provider payloads, learner data, URLs, or bearer material were
accessed or recorded.

## Blockers, deviations, and recovery

The two immutable F01 requests are precisely blocked and rejected as described
above; no partial semantic change or out-of-scope path edit was made. The
verified F07 merge is recoverable at
`91349fc1fa9a474ae31cf408ae0364aa10520385`. The earlier F01 source merge is
recoverable at `34718371ee0ff26758120b11d0d4b788aa11be97`; its pushed
pre-verification checkpoint is `201bf33a9ba532c696432c707145a798d1f07f9f`. The exact
pre-takeover integration head is
`80c281b7ae5826ed2c6abe95ba68a033ffa52174`.
