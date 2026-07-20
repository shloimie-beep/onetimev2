# ONE-TIME-FINISH-NOW Final Report

Generated: 2026-07-19T15:47:39.209Z

CORE_RELEASE: BLOCKED_BY_CORE_SAFETY_GATE
ADMIN_ACCESS: ACCEPTED
PARENT_ACCESS: ACCEPTED
STUDENT_ACCESS: ACCEPTED
CRM_REAL_DATA: PREVIEW_READY

## Verdict

The One Time core runtime is live and healthy on production and staging at
`rabbi-day-one-crm-ed77a04` /
`ed77a04dd24391d5b79be7f839d7f5752a57e0f9`. PR #92 has recorded runtime
deployment proof, rollback/roll-forward proof, CRM approval raw, corrected
counts-only real-source preflight, guarded local CRM apply code, protected
transactional email inputs, staging delivered transactional email proof,
production transactional email deployment/smoke proof, and current production
read-only launch-spine route proof. The full release definition in the attached
prompt cannot be truthfully closed yet. The remaining gaps are exact safety-gate
blockers: final production admin access/controlled transactional send, CRM
production apply gates, provider canary authorization, protected diagnostics
token, and the consuming parts of production launch-spine proof.

This is not a product-code failure. The app is fail-closed in the right places.
Missing provider/private inputs block only their lanes.

PR #92 pushed evidence head inspected before this handoff refresh was
`92e17cedba4e0ad5a99cd132772ff7a4acadb409`. GitHub Actions at that head showed
the same platform/pre-step failure pattern as earlier PR #92 heads: all five
jobs completed as failure with `steps:null` and `logs_url:null`, while local
validation and live smokes passed. The deployed runtime source remains
`ed77a04dd24391d5b79be7f839d7f5752a57e0f9`; later handoff commits should be
read from PR #92 or `git rev-parse HEAD`.

## Current Live Truth

- Production: `https://join.onetimeonetime.com`
- Staging: `https://ot99-web-staging.up.railway.app`
- Live version: `rabbi-day-one-crm-ed77a04`
- Live runtime SHA: `ed77a04dd24391d5b79be7f839d7f5752a57e0f9`
- Latest migration from `/ready`: `2203_w13_100_student_gamification`
- Canonical draft PR: `https://github.com/webcraft-media/onetimev2/pull/91`
- PR #91 head: `e3d3736546f48b3834d6698838befe20884005f1`
- Release tag: pending post-PR #92 transactional-email release tag.

Railway readback:

- Production web deployment: `a3a9328c-3fb5-41c6-b8d4-cf402f400ca7`
- Production worker deployment: `37ce9edf-d7aa-40fc-a013-87dde0f29e72`
- Production web image digest:
  `sha256:074d98ee85b47b6c4d9e7da12d709858452962f0e0094328b47581d60b3520aa`
- Production worker image digest:
  `sha256:69e95b261899044411e252327e89e570b2d71ab60578eb0f7ef8890f28a1fc1c`
- Staging web deployment: `0bf927dd-bab7-407b-afd2-35983d8c7351`
- Staging worker deployment: `385e3b5b-41f4-417d-996b-09e3b1a1f8e3`
- Staging web image digest:
  `sha256:0f70e2002127851826d74a51ec8a3671105b955f55b0667e0a6907c63d095ae6`
- Staging worker image digest:
  `sha256:9c97c969816bc928e52bdec5bce39fdb5d8734e524e7d208568bf1da2c878ffe`

## Access And CRM

W13-103 production protected browser acceptance proved separate administrator,
parent, and student access. That protected handoff remains the accepted access
baseline; W13-104 did not rerun consuming setup/reset links to avoid invalidating
the operator handoff.

Transactional email is deployed, but the final production send/admin access
proof is still blocked.
`ops/codex-runs/RABBI-DAY-ONE-CRM/email-inputs-preflight.json` verifies
protected Resend key, webhook secret, approved domain, approved sender,
approved reply-to, operator canary destination, authorization id, and private
Railway manifest are present and policy-matching without printing raw values.
`ops/codex-runs/RABBI-DAY-ONE-CRM/transactional-email-release.json` records one
controlled staging owner/admin lifecycle email as `provider_delivered` and
records production web/worker deployment plus `/version`, `/health`, and
`/ready` smokes. Production controlled transactional send and final admin access
were not performed because production has zero active owner/admin users; fresh
bootstrap or role-access authorization is required.

CRM real data is preview-ready only. The operator chat approval was preserved
exactly in `CRM-IMPORT-APPROVAL-RAW.md`, a protected private checkpoint manifest
was created outside git, the corrected CRM-first counts-only real-source
preflight completed with status `done`, and the guarded apply writer is
implemented locally with synthetic integration evidence. No production CRM apply
was performed.

The CRM production apply readiness preflight is now recorded at
`ops/codex-runs/RABBI-DAY-ONE-CRM/crm-apply-readiness-preflight.json`. It
confirms source packet, corrected dry-run proof, private authorization, operator
authorization, idempotency, manual-review handling, and production DB
configuration are present, then blocks before any write, send, or provider
mutation.

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

No real import may be applied until fresh backup proof JSON, created-by user
key, and `RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK` are present. The exact
dry-run/count authorization, production DB configuration, idempotency key, and
manual-review exclusion/terminal handling are already present in protected
inputs and sanitized preflight evidence.

Launch-spine consume readiness is now preflighted at
`ops/codex-runs/ONE-TIME-FINISH-NOW/launch-spine-consume-readiness-preflight.json`.
It accepts the current read-only route proof and W13-103 role baseline, then
blocks before any form submit, production write, setup/reset link consumption,
send, or provider mutation.

Provider canary readiness is now preflighted at
`ops/codex-runs/ONE-TIME-FINISH-NOW/provider-canary-readiness-preflight.json`.
It reads the W13-104 provider report, excludes transactional email because that
has a separate canary gate, and blocks WhatsApp, Telegram, Zoom, Vimeo, OpenAI
helper, BNA support, Stripe TEST, and Buffer before any provider call, send,
write, charge, or production DB access.

## Blockers

- Email/admin access: protected Resend inputs are present, Railway variables are
  configured on staging and production, staging controlled transactional email
  was delivered, and production is deployed/smoked. Production controlled send
  and final admin access remain blocked because production has no active
  owner/admin actor.
- CRM apply: operator approval, corrected dry-run preflight, and guarded local
  apply code are recorded, but production apply readiness remains blocked by
  missing fresh backup proof JSON, created-by user key, and
  `RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK`.
- Provider canaries: W13-104 provider evidence is present, but all eight
  non-email provider lanes remain not ready to run. The protected canary
  manifest, exact operator authorization, provider runtime inputs, and
  `ONE-TIME-PROVIDER-CANARIES-OK` confirmation are missing.
- Diagnostics: missing `OPERATIONS_PROBE_TOKEN`.
- Launch spine: current read-only production route proof passed, and consume
  readiness is preflighted, but consuming administrator/parent/student browser
  journeys or production signup submit remain blocked by missing protected
  consume plan, cleanup instructions, exact operator authorization, production
  confirmation, and private journey/signup inputs.

## External Effects

This ONE-TIME-FINISH-NOW session performed twelve staging deployments total and
three production deployments in the CRM-first transactional email slice,
including one superseded production web hygiene deploy. It performed one staging
database write for the controlled lifecycle invitation/test and one staging
external email send. It performed zero production database writes, zero
production CRM import applies, zero production email sends, zero WhatsApp or
Telegram sends, zero Stripe charges, zero DNS changes, zero provider mutations,
and printed/committed no secrets.

## Validation

- JSON parse check passed for run, director, capability, CRM preflight,
  synthetic probe, and launch-spine route-readback JSON files after the
  launch-spine read-only evidence refresh.
- `npm run director:truth` passed after the launch-spine read-only evidence
  refresh.
- `npm run director:truth:live` passed against production and staging
  `/version` after the transactional email deployment evidence refresh.
- `npm run secret:scan` passed across 1721 repo text files after the
  transactional email deployment evidence refresh.
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
  `3e9b286c51d71530cccf192f4ce01b905c73c2e1`. At pushed evidence head
  `92e17cedba4e0ad5a99cd132772ff7a4acadb409`, GitHub checks failed with the
  same pre-step/platform pattern as earlier: all five jobs completed with
  `steps:null` and `logs_url:null`, while local validation and live smokes
  passed. Read the PR or `git rev-parse HEAD` for the current branch head after
  later handoff commits.
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
- CRM apply readiness preflight generated a sanitized blocked report with source
  packet, corrected dry-run proof, private/operator authorization, idempotency,
  manual-review handling, and production DB configuration present; no DB writes,
  no external sends, and no provider mutation were performed.
- Email-inputs preflight passed focused unit coverage and generated a sanitized
  report: protected Resend/sender/reply-to/canary/private manifest inputs
  present, no raw values included.
- Transactional email release proof records staging controlled lifecycle email
  as `provider_delivered`, production deployed/smoked, and production
  controlled send blocked by zero active owner/admin users.
- CRM private checkpoint manifest was created outside git with
  `dry_run_authorized=true` and `production_apply_authorized=false`; contents
  were not printed or committed.
- Current production launch-spine read-only route proof passed: 16 of 16
  GET-only checks passed, no form submits, no setup/reset links consumed, no
  production writes, route-readback SHA-256
  `120b0a9129c8937b679cb7016b0be510e855eead26d689561e7781db8988f1e9`.
- Launch-spine consume readiness preflight generated a sanitized blocked report
  with current read-only route proof and W13-103 role baseline present, no form
  submits, no setup/reset links consumed, no production writes, no external
  sends, and no provider mutation. Required exact authorization:
  `APPROVE_ONE_TIME_PRODUCTION_LAUNCH_SPINE_CONSUME:120b0a9129c8937b679cb7016b0be510e855eead26d689561e7781db8988f1e9:7c342640c2ff7bb886e0b79f43ec9f3466283279e7bbfcf3cd65ee39f976e41a:production`.
- Provider canary readiness preflight generated a sanitized blocked report with
  W13-104 provider evidence present, all eight non-email provider lanes blocked
  before external mutation, no provider calls, no sends, no provider writes, no
  live charges, and no production DB access. Required exact authorization:
  `APPROVE_ONE_TIME_PROVIDER_CANARIES:072c4f00a22a7ca406792b55208b827c16c9dc39e651894ba708dc30777524ac:whatsapp,telegram,zoom,vimeo,openai_helper,bna_support,stripe_test,buffer:production`.
- Current OPS-06 production synthetic probes returned the expected blocked
  status: public/login/readiness/private-denial probes passed, and protected
  diagnostics remained blocked by missing `OPERATIONS_PROBE_TOKEN`. Synthetic
  JSON SHA-256:
  `7c342640c2ff7bb886e0b79f43ec9f3466283279e7bbfcf3cd65ee39f976e41a`.
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
- `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-apply-readiness-preflight.json`
- `ops/codex-runs/RABBI-DAY-ONE-CRM/email-inputs-preflight.json`
- `ops/codex-runs/RABBI-DAY-ONE-CRM/transactional-email-release.json`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/PRODUCTION-LAUNCH-SPINE-READONLY-REPORT.md`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/production-launch-spine-readonly/*`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/launch-spine-consume-readiness-preflight.json`
- `scripts/w12-100/launch/launch-spine-consume-readiness-preflight.ts`
- `tests/unit/w12-100-launch/launch-spine-consume-readiness-preflight.test.ts`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/provider-canary-readiness-preflight.json`
- `scripts/w12-100/providers/provider-canary-readiness-preflight.ts`
- `tests/unit/w12-100-providers/provider-canary-readiness-preflight.test.ts`
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
