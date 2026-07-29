# P21 Atomic Residual-Correction Claim

## Exact identity

- Branch: `codex/v21-p21-content-publication`
- Rejected local and remote head:
  `29d3b94b5efb98ed9d8dcefa2f438aa2e9f546af`
- C00 authorization:
  `aff7a46e8efc1a9756b5b0ef543916eb51f3c906`
- Sole state-based acquisition parent:
  `d633726e427e659adf55d71d009919ae4f6b4dde`
- Canonical READY digest:
  `f0875254206ba39499fe3d21ad147ec252551aa4e25dcfb0f3f4c162fd237528`
- Claim: `eba3bd79-7a63-46fe-89eb-edace22f1a1e`
- Writer: `codex-p21-worker-eba3bd79`
- Active `CONTENT_PUBLICATION` lease:
  `d4c8a72c-7beb-40e9-93d4-73d4f3c62668`
- Lease expires: `2026-07-29T13:18:14Z`
- Effect-lock leases: none.

## Atomic-claim boundary

This commit may change only:

- `ops/v2.1-execution/runtime/P21/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P21/HANDOFF.md`
- `ops/v2.1-execution/runtime/P21/NEXT-PROMPT.md`

No product, test, request, steward, migration, registration, provider, send, or
external-effect action is authorized in this push.

## Bounded correction after reconciliation only

After C00 independently reconciles the exact remote atomic claim, P21 may:

- tie publication completion to the durable exact F05/F06 ProviderOperation and
  original pending outbox/canonical request so a successful readback cannot
  leave that original intent pending;
- require a repository-backed canonical governed
  occurrence/product/version/series lookup before attaching an exact,
  idempotent, constrained relation;
- require transactionally current Student, enrollment, access,
  service-account-consent, privacy, and revocation eligibility before creating
  any active assignment, library projection, Student notice, or adult notice;
  and
- add direct pending-outbox, invented-occurrence, and inactive/revoked-audience
  tests while preserving all passing behavior.

Only local ports and mocks are permitted. No live provider or external effect is
authorized.

## Exact next action

Push and remote-verify this three-runtime-file atomic claim, report its exact
head to C00, and stop. Do not begin the bounded correction until C00 publishes
an exact reconciliation authorization.
