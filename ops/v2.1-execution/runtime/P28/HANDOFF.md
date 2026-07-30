# P28 Handoff

## Identity

- Branch: `codex/v21-p28-communication-foundation`
- Start SHA: `9ba92b070eedfa3756eff4f78fd328de72507a96`
- Implementation SHA: `83355a7b6981073662d71f44a2c8f68264a307d8`
- Interface metadata head: `aaedc3f2ec0a857658c943ea6e00dc6c1e97c46c`
- Final ready-for-review head: derive with `git rev-parse HEAD`; C00 records the pushed head
- Expected pre-claim head: `f891f16eb13593d0eb3bbe53c076513d12b07c23`
- Task packet digest: `3fd5a9c080e3a7695a415dc6fc289d095ad662d6ccfa598910f73014cf38c823`
- Context digest: `96152f74273391337a3c6b8dd576829e7ddf9467cc867fb3b35ec4cf2c3cc18c`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `42599e59-5e65-4269-b3d1-d10632342be6`
- Writer: `codex-p28-worker-42599e59`
- Containing control authorization: `85100180449bf234a93f107eb66a1f7bc635b4f0`
- Ready-entry state basis: `fe95eacb2a958ba043cc9f89c1c27e09e20b9324`
- Ready-entry digest: `48da940a881f37fe700d478fa1c34ae86a33fbaf2c10d000624b71c444711e6b`
- COMMUNICATION_FOUNDATION lease: `ac74a2a9-b988-418a-b429-fefb5feeeb37`
- Lease issued: `2026-07-30T04:01:19Z`
- Lease expiry: `2026-07-30T06:01:19Z`
- Effect locks: none

## Active atomic steward claim

P28 has claimed only immutable request `P17-REMINDER-ROUTING-001`, canonical
request digest
`c6015bb11b581333946e8e9de6e3676d108ed327d52ee1894f355ab921da14cf`,
from integrated P17 head
`78af71603713b6fc73fe755995bdf56193eb199a` and request-container blob
`bec8dc31dbe5d79a26434a7219d4d8696cf15f01`. The evaluated target is the exact
pre-claim P28 head `f891f16eb13593d0eb3bbe53c076513d12b07c23`.

This checkpoint changes only P28 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. All product, contract, interface, test, and steward-request
bytes remain unchanged. Routing implementation has not started.

## Completed behavior

P28 now provides the versioned communication-foundation interface and its
domain, parameterized persistence, desired-state, canonical registry, and
worker boundaries. Exact Rabbi/office/brand/Resend sender truth, all
suppression gates, the four-value reminder preference, email-first dormant
WhatsApp behavior, Admin-only sanitized Communications Review, governed
Start/Pause requests, adult-only public website lead capture, and P29/P30
workflow-fragment validation are implemented.

The registry keeps OT-11 retired/reserved, restores OT-12 to adult support,
reserves OT-14/OT-15 for their exact purposes, and assigns OT-B01 to the
website bot without reusing the historical Complete Signup provider ID.
Provider-ID-empty entries remain non-executable pending separately authorized
realization and save/reopen readback.

## Interface checkpoint

- State: `interface_ready`
- Semantic version: `1.0.0`
- Artifact: `packages/contracts/src/communications/foundation/index.ts`
- Artifact SHA-256: `4c0bac7bb722590d039dcbefae02e1194e6b36350d8a5059cc27af29aa07b5d3`
- Contract digest: `2b8b685495e654dd1369a55086d8709f9612df26f042db676df9f0560a606c86`
- Downstream tasks: P29, P30

## Remaining work

C00 must reconcile this atomic resume claim. Only after explicit continuation
may P28 inspect or modify its owned communication-foundation paths for the
bounded P17 reminder-routing request.

## Exact next action

Push this three-file atomic claim, report its exact head, and stop until C00
reconciles claim `42599e59-5e65-4269-b3d1-d10632342be6`. Do not implement
routing before that reconciliation.

## Coverage

- Requirements: nine assigned, implementation verified
- Acceptance cases: ten assigned, task-owned assertions passed

## Changed files and migrations

- `ops/v2.1-execution/runtime/P28/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P28/HANDOFF.md`
- `ops/v2.1-execution/runtime/P28/NEXT-PROMPT.md`
- Migrations: none

## Verification

- 32 focused assertions in five files: passed
- Full TypeScript typecheck: passed
- Focused ESLint and new-file Prettier checks: passed
- Canonical YAML source parsing and identity assertions: passed
- Interface artifact/contract digests and diff check: passed
- Terminal verification against the clean pushed interface head: passed
- Generated registry projection checks: expected stale-projection failure,
  stewarded by `P28-registry-projection-001`

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0. No provider or
effect lock exists.

## Security, privacy, and data handling

No secrets, provider payloads, learner data, URLs, bearer material, live sends,
workflow mutations, enrollments, or deployments were accessed or performed.

## Blockers, deviations, and recovery

No implementation blocker. Applied migration, central registration, generated
registry projections, shared message-class coverage, and validator semantics
are explicitly requested in `P28-migration-001`, `P28-registration-001`, and
`P28-registry-projection-001`. Recovery base is implementation commit
`83355a7b6981073662d71f44a2c8f68264a307d8`.
