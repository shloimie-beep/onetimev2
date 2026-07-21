## Summary

- Ships the Tisha B'Av 2026 event funnel on `/tisha-bav` with registration, consent handling, idempotency, rate limits, and generic confirmation copy.
- Adds first-party event tables, event-scoped HighLevel delivery intents, provider-off defaults, mock provider coverage, and protected Zoom join flow via `/tisha-bav/live`.
- Adds route/action registry coverage plus Zoom, GHL, and run-status handoff docs.

## Validation

- `npm run build`
- `npx vitest run --config vitest.unit.config.ts tests/unit/day-one/visible-action-registry.test.ts tests/unit/brand-system/brand-system.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/tisha-bav-event-funnel.test.ts`
- `npx playwright test tests/e2e/tisha-bav-funnel.spec.ts --project=chromium`
- `npm run secret:scan`
- `npm run brand:check`
- `git diff --check`
- Scoped Prettier check for touched files

Full-repo `npm run format` is still blocked by the existing baseline formatting backlog outside this change.

## Operator Handoff

- Create or map the event-specific Zoom meeting in protected runtime only, then set `ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL` and optionally `ONE_TIME_TISHA_BAV_2026_ZOOM_MEETING_REF`.
- Configure HighLevel provider mode only after `HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN` and `HIGHLEVEL_TISHA_BAV_WORKFLOW_ID` are ready.
- Replace final artwork at `apps/web/public/assets/events/tisha-bav-2026/final-hero.webp`.
- Production was not changed.
