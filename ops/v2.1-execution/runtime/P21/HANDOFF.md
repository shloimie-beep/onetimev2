# P21 Superseding Ready-for-Review Handoff

## Exact identity

- Branch: `codex/v21-p21-content-publication`
- Rejected final: `29d3b94b5efb98ed9d8dcefa2f438aa2e9f546af`
- Residual-correction claim:
  `cc7e7439ba3567969cb12e3e4b7f0c01af276f93`
- C00 reconciliation:
  `fec562171cc5f049b3b0626d2ba95e45d8da87f6`
- Sole acquisition parent:
  `6209cee92ae59c12b431dcf399e50be4392d538c`
- Corrected implementation: `7878b60fc72a17a7a6aeccc237c44141e2d5ec9b`
- Consumed READY digest:
  `f0875254206ba39499fe3d21ad147ec252551aa4e25dcfb0f3f4c162fd237528`
- Claim: `eba3bd79-7a63-46fe-89eb-edace22f1a1e`
- Released `CONTENT_PUBLICATION` lease:
  `d4c8a72c-7beb-40e9-93d4-73d4f3c62668`
- Lease released: `2026-07-29T12:32:56Z`, before
  `2026-07-29T13:18:14Z`
- Artifact aggregate:
  `0ed47d3fc00de0f5e2660ebd857cbb128ac8fe70f7ebf7e7390cb4770cd5132d`
- Steward-request payload:
  `fb372a6d329ddde76952f5637e351ba2990e15589e9c37f957e06e4eedf9bdf3`
- Steward-request aggregate:
  `3967bfc144214ab517d8df1b2c70a537b1c7fa92aafef019ccfc9f43917d7d81`

## Residual correction

P21 now closes the three remaining transaction-bound truth gaps:

- publication completion locks the accepted durable F05/F06 ProviderOperation
  and its original pending P21 outbox. The operation id/version,
  registry/account binding, product, content version, publication generation,
  idempotency key, canonical request hash, acceptance digest, and optional
  reconciliation digest must all agree;
- the publication record, versioned assignments, library projections,
  Student/adult protected notices, ProviderOperation accepted-to-complete
  transition, original outbox pending-to-complete transition, and exact
  completion receipt commit in one transaction. Any mismatch rolls everything
  back, so a canonical readback cannot leave the original intent pending;
- occurrence attachment first locks a repository-backed active governed
  occurrence and exactly matches its product, occurrence version, and canonical
  series. Caller-invented or mismatched governance is rejected before the
  idempotent constrained relation is attached; and
- each requested audience member is matched against a transactionally locked
  current eligibility row for exact content/publication, household/adult
  recipient, Student, enrollment, access, service-account consent, privacy, and
  revocation versions and states. Missing, stale, inactive, unaccepted,
  privacy-held, or revoked truth prevents every active assignment, projection,
  Student notice, and adult notice.

All earlier approval evidence, canonical private/available readback, Student-only
grant, Parent/sibling denial, unpublish generation invalidation, separate
archive, search, resume, privacy, and optimistic-concurrency behavior remains
covered and passing.

## Structured request

`P21-registration-001` was strengthened for the required forward-only tables,
locks, constraints, and I36/F05/F06 composition. It remains `proposed`; P21 did
not apply a migration or steward request and did not change shared registration.

## Verification

- 5 focused files / 15 deterministic tests passed.
- Workspace TypeScript typecheck passed.
- Focused ESLint and Prettier passed.
- Exact owned scope and `git diff --check` passed.
- Provider-mutation/reference scan passed; the only URL match is the deliberate
  unsafe-URL negative test fixture.
- Secret scan passed across 2898 repository text files.
- All 17 implementation/test Git-blob hashes and aggregate reproduced.
- Structured-request payload and aggregate reproduced.
- No known baseline failure was encountered.

## External effects

Authority was `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider
was inspected or mutated, nothing was sent, and no effect lock was claimed.

## Exact next action

C00 should independently audit the exact superseding remote head, sole-parent
chain, bounded correction scope, artifact/request digests, transaction and
regression evidence, lease release, and zero-effect record. F02/I36 may later
evaluate the unapplied steward request under their own authority.
