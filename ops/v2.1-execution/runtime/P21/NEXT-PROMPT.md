MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: INDEPENDENT_AUDIT

Independently audit One Time v2.1 task P21 at its exact superseding remote
ready-for-review head.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p21-content-publication
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P21.yaml
Task context: ops/v2.1-execution/contexts/P21-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P21/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P21/HANDOFF.md

Rejected final:
`29d3b94b5efb98ed9d8dcefa2f438aa2e9f546af`.
Residual-correction claim:
`cc7e7439ba3567969cb12e3e4b7f0c01af276f93`.
C00 reconciliation:
`fec562171cc5f049b3b0626d2ba95e45d8da87f6`.
Sole acquisition parent:
`6209cee92ae59c12b431dcf399e50be4392d538c`.
Corrected implementation:
`7878b60fc72a17a7a6aeccc237c44141e2d5ec9b`.
Artifact aggregate:
`0ed47d3fc00de0f5e2660ebd857cbb128ac8fe70f7ebf7e7390cb4770cd5132d`.
Request payload:
`fb372a6d329ddde76952f5637e351ba2990e15589e9c37f957e06e4eedf9bdf3`.
Request aggregate:
`3967bfc144214ab517d8df1b2c70a537b1c7fa92aafef019ccfc9f43917d7d81`.
Claim:
`eba3bd79-7a63-46fe-89eb-edace22f1a1e`.
Released CONTENT_PUBLICATION lease:
`d4c8a72c-7beb-40e9-93d4-73d4f3c62668`, released
`2026-07-29T12:32:56Z` before expiry `2026-07-29T13:18:14Z`.

Recompute the exact final remote head and sole-parent chain, all 17 artifact
Git-blob hashes and aggregate, steward-request payload and aggregate, and exact
owned scope. Re-run the five focused files, workspace typecheck, focused
lint/format, diff hygiene, provider-mutation/reference scan, and secret scan.

Audit specifically:

1. the accepted durable F05/F06 ProviderOperation and original pending P21
   outbox are locked and exactly bound to the same operation, registry/account,
   product, content version, publication generation, idempotency key, canonical
   request, acceptance digest, and reconciliation digest;
2. publication, all assignments/projections/notices, exact operation and outbox
   completion, and receipt are one transaction with fail-closed rollback;
3. occurrence governance comes from the repository-backed active canonical
   product/occurrence/version/series row before exact idempotent attachment; and
4. transactionally current Student/enrollment/access/service-account-consent/
   privacy/revocation eligibility is required before every active assignment,
   projection, Student notice, or adult notice.

Confirm direct pending-outbox, invented-occurrence, inactive-audience, and
revoked-audience regressions, and confirm all earlier approval/readback/grant/
unpublish/archive/denial/search/resume/privacy/concurrency behavior remains
passing.

No live provider inspection or effect is authorized. Do not inspect or mutate a
provider, send anything, apply P21-registration-001, or change a migration or
shared registration. If the head passes, report it to C00/I36 for serialized
admission. If it fails, identify the exact immutable head, path, invariant, and
smallest bounded correction authorization required.
