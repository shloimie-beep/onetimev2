# OT-74 Implemented

## Initial Packet

- Added the OT-74 resumable execution packet.
- Registered OT-74 in `ops/execution/registry.json`.

## Remote Audience Line

- Added `packages/contracts/src/audience/schemas.ts`.
- Added `packages/domain/src/audience/dry-run.ts`, `parser.ts`, and `reconciliation.ts`.
- Added migration `packages/db/migrations/1200_ot74_audience_reconciliation.sql`.
- Added synthetic fixture support and dry-run script/evidence.
- Added unmounted `apps/web/src/server/features/audience/router.ts`.
- Added unmounted `apps/web/src/client/app/audience/AudienceImportPreview.tsx`.
- Added audience unit/integration tests.

## Legacy Audience Reconciliation Line

- Added additive migration `packages/db/migrations/1201_ot74_legacy_audience_reconciliation.sql`.
- Added feature-local contracts in `packages/contracts/src/audience-reconciliation/`.
- Added parser, mapper, dry-run reconciliation, segment/tag contracts, and counts-only formatter in `packages/domain/src/audience-reconciliation/`.
- Added Postgres repository in `packages/db/src/audience-reconciliation/`.
- Added unmounted server router in `apps/web/src/server/features/audience-reconciliation/`.
- Added unmounted CRM panel in `apps/web/src/client/features/audience-reconciliation/`.
- Added synthetic-only dry-run tool `scripts/ot74/audience-dry-run.ts`.
- Added OT-74 unit/integration tests.

No central app shell, central CRM entry, provider worker, root package, send, production import, or deployment wiring is included.
