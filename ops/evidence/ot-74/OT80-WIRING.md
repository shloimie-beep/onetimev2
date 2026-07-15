# OT80 Wiring Instructions For OT74

OT74 intentionally leaves all audience reconciliation hooks unmounted.

To wire in OT80:

1. Mount `createAudienceImportPreviewRouter` from
   `apps/web/src/server/features/audience/router.ts` behind an authenticated
   Admin-only route.
2. The router must receive a scoped `loadExistingContacts(accountKey,
   productKey)` implementation that derives scope server-side from the One
   Time session. Do not trust browser-provided account or product scope.
3. Import `AudienceImportPreview` from
   `apps/web/src/client/app/audience/AudienceImportPreview.tsx` only in the
   future authenticated audience/CRM route chunk.
4. Import `apps/web/src/client/app/audience/audience-import-preview.css` only
   with that route chunk.
5. Keep real spreadsheet ingestion disabled until a later approved production
   import packet adds explicit owner approval, suppression policy, rollback,
   and PostgreSQL 16 proof.
6. Preserve dry-run report behavior: counts and reasons only, no raw source row
   contents in UI, logs, reports, or PR evidence.
