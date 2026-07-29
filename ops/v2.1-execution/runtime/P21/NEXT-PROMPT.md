MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: RESUME_AFTER_C00_RECONCILIATION

Resume One Time v2.1 task P21 only after C00 has independently reconciled the
exact remote atomic residual-correction claim.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p21-content-publication
Authoritative control ref: origin/codex/v21-control
Task state: ops/v2.1-execution/runtime/P21/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P21/HANDOFF.md

Rejected final:
`29d3b94b5efb98ed9d8dcefa2f438aa2e9f546af`.
C00 authorization:
`aff7a46e8efc1a9756b5b0ef543916eb51f3c906`.
State-based acquisition:
`d633726e427e659adf55d71d009919ae4f6b4dde`.
READY digest:
`f0875254206ba39499fe3d21ad147ec252551aa4e25dcfb0f3f4c162fd237528`.
Claim:
`eba3bd79-7a63-46fe-89eb-edace22f1a1e`.
CONTENT_PUBLICATION lease:
`d4c8a72c-7beb-40e9-93d4-73d4f3c62668`, expiring
`2026-07-29T13:18:14Z`.

Before changing product or tests, fetch and require:

1. the exact remote branch head equals the atomic claim reported to C00;
2. C00 has published an exact reconciliation/control authorization for that
   head with its sole acquisition parent; and
3. the same claim and lease remain active and unexpired with zero effect locks.

If any check fails, stop.

After reconciliation only, implement exactly these bounded residual fixes:

- durable exact ProviderOperation/original-outbox completion bound to the
  canonical request, so canonical readback completion cannot leave the original
  pending intent;
- repository-backed canonical governed occurrence/product/version/series lookup
  before exact idempotent constrained relation attachment;
- transactionally current Student/enrollment/access/service-account-consent/
  privacy/revocation audience eligibility before any active assignment, library
  projection, Student notice, or adult notice; and
- direct pending-outbox, invented-occurrence, and inactive/revoked-audience
  tests.

Preserve passing behavior. Use local ports and mocks only. Do not apply a
migration or steward request, change shared registration, inspect/mutate a live
provider, send anything, claim an effect lock, or perform any external effect.
Run focused tests, typecheck, lint, format, exact scope/diff checks, digests,
release the lease, publish a superseding ready-for-review final, remote-verify,
and report the exact head to C00.
