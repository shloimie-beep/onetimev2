# Resume: ONE-TIME-FINISH-NOW

Current state: safe core runtime is live on production, and the PR #92 staging
candidate has accepted runtime deployment proof plus rollback/roll-forward
proof. The full release claim remains blocked by protected-input gates and
current production launch-spine proof.

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
- PR #92 runtime-proof source head:
  `ee9929008fc0068b3dcf9b86d11e7c21d1331c93`
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
- PR #92 staging runtime proof passed: staging deployed PR #92, rolled back to
  W13-104, and rolled forward to PR #92 with `/version.deployment` matching the
  serving Railway web deployment.

## What Is Blocked

- Normal transactional access email: missing
  `C:/Users/User/.onetime-w13-104-private/EMAIL-INPUTS.private.json` and
  protected runtime values for Resend/sender/reply-to.
- Real CRM import apply: missing
  `C:/Users/User/.onetime-w13-104-private/CRM-IMPORT-AUTHORIZATION.private.json`
  naming accepted source hashes, tag map, and `apply=true`.
- Provider canaries: missing
  `C:/Users/User/.onetime-w13-104-private/CANARY-AUTHORIZATION.private.json`.
- Protected diagnostics: missing `OPERATIONS_PROBE_TOKEN`.
- Current launch-spine proof: W13-104 did not rerun consuming role-link browser
  acceptance or production signup submit.

## Runtime Proof Caveat

Staging `/version` still reports W13-104 `APP_VERSION` and `COMMIT_SHA` because
those are environment-pinned. PR #92 source binding is proven by the additional
`/version.deployment` object, exact detached deploy worktrees, Railway
deployment IDs/messages, and image digests. Railway did not populate
`RAILWAY_GIT_COMMIT_SHA` for the CLI source deploys.

## Next Executable Packets

1. Run production launch-spine proof only within the approved safety ceiling:
   start with read-only route/current-state proof and non-consuming role
   evidence; consume production setup/reset links or submit one production test
   lead only with exact protected authorization and cleanup instructions.
2. Add or verify protected email inputs, then run exactly one allowlisted
   transactional access email canary.
3. Run CRM dry-run against approved source hashes. Apply only when the private
   manifest names the accepted dry-run hash and sets apply authorization true.
4. Activate provider canaries independently: Zoom, Vimeo/content, Stripe TEST,
   WhatsApp, Telegram, OpenAI helper, Buffer, and BNA support bridge.

## Safety Rules

- Do not print or commit private manifests, tokens, emails, phone numbers,
  setup links, reset links, passwords, contact rows, or raw message bodies.
- Do not send broad email, WhatsApp, Telegram, or social messages.
- Do not perform live Stripe charges.
- Do not change DNS.
- Do not perform destructive migrations or production imports without the exact
  protected authorization manifest.
- Do not use the dirty BNA checkout for One Time product edits.
