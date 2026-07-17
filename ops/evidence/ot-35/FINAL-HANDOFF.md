# OT-35 Final Handoff Evidence

## Branch And Base

- Repository: `webcraft-media/onetimev2`
- Base branch: `codex/crm-core-v1`
- Base SHA: `4ac288968ba24e30a5c3f8c6924f492eedf4338f`
- Foundation ancestor: `3465bd7d4c6b6829a6be6e4b4f8a003d608f3680`
- Work branch: `codex/ot60r-recovery-convergence`

## Scope Implemented

- Replaced the one-page CRM chrome with a reusable authenticated `AppShell`.
- Added One Time header, accurate role/user identity, logout, desktop left nav,
  mobile drawer, page header, toolbar slot, content region, compact app footer,
  skip/current-page keyboard shortcuts, and shared loading/empty/error/session
  states.
- CRM navigation renders only `CRM`; unimplemented Home, Communications, Tasks,
  Relationships, Classes, Billing, Integrations, Studio, Telegram, portals, and
  reports remain absent.
- CRM list now renders as a desktop table and mobile cards with readable names,
  API-backed classification/status/source chips, contact method, assigned team
  member when present, and last activity.
- Detail renders a clean overview only: classification, lead status, source,
  assigned team member when present, email, phone, last activity, consent,
  suppression, signup provenance, and internal note when present.
- Session expiry clears protected CRM state and presents a sign-in recovery
  state before any protected data remains visible.
- OT-60R integration preserves canonical POST-body CRM search and current
  idempotent contact-create behavior from the PR #2 base.

## Supported Routes And Navigation

- `/app/crm`
- `/app/crm/contacts/:contactId`
- Existing `/login` remains the authenticated entry.
- Primary authenticated navigation destination: `CRM` only.

## Evidence Files

- `ops/evidence/ot-35/accessibility-results.json`
- `ops/evidence/ot-35/performance-report.json`
- `ops/evidence/ot-35/BACKEND-GAPS.md`
- `ops/evidence/ot-35/screenshots/crm-list-360x800.png`
- `ops/evidence/ot-35/screenshots/crm-list-390x844.png`
- `ops/evidence/ot-35/screenshots/crm-list-768x1024.png`
- `ops/evidence/ot-35/screenshots/crm-list-1440x1000.png`
- `ops/evidence/ot-35/screenshots/crm-detail-360x800.png`
- `ops/evidence/ot-35/screenshots/crm-detail-390x844.png`
- `ops/evidence/ot-35/screenshots/crm-detail-768x1024.png`
- `ops/evidence/ot-35/screenshots/crm-detail-1440x1000.png`

## Accessibility Results

- Axe violations: 0 at `360x800`, `390x844`, `768x1024`, and `1440x1000`.
- Reduced-motion smoke: passed.
- RTL drawer smoke: passed.
- 200 percent text reflow smoke: passed.
- Horizontal overflow: false for every recorded viewport/mode.

## Performance Results

Profile: Chromium, `390x844`, 150 ms latency, 1600 Kbps download, 750 Kbps
upload, 4x CPU throttle, 1 warm-up and 10 measured samples.

| Gate | p75 | Target | Status |
| --- | ---: | ---: | --- |
| CRM list first usable | 923 ms | 2500 ms | Pass |
| Contact detail first usable | 862 ms | 2500 ms | Pass |
| Return to loaded list | 348 ms | 1500 ms | Pass |
| Cached shell transition | 193 ms | 500 ms | Pass |
| LCP p75 | 892 ms | 2500 ms | Pass |
| CLS | 0.0392 | 0.10 | Pass |
| Initial long task over 200 ms | false | false | Pass |

Compressed route-critical bundle results:

- Authenticated app JS gzip: `67126` bytes.
- Authenticated app CSS gzip: `3099` bytes.
- Public pages exclude `app-crm.js`: true.

Request evidence:

- Recorded API paths: `/api/v1/auth/login`, `/api/v1/auth/session`,
  `/api/v1/crm/contacts/search`, `/api/v1/crm/contacts`,
  `/api/v1/crm/contacts/:contactId`.
- Zero BNA/Operations requests: true.

## Verification Commands

- `npm run build` - pass.
- `npm run typecheck` - pass.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts` - pass, 10/10.
- Focused OT-35 E2E/accessibility/performance slices - pass, 8/8.
- Targeted Prettier check for OT-35-owned files - pass.
- `git diff --check` - pass.
- `npm run secret:scan` - pass.

## Backend Data Gaps

- Durable custom tags are not exposed by the current standalone One Time CRM
  API contract. See `BACKEND-GAPS.md`.
- The frontend intentionally renders only API-backed classification, status,
  and source chips and does not fabricate legacy/custom tags.

## External Mutations

- No production database access.
- No deploy.
- No merge.
- No email, WhatsApp, Telegram, payment, member access, provider, DNS, or other
  external mutation.
- Browser tests used the local in-memory test server and synthetic `example.test`
  data only.
