# OT-74 Implemented

## Initial Packet

- Preserved the OT-74 prompt in `ops/execution/ot-74/ORIGINAL-PROMPT.md`.
- Recorded restart state in `STATE.json`.
- Recorded inputs, decisions, remaining work, test placeholder, integration
  boundaries, and resume instructions.

No app, package, migration, API, component, parser, or domain implementation has
started yet.

## Audience Reconciliation Candidate

- `packages/contracts/src/audience/schemas.ts` defines feature-local schemas
  for batches, normalized rows, source facts, suppression/consent,
  reconciliation decisions, segments, dry-run reports, and dry-run requests.
- `packages/domain/src/audience/parser.ts` maps CSV or worksheet-shaped
  normalized rows into provenance-preserving, hashed normalized rows.
- `packages/domain/src/audience/reconciliation.ts` derives match/manual-review
  outcomes, migration/school/no-contact/active-user segments, communication
  eligibility, and non-destructive rollback records without row contents in the
  report.
- `packages/domain/src/audience/dry-run.ts` exposes a feature-local dry-run
  report builder and counts-only summarizer.
- `packages/db/migrations/1200_ot74_audience_reconciliation.sql` creates
  audience import batch, row, segment assignment, reconciliation event, and
  rollback tables.
- `apps/web/src/server/features/audience/router.ts` provides an unmounted
  dry-run preview router for future OT80 wiring.
- `apps/web/src/client/app/audience/AudienceImportPreview.tsx` and
  `audience-import-preview.css` provide an unmounted counts/segment preview.
- `scripts/audience-reconciliation-dry-run.ts` only uses synthetic fixtures and
  writes counts-only OT74 evidence when `--write-report` is passed.
