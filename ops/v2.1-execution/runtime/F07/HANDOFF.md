# F07 Lane B production-entry handoff

## Result

Lane B is `ready_for_review` at implementation commit `092941f165c35779a987b4e4477cc436a961563e`, parented directly by exact integration head `c0a1e04b8f3ffcaa65b8c6c2a1ec64edf7c1346a`. The branch is `codex/v21-lane3-landing-campaign`. Work consumed claim `d34ee5e7-ad86-49be-ad1e-236592ad3a0b` and DESIGN_SYSTEM lease `aad71ba0-80e9-4a59-beeb-a4776bca0d85` from control transaction `f0ccbdc81e6962add93d0900dd159e24df7cf05f`.

The public landing is now the complete production composition, not a hero-only patch. It uses the exact accepted campaign copy, canonical logo and approved real imagery, Inter, black `#090909`, yellow `#FFD400`, cyan `#67E8F9`, and white. The provisional Montserrat font files, manifest entry, preload, token reference, and exception were removed.

The page covers the Sunday–Thursday 7:00 p.m. Jerusalem schedule with viewer-local conversion, embedded protected live class and protected on-demand library, Family and separate School entry, an adult learning through a separate Student seat, no Student email requirement, device/browser and optional-camera expectations, session/recording expectations, Terms/Privacy/Student Data, cancellation/refund, Member Login, and Support. WhatsApp is explicitly not an active launch channel.

## Free period and signup seam

Display state uses a same-origin server `Date` readback to estimate clock offset and enforces the exact display boundary `2026-09-13T16:24:00.000Z`. Before the boundary, the Family form CTA is exactly `Create my free family account` with helper `No credit card. Free access ends September 13, 2026 at 7:24 p.m. Jerusalem time.` At or after the boundary, the page and form show the `$67/month` hosted-checkout continuation state. Server/domain access and billing enforcement remain authoritative.

The Family form now calls `GET /api/v1/signup/family/bootstrap`, then posts the strict P08 JSON shape to `POST /api/v1/signup/family` with the server-issued idempotency key and `x-csrf-token`. It requests first/last name, adult email, password/confirmation, editable IANA timezone, Terms and Privacy acceptance, and separate optional adult consents. It sends no Student, phone, WhatsApp, card, payment-method, or caller-supplied hash field. The UI truthfully handles P08's `202 session_integration_pending` response and does not claim automatic login. School remains the separate legacy inquiry path for manual follow-up only.

I36 must merge compatible P08 server head `30de59df0555058fc021bc6002a3dffc4e3ea916` before or with this client head.

## Verification

- `npm run build`: passed, including public/app client builds, static page generation, and typecheck.
- Focused Prettier and ESLint: passed.
- `npx vitest run tests/unit/brand-system/brand-system.test.ts`: 4/4 passed.
- `npm run secret:scan`: passed across 3,090 repository text files.
- Focused production-build Playwright campaign/Family/School/no-JS/accessibility suite: 7/7 passed.
- Responsive visual matrix: 8/8 passed for landing and signup at `360x800`, `390x844`, `768x1024`, and `1440x1000`; no overflow, blank capture, or failed route.
- Focused public performance: 2/2 passed.
- Asset metadata: desktop hero `1920x1080` WebP, mobile hero `1080x1920` WebP, social derivative `1200x630` PNG.
- Visual review caught and corrected mobile required-agreement overflow before the final passing capture.

Screenshot SHA-256 values are recorded in `TASK-STATE.yaml`. Screenshots themselves remain ephemeral under ignored `test-results/f07-public-responsive`; no miscellaneous evidence files were added to the branch.

## Known shared blockers and steward dependencies

The normal Playwright webServer cannot start on current integration because PostgreSQL migration 2252 uses `btrim(text)` and the pg-mem harness does not register that function. The exact failure occurs before any Lane B test runs. The same production build passed through an isolated read-only static server. I36/test-harness ownership must register the missing PostgreSQL function or otherwise keep the native migration out of the memory harness.

Several tests outside the Lane B path grant still assert the superseded Family `/api/v1/leads` flow, functioning WhatsApp controls, or the old September 11 ticker. Their owners must update them after admission; Lane B did not edit unauthorized paths.

`npm run brand:check` still reports the pre-existing raw-color finding in `scripts/ops/validate-ot-launch-governance.ts`; no Lane B changed path is implicated.

## Effects

No deployment, provider call, mutation, contact creation, message, enrollment, charge, DNS change, effect lock, or external effect was attempted. Counts: attempted `0`, succeeded `0`, reconciled `0`.

## Exact next action

I36 independently reviews exact head `092941f165c35779a987b4e4477cc436a961563e`, confirms strict path ownership, merges P08 head `30de59df0555058fc021bc6002a3dffc4e3ea916`, then admits this Lane B head non-force.
