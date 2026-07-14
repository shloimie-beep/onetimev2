# OT-12 CRM Core V1 Final Report

## Branch And PR

- Repository: `webcraft-media/onetimev2`
- Base branch: `codex/foundation-landing-lead-v1`
- Base SHA: `9d8b5b0818c788339a68070220461dada13f09b9`
- Delivery branch: `codex/crm-core-v1`
- Implementation/evidence head SHA before final-report closeout: `4fd3a6b3006284593a03dbb0db065d46499cde4a`
- Draft PR: https://github.com/webcraft-media/onetimev2/pull/2

## Commits

- `ede6458027be12b039c3a4f345cb01543d6f361e` - `feat: add standalone One Time auth and CRM API core`
- `bcf0680bc77c3f76b8198edc2dcb598017aff5e5` - `feat: add responsive authenticated CRM shell`
- `4fd3a6b3006284593a03dbb0db065d46499cde4a` - `test: certify One Time CRM vertical slice`
- Final-report closeout commit: see branch history / Codex closeout response for the latest pushed branch head.

## Migration

- `0002_crm_auth_core`
- Checksum: `616eaa3d51757ba5611c4f931cc2a1b6f2aff1e7bd97026654e85bb88d26fd6c`
- Verification: in-memory `runMigrations()` applied `0001_onetime_lead_slice` and `0002_crm_auth_core`.
- `npm run db:verify` was not run against a real database because `DATABASE_URL` is intentionally absent and OT-12 forbids production Rabbi database access.

## Routes And Contracts

- Auth routes: `GET /login`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`.
- App routes: `GET /app/crm`, `GET /app/crm/contacts/:contactId`.
- CRM API routes: `GET /api/v1/crm/contacts`, `POST /api/v1/crm/contacts`, `GET /api/v1/crm/contacts/:contactId`, `PATCH /api/v1/crm/contacts/:contactId`.
- Shared contracts live in `packages/contracts/src/index.ts`: login, roles, contact list query, create contact, update contact, DTOs.

## Auth And Session Design

- Users, sessions, and auth audit events are database-backed under `onetime`.
- Passwords use Node 24 built-in Argon2id with per-password random nonce.
- Session cookie: product-specific `otcrm_session`, HTTP-only, SameSite strict, no broad parent-domain cookie.
- CSRF cookie/header pair: `otcrm_csrf`; session table stores only the CSRF token hash.
- Login rotates any existing session token and logout revokes the session row.
- Login failures are rate-limited with privacy-safe errors.
- Roles: `owner`, `admin`, `crm_agent`, `viewer`; customer UI displays owner/admin as `Administrator`.
- Production owner/admin login is blocked unless the user row is MFA-capable.
- Test identities are synthetic fixtures only.

## Screenshots

- `ops/evidence/ot-12/screenshots/crm-list-360.png`
- `ops/evidence/ot-12/screenshots/crm-detail-360.png`
- `ops/evidence/ot-12/screenshots/crm-list-390.png`
- `ops/evidence/ot-12/screenshots/crm-detail-390.png`
- `ops/evidence/ot-12/screenshots/crm-list-tablet.png`
- `ops/evidence/ot-12/screenshots/crm-detail-tablet.png`
- `ops/evidence/ot-12/screenshots/crm-list-desktop.png`
- `ops/evidence/ot-12/screenshots/crm-detail-desktop.png`

## Bundle, Request, And Performance Results

- `public.js`: `5646` bytes.
- `public.css`: `10539` bytes.
- `app-crm.js`: `204369` bytes.
- Public pages do not load the CRM app bundle.
- Initial authenticated CRM list stayed within the 5 application API request budget.
- Contact detail stayed within the 3 additional application API request budget.
- Performance command passed the CRM list/detail usable-mark gates:
  - list usable budget: `<= 2500ms`
  - detail usable budget: `<= 3000ms`
  - marks: `ot-crm-list-usable`, `ot-crm-detail-usable`

## Synthetic Lead-To-CRM Proof

- E2E test creates a synthetic public signup through `/signup`.
- The signup appears exactly once in authenticated `/app/crm`.
- The row opens the correct contact detail.
- Duplicate public replay stays one contact/lead.
- Manual CRM create/edit creates no outbox events, sends no external message, and grants no access/payment/member state.

## Verification Commands

- `npm run lint` - pass.
- `npm run typecheck` - pass.
- `npm run unit` - pass, 7/7.
- `npm run integration` - pass, 11/11.
- `npm run e2e` - pass, 6/6.
- `npm run accessibility` - pass, 3/3.
- `npm run performance` - pass, 3/3 plus bundle check.
- `npx prettier --check --ignore-unknown <OT-12 changed files>` - pass.
- `node --import tsx ops/evidence/ot-12/capture-screenshots.mjs` - pass, screenshots written.
- `rg -n "BNA|bna|Operations|operations|provider\\.html|View as Rabbi" dist/apps/web/public/assets/app-crm.js dist/apps/web/public/app/crm.html apps/web/src/client/app packages/domain/src/crm apps/web/src/server/app.ts` - no matches.

Known repo-wide note:

- `npm run format` still reports baseline formatting warnings across pre-existing files outside this OT-12 scope. OT-12 changed files pass Prettier with `--ignore-unknown`.

## Boundaries Confirmed

- BNA repo/source was not modified for OT-12 implementation.
- Production Rabbi database was not accessed or migrated.
- Railway, DNS, and deployment were not changed.
- Legacy spreadsheets and the historical 88 contacts were not imported.
- Telegram, external messaging, payments, member access, billing, communications, tasks, relationships, classes, Studio, agents, and BNA control-plane UI were not implemented or invoked.
- No `BNA`, `Operations`, `provider.html`, or `View as Rabbi` references are present in the CRM app bundle/source check.
