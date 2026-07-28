# P28 Handoff

## Identity

- Branch: `codex/v21-p28-communication-foundation`
- Start SHA: `9ba92b070eedfa3756eff4f78fd328de72507a96`
- Implementation SHA before this handoff metadata commit: `83355a7b6981073662d71f44a2c8f68264a307d8`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the pushed head
- Task packet digest: `3fd5a9c080e3a7695a415dc6fc289d095ad662d6ccfa598910f73014cf38c823`
- Context digest: `96152f74273391337a3c6b8dd576829e7ddf9467cc867fb3b35ec4cf2c3cc18c`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `16640fee-ca26-4885-9be7-14fb2baa682c`
- Writer: `codex-p28-worker-16640fee`
- Containing control authorization: `e847dd790ae2f99ae526b0edcbd41897474c8f18`
- Ready-entry parent control: `3cfe14a6e1171d002f7173c13776dc682fddd6a8`
- Ready-entry digest: `2801e38a195ad4c98ddd7305440bd3b67a21273118d0fc3865410ff0410b4285`
- GHL_REGISTRY lease: `f59eb149-ec9e-4d32-afd7-55ad5e32c899`
- COMMUNICATION_FOUNDATION lease: `d2cd17e1-c0d2-4dd9-ab21-62c1b2a24a30`
- Lease expiry: `2026-07-28T22:55:38Z`

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

Commit and push the interface checkpoint, rerun the exact final suite, release
both task-local leases, and publish `ready_for_review`.

## Exact next action

Push the metadata checkpoint whose implementation parent is `83355a7b`, run the
final focused suite plus typecheck/lint/digest/diff verification, then release
both leases in P28 metadata and push the terminal checkpoint.

## Coverage

- Requirements: nine assigned, implementation verified
- Acceptance cases: ten assigned, task-owned assertions passed

## Changed files and migrations

- Six P28-owned implementation roots, including the canonical workflow registry
- `ops/v2.1-execution/runtime/P28/INTERFACE-CHECKPOINT.yaml`
- Three structured steward requests under `runtime/P28/steward-requests/`
- P28 task state, handoff, and next prompt
- Migrations: none

## Verification

- 32 focused assertions in five files: passed
- Full TypeScript typecheck: passed
- Focused ESLint and new-file Prettier checks: passed
- Canonical YAML source parsing and identity assertions: passed
- Interface artifact/contract digests and diff check: passed
- Generated registry projection checks: expected stale-projection failure,
  stewarded by `P28-registry-projection-001`

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0.

## Security, privacy, and data handling

No secrets, provider payloads, learner data, URLs, bearer material, live sends,
workflow mutations, enrollments, or deployments were accessed or performed.

## Blockers, deviations, and recovery

No implementation blocker. Applied migration, central registration, generated
registry projections, shared message-class coverage, and validator semantics
are explicitly requested in `P28-migration-001`, `P28-registration-001`, and
`P28-registry-projection-001`. Recovery base is implementation commit
`83355a7b6981073662d71f44a2c8f68264a307d8`.
