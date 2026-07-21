# Tisha B'Av Funnel Final Report

Status: ready for operator review with provider/runtime blockers.

Implemented:

- Canonical event config at `config/events/tisha-bav-2026.json`.
- Additive migration `2210_tisha_bav_event_funnel.sql` for event definitions, registrations, delivery intents, and short-lived event sessions.
- Public landing page `/tisha-bav` with exact `Send Me the Zoom Link` button copy and no student/payment/password/GHL iframe fields.
- Registration API `POST /api/v1/events/tisha-bav-2026/register` with normalization, honeypot, durable rate limit, idempotency, duplicate update behavior, separate event-service and newsletter consent, and first-party event storage.
- Event-scoped HighLevel adapter and delivery intent with provider-off default, mock coverage, exact event/source tags, and newsletter tag only on explicit consent.
- Private access page `/tisha-bav/live`, join API, short-lived event session cookie, no-store/no-referrer headers, and server-side redirect endpoint.
- Registry coverage in the visible action registry, brand route registry, and action/route inventory.
- Verbatim operator email copy, validated atomic intent artifacts, and manifest under `ops/codex-runs/TISHA-BAV-FUNNEL/EMAIL-COPY-*`.
- Versioned executable email catalog with the exact warm invitation, registration confirmation, one-hour reminder, and ten-minute reminder copy.
- One canonical event start that derives the displayed Eastern/Israel schedule and the fixed `18:00Z` / `18:50Z` reminder instants together.
- HighLevel handoff with exact copy, sender, protected CTA destinations, fixed event-relative waits, late-entry guards, and a prepared-only warm invitation.

Validation:

- `npm run build`: passed.
- `npm run lint`: passed after unrelated CI baseline cleanup in the preview provisioning scripts.
- `npm run typecheck`: passed after the email catalog update.
- `npx vitest run --config vitest.unit.config.ts tests/unit/tisha-bav-email-copy.test.ts`: passed, 2 tests.
- `npx vitest run --config vitest.unit.config.ts tests/unit/day-one/visible-action-registry.test.ts tests/unit/brand-system/brand-system.test.ts`: passed.
- `npx vitest run --config vitest.integration.config.ts tests/integration/tisha-bav-event-funnel.test.ts`: passed, 9 tests, including the exact bounded fallback confirmation payload.
- `npx playwright test tests/e2e/tisha-bav-funnel.spec.ts --project=chromium`: passed.
- `npm run secret:scan`: passed.
- `npm run brand:check`: passed.
- `git diff --check`: passed with line-ending warnings only.
- Scoped Prettier check for touched files: passed.
- Intent preservation validation: passed, 22/22 hard signals and 5/5 actionable spans covered.
- BNA PQC validation fixtures and 8/8 evals: passed; watchdog retains 17 pre-existing findings outside this packet.
- Railway PR environment: deployed commit `f5b573863ddc01d9c48d61d1f04f6239d958eca7` successfully.
- Live preview smoke: `https://ot99-web-onetimev2-pr-102.up.railway.app/tisha-bav` returned HTTP 200 with the event title and registration CTA, and exposed no raw Zoom URL.
- Full local `npm run format`: still shows the existing broad Windows-worktree formatting backlog outside this funnel change; CI's named format blockers were formatted.

Known blockers:

- Zoom event is not created/mapped in protected runtime. See `ZOOM-PROTECTED-HANDOFF.md`.
- HighLevel provider sync is off unless `HIGHLEVEL_EVENT_SYNC_MODE=provider`, token, and workflow ID are configured.
- Warm invitation audience selection and the external send are not authorized; the copy is prepared only.
- Final operator graphic is not present; replacement path is `apps/web/public/assets/events/tisha-bav-2026/final-hero.webp`.

Production changed: no.
