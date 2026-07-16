# OPS-07 Read-Only Audit

## Candidate Result

`NO_INTEGRATED_CANDIDATE`. See `BASE-RESOLUTION.json`.

Because the required OT-99 integrated candidate is absent, OPS-07 source remediation and final exploit reproduction are blocked. This read-only audit is therefore limited to packet preservation, repo-shape inspection, candidate ancestry proof, and reusable test planning.

## Repository Surface On `origin/main`

Current checkout: `610b585f3d221addd4e7b824c92a5cc256cffcf9`

Observed files show a standalone One Time foundation:

- Express/Vite web app under `apps/web`.
- Worker entrypoint under `apps/worker`.
- PostgreSQL package and first migration under `packages/db`.
- Lead capture domain under `packages/domain/src/lead`.
- No `ops/execution/control/CANONICAL-CANDIDATE.json`.
- No OT-99 refs after fetch.
- No test files matched by `rg --files -g '*test*' -g '*spec*' -g 'vitest*' -g 'playwright*'`.

## Static Triage Commands Run

- `git grep -n -E 'account_key|product_key|household_key|learner_key|guardian_user_ref|assigned_user_key'`
- `git grep -n -E 'Cache-Control|setCookie|sameSite|secure:|httpOnly|csrf|return_to|safeReturn'`
- `git grep -n -E 'webhook|signature|timestamp|nonce|replay|idempot|update_id|event_id|delivery_id'`
- `git grep -n -E 'console\.|logger\.|analytics|support.*export|request\.body|req\.body'`
- `git grep -n -E 'https?://|passcode|join_url|playback|token|secret|recovery_code'`

## Triage Observations

- Account/product scope fields exist in the lead-slice migration and lead service.
- The public lead service stores idempotency records by account/product/idempotency key.
- Current public app uses Helmet CSP and a 32kb body limit.
- The current main branch does not contain the authenticated CRM, parent/student portals, provider webhooks, helper/KB, Stripe, Telegram, WhatsApp, Vimeo, Zoom, or social publishing surfaces required for final OPS-07 reproduction.
- `node_modules` is absent in this worktree, so npm-based validation requires dependency installation before it can run.

## Blocked Reproduction Areas Prepared

- Authorization/account/product/role isolation: see `AUTHORIZATION-RESULTS.json`.
- Learner privacy and parent/student lifecycle: see `AUTHORIZATION-RESULTS.json` and `POSTGRESQL-RESULTS.json`.
- Webhook/provider ingress: see `PROVIDER-FIXTURE-RESULTS.json`.
- Session, CSRF, return-route, idempotency, and audit integrity: see `NEGATIVE-TEST-RESULTS.json`.
- Prompt/tool injection and KB scope: see `PROMPT-SAFETY-RESULTS.json`.
- Provider-link/passcode/token leakage: see `DATA-SCAN-RESULTS.json`.
- Full 267-case negative matrix: see `NEGATIVE-TEST-RESULTS.json`.
