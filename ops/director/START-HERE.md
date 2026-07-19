# One Time Director Start Here

Generated: 2026-07-19T16:58:00.000Z

This folder is the canonical director handoff for fresh ChatGPT or Codex
sessions working on `webcraft-media/onetimev2`. It records the current release
state without depending on local chat memory.

## Read Order

1. `AGENTS.md`
2. `ops/director/START-HERE.md`
3. `ops/director/CURRENT-STATE.json`
4. `ops/director/CAPABILITY-MATRIX.json`
5. `ops/director/DEPLOYMENTS.json`
6. `ops/codex-runs/RABBI-DAY-ONE-CRM/STATE.json`
7. `ops/codex-runs/RABBI-DAY-ONE-CRM/MILESTONE.md`
8. `ops/codex-runs/ONE-TIME-FINISH-NOW/FINAL-REPORT.md`
9. `ops/codex-runs/ONE-TIME-FINISH-NOW/RESUME.md`
10. `ops/director/PRODUCT-INVARIANTS.md`
11. `ops/director/DECISION-REGISTER.md`

## Current Truth

- Repository: `webcraft-media/onetimev2`
- Production URL: `https://join.onetimeonetime.com`
- Staging URL: `https://ot99-web-staging.up.railway.app`
- Production and staging `/version` read back:
  `rabbi-day-one-crm-ed77a04`
- Production and staging runtime SHA:
  `ed77a04dd24391d5b79be7f839d7f5752a57e0f9`
- Canonical draft PR:
  `https://github.com/webcraft-media/onetimev2/pull/91`
- PR #91 head:
  `e3d3736546f48b3834d6698838befe20884005f1`
- PR #91 required checks were green when inspected on 2026-07-19.
- Production `/health` and `/ready` were ok.
- Staging `/health` and `/ready` were ok.
- Latest migration from production `/ready`:
  `2204_w12_100_real_source_crm_apply`
- Current release run:
  `ops/codex-runs/RABBI-DAY-ONE-CRM/`
- ONE-TIME-FINISH-NOW remediation PR:
  `https://github.com/webcraft-media/onetimev2/pull/92`
- PR #92 CRM production evidence commit:
  `25c271576be675c36261465e51d4f176a923b007`
- PR #92 deployed runtime remains `ed77a04dd24391d5b79be7f839d7f5752a57e0f9`; the CRM-first evidence at commit `25c271576be675c36261465e51d4f176a923b007` records production migration 2204, real CRM import apply, idempotency replay, reconciliation, and one production signup proof.
- GitHub Actions on that CRM production evidence commit completed as failure for
  all five PR #92 jobs, but the gh-fix-ci inspector reported job logs
  unavailable (`log not found`) for every job id. Local validation and
  production smokes passed.

## Current Verdict

CORE_RELEASE: BLOCKED_BY_CORE_SAFETY_GATE
ADMIN_ACCESS: ACCEPTED
PARENT_ACCESS: ACCEPTED
STUDENT_ACCESS: ACCEPTED
CRM_REAL_DATA: ACCEPTED

The safe core is live, PR #92 transactional email code/config is deployed to
staging and production, and the CRM-first pivot delivered real production CRM
data. The real-source CRM apply used a fresh protected PostgreSQL 18 backup
proof, exact operator authorization, production confirmation, active admin actor
attribution, and idempotency replay. It inserted 1,555 contacts, skipped 4
existing contacts, recorded 2,505 import-row ledger rows, and queued zero sends.
The full release gate remains blocked only by the still-separate lanes: fresh
production final admin/access send or browser smoke, WhatsApp provider canary,
campaign seed copy/approval, protected diagnostics token, and broader
launch-spine consuming proof.

The earlier accepted staging runtime proof lives at
`ops/codex-runs/ONE-TIME-FINISH-NOW/STAGING-RUNTIME-PROOF-REPORT.md` and
`ops/codex-runs/ONE-TIME-FINISH-NOW/staging-runtime-proof/SUMMARY.json`. It
deployed PR #92 to staging, rolled back to W13-104, and rolled forward to PR
#92 with `/version.deployment.deployment_id` matching Railway web deployment
`c464ea23-649b-4c8d-b4af-0d10c5ce3022`.

The current transactional-email production deployment evidence lives at
`ops/codex-runs/RABBI-DAY-ONE-CRM/transactional-email-release.json`. Staging
Railway web `0bf927dd-bab7-407b-afd2-35983d8c7351` and worker
`385e3b5b-41f4-417d-996b-09e3b1a1f8e3` deployed with protected variables and
passed `/version`, `/health`, and `/ready`; one controlled staging
owner/admin lifecycle email was provider-delivered to the protected operator
inbox. Production Railway web `a3a9328c-3fb5-41c6-b8d4-cf402f400ca7` and worker
`37ce9edf-d7aa-40fc-a013-87dde0f29e72` deployed with protected variables and
passed `/version`, `/health`, and `/ready`. Production controlled transactional
send and final admin/access browser smoke were not rerun in the CRM import
slice; prior W13-103 admin acceptance remains protected evidence, and no setup
link was consumed here.

CRM real-data dry-run evidence lives at
`ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-IMPORT-APPROVAL-RAW.md`,
`ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-REAL-DATA-PREFLIGHT.json`,
`ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-REAL-DATA-PREFLIGHT-REPORT.md`, and the
current compact pivot files under `ops/codex-runs/RABBI-DAY-ONE-CRM/`. The
corrected pivot dry-run status is `done`; report SHA-256 is
`93be5a0837d3d90f8995e873c2ea302987f45e0e52de79f08170f01a6223f1d8`; it found
2,505 total rows, 1,596 unique identities, 1,559 CRM-importable contacts, 1,357
email-campaign-eligible contacts, 0 WhatsApp-campaign-eligible contacts, and
848 manual-review rows. Production apply evidence lives at
`ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-apply.json`,
`ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-apply-replay.json`, and
`ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-reconcile.json`; production
signup proof lives at
`ops/codex-runs/RABBI-DAY-ONE-CRM/production-signup-proof.json`.

CRM production apply readiness evidence lives at
`ops/codex-runs/RABBI-DAY-ONE-CRM/crm-apply-readiness-preflight.json`. It
is `ready`; the production apply has already been performed exactly once and
replayed with `database_writes_performed=false`.

Transactional email preflight evidence lives at
`ops/codex-runs/RABBI-DAY-ONE-CRM/email-inputs-preflight.json`, and release
evidence lives at
`ops/codex-runs/RABBI-DAY-ONE-CRM/transactional-email-release.json`. Protected
Resend key, webhook secret, domain, sender, reply-to, operator canary
destination, and private manifest inputs are present and policy-matching.
Staging controlled transactional email was delivered. Production final
admin/access send remains a separate deliberate action; no broad campaign send
is authorized from this handoff.

Production launch-spine read-only evidence lives at
`ops/codex-runs/ONE-TIME-FINISH-NOW/PRODUCTION-LAUNCH-SPINE-READONLY-REPORT.md`
and `ops/codex-runs/ONE-TIME-FINISH-NOW/production-launch-spine-readonly/`.
The wider route readback passed 16 of 16 GET-only checks, including account
lifecycle pages and anonymous denial for private app routes. The OPS-06
synthetic probe passed public/login/readiness/private-denial checks and remains
blocked only for protected worker diagnostics because `OPERATIONS_PROBE_TOKEN`
is absent. No production write, form submit, provider mutation, deployment, or
setup/reset-link consumption was performed.

Launch-spine consume readiness evidence lives at
`ops/codex-runs/ONE-TIME-FINISH-NOW/launch-spine-consume-readiness-preflight.json`.
It confirms the current read-only route proof and W13-103 role baseline are
available, then blocks before any form submit, production write, setup/reset
link consumption, send, or provider mutation because protected consuming-proof
inputs are missing.

Provider canary readiness evidence lives at
`ops/codex-runs/ONE-TIME-FINISH-NOW/provider-canary-readiness-preflight.json`.
It reads the W13-104 provider report and blocks WhatsApp, Telegram, Zoom,
Vimeo, OpenAI helper, BNA support, Stripe TEST, and Buffer before any provider
call, send, write, charge, or production DB access. Transactional email stays
under the separate email-inputs gate.

## What Not To Do From This Handoff

- Do not print or commit secrets, private manifests, setup/reset links,
  passwords, private email addresses, phone numbers, contact rows, or raw
  message bodies.
- Do not perform broad email, WhatsApp, Telegram, or social sends.
- Do not create live Stripe charges.
- Do not change DNS.
- Do not rerun production CRM import with a different source packet, backup
  proof, or idempotency key unless an explicit rollback/re-apply plan is created.
- Do not create or refresh production administrator access, consume setup/reset
  links, or run authenticated CRM browser smokes unless the operator explicitly
  approves that current protected action.
- Do not submit additional production signup leads unless they are
  operator-owned canaries with cleanup/idempotency recorded.
- Do not run Zoom, Vimeo, Stripe TEST, WhatsApp, Telegram, Buffer, OpenAI
  helper, or BNA support canaries until protected provider runtime inputs,
  `CANARY-AUTHORIZATION.private.json`, exact operator authorization, and
  `ONE-TIME-PROVIDER-CANARIES-OK` are present.
- Do not use the dirty BNA checkout for One Time product edits.

## Fast Orientation

- Use `CURRENT-STATE.json` for release refs, live readback, blockers, and
  safety notes.
- Use `CAPABILITY-MATRIX.json` for the required capability status list.
- Use `DEPLOYMENTS.json` for Railway production/staging deployment IDs.
- Use `ops/codex-runs/RABBI-DAY-ONE-CRM/MILESTONE.md` for the latest CRM-first
  status.
