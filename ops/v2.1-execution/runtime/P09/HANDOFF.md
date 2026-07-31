# P09 School-Seat Authority Convergence — Atomic Claim

## Exact identity

- Branch: `codex/v21-p09-school-inquiry`
- Pre-claim local/tracking/live head:
  `a64a0c03edb6ae50023011f470358e9214f1196c`
- Pushed control authorization:
  `fdcba89094f6b8f9460db3d41f3602be2d476990`
- READY state basis:
  `ce71f41af1c70f689db9b3346ae5dfc643a1344f`
- Authorized integration head:
  `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`
- Canonical READY digest:
  `3e3462d65c63269f5623251cbb4f65b0808b20b11fc37c12a38ebf616798cc0c`
- Claim: `129aacb2-3e46-484f-94c1-1b2122b62950`
- Writer: `codex-p09-seat-convergence-129aacb2`
- SCHOOL_INQUIRY lease:
  `5238d22d-51eb-4f74-9cec-a0bf337cc72f`
- Lease issued `2026-07-31T03:48:00Z`; expires
  `2026-07-31T05:48:00Z`.
- Phase scope:
  `P09_P10_school_seat_authority_convergence_request_atomic_claim_only`
- Effect locks: none.

The exact atomic-claim commit is derived with `git rev-parse HEAD` after this
runtime checkpoint is committed. It is intentionally not amended into its own
contents; C00 must read and bind the pushed remote head.

## Complete READY readback

The fetched remote control entry was recomputed from its canonical recursively
sorted JSON payload and matched its sibling digest exactly. Task packet
`191ac9febfbd715a7d97c3a882305ec0ea332023f95f74f3be254265bcdbcbe8`,
context
`a79a242f32c782ee37ffe345b419a443e5ce22dacec10b2390958456fc8cfece`,
package lock
`fc85161d1af76b48f66ffcda334c4e5c56d36f5bfd4b94af11345979f6a7dac2`,
and source package
`10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
all match the issued READY.

Dependency readback is exact:

- I36 terminal is `d89a0f38…`, with sole parent `2e62d79d…`, tree
  `56dc54f5…`, state/handoff digest `8c1a2e89…`, runtime-triplet digest
  `163295a6…`, released lease, and effects `0/0/0`.
- P09 source head is `a64a0c03…`, is an ancestor of `d89a0f38…`, and binds
  the prior immutable `P09-migration-001` raw digest `f6612a8c…`.
- P10 remains at `5fccc345…`, binds immutable `P10-MIGRATION-001` digest
  `33dbeedf…` and Git blob `6470da05…`, and receives no READY.
- Immutable schema predecessors 2241 and 2249 match the READY raw digests and
  Git blobs.

## Claim-only boundary

This checkpoint records only the READY, fresh claim/writer, active lease,
dependency readback, and mandatory C00 stop. It changes exactly:

- `ops/v2.1-execution/runtime/P09/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P09/HANDOFF.md`
- `ops/v2.1-execution/runtime/P09/NEXT-PROMPT.md`

It does not create `P09-migration-002`, allocate an ordinal, write SQL, edit
product code, mutate P10 or shared control, apply or acknowledge a request,
integrate, freeze a candidate, inspect or mutate a provider, deploy, send,
charge, or perform any external effect. The prior implementation, tests,
`P09-migration-001`, `P09-registration-001`, migration 2249, and P10 bytes are
unchanged.

This READY grants no latent later request authority. Only a separate C00
control commit that reconciles the exact pushed claim head may authorize the
request-only phase.

## Exact next action

C00 must independently verify the pushed head has sole parent `a64a0c03…`,
exactly the P09 runtime triplet, the issued claim/lease/bindings, preserved
product/request/P10 bytes, and effects `0/0/0`. P09 then remains stopped until
C00 issues a separate exact authorization.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider
inspection or mutation, message, enrollment, migration application, deployment,
DNS, billing, or other live effect occurred.
