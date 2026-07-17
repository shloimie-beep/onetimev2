# OT-52P Parent Journeys

Implemented as feature-local service/router/UI modules, not mounted in the live app.

## Covered

- Household dashboard with active learner count and limit state.
- Create learner with idempotency.
- Update learner with optimistic versioning.
- Archive learner and restore learner.
- Enforce max three active learners.
- Request student access setup/reset/suspend/restore through injected adapter.
- Launch learner class through protected descriptor only.
- View learner materials, progress, rewards, and administrative updates.
- Preview support request without external send.
- See helper unavailable state until adapter wiring exists.

## Deferred Integration Seams

- Real route mounting.
- Real auth session resolver for parent portal actors.
- Real class/content/progress provider adapters.
- Real credential lifecycle provider adapter.
- Real helper adapter.
- Real support confirmation/send flow.
