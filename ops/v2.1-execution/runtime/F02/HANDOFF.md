# F02 Lease A Atomic-Claim Handoff

## Identity

- Branch: `codex/v21-f02-schema-state-migrations`
- Atomic claim parent: `e4673ff1c2e621e26ac93034be245b280c4da4fa`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Authorized integration head: `26cbebdf828ba9ff485961adb4f90c460c2dbaf9`
- Containing control authorization: `7f6f3508e188dfa1334b39e3ff00904feab47a0b`
- Sole acquisition parent: `296b7002922504b10aa88f5bf6e8c9163ed10ec7`
- Canonical READY digest: `c470a17f3ddd334bb5c4ffa66f51a2e67d773bf937a95d09c9b267476b18f501`
- Claim: `dc6ba41d-f01a-43f5-b8d7-e43c6b8a7e54`
- Shared MIGRATION_AUTHORITY/SCHEMA_CONTRACT lease: `59450be9-031a-4db8-aec1-9a584ba04f2f`
- Lease interval: `2026-07-29T17:36:43Z` through `2026-07-29T18:51:43Z`

## Atomic-claim state

This checkpoint claims only the F02 runtime triplet for
`migration_lease_A_2235_2238`. It does not open requester bodies, edit
`MIGRATION-ALLOCATIONS-PROPOSAL.yaml`, or author migration SQL.

The entry-bound package, task, context, control, F02/I36 state-handoff,
allocation-proposal, and interface-checkpoint digests all match. The four
opaque plan bindings resolve at their exact task heads, Git blobs, request IDs,
and recorded raw or canonical-entry digests:

- F04: `F04-migration-001`, blob `96be444f…`, digest `b42fe840…`
- F05: `F05-MIGRATION-001`, blob `4707ff36…`, digest `450d1e4a…`
- P15: `P15-MIGRATION-001`, blob `b4569eb4…`, digest `076e781f…`
- F06: `F06-migration-001`, blob `d155c2a0…`, digest `06a329a0…`

No requester content was displayed or semantically inspected during claim
validation.

## Ordinal and lock state

Migration control reports `next_available_ordinal: 2235`; ordinal `2231`
remains forbidden. Migration `2234_canonical_state_machines.sql` retains
checksum `d1352c5e…`. Neither the exact F02 head nor the authorized integration
head contains a `2235`, `2236`, `2237`, or `2238` migration filename.

All 14 provider locks are unclaimed, READY contains no effect-lock lease, and
external effects remain attempted `0`, succeeded `0`, reconciled `0`.

## Exact next action

Stop after this atomic claim. C00 must reconcile the exact remote claim head
before F02 reads the four requester bodies, edits the allocation proposal, or
authors any SQL.

## Security and scope

No provider, credential, secret, customer data, persistent/shared database,
deployment, send, or external effect was accessed. Only `TASK-STATE.yaml`,
`HANDOFF.md`, and `NEXT-PROMPT.md` changed.
