# Learning Product Window B Final Report

Updated: 2026-07-20T13:50:34+03:00

Branch: `codex/learning-product-portals-media`
Base SHA: `0d50e0f07afbc0d0d143a45e76e73821ca25178f`
Target base: `codex/one-time-finish-now-20260719`

## Completed

- Replaced student email setup/reset delivery with parent-managed username and password projection, including credential audit tables, username reservation guardrails, password hash references, credential versions, and session-revocation metadata.
- Added parent/student contract fields for safe credential status, class summaries, featured lesson projections, Rabbi-approved lesson conversation summaries, and class leaderboard summaries.
- Added class-only all-time leaderboard support with actual names, no negative labels, Rabbi publication control metadata, and positive point reason policy.
- Added lesson publication and conversation projection tables so portal content can expose only approved/publication-safe lesson summaries instead of raw Vimeo, Zoom, Drive, or meeting URLs.
- Projected the class one Mishnah classroom at `19:00` in `Asia/Jerusalem`, with protected per-session launch requirements.
- Updated portal UI for username/password access management, featured lessons, leaderboards, mobile-safe class picking, and credential state display.
- Updated unit, integration, and browser tests to exercise the new no-student-email flow and the protected mocked Zoom/classroom behavior.

## Evidence

- Unit: `npx vitest run tests/unit/learning-product-portals.test.ts` passed.
- Unit suite: `npm run unit` passed, 52 files and 256 tests.
- Integration: `npx vitest run --config vitest.integration.config.ts tests/integration/portals/portal-mount.test.ts tests/integration/classroom/zoom-learner-classroom.test.ts tests/integration/content/content-library.test.ts --reporter=dot` passed, 3 files and 14 tests.
- E2E: `npx playwright test tests/e2e/ot-83r-portals.spec.ts tests/e2e/ot88-zoom-classroom.spec.ts --reporter=line` passed, 5 tests.
- A11y: `npx playwright test tests/accessibility/ot88-zoom-classroom-a11y.spec.ts --reporter=line` passed, 2 tests.
- Performance: `npx playwright test tests/performance/ot88-zoom-classroom-performance.spec.ts --reporter=line` passed, 1 test.
- Static checks: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run brand:check`, `npm run secret:scan`, `git diff --check`, and scoped Prettier all passed.

## Blockers And Notes

- `npm run db:verify` is blocked without `DATABASE_URL`; no production or provider database credentials were used.
- Full username/password student session issuance remains blocked for the convergence owner because the existing app-wide login route is in `apps/web/src/server/app.ts`, which this window was explicitly forbidden to edit.
- `npm run format` still reports broad pre-existing repo formatting drift; the touched-file Prettier check passes.
- No external Vimeo, Zoom, provider, Railway, DNS, or production database calls were made.
