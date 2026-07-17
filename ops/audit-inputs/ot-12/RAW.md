# OT-12 Raw Request

Source channel: `codex_attachment`
Captured at: `2026-07-14`
Attachment path: `C:\Users\User\.codex\attachments\a92a03ae-0d88-40fd-9f75-5483d2af7337\pasted-text.txt`

```text
TASK ID: OT-12
ROLE: One Time CRM Core V1 implementation owner
BASE BRANCH: codex/foundation-landing-lead-v1
WRITE SCOPE: OneTimeOneTime repository only
DELIVERY BRANCH: codex/crm-core-v1

GOAL

Implement the first real authenticated One Time CRM vertical slice:

public synthetic signup
  -> canonical contact/lead
  -> authenticated CRM list
  -> contact overview
  -> safe create/edit

The release proof is:

One synthetic public signup appears exactly once in a fast, mobile-usable CRM
list and opens into the correct contact detail.

BOUNDARIES

- Do not modify BNA.
- Do not access or migrate the production Rabbi database.
- Do not import legacy spreadsheets or the historical 88 contacts.
- Do not send messages or create accounts for real people.
- Do not deploy or change Railway.
- Do not implement communications, tasks, relationships, billing, classes,
  Studio, agents, Telegram, or BNA control-plane UI.
- Do not show placeholders or nonfunctional controls for deferred features.
- Do not load Operations, provider.html, or any BNA bundle.
- Do not implement â€œView as Rabbi.â€

AUTHENTICATION FOUNDATION

Implement standalone One Time authentication with:

- database-backed users, roles, sessions, and audit records
- Argon2id password hashes
- secure HTTP-only SameSite cookies
- product-specific cookie name with no broad parent-domain cookie
- session rotation and revocation
- CSRF protection for state-changing browser requests
- login rate limiting
- privacy-safe errors
- roles:
  - owner
  - admin
  - crm_agent
  - viewer
- customer-facing role display should use clear terms such as â€œAdministratorâ€;
  do not display confusing ownership language in ordinary CRM navigation
- production owner/admin access requires MFA capability before production launch
- test/staging uses synthetic fixture identities only
- no committed passwords, recovery codes, session tokens, or permanent bootstrap
  credentials
- no shared BNA session, user table, or cookie

ROUTES

Implement:

- GET /login
- POST /api/v1/auth/login
- POST /api/v1/auth/logout
- GET /api/v1/auth/session
- GET /app/crm
- GET /app/crm/contacts/:contactId
- GET /api/v1/crm/contacts
- POST /api/v1/crm/contacts
- GET /api/v1/crm/contacts/:contactId
- PATCH /api/v1/crm/contacts/:contactId

Unauthenticated access redirects safely to /login while preserving only a safe
first-party return path.

CRM LIST

Include:

- clear page title: CRM
- search
- bounded server-side filters
- active-filter chips
- mobile filter drawer or intentional horizontal scroller
- sort
- Add contact for permitted roles
- deterministic keyset pagination
- contact rows/cards with:
  - readable name
  - Family/School classification
  - lead status
  - email/phone where permitted
  - source
  - assigned team member when present
  - last activity
- functional row-open behavior
- loading, empty, error, forbidden, and expired-session states

Names and interactive content must use full readable contrast. Do not reproduce
the faded-text problem.

Do not show exact global totals requiring unbounded count queries.

CONTACT OVERVIEW

Include:

- display name
- Family/School classification
- lead status
- email and phone
- location and timezone
- source and offer/content version
- reminder preference
- consent and suppression state
- created/updated/last-activity timestamps
- audit-safe signup provenance
- functional Edit and Back
- no communications/tasks/relationships tabs until those modules exist

CREATE/EDIT

Support only core local fields:

- contact name
- Family/School classification
- email
- phone/WhatsApp
- location
- timezone
- lead status
- assigned team member where authorized
- concise internal note where supported safely

Requirements:

- shared runtime validation contracts
- optimistic-concurrency/version protection
- privacy-safe duplicate handling
- manual create may offer â€œOpen existing contactâ€
- public repeat submission remains idempotent and does not expose contact
  existence
- edits create audit events
- CRM edits send no external message and grant no access/payment/member status

DATA

Add only forward-compatible, additive migration(s), likely beginning with:

- authentication/session/role tables
- contact version/archive-compatible fields if not already present
- bounded indexes needed for CRM list/search/filter/sort

Do not alter migration 0001 after it has been published or deployed. Create a
new numbered migration.

Use canonical onetime tables and repositories. Do not expose legacy table names
or IDs through the API or UI.

APP SHELL

- Separate authenticated bundle
- Public landing/signup must not import it
- One Time black/yellow brand tokens
- Consistent app header and mobile navigation
- CRM appears exactly once in main navigation
- Do not add empty navigation destinations
- No BNA branding or global super-admin chrome
- No duplicated main/subcategory toolbars
- 44px minimum interaction targets
- keyboard and screen-reader operation
- no horizontal page overflow

API AND PERFORMANCE BUDGETS

- initial CRM list: no more than 5 application API requests
- detail: no more than 3 additional application API requests
- do not load deferred communication/task/relationship data
- list usable mobile cold p75 â‰¤2.5 seconds
- detail usable mobile cold p75 â‰¤3.0 seconds
- warm return route â‰¤1.5 seconds
- explicit functional usable marks, never networkidle
- bounded SQL with no N+1 behavior
- record Server-Timing for handler, pool, and DB
- preserve the public bundle budgets

TESTS

Include:

1. Authentication/session/CSRF/rate-limit tests.
2. Negative role and cross-account authorization tests.
3. Public signup appears once in CRM.
4. Duplicate public replay remains one contact/lead.
5. List/search/filter/sort/pagination.
6. Contact detail.
7. Create/edit and version conflict.
8. Privacy-safe duplicate behavior.
9. No external side effects.
10. Mobile 360/390 behavior.
11. Readable-name contrast and interaction targets.
12. Keyboard/accessibility.
13. No BNA/Operations imports or network requests.
14. Public pages do not load CRM assets.
15. Request-count and throttled performance gates.
16. Browser back/forward and warm-return behavior.

WORKFLOW

1. Create a separate worktree from the published OT-06 feature branch.
2. Create branch codex/crm-core-v1.
3. Do not modify the OT-06 worktree.
4. Keep shared-foundation edits minimal and justified.
5. Commit in bounded units:
   - feat: add standalone One Time authentication core
   - feat: add bounded CRM contact API
   - feat: add responsive CRM list and detail
   - feat: add safe CRM create and edit
   - test: certify lead-to-CRM vertical slice
6. Run the full verification suite.
7. Push the CRM branch.
8. Open a draft PR targeting codex/foundation-landing-lead-v1.
9. Do not merge or deploy.

FINAL REPORT

Return:

- branch and commit SHAs
- draft PR URL
- migration names/checksums
- routes and API contracts
- auth/session design
- screenshots at 360, 390, tablet, and desktop
- bundle sizes
- request counts
- performance results
- synthetic lead-to-CRM proof
- commands and test results
- unresolved blockers
- explicit confirmation that BNA, production DB, Railway, DNS, legacy data,
  Telegram, and external messaging were untouched
```
