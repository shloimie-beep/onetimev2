# P29 Handoff

## Identity

- Branch: `codex/v21-p29-core-workflows`
- Start SHA: `49431959f58f284bdc13ca931acf09f980fc483a`
- Claim checkpoint: `704435bdd00c175e36d2946872784ded7ab09cf4`
- Implementation SHA: `0a42c8701d75d2a15e59c5e7a2f4a3e5d7fb0d18`
- Final ready-for-review head: derive with `git rev-parse HEAD`; C00 records the pushed head
- Task packet digest: `f32a6fae95aa2b14f58c3bdfd17a5639580d049e5daa369ee8dcc43173197b20`
- Context digest: `0e9928a67c5f82b97ff1ef54802e90334c7d7958bc0a4f9349b2534fc603fa27`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `6b96052a-b3f4-429f-9aab-3cbc8ec78e7e`
- Writer: `codex-p29-worker-6b96052a`
- Consumed-claim control authorization: `9a3b4856edb82556eca38416b853d6bdff5ef8bf`
- Ready-entry parent control: `f0f7ea05f7c50f3ea64782ff107fbfd1c4486c24`
- Ready-entry digest: `193b50e837b10a2e9890d909c6295e5801aab9757102425bdb5175d7d92f3efc`
- GHL_CORE_WORKFLOWS lease: `76d9c9a9-554e-4c3a-83f8-52d30002ca36`
- Lease expiry: `2026-07-29T00:09:14Z`
- Lease released: `2026-07-28T23:36:30Z`

## Completed behavior

P29 now provides all 12 assigned OT-01 through OT-10 and OT-13 lifecycle
workflow definitions, the versioned P29 HighLevel fragment, exact approval and
source-of-truth gates, adult-only household-scoped planning, deterministic
idempotency, suppression rechecks, saved/reopened drift comparison, and a
durably fenced worker adapter.

The implementation pins the exact signup cutover and migration audience,
preserves the P28 canonical registry identities, keeps OT-02B paused until
explicit Admin start and opt-in, leaves every Student interaction in One Time,
keeps WhatsApp dormant, keeps secure setup tokens in Resend, uses the four exact
P31 copy IDs, and performs no direct financial or access mutation.

## Remaining work

P29-owned implementation and verification are complete. C00/I36 must integrate
the exact ready-for-review head and adjudicate `P29-registration-001`,
`P29-registry-projection-001`, and `P29-config-001`. Provider configuration,
save/reopen readback, sandbox/canary evidence, publication, enrollment, and
delivery remain later separately authorized work.

## Exact next action

C00 and I36 validate the pushed P29 `ready_for_review` head, integrate it, and
adjudicate the three steward requests without enabling provider effects.

## Coverage

- Requirements: 12 assigned, implementation verified
- Acceptance cases: 12 assigned, task-owned assertions passed
- Focused assertions: 29 passed

## Changed files and migrations

- `apps/worker/src/runners/ghl-workflows/core/**`
- `integrations/highlevel/v21/workflow-fragments/P29-core-lifecycle.yaml`
- `packages/domain/src/communications/workflows/core/**`
- Three structured steward requests under `runtime/P29/steward-requests/`
- P29 task state, handoff, and next prompt
- Migrations: none; the registration request reuses stewarded P28 communication persistence

## Verification

- 29 focused assertions in two files: passed
- Full TypeScript typecheck: passed
- Focused ESLint and Prettier: passed
- P28 canonical registry parity for 12 workflow identities/states/senders/classes/triggers: passed
- Secret scan and diff check: passed

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0.

## Security, privacy, and data handling

No secrets, customer records, provider payloads, bearer URLs, Student contacts,
live messages, workflow mutations, enrollments, publications, billing changes,
access changes, deployments, or external effects were accessed or performed.

## Blockers, deviations, and recovery

No implementation blocker. Shared composers, persistence bindings, generated
projections, validator semantics, and configuration are explicitly stewarded.
Recovery base is implementation commit
`0a42c8701d75d2a15e59c5e7a2f4a3e5d7fb0d18`.
