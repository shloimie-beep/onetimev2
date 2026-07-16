# OPS-04C Rollback

## Scope

OPS-04C performed local repo integration only. No production deployment, staging deployment, DNS change, provider write, broad send, live charge, real customer import, or BNA mutation was performed.

## Code rollback

- If the draft PR is not merged, close it and delete the remote branch:
  - `git push origin --delete integration/ops04c-one-time-access-content-convergence-20260716T213505Z`
- If the branch is merged and must be reverted, revert the merge commit from the target branch with a normal Git revert. Do not delete or hand-edit migrations in an already-deployed database.
- If only the OPS-04C convergence commit needs reversal before merge, revert the final convergence commit on the integration branch and push a replacement commit.

## Migration rollback considerations

- The migration renumbering is file-order metadata only; SQL contents of the leaf migrations were preserved.
- If a real PostgreSQL environment has already applied these migrations, rollback must follow a database-specific plan and should not drop tables without a separate data-retention decision.

## External rollback

No external rollback is needed from this run because:

- Railway deployment was not attempted.
- Vimeo canary did not run with credentials and performed no writes.
- Buffer canary did not run with credentials and performed no writes.
- Telegram live canary was not run.
- OT-111 dry run and OT-106 queue proof were local/synthetic only.
