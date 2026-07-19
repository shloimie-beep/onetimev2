# ONE-TIME-FINISH-NOW Final Report

Generated: 2026-07-19T17:12:49.678+03:00

CORE_RELEASE: BLOCKED_BY_CORE_SAFETY_GATE
ADMIN_ACCESS: ACCEPTED
PARENT_ACCESS: ACCEPTED
STUDENT_ACCESS: ACCEPTED
CRM_REAL_DATA: PREVIEW_READY

## Verdict

The One Time core runtime is already live and healthy on production at W13-104.
The PR #92 staging candidate has passed runtime deployment proof plus
rollback/roll-forward proof. CRM approval raw, corrected counts-only real-source
preflight, guarded local CRM apply code, sanitized email-inputs preflight, and
current production read-only launch-spine route proof are now recorded, but the
full release definition in the attached prompt cannot be truthfully closed yet.
The remaining gaps are exact safety-gate blockers: transactional email
canary/manifest configuration, CRM production apply gates, provider canary
authorization, protected diagnostics token, and the consuming parts of
production launch-spine proof.

This is not a product-code failure. The app is fail-closed in the right places.
Missing provider/private inputs block only their lanes.

PR #92 CRM/email evidence head before this truth-refresh commit was
`0a93e82062e06d01ca50b3e79ffdfc9d40fcd87c`. The accepted staging runtime proof
deployed an earlier PR #92 source commit,
`ee9929008fc0068b3dcf9b86d11e7c21d1331c93`, and the final staging roll-forward
exposed non-secret Railway deployment identity at `/version.deployment`, bound
to deployment `c464ea23-649b-4c8d-b4af-0d10c5ce3022`, with all smoke routes
passing. The later CRM/email commits have not been deployed.

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
- Staging web deployment after PR #92 roll-forward:
  `c464ea23-649b-4c8d-b4af-0d10c5ce3022`
- Staging worker deployment after PR #92 roll-forward:
  `17f1970a-ec19-4fa8-8152-573b47f470ab`
- Final staging web image digest:
  `sha256:25d58d4a0661393a3d3d81e172dde87b610d8b97437162969615646e5c943234`
- Final staging worker image digest:
  `sha256:b213c58070b8d40b612351c5748bdf82e72b655014f8cc83e35a1ab0501a616d`

Staging `/version` still reports W13-104 `APP_VERSION` and `COMMIT_SHA` because
those values are environment-pinned. The new proof is the additional
`/version.deployment` object:

- `deployment_id`: `c464ea23-649b-4c8d-b4af-0d10c5ce3022`
- `snapshot_id`: `14354877-0df6-45e1-806a-47dbcf53b61c`
- `project_id`: `7c8eee26-7a6a-4684-826d-9f4377d67d46`
- `environment_id`: `11edf8a2-0160-45b4-a039-b15b4beb4c10`
- `service_id`: `9fb6d9f4-4f50-4df6-868b-c18a9b83d2f2`
- `git_commit_sha`: `null`

Railway CLI source deploys did not populate `RAILWAY_GIT_COMMIT_SHA`; source
binding therefore relies on exact detached deploy worktrees, deployment CLI
messages, Railway deployment IDs, image digests, and `/version.deployment`
readback.

## Access And CRM

W13-103 production protected browser acceptance proved separate administrator,
parent, and student access. That protected handoff remains the accepted access
baseline; W13-104 did not rerun consuming setup/reset links to avoid invalidating
the operator handoff.

Transactional email is still blocked, but the blocker is narrower now.
`ops/codex-runs/RABBI-DAY-ONE-CRM/email-inputs-preflight.json` verifies
protected Resend key, webhook secret, approved domain, approved sender, and
approved reply-to are present and policy-matching without printing raw values.
The remaining missing input is the protected operator canary destination file,
followed by private `EMAIL-INPUTS.private.json` generation, production variable
configuration, and one controlled operator-inbox canary send.

CRM real data is preview-ready only. The operator chat approval was preserved
exactly in `CRM-IMPORT-APPROVAL-RAW.md`, a protected private checkpoint manifest
was created outside git, the corrected CRM-first counts-only real-source
preflight completed with status `done`, and the guarded apply writer is
implemented locally with synthetic integration evidence. No production CRM apply
was performed.

CRM preflight summary:

- Report JSON:
  `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-corrected-dry-run.json`
- Report SHA-256:
  `93be5a0837d3d90f8995e873c2ea302987f45e0e52de79f08170f01a6223f1d8`
- Total rows processed counts-only: 2,505
- Unique identity count: 1,596
- CRM-importable contacts: 1,559
- Email-campaign-eligible contacts: 1,357
- WhatsApp-campaign-eligible contacts: 0
- Suppressed rows: 152
- Manual-review rows: 848

No real import may be applied until fresh backup proof JSON, exact dry-run
SHA/count authorization, DATABASE_URL, idempotency key, created-by user key,
`RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK`, and exclusion/terminal handling for
manual-review rows are all present.

## Blockers

- Email: protected Resend/domain/sender/reply-to inputs are present and
  policy-matching; missing protected operator canary destination file, private
  email inputs manifest, production variable configuration, and canary send
  proof.
- CRM apply: operator approval, corrected dry-run preflight, and guarded local
  apply code are recorded, but production apply remains blocked until fresh
  backup proof JSON, exact dry-run SHA/count authorization, DATABASE_URL,
  idempotency key, created-by user key,
  `RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK`, and exclusion/terminal handling for
  848 manual-review rows are present.
- Provider canaries: missing protected canary authorization manifest.
- Diagnostics: missing `OPERATIONS_PROBE_TOKEN`.
- Launch spine: current read-only production route proof passed, but consuming
  administrator/parent/student role-link browser journeys and production signup
  submit were not rerun. Those actions still require exact protected
  authorization and cleanup instructions.

## External Effects

This ONE-TIME-FINISH-NOW session performed ten staging deployments total: four
for the initial W13-104 rollback rehearsal and six for the accepted PR #92
runtime proof, rollback, and roll-forward sequence. It performed no production
deployment, production database write, CRM import apply, email send, WhatsApp
or Telegram send, Stripe charge, DNS change, provider mutation, or secret
print. The latest CRM/email refresh added corrected counts, guarded local apply
code, and sanitized email-inputs preflight; production database and external
systems were not mutated.

The W13-104 evidence inspected during this run records the prior successful
staging and production deployments.

Production was read only during the accepted PR #92 staging proof and during
this launch-spine read-only refresh. Production Railway deployment IDs and image
digests remained unchanged.

## Validation

- JSON parse check passed for run, director, capability, CRM preflight,
  synthetic probe, and launch-spine route-readback JSON files after the
  launch-spine read-only evidence refresh.
- `npm run director:truth` passed after the launch-spine read-only evidence
  refresh.
- `npm run director:truth:live` passed against production and staging
  `/version` after the launch-spine read-only evidence refresh.
- `npm run secret:scan` passed across 1702 repo text files after the
  launch-spine read-only evidence refresh.
- `npx --no-install prettier --check` passed for touched launch-spine,
  director, and run Markdown/JSON files.
- Route-proof privacy scan passed for `synthetic-probes.json` and
  `route-readback.json` with route-name-aware private-data patterns.
- `npm ci` passed from the lockfile.
- Targeted ESLint passed for touched runtime proof files.
- `npx --no-install vitest run scripts/w12-100/deploy/railway-launch-toolkit.test.ts`
  passed.
- `npx --no-install vitest run --config vitest.unit.config.ts tests/unit/w12-100-data/real-source-preflight.test.ts`
  passed.
- `npx --no-install vitest run --config vitest.integration.config.ts tests/integration/w12-100-data/real-source-preflight-cli.test.ts`
  passed.
- `npm run integration -- tests/integration/runtime-version-proof.test.ts`
  passed.
- `npm run unit` passed.
- `npm run build` passed.
- PR #92 checks passed at earlier head
  `3e9b286c51d71530cccf192f4ce01b905c73c2e1`. At CRM/email evidence head
  `0a93e82062e06d01ca50b3e79ffdfc9d40fcd87c`, GitHub checks failed before
  workflow steps/logs; local focused gates passed. Read the PR or
  `git rev-parse HEAD` for the current branch head after later docs-only truth
  refresh commits.
- `node --check scripts/check-director-truth.mjs` passed.
- Staging smoke routes passed for the PR #92 deploy, W13-104 rollback, and PR
  #92 roll-forward: `/version`, `/health`, `/ready`, `/`, `/signup`, `/login`,
  `/activate`, and `/forgot-password`.
- PR #92 staging runtime proof and rollback/roll-forward are recorded as
  `accepted_for_pr92_staging_candidate`.
- Corrected CRM-first real-data preflight passed counts-only with status
  `done`, no production side effects, and report SHA-256
  `93be5a0837d3d90f8995e873c2ea302987f45e0e52de79f08170f01a6223f1d8`.
- Guarded real-source CRM apply writer passed synthetic integration evidence;
  production apply performed zero writes.
- Email-inputs preflight passed focused unit coverage and generated a sanitized
  report: protected Resend/sender/reply-to inputs present, canary destination
  missing, no raw values included.
- CRM private checkpoint manifest was created outside git with
  `dry_run_authorized=true` and `production_apply_authorized=false`; contents
  were not printed or committed.
- Current production launch-spine read-only route proof passed: 16 of 16
  GET-only checks passed, no form submits, no setup/reset links consumed, no
  production writes, route-readback SHA-256
  `fb76363c92af59a4c8a62121b93fb4f229e1a60313f4df6a4b0f8ab14639151a`.
- Current OPS-06 production synthetic probes returned the expected blocked
  status: public/login/readiness/private-denial probes passed, and protected
  diagnostics remained blocked by missing `OPERATIONS_PROBE_TOKEN`. Synthetic
  JSON SHA-256:
  `25e296346076b7d4d7444b2ead1174f87d49012628e6cd206b8a2ed8ecb4e3cc`.
- `npx --no-install eslint scripts/check-director-truth.mjs` did not run:
  local `node_modules` is absent and `npx` resolved an incompatible global
  ESLint before loading `@eslint/js`.
- `git diff --check` passed after the launch-spine read-only evidence refresh
  with Windows line-ending warnings only.

## Files Created Or Refreshed

- `ops/codex-runs/ONE-TIME-FINISH-NOW/ORIGINAL-PROMPT.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/STATE.json`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/DECISIONS.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/CAPABILITY-MATRIX.json`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/RESUME.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/FINAL-REPORT.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-IMPORT-APPROVAL-RAW.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-REAL-DATA-PREFLIGHT.json`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-REAL-DATA-PREFLIGHT-REPORT.md`
- `ops/codex-runs/RABBI-DAY-ONE-CRM/STATE.json`
- `ops/codex-runs/RABBI-DAY-ONE-CRM/MILESTONE.md`
- `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-corrected-dry-run.json`
- `ops/codex-runs/RABBI-DAY-ONE-CRM/email-inputs-preflight.json`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/PRODUCTION-LAUNCH-SPINE-READONLY-REPORT.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/production-launch-spine-readonly/*`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/STAGING-ROLLBACK-REPORT.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/staging-rollback/*`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/STAGING-RUNTIME-PROOF-REPORT.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/staging-runtime-proof/*`
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
