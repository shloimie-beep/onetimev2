# Direct Codex Prompt - OT-75 Release And Observability Readiness

```text
TASK: Prepare release/staging/observability machinery without deploying.
REPOSITORY: webcraft-media/onetimev2
IMMUTABLE BASE: dfef7de2035e08f1ee72e0133ccf656fe7a74444
BRANCH: codex/ot75-release-observability-readiness
ACTUAL DEPLOYMENT/DNS/DB/PROVIDER MUTATION: FORBIDDEN

Treat the current directory as untrusted; do not touch BNA. Create a clean One
Time worktree from the exact base and persist OT-75 state. Internal OT-60R SHA
drift is non-blocking.

Own only unique `ops/release/**`, `ops/observability/**`, `scripts/ot75/**`,
release-only tests/evidence, a uniquely named OT-75 workflow, and feature-local
deployment descriptors that do not change current runtime composition. Avoid
`app.ts`, AppShell, auth/CRM/domain/provider code, shared barrels, root package
scripts, current workflows and central worker startup.

Prepare and validate, but do not execute:

- isolated web, delivery-worker, provider-worker and Telegram-worker topology;
- staging versus production environment-name schema without reading/printing
  values;
- liveness, readiness, exact source-SHA, migration/checksum, worker lease and
  provider-state contracts;
- redacted structured logs, metrics, traces, safe count-based dashboards and
  alert thresholds;
- disposable PostgreSQL fresh/upgrade/checksum/rollback assurance;
- backup/PITR evidence checklist and restore drill;
- staging canary, rollback and source-readback runbooks;
- transitional `join.onetimeonetime.com` plan with no root-domain cutover;
- owner/admin account bootstrap procedure that never stores a password or MFA
  secret in Git/evidence;
- release manifest that OT-80 can fill automatically from integrated heads.

Truthfully incorporate the earlier Railway inventory blockers: staging service
and domain, backup/PITR evidence, exact active source SHA, migration ledger,
database reference drift, duplicate data and worker isolation. Turn each into a
machine-checkable predeploy gate where possible.

Run local/static/CI checks. Missing Railway credentials or staging database is
an activation-only blocker; finish all preparation and continue. Commit/push,
open a draft PR against OT-60R, and leave exact OT-80/staging instructions. Do
not deploy or mutate Railway/DNS/databases/providers.
```
