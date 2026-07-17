# OPS-11 — Close production gates and launch live login

## Mission

Continue the existing OPS-10 release. Do not redo feature development.

- Repository: `webcraft-media/onetimev2`
- Draft release PR: #61
- Last reported PR head: `05529dcf96e00982a4a25ec69492b080f9f4da05`
- Staged application source SHA: `d13e9cd3117091e97ef973408d8742a13d1a9479`
- Staging: `https://ot99-web-staging.up.railway.app`
- Production: `https://join.onetimeonetime.com`

Refetch first. If PR #61 advanced, use its newest safe descendant and never reset newer work. Finish only these gates:

1. certify the existing production PostgreSQL 18 path or prove a real reason for a side-by-side alternative;
2. create native production backup and disposable native restore proof;
3. establish immutable-image promotion or deterministic exact-source artifact equivalence;
4. rehearse staging rollback and roll-forward;
5. preserve production rollback, deploy, verify live authentication, and send one protected operator activation/reset email.

Production promotion is authorized after these core gates pass. Optional providers remain fail-closed and do not block login/CRM/portal production.

## Boundaries

Authorized: clean worktree/branch; isolated Railway/GitHub Actions utility jobs; disposable DB/services; backup/restore; release evidence and narrowly required release automation; staging rollback/roll-forward; additive production migrations; production web/worker deployment; one operator lifecycle email; commits/push/PR updates and normal protected merge.

Not authorized: DNS changes; deleting the existing production DB; destructive migrations; broad messages/imports; live Stripe charges; live Buffer publication; unrelated BNA work; force-push; exposing secrets, database URLs, row contents, private addresses, passwords, or activation/reset links.

Do not stop because Docker, `pg_dump`, `psql`, or SSH is absent locally. Use a private one-shot Railway service/container or a narrowly scoped GitHub Actions job. Do not weaken proof into an assertion.

## Durable state

Work from a clean isolated worktree based on current PR #61. Prefer continuing its existing release branch so app/source history stays coherent. Create `ops/codex-runs/OPS-11/` with:

- `ORIGINAL-PROMPT.md`
- `STATE.json`
- `RESUME.md`
- `DATABASE-PATH.md`
- `BACKUP-RESTORE.md`
- `ARTIFACT-PROMOTION.md`
- `STAGING-ROLLBACK.md`
- `PRODUCTION-ROLLBACK.md`
- `LOGIN-DELIVERY.md`
- `MUTATION-LEDGER.json`
- `FINAL-REPORT.md`

Record phase, exact source SHA, app payload/image digests, DB decision, deployment IDs, completed proof, blocker, and next executable action. Commit and push after every phase and at least every 20 minutes. Never store secrets. Another window must be able to resume from the repository alone.

## Phase 1 — Freeze the exact current candidate

1. Fetch PR #61, checks, ancestry, OPS-10 `STATE.json`, final report, backup and rollback records.
   - The audited `05529dcf96e00982a4a25ec69492b080f9f4da05` is exactly one evidence-only commit beyond staged app commit `d13e9cd3117091e97ef973408d8742a13d1a9479`. Base OPS-11 on the current PR head, not on the older app commit.
2. Confirm all required checks remain green.
3. Confirm staging `/version` reports the selected app source SHA and `/health`, `/ready`, `/login`, `/forgot-password`, `/activate`, and `/reset-password` behave correctly.
4. Confirm mandatory authenticator/TOTP routes are retired and email/password lifecycle is active.
5. Verify no release-critical source change exists after the staged app SHA. Evidence-only commits do not require a rebuild. Any runtime/code/config-build change creates a new `SOURCE_SHA` and requires full tests plus restaging before continuing.

## Phase 2 — Certify the actual production PostgreSQL 18 database

PostgreSQL 18 is not itself a blocker. The preferred path is to retain the existing production DB when it proves compatible.

1. Identify production service `Postgres-j9Pi`, volume, exact server version, extensions, collations, schema/migration ledger, and app bindings using redacted metadata only.
2. Use PostgreSQL 18 client tools—not PG16 tools—to dump the PG18 server. PostgreSQL documentation says `pg_dump` refuses a newer server than itself and does not guarantee loading into an older major version; therefore do not attempt an unproven PG18→PG16 downgrade.
3. Create a private, no-domain, one-shot Railway backup runner from the official PostgreSQL 18 image, connected through protected variable references. No raw URL may enter logs or arguments visible in evidence.
4. Create a timestamped custom-format native dump with no owner/ACL. Store it outside Git on a private temporary backup volume or approved private backup location. Record only checksum, size, time, server/client versions, and retention classification.
5. Verify archive listing, then restore it to a disposable isolated PG18 database/service.
6. On that restored clone, verify migration ledger/checksums, schema, indexes, constraints, sequences, and sanitized aggregate count/hash comparisons.
7. Run all migrations and representative app tests against the restored clone: auth/session, lead idempotency, CRM read/write on synthetic records, portal/sibling isolation, worker claims, rollback-compatible old-app reads where applicable.
8. Run the existing PG16 assurance suite separately to retain portability; it does not require production to be PG16.
9. Add a durable PostgreSQL 18 assurance job beside the existing PG16 gates, covering migration-from-zero, concurrency, load, and restore-clone application smokes. Because this changes the repository, record a new `SOURCE_SHA`, rerun all checks, and redeploy/restage it before promotion.
10. If PG18 passes, update stale gates to declare verified PG16–PG18 compatibility where evidence supports it and keep production on PG18.

Only create a side-by-side PG16 service if an actual reproducible PG18 incompatibility is found. Never delete/mutate the old PG18 service. A downgrade requires its own full rehearsal and is not the default.

Also verify Railway volume backup/PITR status and trigger a manual prelaunch volume backup when supported. Native dump/restore remains required.

## Phase 3 — Artifact promotion without another artificial blocker

Preferred proof, in order:

1. same private OCI image digest deployed to staging and production;
2. Railway skipped-build/cached-image promotion that reports the same image digest;
3. deterministic exact-source rebuild with application-payload equivalence.

For option 3, container digests may differ only because of container metadata or environment packaging. Prove equivalence by producing a canonical manifest of runtime application payload hashes from the exact same `SOURCE_SHA`: built server/worker entrypoints, static asset manifest/files, package lock, migrations/checksums, and runtime start commands. Compare staging and proposed production build manifests byte-for-byte. Require exact source SHA, identical dependency lock, toolchain versions, build inputs, and payload manifest. Record both container digests and the reason they differ. Do not accept an unexplained payload difference.

Do not publish proprietary source as a public image or require a new paid registry plan. Use private GHCR only if protected credentials and current Railway plan already permit it.

## Phase 4 — Staging rollback and roll-forward rehearsal

Use actual current deployment history; do not rely on stale report IDs.

1. Capture current green candidate web/worker IDs, digests, variables hash, DB binding, and previous known-good IDs. Confirm every target deployment is still rollback/redeploy eligible under Railway retention.
2. Before rolling anything back, complete the staging acceptance that OPS-10 did not finish: `/forgot-password`, safe invalid `/activate` and `/reset-password`, no-TOTP lifecycle, owner/admin dashboard and CRM, lead/signup idempotency, parent/student isolation, Content, worker/queue health, mobile/a11y/performance, and one sink-only lifecycle-email proof. Do not claim these passed from the four basic smokes alone.
3. Take a native staging backup.
4. Roll staging web/worker to the immediately previous known-good deployments using Railway rollback, which restores the previous image and variables.
5. Verify old `/version`, `/health`, `/ready`, root, and expected old route behavior.
6. Roll forward to the candidate deployments/images without rebuilding if Railway permits; otherwise use the already approved artifact-equivalence path.
7. Reverify exact source SHA and the complete staging acceptance matrix above.
8. Record timing and evidence. If migrations are not compatible with the previous application, repair only via additive compatibility work, restage, and repeat.

## Phase 5 — Preserve production rollback

Before any production mutation:

1. Reconfirm production web deployment `15280d13-3e12-4c72-8460-10e0c6e99b3e`, delivery cron `387e2e49-2055-43c8-86f4-de11f0e60b59`, DB/volume identities, and full current live SHA. Treat IDs as starting evidence and refetch.
2. Confirm prior production web/cron deployments have `canRollback=true` and remain inside retention. If not, create an equivalent safe blue-green preservation path before mutation; do not rely on the old SHA because it is not in this repository.
3. Capture protected variable-name inventory and value hashes, never values.
4. Create a fresh PG18 native dump, verify it, and restore-test it as in Phase 2 immediately before cutover.
5. Confirm migrations are additive, lock/statement-time bounded, and compatible with old app rollback.
6. Write exact service/database rollback steps. Database restore is last resort; app rollback is preferred.

## Phase 6 — Production promotion

Once all prior gates pass:

0. Complete a redacted staging-versus-production configuration parity review. Require correct production `PUBLIC_BASE_URL`, DB/SSL binding, trusted-proxy policy, `AUTH_CSRF_SECRET`, required encryption/lifecycle keys, `RUN_MIGRATIONS_ON_STARTUP=false`, process type, version/SHA metadata, and provider-off defaults. Compare variable names and value fingerprints only; never print values.

1. Apply migrations once using a controlled one-shot migration job.
2. Deploy the staging-approved artifact/equivalent payload to production worker/cron and web in migration-compatible order.
   - Resolve the actual worker topology first. The recorded `one-time-delivery-cron` may be stopped/build-only and must not be treated as a functioning lifecycle worker.
   - Deploy or correctly configure the candidate worker/cron topology that owns lifecycle email and outbox processing, with single-consumer leases, heartbeat/readiness, provider-off defaults, and graceful shutdown.
   - Prove one sink lifecycle event is claimed and completed before enabling the one-email canary.
   - Use the repository's actual shared image/startup topology, including `scripts/railway-start.mjs` and `PROCESS_TYPE=worker` when that is the verified worker entry. Do not leave the lifecycle outbox dependent on a stopped build-only cron.
3. Do not change DNS or the custom domain.
4. Require `/version` exact source SHA; `/health` and `/ready` 200.
5. Verify through `https://join.onetimeonetime.com`:
   - `/`, `/login`, `/forgot-password`;
   - safe invalid-token `/activate` and `/reset-password`;
   - `/rabbi-member` → `/login` and `/one-time/signup` → `/signup` compatibility redirects;
   - production canonical root and HTTPS/secure cookies;
   - signup → deduplicated CRM contact/lead/audit/outbox;
   - protected owner/admin CRM/dashboard;
   - separate parent/student journeys and sibling isolation;
   - Content route and worker/queue health;
   - no mandatory authenticator app;
   - no unintended sends/provider actions.
6. Observe bounded health/error/auth/DB/worker/queue metrics for at least 15 minutes.

Automatic rollback triggers: wrong SHA, health/readiness failure, login/recovery unavailable, migration mismatch, integrity error, role/data leak, or sustained critical errors. Roll web/worker back once to preserved deployments, verify old production, stop further activation, and report `ROLLED_BACK`; do not loop retries.

## Phase 7 — One operator activation/reset email

Only after live production routes and core journeys pass:

1. Resolve the destination from protected `ONE_TIME_OWNER_TEST_EMAIL`, otherwise the single canonical active production owner/admin. Never print it.
2. If absent, create owner/admin and one activation. If unactivated, rotate/resend one deduplicated activation. If activated but password unknown, send one reset. Never email a password.
3. Link must use production `/activate` or `/reset-password`, be hashed, expiring, single-use, rate-limited, and absent from logs/evidence.
4. Prove one outbox intent, one provider acceptance, one audited result, and no duplicate.
5. If destination is ambiguous, keep the healthy app live and block only the email handoff. Do not guess.

Do not send any other customer message.

## Phase 8 — Closeout

Run all relevant formatting, lint, typecheck, unit, integration, build, secret, DB, e2e, accessibility, performance, and diff checks for touched work. Update OPS-10 truth plus OPS-11 evidence. Push checkpoints, update the canonical release PR, and use normal branch protections. Merge/tag only if allowed and green; never pretend.

Final status must be exactly one:

- `LIVE_LOGIN_READY`
- `LIVE_LOGIN_READY_EMAIL_HANDOFF_BLOCKED`
- `ROLLED_BACK`
- `PRODUCTION_BLOCKED_BACKUP`
- `PRODUCTION_BLOCKED_ROLLBACK`
- `PRODUCTION_BLOCKED_DATABASE_INTEGRITY`
- `PRODUCTION_BLOCKED_ARTIFACT_EQUIVALENCE`

Report source SHA, payload/image digests, DB path/version, native backup/restore, staging rollback, production deployment/rollback IDs, live routes/journeys, email outcome without destination/token, tests/evidence/PR, external mutations, exact remaining blocker, and clean git status.

Successful next operator action:

> Open the activation/reset email, set your password, and log in at https://join.onetimeonetime.com/login.
