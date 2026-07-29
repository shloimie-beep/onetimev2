# P11 Retained-Credential Correction Atomic Claim

## Identity

- Branch: `codex/v21-p11-admin-operations`
- Exact rejected final: `17538da1ff15066c3e242567970062db4589577b`
- Rejected implementation:
  `17924328cdc820e3cc9a8928f0685b868df4df74`
- Containing authorization:
  `54df8a79e1d2beb0e2ea7289dcbd13617ed90197`
- State-based acquisition:
  `930b5ab55c1f7e40b1143a757417bee1ca9ae49e`
- READY digest:
  `daa56dabb6b8f3d28f7a4d23ce252143d51f8b8b08fbad35802ac9fedef34dcb`
- Claim: `95a4b423-1906-4b24-846b-c4f9d3c1c32a`
- Writer: `codex-p11-worker-95a4b423`
- ADMIN_OPERATIONS_UI lease:
  `c9c69acd-9df5-4411-9cbd-887f33f237f1`
- Lease window: `2026-07-29T10:44:39Z` through
  `2026-07-29T11:44:39Z`
- Phase scope:
  `P11_atomic_claim_retained_credential_binding_correction_only`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed remote head.

## Bound rejection

I36 independently reproduced all prior mechanical evidence but rejected the
exact final. `AdminSearchPage`, initial request, and recent-query state have no
credential-version binding. The component accepts them whenever authorization
state is `admin`, initializes its observed version to that new credential, and
clears mismatches only after render.

The exact read-only probe rendered both a retained private result and retained
recent query for an Admin credential version while the page contract carried
no credential version. The correction must bind retained search/request/recent
state and dashboard snapshots to the exact credential/session version and fail
closed synchronously when absent or non-current.

## Preserved evidence

- Prior implementation artifact digest:
  `3529decc4b00ab8991bb151a49914676104ae00bb39a0711f2c8596019352986`
- Unchanged request digest:
  `68a99cc059304f66570f2296a5872bfa379062ae854401c54c196ec12b56fa42`.
- Unchanged aggregate:
  `2327a180d429e131be3de3d65ada907ed964031496aa49b7eb2524bd797a7f8e`.
- F05 and F07 dependency heads and digests remain exact as recorded in
  `TASK-STATE.yaml`.

## Atomic checkpoint scope

This checkpoint changes only P11 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. No product, test, structured request, steward, registration,
provider, or effect file was edited.

## Next action

C00 must reconcile the exact pushed atomic claim head. P11 must stop after
reporting it and may correct product/tests only under a subsequent explicit
authorization.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.
