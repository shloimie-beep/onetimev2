# OT-39 Final Report

## Scope

Integrated OT-39 CRM frontend privacy, usability-mark, cached-return, and
performance evidence into `codex/ot60r-recovery-convergence` after OT-35.

No server, database, migration, domain, worker, package, or lock files were
edited. No real data, deployments, provider calls, or production mutations were
performed.

## Fixed

- Free-text contact search uses authenticated POST-body
  `/api/v1/crm/contacts/search`; no `search` value is added to
  `GET /api/v1/crm/contacts`.
- Classification, status, sort, cursor, and search are allowlisted before being
  submitted in the private JSON command body.
- Authenticated CRM fetches now use explicit private/no-store request semantics.
- Any `401` or `403` from authenticated CRM/session requests clears retained
  protected contact/list/detail state before recovery UI renders.
- Usability marks are emitted from React effects only after commit, visible
  actionable content, and at least the next animation frame.
- Back-to-list from detail reuses the valid in-memory list cache; performance
  proof recorded `warm_return_list_gets` as thirty zeroes.
- Manual create requests carry an in-memory body `idempotency_key` that persists
  across same-intent retries and regenerates after materially different input,
  success/unmount, or cancellation.
- Update requests expose an `If-Match` version adapter seam and preserve
  version-conflict surfacing.
- Client permissions now flow through a deny-by-default server-issued
  capability seam, with temporary compatibility limited to the current server
  role keys that the backend already authorizes.
- OT-35 E2E/performance specs are now skipped supersession sentinels pointing to
  the OT-39 privacy, accessibility, and performance proof.

## OT-60R Integration Notes

Search is claimed only as private POST-body search in this integrated branch.
The server-issued capability seam remains ready for a future session payload
with `session.capabilities.crm.contacts`; until then the client uses the same
legacy role compatibility keys that the backend already authorizes.

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
| List first usable | 908 ms | 920 ms | 936 ms | 2500 ms | Pass |
| Detail first usable | 886 ms | 894 ms | 909 ms | 2500 ms | Pass |
| Warm return to cached list | 137 ms | 140 ms | 147 ms | 1500 ms | Pass |
| Cached shell transition | 136 ms | 151 ms | 157 ms | 500 ms | Pass |

Bundle evidence:

- Authenticated CRM JS gzip: 68,269 bytes.
- Authenticated CRM CSS gzip: 3,139 bytes.
- Public pages exclude `app-crm.js`: true.
- Zero BNA/Operations requests: true.

Web-vital evidence:

- List LCP samples ranged from 836 ms to 912 ms.
- Detail LCP samples ranged from 812 ms to 864 ms.
- CLS stayed at 0.0922 for list and 0.0662 for detail.
- No long task over 200 ms was observed.

## Commands Run

- `npm run build`
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`
- `npx playwright test tests/e2e/ot-39/crm-privacy-usability.spec.ts tests/accessibility/ot-39/crm-a11y.spec.ts tests/performance/ot-39/crm-performance.spec.ts tests/performance/public-performance.spec.ts --reporter=line`
- `npx playwright test tests/performance/ot-39/crm-performance.spec.ts`
- `npm run typecheck`
