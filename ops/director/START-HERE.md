# One Time Director Start Here

Generated: 2026-07-19T17:12:49.678+03:00

This folder is the canonical director handoff for fresh ChatGPT or Codex
sessions working on `webcraft-media/onetimev2`. It records the current release
state without depending on local chat memory.

## Read Order

1. `AGENTS.md`
2. `ops/director/START-HERE.md`
3. `ops/director/CURRENT-STATE.json`
4. `ops/director/CAPABILITY-MATRIX.json`
5. `ops/director/DEPLOYMENTS.json`
6. `ops/codex-runs/ONE-TIME-FINISH-NOW/FINAL-REPORT.md`
7. `ops/codex-runs/ONE-TIME-FINISH-NOW/RESUME.md`
8. `ops/director/PRODUCT-INVARIANTS.md`
9. `ops/director/DECISION-REGISTER.md`

## Current Truth

- Repository: `webcraft-media/onetimev2`
- Production URL: `https://join.onetimeonetime.com`
- Staging URL: `https://ot99-web-staging.up.railway.app`
- Production and staging `/version` read back:
  `w13-104-public-cls-688fc70`
- Production and staging runtime SHA:
  `688fc70cf64b72bc52f4ea7511d8593750d7ab45`
- Canonical draft PR:
  `https://github.com/webcraft-media/onetimev2/pull/91`
- PR #91 head:
  `e3d3736546f48b3834d6698838befe20884005f1`
- PR #91 required checks were green when inspected on 2026-07-19.
- Production `/health` and `/ready` were ok.
- Staging `/health` and `/ready` were ok.
- Latest migration from `/ready`:
  `2203_w13_100_student_gamification`
- Current release run:
  `ops/codex-runs/ONE-TIME-FINISH-NOW/`
- ONE-TIME-FINISH-NOW remediation PR:
  `https://github.com/webcraft-media/onetimev2/pull/92`
- PR #92 CRM/email evidence head before this truth-refresh commit:
  `0a93e82062e06d01ca50b3e79ffdfc9d40fcd87c`
- PR #92 checks at that evidence head failed before workflow steps/logs; local
  focused gates passed. Read the PR or `git rev-parse HEAD` for the current
  branch head after later docs-only truth refresh commits.

## Current Verdict

CORE_RELEASE: BLOCKED_BY_CORE_SAFETY_GATE
ADMIN_ACCESS: ACCEPTED
PARENT_ACCESS: ACCEPTED
STUDENT_ACCESS: ACCEPTED
CRM_REAL_DATA: PREVIEW_READY

The safe core is live, and PR #92 staging rollback/roll-forward is accepted for
the staging candidate. CRM approval raw, corrected counts-only real-source
preflight, a guarded local CRM apply writer, sanitized email-inputs preflight,
and current production read-only launch-spine route proof are recorded.
`CRM_REAL_DATA` remains `PREVIEW_READY` because production apply still requires
fresh backup proof JSON, exact dry-run SHA/count authorization, DATABASE_URL,
idempotency key, created-by user key, `RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK`,
and exclusion/terminal handling for manual-review rows. The full release gate
remains blocked by exact private-input/current-proof blockers: transactional
email canary/manifest, CRM apply gates, provider canary authorization, protected
diagnostics token, and the consuming parts of production launch-spine proof.

The accepted staging runtime proof lives at
`ops/codex-runs/ONE-TIME-FINISH-NOW/STAGING-RUNTIME-PROOF-REPORT.md` and
`ops/codex-runs/ONE-TIME-FINISH-NOW/staging-runtime-proof/SUMMARY.json`. It
deployed PR #92 to staging, rolled back to W13-104, and rolled forward to PR
#92 with `/version.deployment.deployment_id` matching Railway web deployment
`c464ea23-649b-4c8d-b4af-0d10c5ce3022`.

Staging `/version` still reports W13-104 `APP_VERSION` and `COMMIT_SHA` because
those values are environment-pinned. Railway did not populate
`RAILWAY_GIT_COMMIT_SHA` for the CLI source deploys, so source binding relies on
exact detached deploy worktrees, deployment CLI messages, Railway deployment
IDs, image digests, and `/version.deployment` readback.

CRM real-data dry-run evidence lives at
`ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-IMPORT-APPROVAL-RAW.md`,
`ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-REAL-DATA-PREFLIGHT.json`,
`ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-REAL-DATA-PREFLIGHT-REPORT.md`, and the
current compact pivot files under `ops/codex-runs/RABBI-DAY-ONE-CRM/`. The
corrected pivot dry-run status is `done`; report SHA-256 is
`93be5a0837d3d90f8995e873c2ea302987f45e0e52de79f08170f01a6223f1d8`; it found
2,505 total rows, 1,596 unique identities, 1,559 CRM-importable contacts, 1,357
email-campaign-eligible contacts, 0 WhatsApp-campaign-eligible contacts, and
848 manual-review rows. The guarded apply writer is implemented locally and
accepted with synthetic integration evidence. No production CRM apply was
performed.

CRM production apply readiness evidence lives at
`ops/codex-runs/RABBI-DAY-ONE-CRM/crm-apply-readiness-preflight.json`. It
confirms source packet and corrected dry-run proof are present, then blocks
before any DB connection, write, send, or provider mutation because protected
production-apply inputs are still missing.

Transactional email preflight evidence lives at
`ops/codex-runs/RABBI-DAY-ONE-CRM/email-inputs-preflight.json`. Protected Resend
key, webhook secret, domain, sender, and reply-to inputs are present and
policy-matching; the lane remains blocked by missing protected operator canary
destination file and private email inputs manifest. No email was sent.

Production launch-spine read-only evidence lives at
`ops/codex-runs/ONE-TIME-FINISH-NOW/PRODUCTION-LAUNCH-SPINE-READONLY-REPORT.md`
and `ops/codex-runs/ONE-TIME-FINISH-NOW/production-launch-spine-readonly/`.
The wider route readback passed 16 of 16 GET-only checks, including account
lifecycle pages and anonymous denial for private app routes. The OPS-06
synthetic probe passed public/login/readiness/private-denial checks and remains
blocked only for protected worker diagnostics because `OPERATIONS_PROBE_TOKEN`
is absent. No production write, form submit, provider mutation, deployment, or
setup/reset-link consumption was performed.

## What Not To Do From This Handoff

- Do not print or commit secrets, private manifests, setup/reset links,
  passwords, private email addresses, phone numbers, contact rows, or raw
  message bodies.
- Do not perform broad email, WhatsApp, Telegram, or social sends.
- Do not create live Stripe charges.
- Do not change DNS.
- Do not perform production CRM import apply until fresh backup proof JSON,
  exact dry-run SHA/count authorization, DATABASE_URL, idempotency key,
  created-by user key, `RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK`, and
  exclusion/terminal handling for manual-review rows are all present.
- Do not run Zoom, Vimeo, Stripe TEST, WhatsApp, Telegram, Buffer, OpenAI
  helper, or BNA support canaries without the protected manifest.
- Do not use the dirty BNA checkout for One Time product edits.

## Fast Orientation

- Use `CURRENT-STATE.json` for release refs, live readback, blockers, and
  safety notes.
- Use `CAPABILITY-MATRIX.json` for the required capability status list.
- Use `DEPLOYMENTS.json` for Railway production/staging deployment IDs.
- Use `ops/codex-runs/ONE-TIME-FINISH-NOW/RESUME.md` for the next exact work.
