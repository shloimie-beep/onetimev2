# P12 Interface Handoff

## Identity

- Branch: `codex/v21-p12-parent-household`
- Start SHA: `f1cecb5343cd1461ecd5c866ce7a9ad4a78c7635`
- Implementation SHA before this handoff metadata commit:
  `f1cecb5343cd1461ecd5c866ce7a9ad4a78c7635`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the
  observed pushed head.
- Task packet digest:
  `37a367f92ac2af2a1e9ef17ae97ec2caed3d80ea608d7bcbbeeb6ecc64a0c2bd`
- Context digest:
  `1b1bc9f0a0624836ba69e7c35acb2d70ea43f71347cb434be9796b307e418b73`
- Source package digest:
  `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `776c6b8b-8729-49ea-a9ca-f505fbaf320c`
- Writer: `codex-p12-worker-776c6b8b`
- Containing control authorization:
  `ab393d7eb3b7f55b910ba110949c05c40b7383e6`
- Ready-entry parent control:
  `3c4130ae4d015471ce21e7d70a39d98dde113318`
- Ready-entry digest:
  `9c85fefc71f18383c5bf674a35bce3c6026ebf6f844ed472376f77a866951c86`
- PARENT_HOUSEHOLD_UI lease:
  `992f62c1-faba-4709-bae6-6c201cc776b2`
- Lease issue / expiry:
  `2026-07-29T03:20:30Z` / `2026-07-29T04:20:30Z`

## Interface

- Implementation: `4299c6b828a23fdf79bdc976ab5630df3591ed00`
- Semantic contract: `1.0.0`
- Canonical digest:
  `6ba2fd50d2cbc20d8b4b9e403f66ca40586786d8ea8621c7d43933537165dbe7`
- Registration request digest:
  `501ae46b1ad26e933d2e15b4f13760f4c3c8ec93d2672dc7be0d7e372046e733`

## Completed behavior

Verified the exact repository, containing control authorization and acquisition
parent, authorized integration start, absent branch, canonical ready-entry
digest, package/task/context/source digests, F03/F04/F07 dependency bindings
and ancestry, sole writer lease, and zero effect locks. All 200 locked and 15
source-package Git blobs matched. Created the isolated P12 branch from the exact
start. This atomic checkpoint contains only the three P12 runtime files;
the P12 contract, domain aggregate, server transaction service, and client
workspace. Parent scope is household-bound; create/restore is revision and
seat-bound; lifecycle and credentials drive session/enrollment effects; and a
new password appears only in the immediate handoff.

## Remaining work

Implement the isolated Parent-only household overview and up-to-three active
Student-seat lifecycle, actual-name guidance, safe username/password reset,
archive/reactivation limits, household isolation, and Parent-only authority.
Publish the required P12 interface checkpoint before downstream P13 starts.

## Exact next action

Push the exact interface checkpoint, complete final scope/secret/diff checks,
then release the lease and publish the clean ready_for_review final.

## Coverage

- Requirements: seven implementation-ready.
- Acceptance cases: seven task-owned assertion sets passed.

## Changed files and migrations

- `ops/v2.1-execution/runtime/P12/HANDOFF.md`
- `ops/v2.1-execution/runtime/P12/NEXT-PROMPT.md`
- `ops/v2.1-execution/runtime/P12/TASK-STATE.yaml`
- Migrations: none
- Steward requests: none

## Verification

- Exact remote repository/control/integration/branch identity: passed.
- Canonical ready-entry digest: passed.
- All locked/source/package/task/context digests: passed.
- F03/F04/F07 dependency ancestry and bindings: passed.
- Claim, PARENT_HOUSEHOLD_UI lease, and zero effect locks: passed.
- Focused domain/server/client verification: 3 files and 11 tests passed.
- Workspace typecheck, focused ESLint, and focused Prettier: passed.

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0.

## Security, privacy, and data handling

No secrets, provider payloads, customer or child data, live sends, enrollment,
provider mutation, deletion, or deployment were accessed or performed.

## Blockers, deviations, and recovery

None. Recovery base is exact integration head
`f1cecb5343cd1461ecd5c866ce7a9ad4a78c7635`.
