# Resume: ONE-TIME-FINISH-NOW

Current state: safe core runtime is live on production, and the PR #92 staging
candidate has accepted runtime deployment proof plus rollback/roll-forward
proof. CRM approval raw, corrected counts-only real-source preflight, guarded
local CRM apply code, sanitized email-inputs preflight, and current production
read-only launch-spine route proof are recorded, but `CRM_REAL_DATA` remains
`PREVIEW_READY`. The full release claim remains blocked by protected-input
gates, CRM production apply gates, and the consuming parts of production
launch-spine proof.

## Start Here

1. Read `AGENTS.md`.
2. Read `ops/director/START-HERE.md`.
3. Read `ops/codex-runs/ONE-TIME-FINISH-NOW/STATE.json`.
4. Read `ops/codex-runs/ONE-TIME-FINISH-NOW/CAPABILITY-MATRIX.json`.
5. Read `ops/codex-runs/ONE-TIME-FINISH-NOW/FINAL-REPORT.md`.
6. Run `npm run director:truth:live` before relying on the director as current
   production truth.

## Current Truth

- Production URL: `https://join.onetimeonetime.com`
- Staging URL: `https://ot99-web-staging.up.railway.app`
- Production and staging version: `w13-104-public-cls-688fc70`
- Production and staging runtime SHA:
  `688fc70cf64b72bc52f4ea7511d8593750d7ab45`
- Canonical draft PR: `https://github.com/webcraft-media/onetimev2/pull/91`
- PR #92 CRM/email evidence head before this truth-refresh commit:
  `0a93e82062e06d01ca50b3e79ffdfc9d40fcd87c`
- PR #92 checks at that evidence head failed before workflow steps/logs; local
  focused gates passed. Read the PR or `git rev-parse HEAD` for the current
  branch head after later docs-only truth refresh commits.
- Final staging PR #92 web deployment:
  `c464ea23-649b-4c8d-b4af-0d10c5ce3022`
- Final staging PR #92 worker deployment:
  `17f1970a-ec19-4fa8-8152-573b47f470ab`
- Isolated worktree:
  `C:/Users/User/.onetime-worktrees/ONE-TIME-FINISH-NOW`

## What Is Accepted

- W13-104 production and staging `/version`, `/health`, and `/ready` readbacks.
- W13-104 production web and worker Railway deployments are successful.
- W13-104 fresh PG18 backup/restore proof passed before production deployment.
- W13-103 production protected browser acceptance passed for administrator,
  parent, and student identities.
- OPS-13A CRM source inventory and counts-only preview are available as
  preflight input.
- CRM operator approval raw is preserved in
  `ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-IMPORT-APPROVAL-RAW.md`.
- Corrected CRM-first counts-only dry-run passed with status `done`; report
  SHA-256 is
  `93be5a0837d3d90f8995e873c2ea302987f45e0e52de79f08170f01a6223f1d8`. It found
  1,559 CRM-importable contacts, 1,357 email-campaign-eligible contacts, 0
  WhatsApp-campaign-eligible contacts, and 848 manual-review rows.
- Guarded real-source CRM apply writer is implemented locally and accepted with
  synthetic integration evidence; production apply performed zero writes.
- Sanitized email-inputs preflight verifies protected Resend/domain/sender/
  reply-to inputs are present and policy-matching. It is blocked only by missing
  protected operator canary destination file; no private manifest was written
  and no email was sent.
- A protected private CRM checkpoint manifest exists with
  `dry_run_authorized=true` and `production_apply_authorized=false`; contents
  are not committed or printed.
- PR #92 staging runtime proof passed: staging deployed PR #92, rolled back to
  W13-104, and rolled forward to PR #92 with `/version.deployment` matching the
  serving Railway web deployment.
- Current production read-only launch-spine proof passed for 16 of 16 GET-only
  route checks, including public/account lifecycle routes, known 404 behavior,
  and anonymous denial for private app routes.
- Current OPS-06 production synthetic probes passed public/login/readiness and
  private-denial checks; protected diagnostics remains blocked by missing
  `OPERATIONS_PROBE_TOKEN`.

## What Is Blocked

- Normal transactional access email: protected Resend/domain/sender/reply-to
  inputs are present and policy-matching, but the protected operator canary
  destination file and `EMAIL-INPUTS.private.json` are missing; production
  variables and controlled canary send proof are not configured.
- Real CRM import apply: corrected dry-run and guarded local apply code are
  recorded, but production apply remains blocked until fresh backup proof JSON,
  exact dry-run SHA/count authorization, DATABASE_URL, idempotency key,
  created-by user key, `RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK`, and
  exclusion/terminal handling for 848 manual-review rows are present.
- Provider canaries: missing
  `C:/Users/User/.onetime-w13-104-private/CANARY-AUTHORIZATION.private.json`.
- Protected diagnostics: missing `OPERATIONS_PROBE_TOKEN`.
- Consuming launch-spine proof: current read-only route proof is recorded, but
  this run did not consume role-link browser journeys or submit a production
  signup lead. Those actions still require exact protected authorization and
  cleanup instructions.

## Runtime Proof Caveat

Staging `/version` still reports W13-104 `APP_VERSION` and `COMMIT_SHA` because
those are environment-pinned. PR #92 source binding is proven by the additional
`/version.deployment` object, exact detached deploy worktrees, Railway
deployment IDs/messages, and image digests. Railway did not populate
`RAILWAY_GIT_COMMIT_SHA` for the CLI source deploys.

## Next Executable Packets

1. Complete the consuming production launch-spine proof only with exact
   protected authorization and cleanup instructions: administrator, parent, and
   student browser journeys using setup/reset links, or one production signup
   submit.
2. Provide the protected operator canary destination file, generate
   `EMAIL-INPUTS.private.json` from the sanitized preflight without committing
   or printing it, configure production variables, then run exactly one
   allowlisted transactional access email canary.
3. Record fresh backup proof JSON, exact protected acceptance of
   `APPROVE_RABBI_DAY_ONE_CRM_IMPORT:93be5a0837d3d90f8995e873c2ea302987f45e0e52de79f08170f01a6223f1d8:1559:production`,
   DATABASE_URL, idempotency key, created-by user key,
   `RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK`, and terminal/exclusion handling for
   manual-review rows before any CRM production import apply.
4. Activate provider canaries independently: Zoom, Vimeo/content, Stripe TEST,
   WhatsApp, Telegram, OpenAI helper, Buffer, and BNA support bridge.

## Safety Rules

- Do not print or commit private manifests, tokens, emails, phone numbers,
  setup links, reset links, passwords, contact rows, or raw message bodies.
- Do not send broad email, WhatsApp, Telegram, or social messages.
- Do not perform live Stripe charges.
- Do not change DNS.
- Do not perform destructive migrations or production imports without exact
  protected authorization, terminal manual-review decisions, and fresh
  backup/rollback proof.
- Do not use the dirty BNA checkout for One Time product edits.
