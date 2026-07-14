# OT-39 Final Report

## Scope

Corrected OT-35 CRM frontend privacy, usability-mark, cached-return, and
performance evidence on branch `codex/ot39-crm-privacy-performance-correction`
from required base `6ca5e568c328ea116a9413b57ea5920400f8bc14`.

No server, database, migration, domain, worker, package, or lock files were
edited. No real data, deployments, provider calls, or production mutations were
performed.

## Fixed

- Free-text contact search is unavailable in the current frontend until the
  POST-body endpoint exists. The production CRM adapter throws before any
  `search` value can be added to `GET /api/v1/crm/contacts`.
- Classification, status, sort, and cursor remain the only list values sent via
  GET, and they are allowlisted as non-PII filter values.
- Authenticated CRM fetches now use explicit private/no-store request semantics.
- Any `401` or `403` from authenticated CRM/session requests clears retained
  protected contact/list/detail state before recovery UI renders.
- Usability marks are emitted from React effects only after commit, visible
  actionable content, and at least the next animation frame.
- Back-to-list from detail reuses the valid in-memory list cache; performance
  proof recorded `warm_return_list_gets` as thirty zeroes.
- Manual create requests carry an in-memory `Idempotency-Key` that persists
  across same-intent retries and regenerates after materially different input,
  success/unmount, or cancellation.
- Update requests expose an `If-Match` version adapter seam and preserve
  version-conflict surfacing.
- Client permissions now flow through a deny-by-default server-issued
  capability seam, with temporary compatibility limited to the current server
  role keys that the backend already authorizes.
- OT-35 evidence files that accepted GET search and 10-sample performance are
  now skipped supersession sentinels pointing to the OT-39 privacy,
  accessibility, and performance proof.

## Waiting For OT-38 Integration

One-line integration change:

`Change CRM_SEARCH_ADAPTER.status from unavailable_until_ot38 to post_body after OT-38 exposes POST /api/v1/crm/contacts/search and session.capabilities.crm.contacts.search=true.`

Search is not claimed complete on this branch. After OT-38 merges, the combined
journey must be tested with free-text terms sent only in an authenticated JSON
body and absent from URLs, browser history, storage, traces, screenshots, and
analytics.

The server-issued capability seam is also waiting for the session payload to
include `session.capabilities.crm.contacts`.

## Blocked

- None for this frontend-only correction.

## Evidence

- E2E privacy/usability/screenshot proof:
  `tests/e2e/ot-39/crm-privacy-usability.spec.ts`
- Accessibility/reflow/touch-target proof:
  `tests/accessibility/ot-39/crm-a11y.spec.ts`
- Performance proof:
  `tests/performance/ot-39/crm-performance.spec.ts`
- Accessibility results:
  `ops/evidence/ot-39/accessibility-results.json`
- Performance results:
  `ops/evidence/ot-39/performance-report.json`
- Screenshots:
  `ops/evidence/ot-39/screenshots/`

## Performance Summary

The accepted run used 30 measured samples after explicit warm-up for each
journey at 390x844 with 150 ms latency, 1600 kbps down, 750 kbps up, and 4x CPU
throttle.

| Journey | p50 | p75 | p95 | Target | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| List first usable | 927 ms | 932 ms | 1004 ms | 2500 ms | Pass |
| Detail first usable | 915 ms | 926 ms | 950 ms | 2500 ms | Pass |
| Warm return to cached list | 158 ms | 162 ms | 181 ms | 1500 ms | Pass |
| Cached shell transition | 164 ms | 179 ms | 190 ms | 500 ms | Pass |

Bundle evidence:

- Authenticated CRM JS gzip: 68,274 bytes.
- Authenticated CRM CSS gzip: 3,139 bytes.
- Public pages exclude `app-crm.js`: true.
- Zero BNA/Operations requests: true.

Web-vital evidence:

- List LCP samples ranged from 436 ms to 556 ms.
- Detail LCP samples ranged from 448 ms to 524 ms.
- CLS stayed at 0.0751 for list and 0.0564 for detail.
- No long task over 200 ms was observed.

## Commands Run

- `npm ci`
- `npm run typecheck`
- `npm run build`
- `npx playwright test tests/e2e/ot-39/crm-privacy-usability.spec.ts`
- `npx playwright test tests/accessibility/ot-39/crm-a11y.spec.ts`
- `npx playwright test tests/performance/ot-39/crm-performance.spec.ts`
- `npm run lint`
- `npm run test`
- `npm run e2e`
- `npm run accessibility`
- `npm run performance`
- `git diff --check`

`npm run verify` was attempted, but the repo-wide `prettier --check .` step is
blocked by 55 pre-existing unrelated formatting warnings. Touched-file Prettier
was run successfully on the OT-39 text files, and the remaining verification
steps were run individually.
