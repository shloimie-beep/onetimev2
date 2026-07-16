# OT-83R Final Report

Updated: 2026-07-16T14:27:00+03:00

Branch: `codex/ot83r-complete-portals`

Draft PR: https://github.com/webcraft-media/onetimev2/pull/33

Status: `READY_FOR_OT99`

`READY_FOR_OT99`: yes after the OT-83R truthfulness repair. Implementation head
`20fe0f8ffc079f1f540d7dc16cacca86259ab407` was observed green on PR #33 with
Node 24 verify and both PostgreSQL workflows passing.

## Completed Repair

- Reused the existing task-owned branch and PR; no replacement branch or PR was
  created.
- Preserved the completed backend from audited head
  `f8406b0a22683c9bf4391cae73f074ee5f09d36c`.
- Wired parent learner create, edit, archive, and restore through
  `portal-api.ts` and `portal-entry.tsx`.
- Wired student-access setup, reset, suspend, restore, and revoke sessions
  through the same client/API boundary.
- Replaced portal `window.prompt` usage with accessible branded dialogs for
  learner and student-access operations.
- Wired parent protected content opening through learner-scoped material
  callbacks.
- Removed visible portal controls that only advertised unavailable V1 behavior.
- Kept Add learner visible and routed so the fourth-seat denial is a real API
  journey, not a disabled-control screenshot.
- Kept archived learners visible in the parent dashboard so Restore is reachable
  while backend active-seat enforcement remains intact.
- Updated route/action registry coverage to point at the new real routed
  browser journey.

## Browser Journeys

Added `tests/e2e/ot-83r-portals.spec.ts` with real app/API coverage for:

- parent add learner;
- fourth active-seat denial;
- edit learner;
- archive and restore learner;
- student credential lifecycle operations;
- parent protected content opening;
- student content opening;
- student question submission;
- session expiry after parent revokes sessions;
- household, sibling, and role denial;
- provider URL leakage guards.

Evidence:

- `ops/evidence/ot-83r/REAL-APP-JOURNEYS.json`
- `ops/evidence/ot-83r/real-app-screenshots/parent-after-journey-390x844.png`
- `ops/evidence/ot-83r/real-app-screenshots/parent-after-journey-1440x1000.png`
- `ops/evidence/ot-83r/real-app-screenshots/student-after-journey-390x844.png`
- `ops/evidence/ot-83r/real-app-screenshots/student-after-journey-1440x1000.png`

The real app evidence recorded 0 critical/serious axe violations, no horizontal
overflow, and no raw provider URL leakage across captured viewports.

## Verification

Passed locally:

- `CI=1 npm run verify`
- `npx vitest run tests/ot-52/portal-services.test.ts tests/ot-52/portal-router.test.ts tests/ot-52/portal-ui.test.ts tests/unit/ot83r-portal-registry.test.ts`
- `CI=1 npx playwright test tests/e2e/ot-83r-portals.spec.ts`
- `npm run format`

Local PostgreSQL commands were attempted but blocked by environment, not by
code:

- `npm run db:verify` failed because `DATABASE_URL` is unset.
- `npx tsx scripts/postgres-assurance/run.ts` failed with
  `ECONNREFUSED 127.0.0.1:5432`.
- `OT83_ALLOW_POSTGRES_WRITE=true npx tsx tests/ot-83/real-postgres-concurrency.ts`
  failed with `ECONNREFUSED 127.0.0.1:5432`.
- Docker, `psql`, and a local PostgreSQL listener were unavailable.

CI passed on PR #33 for implementation head
`20fe0f8ffc079f1f540d7dc16cacca86259ab407`:

- `Node 24 verify` - passed in 7m03s.
- `PostgreSQL 16 assurance harness` - passed in 55s.
- `PostgreSQL 16 learner-seat proof` - passed in 37s.

## Guardrails

- BNA was not edited.
- No production database, provider send, payment, deploy, DNS, real-user, or
  source-of-truth mutation was performed.
- Provider adapters remain default-off and return opaque local descriptors
  without raw provider URLs.
