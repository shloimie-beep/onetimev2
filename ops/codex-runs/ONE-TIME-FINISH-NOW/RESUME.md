# Resume: ONE-TIME-FINISH-NOW

Current state: safe core runtime is live on production and staging, but the full
release claim remains blocked by protected-input and current-proof gates.

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
- Evidence head:
  `e3d3736546f48b3834d6698838befe20884005f1`
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
- Current rollback proof: W13-104 staging source-rebuild rollback and
  roll-forward were exercised, but rollback is not accepted because `/version`
  stayed W13-104 during the rollback-source deploy. See
  `STAGING-ROLLBACK-REPORT.md`.
- Current launch-spine proof: W13-104 did not rerun consuming role-link browser
  acceptance or production signup submit.

## Next Executable Packets

1. Add or verify protected email inputs, then run exactly one allowlisted
   transactional access email canary.
2. Make runtime source proof source-authoritative for rollback, or update the
   rollback procedure to bind deployment metadata, image digest, and runtime
   source readback in one accepted proof; then rerun staging rollback.
3. Build or run non-consuming role acceptance fixtures; consume production
   setup/reset links only if the protected manifest explicitly permits it.
4. Run a production-safe signup proof, or one approved test lead submit with
   cleanup/reconciliation instructions.
5. Run CRM dry-run against approved source hashes. Apply only when the private
   manifest names the accepted dry-run hash and sets apply authorization true.
6. Activate provider canaries independently: Zoom, Vimeo/content, Stripe TEST,
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
