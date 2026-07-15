# OT-80 Conflict Ledger

## OT-71

Merged `origin/codex/ot71-product-core-train` without conflicts.

Carried forward:

- OT-71 migration `1700_ot71_account_lifecycle.sql` is now present.
- OT-72 also has a `1700` provider-truth migration; OT80 must renumber the
  provider-truth migration during OT-72 integration.
- OT-71 Phase 6 combined proof/publication is pending and will be completed
  after all lanes converge.

Known required collision work from the OT80 packet:

- OT-71 and OT-72 both use migration prefix `1700`; provider-truth migration
  must be renumbered to the next stable free prefix during integration.
- OT-74 contains parallel audience/reconciliation implementations and two
  migrations; OT80 must choose or consolidate one canonical model and reject
  duplicate write paths.
- OT-75 must preserve OT-72 PostgreSQL teardown guard.
- OT-71 and OT-72 Telegram DB test overlap must be reconciled without weakening
  product isolation or provider-truth assertions.
- OT-71 and OT-73 public-page build changes must be reconciled so public,
  Parent, and Student pages build as isolated entries.
- Execution registry entries from OT-73, OT-74, and OT-76 must be merged
  semantically.
- OT80 must retain one auth/session/CSRF/MFA/capability system, one CRM API,
  one outbox, one delivery worker, one class/content model, and one
  Parent/Student portal model.
