# F02 Lease B Compatibility-Correction Atomic Claim

- Claim parent: `032aeb9cb0c786729ff2c394744ab561eeb3f6c1`
- Containing control: `9d53cf1c581dcb67e30b2beb62d048a1839f23e2`
- Sole control acquisition parent: `a6bc58cc4a35173fd1606124c0fa651dda2dac64`
- READY digest: `5011b9dd7fe5c1883e091b46b097d907d6aaa99669999f60b7554dc225e45134`
- Claim: `6b1e1632-e3d9-4f87-92b3-8b150a6715d2`
- Shared MIGRATION_AUTHORITY/SCHEMA_CONTRACT lease: `31e905c8-d5c2-4e3c-9e98-c2e8f78989ce`
- Lease expiry: `2026-07-30T01:23:18Z`
- Effects: `0/0/0`

The prior Lease B release was rejected for one compatibility semantic gate:
migration 2239 must preserve a sole paused or archived legacy canonical series
without forcing it to active lifecycle. The correction window must rerun the
native sole-paused and sole-archived probes plus both complete 75/75 migration
inventories while preserving protected migrations 2234 through 2238, the
exact ten-path ceiling, next ordinal 2245, and effects `0/0/0`.

This atomic claim changes only `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. The allocation proposal, migrations, product code, control,
provider state, and all external systems remain untouched.

Stop for C00 reconciliation. Do not edit SQL or the proposal, merge, register,
inspect providers, deploy, send, or perform external effects beforehand.
