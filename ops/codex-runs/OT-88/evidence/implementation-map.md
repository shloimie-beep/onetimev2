# OT-88 Implementation Map

Status: `READY_FOR_ZOOM_CANARY`.

Split statuses:

- `task_status=READY_FOR_ZOOM_CANARY`
- `ot99_integration_status=READY_FOR_OT99`
- `live_zoom_status=NOT_READY_PENDING_CANARY`

## Product Slice

- Daily 19:00 Asia/Jerusalem classroom occurrence projection remains sink-mode/testable and provider-off by default.
- Official Zoom Meeting SDK launch is isolated behind explicit ports:
  `ZoomMeetingLaunchPort`, `ZoomRegistrantPort`, `ZoomProviderReadinessPort`,
  `ZoomAttendanceReconciliationPort`, `ZoomFeatureParticipantPort`, and
  `ReminderDeliveryPort`.
- Deterministic sink ports model the SDK launch shape and official client/component
  method boundary without importing Zoom scripts or calling Zoom.
- Launch grants are terminal once consumed. Replays cannot regenerate provider
  material, the same idempotency key cannot reactivate a consumed grant, and
  rejoin requires a new idempotency key/new grant.
- Bootstrap remains learner/session/CSRF/origin bound, with expiry, revocation,
  sibling mismatch, session mismatch, and concurrent-consume coverage.
- Launch HTML and bootstrap JSON use opaque references only. Public responses are
  contract-parsed so internal provider digests and SDK-method metadata are not
  exposed to the browser.
- Reminder preference, consent, suppression, retry, and dead-letter behavior is
  deterministic sink-only and records `external_send_performed=false`.

## Main Files

- `packages/domain/src/providers/zoom.ts`
- `packages/domain/src/classroom/service.ts`
- `packages/domain/src/portals/services.ts`
- `packages/db/src/classroom/repository.ts`
- `packages/db/migrations/2100_ot88_zoom_learner_classroom.sql`
- `apps/web/src/server/app.ts`
- `apps/web/src/server/features/portals/routers.ts`
- `apps/web/src/client/classroom/zoom-launch-client.ts`
- `apps/web/vite.app.config.ts`
- `playwright.config.ts`

## Test Coverage

- `tests/unit/classroom/classroom-contracts.test.ts`
- `tests/integration/classroom/zoom-learner-classroom.test.ts`
- `tests/e2e/ot88-zoom-classroom.spec.ts`
- `tests/accessibility/ot88-zoom-classroom-a11y.spec.ts`
- `tests/performance/ot88-zoom-classroom-performance.spec.ts`
- `tests/support/test-server.ts`
