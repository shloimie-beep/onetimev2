# F07 Lane B production-entry handoff

## Result

Lane B is `ready_for_review` at corrected implementation commit `0937404a24cb1c880afc1d1a8a555a29936e735b`, whose sole parent is preserved terminal head `97108442bb75f1b30455a8658c2c7ab55f4d9e5f`. Its history retains implementation `092941f165c35779a987b4e4477cc436a961563e` and exact integration ancestor `c0a1e04b8f3ffcaa65b8c6c2a1ec64edf7c1346a`. The branch is `codex/v21-lane3-landing-campaign`. Work consumed claim `d34ee5e7-ad86-49be-ad1e-236592ad3a0b` and DESIGN_SYSTEM lease `aad71ba0-80e9-4a59-beeb-a4776bca0d85` from control transaction `f0ccbdc81e6962add93d0900dd159e24df7cf05f`.

The public landing is now the complete production composition, not a hero-only patch. It uses the exact accepted campaign copy, canonical logo and approved real imagery, Inter, black `#090909`, yellow `#FFD400`, cyan `#67E8F9`, and white. The provisional Montserrat font files, manifest entry, preload, token reference, and exception were removed.

The page covers the Sunday–Thursday 7:00 p.m. Jerusalem schedule with viewer-local conversion, embedded protected live class and protected on-demand library, Family and separate School entry, an adult learning through a separate Student seat, no Student email requirement, device/browser and optional-camera expectations, session/recording expectations, Terms/Privacy/Student Data, cancellation/refund, Member Login, and Support. WhatsApp is explicitly not an active launch channel.

## Free period and signup seam

Display state uses a same-origin server `Date` readback to estimate clock offset and enforces the exact display boundary `2026-09-13T16:24:00.000Z`. Before the boundary, the Family form CTA is exactly `Create my free family account` with helper `No credit card. Free access ends September 13, 2026 at 7:24 p.m. Jerusalem time.` At or after the boundary, the CTA is exactly `Create account and continue to checkout`; the `$67/month` hosted-checkout disclosure is rendered separately. Server/domain access and billing enforcement remain authoritative.

The Family form calls `GET /api/v1/signup/family/bootstrap`, then posts the strict P08 JSON shape to `POST /api/v1/signup/family` with the server-issued idempotency key and `x-csrf-token`. It requests first/last name, adult email, password/confirmation, editable IANA timezone, Terms and Privacy acceptance, and separate optional adult consents. It sends no Student, phone, WhatsApp, card, payment-method, or caller-supplied hash field. The UI truthfully handles P08's `202 session_integration_pending` response and does not claim automatic login.

The separate School branch now posts same-origin `POST /api/v2.1/signup/school-inquiry` with exactly four required P09 fields (`school_name`, `contact_first_name`, `contact_last_name`, `email`) and only the two permitted optional fields (`phone`, `note`) when populated. It sends no Family, account, access, role, portal, consent, marketing/newsletter, nurture, attribution, timezone, or caller-generated idempotency field. I36 must apply canonical registration request `P09-registration-001` before or with this client head.

I36 must merge compatible P08 server head `30de59df0555058fc021bc6002a3dffc4e3ea916` and apply the P09 route registration before or with this client head.

## Verification

- `npm run build`: passed, including public/app client builds, static page generation, and typecheck.
- Focused Prettier and ESLint: passed.
- P09 contract and public form-model tests: 5/5 passed.
- `npm run secret:scan`: passed across 3,090 repository text files.
- Focused production-build Playwright campaign/Family/P09 School/no-JS/accessibility suite: 7/7 passed. The first replay exposed only an ambiguous Family test label selector after the new contact fields; exact selectors were applied and the complete suite then passed.
- The accessibility/overflow loop passed landing and signup at `360x800`, `390x844`, `768x1024`, and `1440x1000`.

The prior screenshot hashes belonged to source head `092941f165c35779a987b4e4477cc436a961563e` and remain preserved in Git history; they are not presented as current-byte evidence after the School form correction. No new screenshots or miscellaneous evidence files were committed.

## Known shared blockers and steward dependencies

The normal Playwright webServer cannot start because the pg-mem harness does not register `btrim(text)`. Direct `createMemoryPool()` plus `runMigrations()` replay fails first in migration `2235_v21_household_identity.sql`; migration 2252's `btrim` calls are all inside its stripped PostgreSQL-only block. The corrected production build passed through an isolated static preview. I36/test-harness ownership should register the missing PostgreSQL function; the blocker is real, but it must not be attributed to migration 2252.

Several tests outside the Lane B path grant still assert the superseded Family `/api/v1/leads` flow, functioning WhatsApp controls, or the old September 11 ticker. Their owners must update them after admission; Lane B did not edit unauthorized paths.

`npm run brand:check` still reports the pre-existing raw-color finding in `scripts/ops/validate-ot-launch-governance.ts`; no Lane B changed path is implicated.

## Effects

No deployment, provider call, mutation, contact creation, message, enrollment, charge, DNS change, effect lock, or external effect was attempted. Counts: attempted `0`, succeeded `0`, reconciled `0`.

## Exact next action

I36 independently reviews exact corrected implementation head `0937404a24cb1c880afc1d1a8a555a29936e735b`, confirms strict path ownership, merges P08 head `30de59df0555058fc021bc6002a3dffc4e3ea916`, applies the canonical P09 route registration, then admits this Lane B head non-force.
