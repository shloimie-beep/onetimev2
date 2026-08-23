# PR #131 Current Candidate Deployment Result

- Result: `passed`
- Recorded at: `2026-08-07T14:59:30.914Z`
- Repository: `shloimie-beep/onetimev2`
- Integration PR: `#131`
- Integration branch: `codex/one-time-complete-production-launch-20260805`
- Deployed candidate: `43968d4b6163f97799e14289c2424c1001ab5c37`
- Pre-deploy production source: `3b7e5a98f3a52c59bcbe2261644409e00d609bb8`
- Preserved rollback branch: `rollback/one-time-pre-complete-launch-20260805`
- Preserved rollback SHA: `a157c388d8dc292699f7cd1a1ef178918ee30885`

## Candidate gate

The PR head was fetched again immediately before deployment and matched the clean controller worktree and remote integration branch. GitHub reported the PR mergeable with a clean merge state. No required branch-protection checks were configured. The completed CI, migration verification, PostgreSQL concurrency, PostgreSQL assurance, and PostgreSQL 18 assurance workflows were successful. The queued non-required reliability workflow was treated as non-blocking under the operator decision; no failure was ignored and no suite was rerun merely to create evidence.

## Progressive production deployment

The exact clean worktree was uploaded to the existing Railway production project and environment. Only `APP_VERSION` and `COMMIT_SHA` were advanced to the candidate with deploy triggering suppressed until each corresponding source upload. No provider-owned GHL, Zoom, Vimeo, media, sender, billing, or transport variable was listed or changed.

| Service | Service ID                             | Deployment ID                          | Status    | Image digest                                                              |
| ------- | -------------------------------------- | -------------------------------------- | --------- | ------------------------------------------------------------------------- |
| Web     | `d175ad94-5e3c-41c2-8cbc-daa1a299077d` | `35de7372-d367-4cec-84f8-f6758058e759` | `SUCCESS` | `sha256:cd7c8b1d13793bf5728e32356a48f797b810b359a03874e66931c32a5c3a1acf` |
| Worker  | `742f60ed-dc2f-4321-85d0-019003d4e9b9` | `6e2e806f-319f-403f-83a0-7b5b202236a2` | `SUCCESS` | `sha256:5af6cc6829a8fbfe3ec19c3924f7808e07fd499ec057d4a7f84579bda9daaf03` |

## Production readback

- Protected web runtime identity returned version and commit `43968d4b6163f97799e14289c2424c1001ab5c37` and web deployment `35de7372-d367-4cec-84f8-f6758058e759`.
- The ready `delivery_outbox` worker heartbeat returned version and commit `43968d4b6163f97799e14289c2424c1001ab5c37`, with heartbeat age `2,371 ms` at the final readback.
- Database and migration-ledger dependencies were healthy and diagnostics reported no blockers.
- `delivery_outbox`, `support_outbox`, and `account_lifecycle_outbox` each had zero ready, leased, expired-lease, retry, and dead-letter rows.
- Remote `npm run db:verify` passed with `102/102` migrations applied, zero pending migrations, and zero integrity issues. The candidate contained no migration after the pre-deploy source, so no migration mutation was run.
- Migration head remains `2271_ot16_f05_dispatch_context`.
- `/health`, `/ready`, and `/version` returned HTTP 200 on both `app.onetimeonetime.com` and `join.onetimeonetime.com`.
- Unauthenticated protected diagnostics returned HTTP 403 with `OPS_OWNER_DIAGNOSTICS_FORBIDDEN` on both domains; authenticated probe-token diagnostics returned HTTP 200 with `no-store` behavior.

## Funnel and provider boundaries

No DNS, domain, redirect, or public-funnel switch was performed. Live readback on both domains still rendered `Create your Family account` and did not render `Pre-register`. That behavior already existed before this deployment and remains an explicit unresolved source-of-truth conflict; broad funnel/copy cutover is blocked pending the source-of-truth and landing lanes' final decision.

The deployment proves application-source rollout only. It does not prove GHL, Zoom, or Vimeo canary readiness or broad provider activation. Provider-owned configuration and lane evidence remain authoritative for those states.
