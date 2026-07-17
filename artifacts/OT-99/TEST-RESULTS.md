# OT-99 Test Results

Validated code candidate before report-only closeout: 2ba69b080b96243de27cc701925717ae7144ac2f.

## Passed Locally

- npm run secret:scan.
- npm run lint.
- npm run typecheck.
- npm run unit: 27 files, 152 tests.
- npm run integration: 25 files, 128 tests.
- npm run build.
- CI=1 npm run e2e: 32 browser tests.
- CI=1 npm run accessibility: 9 browser accessibility tests.
- CI=1 npm run performance: 7 performance tests plus bundle report.
- npx prettier --write on OT-99-touched source/test files, followed by lint/typecheck/test reruns.

## Focused Repairs Verified

- Lead-capture sink delivery test now uses a due class reminder date instead of a far-future fixture and passes with all three expected sink-delivered rows.
- OT-83R and OT-88 browser tests use separate student identities to avoid session revocation during parallel Playwright runs.
- Parent protected-content access now has household-level billing entitlement fixture coverage.
- OT-83R exact textbox selectors and sibling launch negative assertion match the integrated OT-88 classroom UI/schema.
- Portal support routing no longer imports unused preview-only support handlers.

## Blocked Locally

- npm run db:verify: blocked because DATABASE_URL is not configured.
- npx tsx scripts/postgres-assurance/run.ts: blocked because no PostgreSQL server is listening on 127.0.0.1:5432.
- npm run verify: blocked at repo-wide npm run format because this Windows checkout reports pre-existing CRLF drift across hundreds of files outside the OT-99 touch set. The files touched by OT-99 pass scoped Prettier.

## Remote Checks Required

The canonical draft PR must run and pass GitHub's required checks on the exact pushed candidate SHA before OT-99 can be treated as remote-green:

- Node 24 verify.
- PostgreSQL 16 assurance harness.
- PostgreSQL 16 learner-seat proof.

## External Mutation Attestation

No deploy, provider contact, BNA contact, production database access, production import, DNS change, payment, broad send, hard delete, or public Buffer post was performed.
