NOT_READY_FOR_PRODUCTION

# OPS-10 Final Report Draft

Generated: 2026-07-17T09:48:15+03:00

This is a draft closeout artifact while OPS-10 remains in progress.

## Current Candidate

- Repo: `webcraft-media/onetimev2`
- Branch: `release/ops10-full-staged-production-launch-20260717T050800Z`
- PR: `https://github.com/webcraft-media/onetimev2/pull/61`
- Candidate app/code head staged: `d13e9cd3117091e97ef973408d8742a13d1a9479`.
- PR: all required checks passed on `d13e9cd3117091e97ef973408d8742a13d1a9479`.

## Done So Far

- OPS-10 ZIP validated and preserved.
- Release branch/worktree created.
- PR #60 Prettier and OPS-06 cleanup defects repaired.
- Public lead idempotency race repaired.
- OT-107 student helper accepted as already satisfied by the candidate.
- OT-114 CRM/support communications merged.
- OT-114 migration namespace collision repaired by renumbering to
  `2016_ot114_crm_communications_support`.
- Local focused auth, CRM, portal, support, communications, a11y/perf, build,
  brand, typecheck, lint, secret scan, and OPS-06 gates have passed as recorded
  in `LOCAL-GATES.md`.
- PR #61 passed OPS-06 deterministic, PostgreSQL assurance, static readiness,
  and learner-seat proof on commit `b5592fbfdaf3aad902c9f2237ea340c93d457480`.
- Node 24 verify on that commit failed only in the OT-39 drawer focus-loop e2e
  after owner/support navigation added extra drawer links; the test now asserts
  the full visible drawer-link tab order and final wrap to Close navigation.
- Local focused drawer e2e, formatting, lint, secret scan, and full `npm run e2e`
  passed after the Node 24 repair.
- Migration checksum line-ending compatibility repaired after staging revealed
  mixed historical CRLF/LF migration checksums.
- PR #61 passed all required checks again on
  `d13e9cd3117091e97ef973408d8742a13d1a9479`.
- Staging migrations applied through `2190_ot109_rabbi_content_publisher` and
  idempotent rerun reported `total=35 applied=0 already_applied=35`.
- Final staging web deploy `d06dc5a5-41cf-4b41-b337-ebe4425bc371` succeeded with
  digest `sha256:56f600b00111537e352cf43b5bb67c2d04d99594b49b268facc91af4066ba33a`.
- Final staging worker deploy `21e2cdd2-a441-4225-a98e-6243c08c4da0` succeeded
  with digest `sha256:12af9a6eb4f17696689a59f3943fbfc473ba9411a3d9c3104a1c64bb7a2693f0`.
- Staging smokes passed for `/health`, `/ready`, `/version`, and `/login`;
  `/version` reported `ops10-d13e9cd` and the exact candidate SHA.

## Not Live Ready

- No production deployment has been performed.
- No production activation/reset email has been sent.
- No parent-test activation email has been sent.
- Native production backup/restore proof is not complete.
- Staging rollback rehearsal is not complete.
- Same-image staging-to-production promotion was not proven; Railway CLI source
  deploys rebuilt staging images.
- Production DB currently resolves to Railway Postgres 18 service
  `Postgres-j9Pi`; OPS-10 requires a PostgreSQL 16-compatible production path
  before promotion.

## Operator Email Outcome

`not_sent`: Production auth routes must pass first. No password, activation
link, reset link, private address, or private destination is recorded here.

## Parent Test Outcome

`not_sent`: Protected parent-test destination has not been used in OPS-10.

## Mandatory TOTP

Local auth tests verify no mandatory authenticator path; deprecated MFA endpoints
return gone/disabled behavior.

## External Mutations

Staging Railway deployments, non-secret staging release variable updates, and a
staging PG16 migration were performed. No production deployment, DNS change,
production DB write, provider send, live Stripe action, Buffer publication, Zoom
customer mutation, production import, or Stripe webhook mutation has been
performed by OPS-10.

## Next Operator Action

Resolve production blockers in `STATE.json`; do not send login instructions
until production is actually live and the single activation/reset email has been
sent.
