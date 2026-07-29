# I36 F01/F04/F05 Full-Integration Release

## Identity

- Branch: `codex/v21-integration`
- Reconciled claim head:
  `fd53e789623dfb070d62c5bfd17b18ed37a4a262`
- Reconciliation authorization:
  `a20241476ce5491ce9066cb0ee0ed12f12d53da4`
- Sole reconciliation parent:
  `a505c0bdf39891810becf8a011306cef89eadc87`
- READY I36 digest:
  `5103960074b68850afdd64c58960276a278de7b6fc76ed84d1bc81b781202a96`
- Claim: `257056a3-d401-4f0f-bd90-e032d855ee3e`
- RELEASE_INTEGRATOR lease: `32382426-de6d-46c0-afb7-1157ef2f6a2e`
- Lease released: `2026-07-29T13:42:37Z`, before its
  `2026-07-29T14:24:01Z` expiry.
- Phase scope: `F01_F04_F05_full_integration_atomic_claim_only`
- Final metadata release head: derive with `git rev-parse HEAD`; C00 records the
  pushed remote head.

## Merge record

1. F01 source `b5344992a43a735a9c66047fecd83f951651de27`
   was ancestry-merged at `f8b5a1530152a4fd02ad05f6b2582d3d61a7901c`
   with first parent `fd53e789623dfb070d62c5bfd17b18ed37a4a262`.
2. F04 source `54a0ac28b51d271aacab60003451dbcc66ffcac8`
   was ancestry-merged at `375fabcd884c28302ed20762b1891560ea031a21`
   with first parent `f8b5a1530152a4fd02ad05f6b2582d3d61a7901c`.
3. F05 source `9174d845e1c04916e2f1884cfadfaef624ac6862`
   was ancestry-merged at `eb05db1f487a85ef66287d38641d1abf7ef3c0b7`
   with first parent `375fabcd884c28302ed20762b1891560ea031a21`.

All source refs, required merge bases, merge-after heads, canonical queue
digests, task/state-handoff digests, exact parents, source ancestry, and
13/4/3-path first-parent inventories passed. The total merged delta is exactly
the 20-path union authorized by the queue.

## Integrator correction

Focused ESLint found `parseUniqueCsv` was unused after the F01 retired-config
cleanup. I36 removed only that dead helper in the authorized
`packages/config/src/index.ts` path at
`c9e63ad339eafcec23697f6c317d873faf5532a8`.

## Verification

- Four focused F04/F05 Vitest files: 22 tests passed.
- Workspace TypeScript typecheck passed twice.
- Focused ESLint and CRLF-aware Prettier passed.
- Client production build passed.
- Exact merge-parent, ancestry, per-item scope, 20-path union, and diff hygiene
  checks passed.
- Repository secret scan passed across 2,912 text files.

F04/F05 migration and registration requests remain unapplied. No provider,
send, steward, migration, registration, or external effect was performed.

## Next action

C00 should reconcile the three exact merge heads, the integrator correction,
and the exact pushed metadata release head. I36 must stop after reporting this
checkpoint.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
