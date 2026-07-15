# OT-74 Integration Manifest

## Initial Packet

- Shared OT-60R control files edited: no.
- Shared registry edited: no.
- OT-71 paths edited: no.
- OT-72 paths edited: no.
- Product code edited: no.
- External mutations: zero.

## Planned Feature-Local Paths

- `packages/contracts/src/audience/*`
- `packages/domain/src/audience/*`
- `packages/db/migrations/1200_*`
- `apps/web/src/server/features/audience/*`
- `apps/web/src/client/app/audience/*`
- `scripts/audience-*`
- `scripts/support/audience-*`
- `tests/unit/audience/*`
- `tests/integration/audience/*`
- `ops/evidence/ot-74/*`

Any deviation must be recorded here before commit.

## Implementation Candidate

- Shared OT-60R control files edited: no.
- Shared registry edited: no.
- OT-71 paths edited: no.
- OT-72 paths edited: no.
- `app.ts` edited: no.
- AppShell edited: no.
- Central CRM entry edited: no.
- Shared barrels edited: no.
- Root package files edited: no.
- Provider workers edited: no.
- Product code mounted: no.
- External mutations: zero.

## OT80 Wiring Instructions

OT80 may wire this foundation by:

1. Importing `createAudienceImportPreviewRouter` from
   `apps/web/src/server/features/audience/router.ts`.
2. Providing a scoped `loadExistingContacts(accountKey, productKey)` function
   that derives account/product from the authenticated One Time session, not
   from browser-controlled scope.
3. Mounting the router behind an authenticated admin-only route.
4. Importing `AudienceImportPreview` and
   `apps/web/src/client/app/audience/audience-import-preview.css` into the
   future authenticated CRM/audience route chunk only.
5. Preserving the OT74 no-send/no-import behavior until a later approved
   production import packet adds real spreadsheet ingestion and write gates.
