# W13-101 Rollback And Roll-Forward

Generated: 2026-07-18T17:56:40Z
Updated: 2026-07-18T18:36:00Z

Status: exact-source roll-forward fallback passed; native Railway `down` rollback was not reliable enough for production use.

## Baseline Safe Deployments

- Web: `b46859f5-8662-4675-a0ef-354a7d042ca0`, image `sha256:58e5f7625d2d90d591f99b9193a2b8f829b0fb2fba7dfeea1fc343ba2719065e`.
- Worker: `cc51706f-da28-4da5-ac83-02d9aada7f8a`, image `sha256:a05951d0240fa976bc313d86616505052df03080c34a6653aa1b1a74b1f3cf16`.

## Native Rollback Rehearsal

A no-op safe redeploy was created first:

- Web rehearsal deployment: `ee817c75-bc1e-4e17-82c0-a9af19532a7b`, success.
- Worker rehearsal deployment: `fa899003-2159-4aeb-bd36-800467c9add7`, success.

Then `railway down --yes` was executed on each service to remove the latest deployment.
This did not restore the expected baseline safely: web reported failed deployment
`d6834939-6b73-4967-bfb9-cbfe58abb2e2`, worker reported no current deployment ID,
and the staging public URL returned 404 Application not found.

Conclusion: do not use `railway down` as the production rollback mechanism for this release without additional Railway-side validation. Treat database restore as a separate last-resort action only.

## Roll-Forward Recovery

Exact-source roll-forward from clean runtime worktree
`C:\Users\User\OneTimeOneTime-w13-101-runtime-candidate` at
`466d8489bb8c7a3a57f7590929b58e7857420e86` restored staging:

- Final web deployment: `7fa7c45b-21a8-45eb-b92d-3750fca06362`, success, image `sha256:58e5f7625d2d90d591f99b9193a2b8f829b0fb2fba7dfeea1fc343ba2719065e`.
- Final worker deployment: `6e18ddfa-c4fd-4aab-ac30-164bf18bbab4`, success, image `sha256:a05951d0240fa976bc313d86616505052df03080c34a6653aa1b1a74b1f3cf16`.
- `/version`: `w13-101-safe-core-466d848` / `466d8489bb8c7a3a57f7590929b58e7857420e86`.
- `/health`: 200, ok=true.
- `/ready`: 200, ok=true, latest migration `2203_w13_100_student_gamification`, optional transports disabled.

Production rollback recommendation: prefer exact-source rebuild/roll-forward fallback from the tagged `RUNTIME_SOURCE_SHA` and retained config records. Do not run `railway down` in production as a routine rollback until the unexpected staging behavior is explained and re-tested.

## Production W13-101 Roll-forward State

Updated: 2026-07-18T19:25:46.855Z

- Production web exact-code deployment succeeded: 243b614a-bd51-49fe-9aae-b17b99a6fe22.
- Production worker exact-code deployment succeeded after a worker-manifest retry: 52226afb-5b5c-4e79-8982-8b26115dfaba.
- The first worker upload failed because root railway.json applied the web healthcheck to the worker; the active worker retry used the tracked worker manifest in a disposable detached worktree.
- Staging showed native `railway down` is not a safe routine rollback path for this topology. Preferred runtime recovery remains exact-source rebuild/roll-forward. Database restore remains last resort and requires operator approval.
