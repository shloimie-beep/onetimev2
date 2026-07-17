# OPS-11 Staging Rollback

Status: `pending`

Staging rollback and roll-forward must use current Railway deployment history,
not stale report IDs.

## Required

- Capture current staging web/worker IDs, digests, variable-name hashes, DB
  binding hash, and previous known-good IDs.
- Verify target deployments are rollback/redeploy eligible.
- Complete full staging acceptance before rollback:
  - `/forgot-password`;
  - safe invalid `/activate` and `/reset-password`;
  - no mandatory TOTP;
  - owner/admin dashboard and CRM;
  - lead/signup idempotency;
  - parent/student isolation;
  - Content;
  - worker/queue health;
  - mobile/a11y/performance;
  - one sink-only lifecycle-email proof.
- Take native staging backup.
- Roll staging web/worker back to previous known-good deployments.
- Verify old `/version`, `/health`, `/ready`, root, and expected old route
  behavior.
- Roll forward to candidate deployments/images without rebuilding when
  available, otherwise via approved artifact equivalence.
- Reverify exact source SHA and full acceptance matrix.

## Current Result

Not yet run.
