# Tisha B'Av Funnel Final Report

Status: preview synchronization passed; narrow production promotion pending.

Implemented:

- Canonical event config at `config/events/tisha-bav-2026.json`.
- Additive migration `2210_tisha_bav_event_funnel.sql` for event definitions, registrations, delivery intents, and short-lived event sessions.
- Additive migration `2211_tisha_bav_provider_event_scope.sql` to seed the provider-scoped `rabbi_sheller_provider` / `one_time_mishnah_class` event definition used by runtime configuration.
- Public landing page `/tisha-bav` with final desktop `tisha beav(1).png` art, final mobile `tishea beav mobile(1).png` art, Hebrew text above the English title on top of the image, final minimal details, one visible `Reserve My Spot` CTA, and no student/payment/password/GHL iframe fields.
- One-screen initial mobile layout with the registration form closed until CTA click.
- Full-page same-page registration modal on mobile and desktop, with no visible newsletter checkbox or consent paragraph.
- Registration API `POST /api/v1/events/tisha-bav-2026/register` with normalization, honeypot, durable rate limit, idempotency, duplicate update behavior, separate event-service and newsletter consent, explicit PostgreSQL timestamp casts, and first-party event storage.
- Event-scoped HighLevel adapter and delivery intent with provider-off default, mock coverage, and exact event/source tags. The Tisha page no longer exposes a newsletter opt-in, so newsletter consent is not requested in this flow.
- Private access page `/tisha-bav/live`, join API, short-lived event session cookie, no-store/no-referrer headers, and server-side redirect endpoint.
- Registry coverage in the visible action registry, brand route registry, and action/route inventory.
- Verbatim operator email copy, validated atomic intent artifacts, and manifest under `ops/codex-runs/TISHA-BAV-FUNNEL/EMAIL-COPY-*`.
- Versioned executable email catalog with the exact warm invitation, registration confirmation, one-hour reminder, and ten-minute reminder copy.
- One canonical event start that derives the displayed Eastern/Israel schedule and the fixed `18:00Z` / `18:50Z` reminder instants together.
- HighLevel handoff with exact copy, sender, protected CTA destinations, fixed event-relative waits, late-entry guards, and a prepared-only warm invitation.

Validation:

- `npm run build`: passed.
- Scoped lint for all Tisha implementation and audit files: passed.
- `npm run typecheck`: passed after the email catalog update.
- `npx vitest run --config vitest.unit.config.ts tests/unit/tisha-bav-email-copy.test.ts`: passed, 2 tests.
- `npx vitest run --config vitest.unit.config.ts tests/unit/day-one/visible-action-registry.test.ts tests/unit/brand-system/brand-system.test.ts`: passed.
- `npx vitest run --config vitest.integration.config.ts tests/integration/tisha-bav-event-funnel.test.ts`: passed, 10 tests, including provider idempotency, provider-scoped event definition, and the exact bounded fallback confirmation payload.
- `npx playwright test tests/e2e/tisha-bav-funnel.spec.ts --project=chromium`: passed, including seven one-screen mobile viewports, desktop landscape art, mobile portrait art, title overlay order, closed initial form, full-page modal, no visible checkbox/consent message, form submit, and final thank-you/share state.
- `npm run secret:scan`: passed.
- `npm run brand:check`: passed.
- `git diff --check`: passed with line-ending warnings only.
- Scoped Prettier check for touched files: passed.
- Intent preservation validation: passed, 22/22 hard signals and 5/5 actionable spans covered.
- BNA PQC validation fixtures and 8/8 evals: passed; watchdog retains 17 pre-existing findings outside this packet.
- Railway PR environment: deployed commit `549098b28adfeca923564efd179ff980732b1654` successfully with the HighLevel first-write tag reconciliation fix.
- Railway preview database migration: `2211_tisha_bav_provider_event_scope.sql` applied through the existing PR environment database service using `DATABASE_PUBLIC_URL`.
- Protected operator reconciliation: passed with one registration, one HighLevel delivery row, published workflow readback, exact event tags in the provider UI, no newsletter tag, and a succeeded final delivery state.
- HighLevel execution readback: the immediate confirmation executed once; duplicate add requests were skipped; one active operator enrollment is waiting for the one-hour reminder.
- OT-C01 remains draft with zero recipients and zero messages sent.
- Live preview smoke: `https://ot99-web-onetimev2-pr-102.up.railway.app/tisha-bav` returned HTTP 200 with the event title and registration CTA, and exposed no raw Zoom URL.
- Visual evidence captured locally for the final desktop and mobile hero layouts, one-screen mobile viewports, full-page registration modal, and success/share state; committed evidence files are under `ops/codex-runs/TISHA-BAV-FUNNEL/screenshots/one-screen-local/`.
- Full local `npm run format`: still shows the existing broad Windows-worktree formatting backlog outside this funnel change; CI's named format blockers were formatted.

Remaining release work:

- Preview Zoom join URL is configured in protected Railway PR runtime; production mapping remains pending for the narrow release.
- Preview HighLevel provider mode, token, location, and published workflow ID are configured and verified.
- Warm invitation audience selection and the external send are not authorized; the copy is prepared only.
- Production promotion remains to be completed by the authorized narrow release lane.

Production changed: no.
