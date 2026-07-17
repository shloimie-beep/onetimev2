# W12-99 Rollback Plan

Generated: 2026-07-17T15:56:23+03:00

## Current W12-99 State

W12-99 has not deployed staging or production, has not applied a real import, has not run provider canaries, and has not mutated production data or provider state.

Rollback before merge is simple:

1. Close or abandon the W12-99 draft PR.
2. Keep PR #61/release source unchanged at `c7d46066517d7a458d189f2c782cc06200f7861c`.
3. Do not deploy this integration branch.
4. Do not apply any W12-01 real import manifests.
5. Do not run provider canaries from W12-99 artifacts.

## If W12-99 Is Later Deployed To Isolated Staging

1. Verify the staging target is not production.
2. Record `/version` before deployment.
3. Deploy only the exact W12-99 commit SHA.
4. If smoke or journey checks fail, redeploy the previous staging source SHA recorded before the deploy.
5. Verify `/health`, `/ready`, `/version`, worker readiness, and customer-safe routes after rollback.

## If W12-100 Later Applies Real CRM Data

1. Require an exact approved manifest hash and counts.
2. Use W12-01 import change-ledger tables to produce affected IDs and reversible actions.
3. Reconcile counts before and after apply.
4. Roll back only the approved batch, never unrelated contacts.
5. Preserve consent/suppression precedence over campaign eligibility.

## Production Rollback Reference

OPS-11 production remains live at `ops11-1197673` / `1197673fa409bfc4c649c2683f782e86775caa5e`. OPS-11 recorded that native Railway rollback to the older production image was unavailable because old deployments were removed; the preserved production fallback is source rebuild to `d13e9cd3117091e97ef973408d8742a13d1a9479`, with database restore as last resort.
