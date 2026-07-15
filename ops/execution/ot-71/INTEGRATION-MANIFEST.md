# OT-71R Integration Manifest

## Initial Packet

- Shared OT-60R control files edited: no.
- Shared registry edited: no.
- OT-72 provider-owned files edited: no.
- Product code edited: no.
- External mutations: zero.

## Phase 1

- Shared OT-60R control files edited: no.
- Shared registry edited: no.
- OT-72 provider-owned files edited: no.
- Provider transports, credentials, webhooks, polling, and live activation edited: no.
- New migration: `packages/db/migrations/1100_ot71_class_occurrence_fulfillment.sql`.
- Product contracts added: `packages/contracts/src/classes/index.ts`.
- Product domain added: `packages/domain/src/classes/schedule.ts`, `packages/domain/src/classes/service.ts`.
- Existing integration points touched:
  - `packages/domain/src/lead/service.ts` schedules eligible class reminders only after public signup commit.
  - `packages/contracts/src/delivery/types.ts`, `packages/domain/src/delivery/eligibility.ts`, `packages/domain/src/delivery/messages.ts`, and `apps/worker/src/delivery/repository.ts` recognize provider-neutral class reminder events in sink mode.
  - `apps/web/src/server/app.ts` exposes owner/admin class list/detail APIs.
- Raw provider URL/secret/target exposure: none; class launch descriptors return `provider_unavailable`.
- External mutations: zero.

## Future Shared Hotspots

Any necessary shared hotspot changes must be small, clearly labeled, and recorded here with file paths, reason, owner boundary, tests, and rollback notes.
