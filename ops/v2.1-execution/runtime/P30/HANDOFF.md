# P30 Handoff

## Identity

- Branch: `codex/v21-p30-campaign-workflows`
- Start SHA: `49431959f58f284bdc13ca931acf09f980fc483a`
- Implementation SHA before this handoff metadata commit: `49431959f58f284bdc13ca931acf09f980fc483a`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the pushed head
- Task packet digest: `b8aa34e1cdbe02d65f496c2a22925e90ea2b835644ab895af1ff0f9eede9ba64`
- Context digest: `5dd28dbffec92036402b291b484dd537317d4c003406f979aecd71edcd770878`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `9c4e04b6-485c-4d91-aed4-40e2b8be9aab`
- Writer: `codex-p30-worker-9c4e04b6`
- Containing control authorization: `62db0bf0de280932b07cf86dd8e03501ca708229`
- Ready-entry parent control: `f0f7ea05f7c50f3ea64782ff107fbfd1c4486c24`
- Ready-entry digest: `2b0b3f114514f1661b3b07c18145826615770148e0d69ab8314c9f19e2d51f42`
- GHL_CAMPAIGNS lease: `e55a881a-4f1c-4667-9edb-1f5be1d9b492`
- Lease expiry: `2026-07-29T00:09:14Z`

## Completed behavior

Verified the exact repository, containing control head, authorized integration
start, absent branch, canonical ready-entry digest, package/task/context/source
digests, P28/P31 dependency bindings and ancestry, sole writer lease, and zero
effect locks. All 200 locked and 15 source-package Git blobs matched. Created
the isolated P30 branch from the exact start. This atomic checkpoint contains
only the three P30 runtime files; product implementation has not started.

## Remaining work

Implement the isolated P30 newsletter, former-member reactivation, and OT-16
conversion workflow fragments with exact audience, suppression, approval,
School exclusion, copy, schedule, and exit behavior. Create only a structured
P30 steward request if canonical registry registration is required.

## Exact next action

After C00 records this atomic claim head, inspect only the named P28/P31
dependency artifacts and P30-owned paths, then implement the smallest coherent
campaign-workflow contract with zero external effects.

## Coverage

- Requirements: three assigned and claimed; implementation not started.
- Acceptance cases: six assigned; none run.

## Changed files and migrations

- `ops/v2.1-execution/runtime/P30/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P30/HANDOFF.md`
- `ops/v2.1-execution/runtime/P30/NEXT-PROMPT.md`
- Migrations: none
- Steward requests: none

## Verification

- Exact remote repository/control/integration/branch identity: passed.
- Canonical ready-entry digest: passed.
- Locked/source/package/task/context digests: passed.
- P28/P31 dependency ancestry and artifact hashes: passed.
- Claim, GHL_CAMPAIGNS lease, and zero effect locks: passed.

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0.

## Security, privacy, and data handling

No secrets, provider payloads, customer or child data, live sends, workflow
mutations, enrollments, or deployments were accessed or performed.

## Blockers, deviations, and recovery

None. Recovery base is exact integration head
`49431959f58f284bdc13ca931acf09f980fc483a`.
