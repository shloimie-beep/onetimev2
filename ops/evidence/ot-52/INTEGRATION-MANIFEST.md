# OT-52P Integration Manifest

## Feature-Local Modules

- Contracts: `packages/contracts/src/portals/index.ts`
- Domain services: `packages/domain/src/portals/services.ts`
- Repository: `packages/db/src/portals/repository.ts`
- Migration: `packages/db/migrations/1500_ot52_portal_households_learners.sql`
- Routers: `apps/web/src/server/features/portals/routers.ts`
- UI: `apps/web/src/client/features/portals/PortalFeatures.tsx`

## Not Mounted

- No edits to `apps/web/src/server/app.ts`.
- Parent and student routers are exported only.
- UI components are exported only.
- Existing public and CRM bundles continue to build and test.

## Required Future Wiring

- Auth session to `PortalActorContext` resolver.
- CSRF verifier from the eventual portal session.
- Parent/student route mounts.
- Provider-safe class/content/progress adapters.
- Credential lifecycle adapter.
- Helper adapter.
- Support confirmation/send adapter.

## External Mutation Count

- Production/external sends: `0`.
- Production database migrations: `0`.
- Deployments: `0`.
