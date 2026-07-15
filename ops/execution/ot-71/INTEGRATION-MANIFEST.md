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

## Phase 2

- Shared OT-60R control files edited: no.
- Shared registry edited: no.
- OT-72 provider-owned files edited: no.
- Provider transports, credentials, webhooks, polling, and live activation edited: no.
- New migration: `packages/db/migrations/1400_ot71_content_library.sql`.
- Product contracts added: `packages/contracts/src/content/index.ts`.
- Product domain added: `packages/domain/src/content/service.ts`.
- Existing integration points touched:
  - `packages/contracts/src/index.ts` exports content contracts.
  - `packages/domain/src/index.ts` exports content library admission/read/portal adapter helpers.
  - `apps/web/src/server/app.ts` exposes owner/admin content library list/detail APIs and a CSRF-protected local outcome sink.
- Raw provider URL/secret/target exposure: none; transcript/source/review/playback metadata is redacted, provider refs are digest-only, and portal actions are app-relative descriptors.
- External mutations: zero.

## Phase 3

- Shared OT-60R control files edited: no.
- Shared registry edited: no.
- OT-72 provider-owned files edited: no.
- Provider transports, credentials, webhooks, polling, live identity providers, and live activation edited: no.
- New migration: `packages/db/migrations/1700_ot71_account_lifecycle.sql`.
- Product contracts added: `packages/contracts/src/accounts/index.ts`.
- Product domain added: `packages/domain/src/accounts/lifecycle.ts`.
- Existing integration points touched:
  - `packages/contracts/src/index.ts` exports account lifecycle contracts and extends canonical user roles with `parent` and `student`.
  - `packages/domain/src/index.ts` exports account lifecycle service helpers.
  - `tests/integration/telegram-db-foundation.test.ts` advances the durable migration expectation to `1700_ot71_account_lifecycle`.
- Raw provider URL/secret/target exposure: none; lifecycle tokens are hash-only in persistence, delivery intents contain no raw token payload, and parent flows cannot read student passwords or session material.
- External mutations: zero.

## Phase 4

- Shared OT-60R control files edited: no.
- Shared registry edited: no.
- OT-72 provider-owned files edited: no.
- Provider transports, credentials, webhooks, polling, live identity providers, billing portal activation, and live support/helper sends edited: no.
- Product contracts touched: `packages/contracts/src/index.ts`, `packages/contracts/src/portals/index.ts`.
- Product domain touched: `packages/domain/src/index.ts`, `packages/domain/src/portals/services.ts`, `packages/domain/src/portals/account-lifecycle-adapter.ts`.
- Web server/client touched:
  - `apps/web/src/server/app.ts` mounts protected portal shells and canonical-auth portal APIs.
  - `apps/web/src/server/features/portals/routers.ts` adds default parent dashboard support and uses shared learner-materials contracts.
  - `apps/web/src/client/app/portal-api.ts` and `apps/web/src/client/app/portal-entry.tsx` mount the parent/student portal app.
  - `apps/web/src/client/features/portals/PortalFeatures.tsx` consumes learner materials and progress.
  - `apps/web/vite.app.config.ts` and `scripts/build-public-pages.ts` build and generate the portal app pages.
- Tests added: `tests/integration/portals/portal-mount.test.ts`.
- Raw provider URL/secret/target exposure: none; class/content actions remain app-relative or `provider_unavailable`, and lifecycle operations persist only token hashes/digests.
- External mutations: zero.

## Phase 5

- Shared OT-60R control files edited: no.
- Shared registry edited: no.
- OT-72 provider-owned files edited: no.
- Provider transports, credentials, webhooks, polling, live identity providers, billing portal activation, support/helper sends, Studio, agent fleets, and BNA integration internals edited: no.
- Product contracts added: `packages/contracts/src/dashboard/index.ts`.
- Product domain added: `packages/domain/src/dashboard/service.ts`.
- Existing integration points touched:
  - `packages/contracts/src/index.ts` exports dashboard contracts.
  - `packages/domain/src/index.ts` exports owner/admin dashboard and visible-action registry helpers.
  - `apps/web/src/server/app.ts` mounts protected owner/admin shells and `/api/v1/dashboard/owner`.
  - `apps/web/src/client/app/crm-api.ts`, `apps/web/src/client/app/crm-entry.tsx`, `apps/web/src/client/app/crm.css`, and `apps/web/src/client/app/shell/AppShell.tsx` extend the authenticated shell with dashboard, classes, content, billing status, registry, and mobile current-route behavior.
  - `scripts/build-public-pages.ts` generates dashboard/classes/content/billing app pages.
- Tests added: `tests/integration/dashboard/owner-dashboard.test.ts`.
- Raw provider URL/secret/target exposure: none; dashboard responses contain bounded local statuses only, billing remains read-only, and provider transport mutation count is zero.
- External mutations: zero.

## Future Shared Hotspots

Any necessary shared hotspot changes must be small, clearly labeled, and recorded here with file paths, reason, owner boundary, tests, and rollback notes.
