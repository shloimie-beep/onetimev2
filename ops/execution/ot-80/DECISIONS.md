# OT-80 Decisions

## DEC-OT80-001 - Remote Heads Are Source Authority

OT80 follows the packet rule that fetched remote heads are authoritative.
Stale registry, state, or self-SHA metadata is evidence to reconcile, not a
whole-task stop gate.

## DEC-OT80-002 - Communications Archive Implemented Directly

No fetched remote ref or local OneTime worktree evidence contained the Day-One
communications ZIP hash or message-catalog hash during Phase 0. OT80 will
preserve the archive byte-for-byte as audit input and implement the reconciled
server-owned catalog directly unless a later refetch finds a safe descendant
implementation lane.

## DEC-OT80-003 - Staging Is Later, Isolated, And Gated

The input manifest authorizes isolated One Time staging after candidate gates.
It does not authorize production, root-domain DNS, live Stripe charges,
bulk/audience sends, real family/school/legacy sends, or real legacy-data
mutation.

## DEC-OT80-004 - OT74 Canonical Audience Path

OT74 arrived with two parallel audience implementations. OT80 keeps the
feature-local `audience-reconciliation` line as canonical because it includes
the legacy audience contracts, Postgres repository, dry-run idempotency,
rollback records, audit events, segment contracts, and explicit no-send
semantics needed for the final One Time convergence.

The generic `audience` import-preview line and migration
`1200_ot74_audience_reconciliation.sql` were rejected during OT80 integration
to avoid duplicate write paths. OT74 historical evidence remains preserved as
provenance, but product code now exposes only the legacy audience
reconciliation model.

## DEC-OT80-005 - OT72 Provider Truth Migration Renumber

OT71 already owns migration prefix `1700` through
`1700_ot71_account_lifecycle.sql`. During OT72 integration, OT80 renamed the
provider-truth migration from the source-lane name
`1700_ot72_provider_truth.sql` to `1800_ot72_provider_truth.sql`.

Active tests and OT72 integration references were updated to the `1800`
identifier. The frozen OT80 source-head inventory still lists the fetched
source-lane file name as provenance.

## DEC-OT80-006 - Server-Owned Day-One Communications Catalog

No source branch contained the Day-One communications archive or message-catalog
hashes, so OT80 implemented a server-owned catalog directly from the preserved
audit input.

Active delivery rendering is limited to committed Family acknowledgements,
consented Family WhatsApp acknowledgements, protected-link class reminders, and
internal owner/admin lead alerts. School submissions keep the public web
acknowledgement and internal lead alert only; School public email and WhatsApp
receipt filters/sends were removed from active delivery surfaces.

Class reminders now require a protected One Time application route. Missing or
unsafe protected links skip the delivery rather than leaking a raw provider URL
or making a false access-ready claim.

## DEC-OT80-007 - OT73 Landing Addendum Preserved With Communications Copy

The newer OT73 corrected addendum restores the moving free-until-Rosh-Hashanah
ticker and removes the separate hero price/trial/no-card promotion. OT80 keeps
that direction, including self-hosted DM Serif Display assets and the public
landing copy/layout changes.

The Day-One communications decision remains authoritative for signup success
and delivery semantics. Family and School success copy stays domain-owned in
`successCopy()`, and School submissions remain public web acknowledgement plus
internal alert only. OT73 may change public presentation, but it cannot
reintroduce School public email/WhatsApp sends or imply immediate class access,
reminders, portal accounts, or Family messages for School inquiries.

## DEC-OT80-008 - OT75 Scope Validation Is Conductor-Aware

OT75's release validator is intentionally strict: on the standalone OT75 branch
it validates every changed file since the immutable OT60R base and rejects
runtime composition drift. In the OT80 conductor branch, that same comparison
includes already-merged OT71, OT72, OT73, OT74, and communications changes, so
an unscoped run is an expected false failure.

OT80 keeps the strict scope guard but adds an explicit `--scope-base` /
`OT75_SCOPE_BASE_SHA` override. The conductor run uses the first parent of the
OT75 merge commit as the scope base, validating only the OT75 contribution. The
standalone OT75 workflow and default CLI behavior remain unchanged.
