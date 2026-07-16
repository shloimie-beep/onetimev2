# OPS-02 — Direct-to-Codex Execution Prompt

You are the principal release/infrastructure engineer executing OPS-02 for `webcraft-media/onetimev2`. Execute the work; do not merely describe it.

The objective is to establish and prove a genuinely isolated One Time staging environment on Railway for the latest accepted OT-99 integration candidate discovered at runtime. At packet generation time OT-99 was not found. You must repeat discovery. If an accepted OT-99 exact SHA is still absent, build all reusable OPS-02 staging/IaC/inventory/validation work that does not require the exact source, persist a durable checkpoint, and finish with `waiting_for_ot99_sha`. Do not deploy OT-81, a moving branch, or any other candidate as a substitute.

## Absolute boundaries

- TASK_ID is `OPS-02` in all run paths, receipts, branches, commits, logs, reports, and external resource annotations.
- The target Git repository is exactly `webcraft-media/onetimev2`.
- This is not the BNA project, service, database, repository, queue, provider configuration, or domain.
- Never create, rename, attach, or deploy One Time as `skillful-motivation`.
- Never access or mutate a production database, production Railway environment, BNA resource, or production contact/user dataset.
- Preserve `join.onetimeonetime.com` as the current launch hostname. Do not change root/apex DNS, production routing, redirects, CNAME/TXT records, or public cutover state.
- Keep every external provider sink, test, disabled, or absent. Core landing, signup, CRM, parent portal, and student portal paths must remain usable or visibly safe when providers are absent.
- Never send broadly, send to real destinations, charge a live card, make a test purchase without separate approval, publish Buffer/social content, create a real user, import production contacts, or copy real child/family data.
- Never print, commit, upload into evidence, or place in command arguments: secret values, database URLs, provider keys, tokens, authorization headers, cookies, private keys, passwords, MFA seeds, recovery codes, activation links, raw destinations, real rows, message bodies, contact exports, or child/family PII.
- Record only names, presence/absence, opaque resource IDs, exact Git SHAs, hashes, counts, booleans, HTTP codes, latency summaries, and sanitized timestamps.
- Shell tracing must remain disabled for every provider/secret operation.

Read the other packet files before execution. Treat `PACKET.json` as an audit snapshot, not current truth.

## Allowed final status

Your final report must use exactly one of:

`waiting_for_ot99_sha`  
`ready_for_exact_sha_staging`  
`staging_deployed_provider_off`  
`ready_for_controlled_canary_approval`  
`blocked_external_access`

Do not return another top-level status.

## Phase 0 — Safety shell and local evidence root

Use a POSIX shell when available. Adapt syntax faithfully on Windows without weakening any guard.

```bash
set -euo pipefail
set +x
umask 077
export OPS02_PACKET_ID='OPS-02-20260716T040144Z-40d638ea'
export OPS02_PROJECT_NAME='one-time-staging-ops-02'
export OPS02_ENVIRONMENT_NAME='staging'
export OPS02_WEB_SERVICE_NAME='one-time-staging-web'
export OPS02_WORKER_SERVICE_NAME='one-time-staging-worker'
export OPS02_DATABASE_SERVICE_NAME='one-time-staging-postgres'
```

Never enable `set -x`. Do not pipe raw provider output to the execution log.

Create a safe event logger that accepts only hand-constructed messages:

```bash
ops02_log() {
  printf '%s task=OPS-02 %s
' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >> "$OPS02_RUN_DIR/EXECUTION.log"
}
```

## Phase 1 — Locate the repository by origin

Do not trust the current directory or folder name. Search existing Git checkouts. Normalize SSH and HTTPS origins to owner/repository. Accept only these origins:

- `https://github.com/webcraft-media/onetimev2.git`
- `git@github.com:webcraft-media/onetimev2.git`

If no matching checkout exists, clone into a new directory using authenticated read access. Do not edit another product’s checkout.

Required read-only receipt:

```bash
EXPECTED_SLUG='webcraft-media/onetimev2'
git -C "$OPS02_REPO" remote get-url origin
git -C "$OPS02_REPO" fetch --all --prune --tags
git -C "$OPS02_REPO" rev-parse --is-inside-work-tree
git -C "$OPS02_REPO" status --porcelain=v1
```

Normalize and compare the origin. If it does not equal the expected slug, stop with `blocked_external_access`. Never repoint an unrelated checkout’s origin.

## Phase 2 — Create the durable run records before mutation

Read-only repository discovery and fetch are allowed before this phase. No repository file edit, Railway mutation, database mutation, domain action, deployment, or provider action may occur before the following files exist.

Resolve a read-only preparation base SHA. Prefer the latest accepted integrated/convergence candidate with successful required checks. Do not call it OT-99 unless OT-99 eligibility is proven. The packet snapshot observed PR 25 head `809480bb5581c4104f64c4c04a5c92fff8aaa7cf`, but you must rediscover and may select a newer accepted integration base.

Create an isolated worktree outside every existing worktree:

```bash
OPS02_PREPARATION_BASE_SHA="$(git -C "$OPS02_REPO" rev-parse "$OPS02_PREPARATION_BASE_REF^{commit}")"
OPS02_RUN_ID="OPS-02-$(date -u +%Y%m%dT%H%M%SZ)-$(printf '%s' "$OPS02_PREPARATION_BASE_SHA" | cut -c1-8)"
OPS02_WORKTREE="$(dirname "$OPS02_REPO")/onetimev2-$OPS02_RUN_ID"
git -C "$OPS02_REPO" worktree add --detach "$OPS02_WORKTREE" "$OPS02_PREPARATION_BASE_SHA"
cd "$OPS02_WORKTREE"
OPS02_RUN_DIR="ops/codex-runs/OPS-02/$OPS02_RUN_ID"
install -d "$OPS02_RUN_DIR/evidence"
```

Immediately create these files with valid initial content, not empty placeholders:

- `RECEIPT.json`: task, packet ID, UTC time, normalized origin, preparation base ref/SHA, worktree path represented as a local path hash if it contains personal information, packet checksum result.
- `ORIGINAL-PROMPT.md`: the complete text of this prompt.
- `INPUTS.json`: public input values and a protected-name presence matrix only. Never include protected values.
- `STATE.json`: top-level status initialized to `waiting_for_ot99_sha`, phase `intake_persisted`, mutation counters all zero.
- `RESUME.md`: exact safe commands to rerun origin/candidate discovery.
- `EXECUTION.log`: first sanitized event line.
- `FINAL-REPORT.md`: initial report with status `waiting_for_ot99_sha`, statement that execution has not mutated external resources, and paths to the initial receipt/state.

Hash these records and write the hashes to `RECEIPT.json`. Commit or otherwise checkpoint them before any external mutation. If the repository ignores original-prompt paths, add only the minimum OPS-02-specific ignore exception needed to persist this prompt; do not expose secrets.

Create a branch from the detached worktree only after the initial record commit:

```bash
OPS02_BRANCH="codex/ops-02-staging-activation-$(printf '%s' "$OPS02_PREPARATION_BASE_SHA" | cut -c1-8)"
git switch -c "$OPS02_BRANCH"
```

A local commit is required for durable checkpointing. Push only when repository write access is authenticated and authorized. Never merge automatically.

## Phase 3 — Resolve the accepted OT-99 exact SHA dynamically

Search GitHub and the fetched repository for exact task identifiers `OT-99` and `OT99`. Inspect pull requests, issues, release manifests, run reports, integration manifests, acceptance records, branches, and tags. Branch existence is only a lead.

An OT-99 candidate is eligible only when all conditions hold:

1. The object exists in `webcraft-media/onetimev2` and resolves to a 40-character commit SHA.
2. A pull request, merge record, or machine-readable acceptance document explicitly identifies that SHA as the accepted integrated OT-99 candidate.
3. The exact tree contains an OT-99 integration/release manifest listing the included lanes or source inputs. A branch name alone fails.
4. Required CI, build/test, and PostgreSQL assurance checks completed successfully for that exact SHA. Record check names, run IDs, conclusions, and URLs.
5. Git ancestry is coherent with the accepted integration base and the SHA is not a synthetic local merge unless the acceptance record explicitly approves it.
6. No newer eligible accepted OT-99 candidate supersedes it. Compare acceptance timestamps and sequence evidence, not lexical branch names.
7. The candidate has no unresolved release blocker that explicitly forbids staging.

Record every considered candidate in `evidence/candidate-resolution.json` with public metadata only. Do not include tokens or raw API headers.

When no eligible OT-99 candidate exists:

- Keep `status=waiting_for_ot99_sha`.
- Do not deploy any application SHA.
- Continue Phase 4 read-only inventory when possible.
- Build the reusable OPS-02 assets described in Phase 5 under OPS-02-owned paths.
- Run static/local validation that does not need OT-99.
- Commit the checkpoint.
- Update `RESUME.md` with exact candidate-discovery commands and the acceptance conditions still missing.
- Finish. Do not continue to resource creation, database mutation, domain generation, or deployment merely because an older certified line exists.

When an eligible OT-99 candidate exists, set:

```bash
export OPS02_EXPECTED_SOURCE_SHA="$OPS02_OT99_SHA"
```

Update `STATE.json` to `ready_for_exact_sha_staging` after recording the exact SHA and local source receipts. The phrase means the target SHA is identified; it is not permission to skip any later gate.

## Phase 4 — Read-only Railway and domain inventory

First verify the installed CLI and command help:

```bash
railway --version
railway --help
railway init --help
railway link --help
railway status --help
railway environment --help
railway add --help
railway service --help
railway variable --help
railway domain --help
railway up --help
```

Then run read-only inventory with no shell tracing:

```bash
set +x
railway whoami
railway project list --json
railway status --json
railway environment list --json
railway service list --json
railway service status --all --json
```

Capture raw JSON only in a mode-0600 temporary directory outside Git. Convert it to `evidence/railway-inventory.redacted.json` containing:

- authenticated identity handle or opaque account ID, not tokens;
- workspace names/opaque IDs;
- project/environment/service/database/volume names and opaque IDs;
- deployment states and region/replica counts;
- domain hostnames;
- backup/PITR presence booleans where available;
- denylist matches and collision decisions.

Delete raw temporary JSON after redaction.

Hard reject any selected target that identifies BNA, `skillful-motivation`, `one-time-production`, or a `production` environment. A separate staging environment inside a production project is not sufficient. OPS-02 requires a separate One Time staging project.

Do not run `railway variable list --kv`. If variable-name presence must be inspected, capture JSON privately, reduce it immediately to names and booleans, then delete raw output.

If Railway authentication or authorization is unavailable while OT-99 is absent, record that limitation but keep `waiting_for_ot99_sha` and finish reusable local preparation. If OT-99 exists and the lack of external access blocks the next safe step, use `blocked_external_access` with the exact missing permission/protected name and resume command.

For domain state, perform read-only DNS/HTTP checks of `onetimeonetime.com`, `join.onetimeonetime.com`, and any discovered staging hostname. Record records/status/TLS metadata only. Do not mutate DNS. A failure to resolve the launch hostname is evidence, not authorization to change it.

## Phase 5 — Build reusable OPS-02 staging/IaC/validation assets

Do this whether OT-99 exists or not. Keep changes in OPS-02-owned operational paths unless the exact candidate already defines a stricter ownership contract:

- `ops/release/ops-02/`
- `ops/codex-runs/OPS-02/`
- `scripts/ops-02/`
- `tests/ops-02/`
- one uniquely named OPS-02 validation workflow if repository policy permits it

Do not modify product/domain/provider logic merely to make a gate pass. Do not edit `apps/web`, `apps/worker`, central configuration, migrations, or root package scripts during the waiting checkpoint. Build wrappers that discover current scripts and paths.

Required reusable assets:

1. `inventory.mjs` or equivalent: reads Git/Railway metadata and writes redacted name/ID/status evidence.
2. `candidate-resolver.mjs`: evaluates OT-99 eligibility and emits exact SHA/reasons without accepting branch names alone.
3. `guard-context.mjs`: fails closed on BNA, `skillful-motivation`, production, repository-origin drift, database-reference drift, or moving-source deployment.
4. `render-env-presence.mjs`: emits variable names/presence only and rejects value-shaped output.
5. `migration-ledger.mjs`: hashes exact candidate migration files and compares them with `onetime.schema_migrations`.
6. `verify-runtime.mjs`: probes discovered health/readiness/version paths, exact SHA, target app, and provider-off state.
7. `worker-smoke.mjs`: runs a bounded one-shot sink worker proof and reports counts/lease conflicts only.
8. `forbidden-action-audit.mjs`: asserts zero sends, zero charges, zero provider mutations, zero Buffer publishes, zero real users, zero production imports, zero DNS mutations.
9. `evidence-scan.mjs`: fails on secret/URL/token/cookie/PII patterns in OPS-02 evidence.
10. Machine-readable contracts for architecture, resource names, protected configuration names, acceptance gates, backup/restore, and rollback.
11. A static validation workflow that runs without provider secrets and never deploys.

Run formatting, lint/typecheck, focused tests, secret scan, and `git diff --check` for these assets. Preserve inherited repository-wide failures separately; changed OPS-02 files must pass their own formatting and tests.

When OT-99 is absent, commit these reusable assets and finish `waiting_for_ot99_sha` after updating all state/resume/final records.

## Phase 6 — Recreate a clean exact-SHA deployment worktree

Proceed only with an eligible OT-99 SHA.

Fetch again, verify the object, and create a second clean detached worktree dedicated to deployment. Do not deploy from the preparation branch containing OPS-02 tooling unless the accepted candidate explicitly includes those commits. Tooling may be run from the preparation worktree while deployment content comes from the exact candidate worktree.

```bash
git -C "$OPS02_REPO" fetch --all --prune --tags
test "$(git -C "$OPS02_REPO" rev-parse "$OPS02_EXPECTED_SOURCE_SHA^{commit}")" = "$OPS02_EXPECTED_SOURCE_SHA"
OPS02_DEPLOY_WORKTREE="$(dirname "$OPS02_REPO")/onetimev2-OPS-02-deploy-$(printf '%s' "$OPS02_EXPECTED_SOURCE_SHA" | cut -c1-8)"
git -C "$OPS02_REPO" worktree add --detach "$OPS02_DEPLOY_WORKTREE" "$OPS02_EXPECTED_SOURCE_SHA"
cd "$OPS02_DEPLOY_WORKTREE"
test -z "$(git status --porcelain=v1)"
git rev-parse HEAD
git rev-parse HEAD^{tree}
git archive --format=tar HEAD | sha256sum
```

Record HEAD, tree SHA, archive SHA-256, candidate PR/acceptance evidence, and empty porcelain count. Never include uncommitted files in `railway up`.

Inspect exact-candidate `package.json`, Dockerfile, Railway config, start wrapper, config schema, migrations, route definitions, worker mode, health/version endpoints, and CI workflows. Reconcile descriptor-only files with implemented runtime. Do not assume `/healthz` or `/readyz`; the audited older line actually used `/health` and `/ready`.

Run local candidate gates before Railway mutation:

```bash
npm ci
npm run secret:scan
npm run lint
npm run typecheck
npm run unit
npm run integration
npm run build
npm run e2e
npm run accessibility
npm run performance
```

Run exact scripts that exist; do not invent missing script success. If repo-wide formatting has inherited drift, run the repository check and a changed-file check, and report both honestly. Do not waive a failure in the exact candidate’s required checks.

## Phase 7 — Provision or adopt the isolated Railway resources

Proceed only when:

- OT-99 exact SHA is eligible;
- live inventory is redacted and stored;
- authenticated non-production authorization is proven;
- selected workspace is approved;
- denylist checks pass;
- protected values can be supplied without disclosure.

Preferred creation commands, after verifying current help:

```bash
set +x
railway init --name "$OPS02_PROJECT_NAME" --workspace "$OPS02_RAILWAY_WORKSPACE" --json
railway environment new "$OPS02_ENVIRONMENT_NAME" --json
railway link --project "$OPS02_APPROVED_STAGING_PROJECT_ID" --environment "$OPS02_APPROVED_STAGING_ENVIRONMENT_ID" --json
railway add --service "$OPS02_WEB_SERVICE_NAME" --json
railway add --service "$OPS02_WORKER_SERVICE_NAME" --json
railway add --database postgres --json
railway status --json
```

If safe resources already exist, adopt them only with an explicit protected approval reference and complete isolation proof. Never adopt based only on matching names.

After every mutation, run `railway status --json`, sanitize it, compare the project/environment IDs with the approved OPS-02 IDs, and update `STATE.json`. If context changes unexpectedly, stop.

Require exactly the process types implemented by the candidate. Do not create decorative provider/Telegram services when no executable process exists. At minimum, create one web service and the actual sink worker service.

## Phase 8 — Prove PostgreSQL 16 before schema work

Railway’s PostgreSQL service may not default to version 16. Connect through a protected reference and run only sanitized version/identity queries:

```sql
SELECT current_setting('server_version_num') AS server_version_num;
SELECT current_database() AS database_name;
SELECT current_user AS database_role;
```

Store the version number. Hash or replace database name/role with opaque local labels if they expose protected naming. `server_version_num` must begin with `16`. If not, create/configure a supported PostgreSQL 16 service through Railway’s current documented mechanism. Do not downgrade an initialized volume. If PostgreSQL 16 cannot be provisioned with authorized access, use `blocked_external_access`.

Create three non-production targets or equivalent isolated databases on an explicitly disposable PostgreSQL 16 administrative server:

- fresh proof;
- upgrade proof;
- persistent staging application database.

Do not run the repository’s PostgreSQL assurance script against the persistent staging database if the script creates/drops databases or requires administrative permissions. Use a disposable PG16 server/cluster for that script.

## Phase 9 — Fresh and upgrade migration rehearsal

Generate the exact candidate migration ledger from file bytes. Do not reuse the older 13-entry OT-81 ledger as proof.

### Fresh proof

1. Confirm empty disposable PostgreSQL 16 target.
2. Run the candidate migration command, normally `npm run db:migrate`, with `DATABASE_URL` supplied only through the protected environment.
3. Run the verification command, normally `npm run db:verify`.
4. Query `onetime.schema_migrations` for IDs/checksums and immediately reduce output to IDs/checksums/statuses.
5. Compare every checksum with exact candidate file bytes.
6. Run a second migration/verify pass and require idempotency.
7. Run the repository PostgreSQL assurance harness on a disposable PG16 admin target when supported.
8. Destroy disposable databases after evidence is durable and cleanup is authorized.

### Upgrade proof

1. Resolve `OPS02_PREVIOUS_APPROVED_SOURCE_SHA` from the latest prior approved staging/release manifest, not a branch guess.
2. Create a clean PostgreSQL 16 upgrade target.
3. Apply migrations from that prior exact SHA.
4. Load only reserved synthetic fixtures.
5. Apply exact OT-99 migrations.
6. Verify ledger/checksums, schema constraints/indexes, application queries, idempotency, and row-count invariants.
7. Record the delta and sanitized counts.

If no documented supported baseline exists, record that as an acceptance gap; do not invent one or claim canary readiness.

## Phase 10 — Configure isolated variables and provider-off state

Discover the exact candidate environment schema first. Set values only in the OPS-02 project/environment/services.

Public non-secret configuration includes:

```text
NODE_ENV=production
PUBLIC_BASE_URL=the Railway-provided OPS-02 staging URL
APP_VERSION=OPS-02 plus the exact SHA short form
COMMIT_SHA=the exact 40-character OT-99 SHA
RUN_MIGRATIONS_ON_STARTUP=false
OUTBOX_TRANSPORT_MODE=sink
DELIVERY_TRANSPORT_MODE=sink when recognized
DELIVERY_PROVIDER_ACTIVATION_ENABLED=false when recognized
ENABLE_REAL_EMAIL_TRANSPORT=false
ENABLE_REAL_WHATSAPP_TRANSPORT=false
ENABLE_REAL_TELEGRAM_TRANSPORT=false
ENABLE_PAYMENT_TRANSPORT=false
```

Set `PROCESS_TYPE=web` for web and `PROCESS_TYPE=worker` for worker when `scripts/railway-start.mjs` or the exact candidate uses that selector.

Set protected values through stdin/provider references only:

```bash
set +x
printf '%s' "$AUTH_CSRF_SECRET" | railway variable set AUTH_CSRF_SECRET --stdin --skip-deploys --service "$OPS02_WEB_SERVICE_NAME" --environment "$OPS02_ENVIRONMENT_NAME" --json
printf '%s' "$MFA_SECRET_ENCRYPTION_KEY" | railway variable set MFA_SECRET_ENCRYPTION_KEY --stdin --skip-deploys --service "$OPS02_WEB_SERVICE_NAME" --environment "$OPS02_ENVIRONMENT_NAME" --json
```

Use Railway reference variables for the isolated database rather than copying the URL into command arguments. Confirm staging and production database references differ without printing either value. Record only opaque IDs and equality result.

Do not configure live/test provider keys just to satisfy readiness. Missing providers must be supported by core product flows. If the candidate requires a test provider reference for a non-mutating readback, verify test mode through protected metadata and keep all mutation paths disabled.

## Phase 11 — Back up before staging migration

Before any migration or synthetic write to the persistent staging database:

- establish/verify a scheduled backup;
- record latest successful backup age and schedule without values;
- enable/verify PITR when authenticated non-production authorization and plan capability permit it;
- record PITR healthy boolean and retention window;
- create a manual backup or approved recovery point;
- verify the database service/volume IDs are OPS-02 resources.

If backup/PITR configuration requires a human dashboard action, write the exact resource IDs and action path to `RESUME.md`, set `blocked_external_access` only after OT-99 exists and this blocks the next safe step, and do not migrate.

## Phase 12 — Migrate the persistent staging database

With web and worker stopped or not yet deployed:

1. Reconfirm Railway context and database opaque ID.
2. Reconfirm PostgreSQL 16.
3. Reconfirm backup/PITR receipt.
4. Run the exact candidate migration command against only the OPS-02 database.
5. Run checksum/idempotent verification.
6. Store migration IDs/checksums/statuses, not data rows.
7. Keep `RUN_MIGRATIONS_ON_STARTUP=false`.

A pre-deploy migration command may be configured only after rehearsals pass and only if it targets the OPS-02 database. Do not allow both startup migrations and pre-deploy migrations.

## Phase 13 — Deploy exact SHA to web and worker

Disable GitHub autodeploys or disconnect moving-branch triggers. Confirm the deploy worktree is detached at `OPS02_EXPECTED_SOURCE_SHA` and clean immediately before each upload.

Deploy with explicit selectors from the exact worktree:

```bash
cd "$OPS02_DEPLOY_WORKTREE"
test "$(git rev-parse HEAD)" = "$OPS02_EXPECTED_SOURCE_SHA"
test -z "$(git status --porcelain=v1)"
railway up --project "$OPS02_APPROVED_STAGING_PROJECT_ID" --environment "$OPS02_APPROVED_STAGING_ENVIRONMENT_ID" --service "$OPS02_WEB_SERVICE_NAME" --json
railway up --project "$OPS02_APPROVED_STAGING_PROJECT_ID" --environment "$OPS02_APPROVED_STAGING_ENVIRONMENT_ID" --service "$OPS02_WORKER_SERVICE_NAME" --json
```

Use exact candidate Dockerfile/start commands. On the audited older line, the Dockerfile/start wrapper selected processes with `PROCESS_TYPE`; rediscover this.

Configure Railway’s deployment healthcheck to the exact implemented web path returning HTTP 200. The old application used `/health`, not the descriptor’s `/healthz`.

Generate a Railway-provided staging domain only for the web service:

```bash
railway domain --service "$OPS02_WEB_SERVICE_NAME" --json
```

Accept only a distinct `.up.railway.app` hostname unless a separately delegated staging hostname is explicitly approved. Do not add a custom root or launch domain.

After basic source, health, migration, and provider-off proof passes, status may become `staging_deployed_provider_off`.

## Phase 14 — Exact source, health, and process verification

Probe the exact implemented routes from multiple independent checks:

- liveness path discovered from source;
- readiness path that verifies the OPS-02 database;
- version/source path, expected to be `/version` on the audited older line;
- landing, signup, login, CRM, parent portal, and student portal routes.

Require:

- HTTPS/TLS valid for the staging hostname;
- liveness HTTP 200;
- readiness HTTP 200 and no production/BNA dependency;
- version `commit_sha` equals `OPS02_EXPECTED_SOURCE_SHA`;
- version target identifies One Time;
- web Railway deployment metadata is consistent with the exact source receipt;
- worker deployment uses the same source SHA, proven through deployment metadata and sanitized startup/one-shot evidence;
- no descriptor-only endpoint is claimed without runtime proof.

Railway deployment healthchecks do not continuously monitor after activation, so run independent post-deploy probes and a bounded interval check.

## Phase 15 — Synthetic bootstrap and smoke tests

Use only reserved synthetic identities, preferably `example.invalid` or repository-defined reserved fixtures. Do not create real accounts or send activation messages.

When the product requires owner/admin authentication, use an approved synthetic bootstrap command or test harness. Temporary credentials remain outside Git and reports. Record role, enabled state, MFA-enrolled boolean, fixture namespace, and timestamp only. If the only available path would send to a real destination or create a real user, do not run it; record the blocker.

Required smoke proof:

1. Landing page renders with providers absent.
2. Synthetic signup persists to the OPS-02 database.
3. Outbox entry remains sink-only; zero provider deliveries.
4. Login/auth/session flow works with synthetic credentials and security headers.
5. CRM list/detail/create/edit paths use synthetic contacts only.
6. Parent and student portals use synthetic household/learner fixtures only.
7. Provider-dependent controls are visibly unavailable or safely local; no 500 caused solely by absent providers.
8. Web and worker share only the OPS-02 database.
9. Two bounded worker instances or concurrency tests demonstrate non-overlapping claims and bounded leases when supported.
10. Cleanup removes or namespaces synthetic fixtures.

Never import production contacts to make CRM look populated.

## Phase 16 — Build, security, accessibility, bundle, and performance gates

Run repository-defined gates against the exact candidate and staging URL where appropriate:

- deterministic dependency install;
- secret scan;
- formatting and changed-file formatting;
- lint;
- typecheck;
- unit tests;
- integration tests;
- production build;
- end-to-end browser tests;
- accessibility suite;
- performance suite;
- bundle-size/security gates;
- OPS-02 evidence scan;
- `git diff --check`.

Use at least 30 samples for staging-critical performance routes when the repository harness supports it. Record sample count, p50, p95, thresholds, and pass/fail, not raw payloads.

Verify security headers, private/no-store authenticated responses, no query-string PII, no secret/provider values in logs, and no BNA/Operations client bundle fanout.

## Phase 17 — Backup/restore rehearsal

Prefer PITR because Railway’s current PITR flow creates a new Postgres service beside the source without touching the source.

1. Create a reserved synthetic marker and record its opaque key hash only.
2. Capture an approved target timestamp.
3. Trigger PITR to a new disposable Postgres service or use an equivalent safe side-by-side restore.
4. Verify PostgreSQL 16 on the fork.
5. Verify migration ledger checksums and sanitized table/count invariants.
6. Verify the synthetic marker state expected at the target timestamp.
7. Run read-only application compatibility against the fork.
8. Store fork ID, restore range, target timestamp precision, checksums/counts, and result.
9. Destroy or stop the fork after explicit cleanup authorization; record a human cleanup step when an agent deletion restriction applies.

Do not first rehearse by swapping the only staging volume. Native Railway volume restores are same-project/environment staged volume swaps and can remove newer backup history after the selected point.

## Phase 18 — Exact-SHA rollback rehearsal

Record the prior approved staging SHA. If none exists, the safe rollback is stopping services while preserving the database; do not fabricate a SHA.

When a prior compatible SHA exists:

1. Stop the worker and freeze synthetic writes.
2. Preserve sanitized evidence.
3. Deploy the prior exact SHA to web and worker from a clean detached worktree.
4. Verify version/health/readiness and sink mode.
5. Confirm the forward-migrated schema remains compatible.
6. Record elapsed time and deployment IDs.
7. Redeploy the OT-99 exact SHA to both services.
8. Repeat exact-SHA, health, readiness, migration, and worker checks.

Never use “redeploy latest” as exact rollback proof. Never run improvised down migrations.

When backup/PITR, restore rehearsal, exact-SHA rollback rehearsal, and every acceptance gate pass, status becomes `ready_for_controlled_canary_approval`. This status does not authorize provider activation, live card use, broad send, Buffer publication, real-user onboarding, root DNS mutation, or public cutover.

## Phase 19 — Final forbidden-action audit

Write `evidence/forbidden-action-audit.json` with integer counters. Every counter must be zero:

```json
{
  "task_id": "OPS-02",
  "live_email_sends": 0,
  "live_whatsapp_sends": 0,
  "live_telegram_sends": 0,
  "broad_sends": 0,
  "live_charges": 0,
  "test_purchases_without_separate_approval": 0,
  "buffer_or_social_publications": 0,
  "real_users_created": 0,
  "production_contacts_imported": 0,
  "production_database_reads": 0,
  "production_database_writes": 0,
  "bna_mutations": 0,
  "skillful_motivation_mutations": 0,
  "root_dns_changes": 0,
  "join_hostname_changes": 0,
  "secret_values_committed": 0,
  "real_rows_or_child_family_pii_in_evidence": 0
}
```

Any nonzero value is a hard failure and requires immediate stop/containment. Do not conceal it.

## Phase 20 — Persist final state and return

Update all durable run files. `FINAL-REPORT.md` and `STATE.json` must agree on the one allowed status.

Required final evidence:

- normalized Git origin;
- OT-99 search/eligibility evidence;
- exact candidate SHA or explicit absence;
- preparation and deploy worktree receipts;
- tree SHA and archive SHA-256;
- PR/acceptance/CI run evidence;
- sanitized Railway inventory and mutation receipts;
- project/environment/web/worker/database/volume/domain opaque IDs;
- PostgreSQL 16 proof;
- fresh, upgrade, and staging migration ledgers/checksums;
- backup/PITR and restore proof;
- web/worker exact source readback;
- provider-off matrix;
- synthetic bootstrap/smoke results;
- build/security/a11y/performance/bundle results;
- rollback rehearsal;
- all-zero forbidden-action audit;
- exact remaining blockers and resume commands.

`RESUME.md` must be executable and must reference only named protected configuration, never values. Include the minimum next command group for the chosen status.

Before committing final evidence, run the evidence scanner and inspect the diff. Then commit with a message beginning `OPS-02:`. Push only when authorized. Never merge, promote, activate providers, or change DNS.

Return only the final allowed status, exact evidence paths/IDs/SHAs, and resume steps. Do not claim success from a branch name, a green check on another SHA, or an older candidate.
