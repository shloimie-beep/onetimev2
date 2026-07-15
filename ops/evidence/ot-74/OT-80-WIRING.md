# OT-80 Wiring Instructions

OT-74 leaves all hooks unmounted by design.

## Server

1. Import `createOt74AudienceReconciliationRouter` from `apps/web/src/server/features/audience-reconciliation/router.ts`.
2. Import `createPostgresLegacyAudienceRepository` from `packages/db/src/audience-reconciliation/repository.ts`.
3. Construct the repository with the existing `DbPool`.
4. Provide guards:
   - `loadSession(req)` returning `{ sessionKey, actor: { accountKey, productKey, userKey, role } }`.
   - `verifyCsrf(req, session)` using the accepted CRM/session CSRF verifier.
5. Mount only after OT-80 approval, for example under `/api/v1/audience-reconciliation`.

## Client

1. Import `AudienceReconciliationPanel` from `apps/web/src/client/features/audience-reconciliation/AudienceReconciliationPanel.tsx`.
2. Fetch `/contracts` for segment contracts and `/dry-runs` for summary-only dry-run responses.
3. Keep upload/import UI synthetic or explicitly approved until a later production import gate.
4. Do not trigger sends from segment labels. All OT-74 segment contracts are no-send contracts.

## Database

Run migration `1200_ot74_legacy_audience_reconciliation.sql` through the existing migration runner in a non-production test or CI environment before mounting.

## Must Not Do In OT-80 Without Separate Approval

- Ingest real spreadsheets.
- Send migration campaigns.
- Grant class or portal entitlement to school submissions.
- Merge contacts by name alone.
- Delete contacts as rollback.
- Enable provider/network sends.
