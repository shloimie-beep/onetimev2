# Resume: ONE-TIME-FINISH-NOW

Current state: safe core runtime is live on production, and the PR #92 staging
candidate has accepted runtime deployment proof plus rollback/roll-forward
proof. CRM approval raw, counts-only real-source preflight, and current
production read-only launch-spine route proof are recorded, but `CRM_REAL_DATA`
remains `PREVIEW_READY`. The full release claim remains blocked by
protected-input gates, CRM production apply gates, and the consuming parts of
production launch-spine proof.

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
- PR #92 latest green evidence head before this launch-spine read-only refresh:
  `3e9b286c51d71530cccf192f4ce01b905c73c2e1`
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
- CRM counts-only real-source dry-run passed with status `done`; report SHA-256
  is
  `0bf8ad1c72f2855a22dc42899873b88cceb8a29187db4be86610403ac7a3e22c`.
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

- Normal transactional access email: missing
  `C:/Users/User/.onetime-w13-104-private/EMAIL-INPUTS.private.json` and
  protected runtime values for Resend/sender/reply-to.
- Real CRM import apply: dry-run authorization and counts-only preflight are
  recorded, but production apply remains blocked by 2,418 manual-review rows,
  missing exact protected `apply=true` acceptance of the dry-run hash/count set,
  fresh backup/rollback proof, and W12-100 preflight
  `apply_mode_implemented=false`.
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
2. Add or verify protected email inputs, then run exactly one allowlisted
   transactional access email canary.
3. Resolve CRM manual-review rows, record exact protected acceptance of the
   preflight hash/count set with `apply=true`, verify fresh backup/rollback
   proof, and implement the fail-closed apply path before any CRM production
   import apply.
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
