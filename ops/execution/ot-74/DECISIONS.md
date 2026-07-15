# OT-74 Decisions

## DEC-OT74-001 - Keep OT74 Feature-Local

OT74 will avoid `app.ts`, AppShell, the central CRM entry, shared barrels, root
packages, provider workers, and OT-71/OT-72 paths. New code should live under
feature-local audience/import/reconciliation paths and remain unmounted until
OT-80.

## DEC-OT74-002 - No Real Audience Data

Only synthetic fixtures are allowed in tests and dry-run examples. The dry-run
tool must not ingest real spreadsheets during this task and must not print row
contents.

## DEC-OT74-003 - Non-Destructive Reconciliation

The model must preserve import provenance, ambiguous matches, consent,
suppression, communication eligibility, rollback records, and independent lead,
old-system, and active-legacy-user facts without destructive contact deletion.
