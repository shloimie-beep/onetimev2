## Summary

- Ships the Tisha B'Av 2026 event funnel on `/tisha-bav` with registration, consent handling, idempotency, rate limits, and generic confirmation copy.
- Updates `/tisha-bav` to the final focused event-funnel hero: desktop Image A, mobile Image B, minimal headline/Hebrew/supporting copy, `Reserve My Spot` CTA, and final thank-you state.
- Adds first-party event tables, provider-scoped event seeding, event-scoped HighLevel delivery intents, provider-off defaults, mock provider coverage, and protected Zoom join flow via `/tisha-bav/live`.
- Adds route/action registry coverage plus Zoom, GHL, and run-status handoff docs.
- Preserves and implements the exact operator-approved event email catalog, with all dated copy and both reminder instants tied to the canonical event start.
- Keeps the warm invitation prepared-only and all CTAs on protected One Time event pages; no raw Zoom URL is present.

## Validation

- `npm run build`
- `npx vitest run --config vitest.unit.config.ts tests/unit/day-one/visible-action-registry.test.ts tests/unit/brand-system/brand-system.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/tisha-bav-event-funnel.test.ts`
- `npx playwright test tests/e2e/tisha-bav-funnel.spec.ts --project=chromium`
- `npm run secret:scan`
- `npm run brand:check`
- `npx vitest run --config vitest.unit.config.ts tests/unit/tisha-bav-email-copy.test.ts`
- Intent preservation validation (22/22 hard signals)
- Railway preview DB migration `2211_tisha_bav_provider_event_scope.sql`
- Railway preview registration domain smoke (`success=true`, `confirmation_queued=true`, `ghl_sync_status=provider_off`)
- Railway preview HTTP registration smoke (`success=true`, `confirmation_queued=true`, `ghl_sync_status=provider_off`)
- Railway preview smoke at `https://ot99-web-onetimev2-pr-102.up.railway.app/tisha-bav` (HTTP 200; event title and CTA present; no raw Zoom URL)
- Desktop/mobile visual crop evidence for the final hero assets under `ops/codex-runs/TISHA-BAV-FUNNEL/screenshots/`
- `git diff --check`
- Scoped Prettier check for touched files

Full-repo `npm run format` is still blocked by the existing baseline formatting backlog outside this change.

## Operator Handoff

- Preview protected runtime has `ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL` configured from the operator-provided URL. Production runtime was not changed.
- Configure HighLevel provider mode only after `HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN` and `HIGHLEVEL_TISHA_BAV_WORKFLOW_ID` are ready.
- Production was not changed.
