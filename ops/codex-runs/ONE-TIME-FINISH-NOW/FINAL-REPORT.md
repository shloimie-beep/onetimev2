# ONE-TIME-FINISH-NOW Final Report

Generated: 2026-07-19T14:52:52.0505712+03:00

CORE_RELEASE: BLOCKED_BY_CORE_SAFETY_GATE
ADMIN_ACCESS: ACCEPTED
PARENT_ACCESS: ACCEPTED
STUDENT_ACCESS: ACCEPTED
CRM_REAL_DATA: PREVIEW_READY

## Verdict

The One Time core runtime is already live and healthy on production and staging
at W13-104, but the full release definition in the attached prompt cannot be
truthfully closed yet. The remaining gaps are exact safety-gate blockers:
normal transactional email configuration, protected CRM import authorization,
provider canary authorization, protected diagnostics token, source-authoritative
rollback proof, and current launch-spine proof.

This is not a product-code failure. The app is fail-closed in the right places.
Missing provider/private inputs block only their lanes.

PR #92 now also contains CI-green runtime deployment proof code at
`504560f77cbceae4675cba49e57f21ab55568467`. That code adds non-secret Railway
deployment identity to `/version` and teaches the launch toolkit to validate it,
but it is not live-proven until staging is deployed and rollback/roll-forward is
rerun with deployment metadata and image digests bound to `/version.deployment`.

## Current Live Truth

- Production: `https://join.onetimeonetime.com`
- Staging: `https://ot99-web-staging.up.railway.app`
- Live version: `w13-104-public-cls-688fc70`
- Live runtime SHA: `688fc70cf64b72bc52f4ea7511d8593750d7ab45`
- Latest migration from `/ready`: `2203_w13_100_student_gamification`
- Canonical draft PR: `https://github.com/webcraft-media/onetimev2/pull/91`
- PR #91 head: `e3d3736546f48b3834d6698838befe20884005f1`
- Release tag seen locally: `onetime-w13-104-production-20260719T0656Z`

Railway readback:

- Production web deployment: `74a6b736-dd67-4966-bdf6-b7dd80280d1a`
- Production worker deployment: `0a0d730c-fa00-4338-b446-a8dcb8832c17`
- Staging web deployment: `e32187d8-a32b-401d-ae8a-37d87af1a203`
- Staging worker deployment: `9f49ae76-3daf-4813-b01d-20e11867564a`

## Access And CRM

W13-103 production protected browser acceptance proved separate administrator,
parent, and student access. That protected handoff remains the accepted access
baseline; W13-104 did not rerun consuming setup/reset links to avoid invalidating
the operator handoff.

Transactional email is still blocked. Missing input:
`EMAIL-INPUTS.private.json`, plus protected Resend/sender/reply-to runtime
values.

CRM real data is preview-ready only. OPS-13A contains sanitized source inventory
and counts-only preview input, but no real import may be applied until
`CRM-IMPORT-AUTHORIZATION.private.json` identifies the accepted source hashes,
tag map, and apply authorization.

## Blockers

- Email: missing protected email inputs and runtime variables.
- CRM apply: missing protected import authorization manifest.
- Provider canaries: missing protected canary authorization manifest.
- Diagnostics: missing `OPERATIONS_PROBE_TOKEN`.
- Rollback: W13-104 staging source-rebuild rollback and roll-forward were
  exercised, but the gate is not accepted because `/version` stayed W13-104
  during the rollback-source deploy. PR #92 implements the next proof path, but
  that path is not live-accepted yet.
- Launch spine: W13-104 production signup submit and current role browser
  acceptance were not rerun.

## External Effects

This ONE-TIME-FINISH-NOW session performed four staging deployments for the
rollback/roll-forward rehearsal. It performed no production deployment,
production database write, CRM import apply, email send, WhatsApp or Telegram
send, Stripe charge, DNS change, provider mutation, or secret print.

The W13-104 evidence inspected during this run records the prior successful
staging and production deployments.

No staging deployment was performed for PR #92 commit `504560f` in this update.

## Validation

- JSON parse check passed for run and refreshed director JSON files.
- `npm run director:truth` passed.
- `npm run director:truth:live` passed against production and staging
  `/version`.
- `npm run secret:scan` passed across 1662 repo text files.
- `npm ci` passed from the lockfile.
- Targeted ESLint passed for touched runtime proof files.
- `npx --no-install vitest run scripts/w12-100/deploy/railway-launch-toolkit.test.ts`
  passed.
- `npm run integration -- tests/integration/runtime-version-proof.test.ts`
  passed.
- `npm run unit` passed.
- `npm run build` passed.
- PR #92 checks passed at
  `504560f77cbceae4675cba49e57f21ab55568467`: Node 24 verify, OPS-06,
  PostgreSQL 18 assurance/restore, and PostgreSQL 16 assurance.
- `node --check scripts/check-director-truth.mjs` passed.
- W13-104 staging roll-forward smoke passed `/version`, `/health`, `/ready`,
  `/`, `/signup`, `/login`, `/activate`, and `/forgot-password`.
- Staging rollback rehearsal is recorded as
  `partial_not_accepted_version_endpoint_not_source_authoritative`.
- `npx --no-install eslint scripts/check-director-truth.mjs` did not run:
  local `node_modules` is absent and `npx` resolved an incompatible global
  ESLint before loading `@eslint/js`.
- `git diff --check` passed with Windows line-ending warnings only.

## Files Created Or Refreshed

- `ops/codex-runs/ONE-TIME-FINISH-NOW/ORIGINAL-PROMPT.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/STATE.json`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/DECISIONS.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/CAPABILITY-MATRIX.json`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/RESUME.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/FINAL-REPORT.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/STAGING-ROLLBACK-REPORT.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/staging-rollback/*`
- `ops/director/START-HERE.md`
- `ops/director/CURRENT-STATE.json`
- `ops/director/CAPABILITY-MATRIX.json`
- `ops/director/DEPLOYMENTS.json`
- `scripts/check-director-truth.mjs`
- `.dockerignore`
- `apps/web/src/server/app.ts`
- `packages/config/src/index.ts`
- `scripts/w12-100/deploy/railway-launch-toolkit.ts`
- `scripts/w12-100/deploy/railway-launch-toolkit.test.ts`
- `tests/integration/runtime-version-proof.test.ts`
- `package.json`
