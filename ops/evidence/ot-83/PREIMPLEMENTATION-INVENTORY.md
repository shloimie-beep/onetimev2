# OT-83 Preimplementation Inventory

Base refs:
- OT81: `ff23c9af0c3e3de18cd991097eb6e66032b11546`
- OT82: `a8e4109b0530855bc7a5f56c90104706b9c8cd7c`
- Ancestry: OT81 is an ancestor of OT82.

Accepted code found:
- Migrations through `1800_ot72_provider_truth.sql`; OT52 household/learner tables in `1500_ot52_portal_households_learners.sql`; OT71 account lifecycle in `1700_ot71_account_lifecycle.sql`.
- Portal contracts in `packages/contracts/src/portals/index.ts`.
- Portal domain services in `packages/domain/src/portals/services.ts`.
- PostgreSQL repository in `packages/db/src/portals/repository.ts`.
- Account lifecycle setup/reset/suspend/restore in `packages/domain/src/accounts/lifecycle.ts`.
- Parent/student routers in `apps/web/src/server/features/portals/routers.ts`.
- Session-derived portal actors in `apps/web/src/server/app.ts`.
- React portal UI in `apps/web/src/client/features/portals/PortalFeatures.tsx`.
- OT82 design primitives/tokens in `packages/brand-system`.

Reuse/extend decisions:
- Household, guardian, learner, student access, consent, rewards, updates, audit, idempotency: reuse and extend canonically.
- Parent and student app shells: reuse OT82/OT71 shell and portal bundle.
- Student setup/reset/suspend/restore: reuse accepted account lifecycle.
- Parent revoke learner sessions: create as missing canonical operation.
- Real PostgreSQL learner-seat proof: add OT83-specific script/workflow.

No duplicate stack was created.
