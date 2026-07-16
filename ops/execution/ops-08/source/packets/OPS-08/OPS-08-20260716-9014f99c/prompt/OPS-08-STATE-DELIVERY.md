<!-- OPS-08 direct prompt continuation 3 of 3; packet OPS-08-20260716-9014f99c -->

## OPS-08 readiness state machine

Use only these transitions:

1. `audit_in_progress`
2. one or more blocked states:
   - `blocked_packet_integrity`
   - `blocked_source_convergence_required`
   - `blocked_isolated_staging_required`
   - `blocked_migration_threshold`
   - `blocked_email_readiness`
   - `blocked_callback_readiness`
   - `blocked_unapproved_root_drift`
   - `blocked_provider_guidance_changed`
3. `ready_for_dns_operator_action`
4. `authorized_window_pending`
5. `cutover_in_progress`
6. `cutover_observing`
7. `cutover_complete` or `rolled_back`

This execution cannot move beyond `ready_for_dns_operator_action` because production authorization is absent.

Set `ready_for_dns_operator_action` only when:

- safe repository changes and tests are complete;
- source/staging/callback/email/migration gaps are either passed or are exclusively operator/account-access actions;
- root and launch domains were not changed;
- no production deployment/provider/send mutation occurred;
- exact private operator inputs are enumerated without values;
- cutover and rollback manifests validate.

If code or non-access evidence is incomplete, use the appropriate blocked state instead.

## OPS-08 Git and PR delivery for repository-side work

After focused checks pass:

1. Stage only OPS-08-owned repository changes and evidence.
2. Commit with an OPS-08-prefixed message.
3. Push the OPS-08 branch.
4. Open a draft pull request titled:

`[OPS-08] Domain, email, and legacy cutover readiness`

5. PR body must include:
   - exact base and head SHA;
   - source-selection/ancestry proof;
   - files changed;
   - tests and results;
   - observed domain/Railway/email/callback/migration evidence;
   - blocked external/operator actions;
   - mutation counters, all expected to be zero for DNS, production deploy, providers, email DNS, real sends, and payments;
   - final OPS-08 state;
   - statement that the PR is not cutover authorization.

Do not merge the PR.

## OPS-08 required final evidence

Produce:

- `ops/codex-runs/OPS-08/state.json`
- `ops/codex-runs/OPS-08/command-log.ndjson`
- `ops/evidence/ops-08/inventory.json`
- `ops/evidence/ops-08/source-selection.json`
- `ops/evidence/ops-08/domain-dns-tls.json`
- `ops/evidence/ops-08/railway-readiness.json`
- `ops/evidence/ops-08/migration-thresholds.json`
- `ops/evidence/ops-08/deliverability.json`
- `ops/evidence/ops-08/callback-matrix.csv`
- `ops/evidence/ops-08/synthetic-probes.json`
- `ops/evidence/ops-08/acceptance-report.json`
- `ops/release/ops-08/reversible-change-manifest.json`
- `ops/release/ops-08/cutover-runbook.md`
- `ops/release/ops-08/rollback-runbook.md`
- `ops/release/ops-08/operator-actions.json`
- `ops/evidence/ops-08/checksums.sha256`

`operator-actions.json` must contain names of required actions, owners/roles, prerequisites, and private reference fields. It must not contain raw DNS or provider values.

## OPS-08 final response format

Return only:

- final state;
- repository branch;
- exact head SHA;
- draft PR URL when created;
- acceptance gate count;
- blocker/action count;
- confirmation that root mutations, launch-domain mutations, production deploys, provider mutations, email-DNS changes, real sends, live payments, and unintended access grants all equal zero;
- paths to the evidence index, reversible manifest, cutover runbook, and rollback runbook.

Do not claim production readiness or cutover completion.
