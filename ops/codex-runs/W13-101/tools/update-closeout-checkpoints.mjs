import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const runDir = path.join(root, 'ops/codex-runs/W13-101');
const now = new Date().toISOString();

const runtimeSha = '466d8489bb8c7a3a57f7590929b58e7857420e86';
const finalStatus = 'CORE_DEPLOYED_OPTIONAL_CAPABILITIES_PENDING';

async function readJson(name) {
  return JSON.parse(await readFile(path.join(runDir, name), 'utf8'));
}

async function writeJson(name, value) {
  await writeFile(path.join(runDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const productionDeployment = await readJson('PRODUCTION-DEPLOYMENT.json');
Object.assign(productionDeployment, {
  updated_at: now,
  status: 'deployed_safe_core_optional_capabilities_pending',
  runtime_source_sha: runtimeSha,
  pre_deploy_version: {
    version: 'ops11-1197673',
    commit_sha: '1197673fa409bfc4c649c2683f782e86775caa5e',
  },
  post_deploy_version: {
    version: 'w13-101-safe-core-466d848',
    commit_sha: runtimeSha,
    target_app: 'one-time',
  },
  web_deployment_id: '243b614a-bd51-49fe-9aae-b17b99a6fe22',
  worker_deployment_id: '52226afb-5b5c-4e79-8982-8b26115dfaba',
  image_digest_or_rebuild_fingerprint:
    'web=sha256:b8a17ddb5e588dbaf13aaa9b086d3ffb66dbdc70984d0e3deb6b24ada68a6718; worker=sha256:8ce30ebc73e6937ff25c175b5aa795aba3c6beeabceea527c4f273b39c3c56b8',
  fresh_backup: {
    status: 'passed',
    proof_deployment_id: '217563a6-abe7-4a79-a093-b5129b528618',
    run_id: 'w13-101-prod-pg18-20260718T190341Z',
    private_location: '/backup/w13-101-prod-pg18-20260718T190341Z/production-pg18.dump',
    dump_sha256: '75fdc8c1096f4a4ede5bab2a44fe7b90538c247c82740ff50c167cced7bdfbc2',
    restored_latest_migration: '2190_ot109_rabbi_content_publisher',
  },
  production_database_migration: {
    pre_migration_latest: '2190_ot109_rabbi_content_publisher',
    post_migration_latest: '2203_w13_100_student_gamification',
    applied_ids: [
      '2200_w12_02_communication_history',
      '2201_w12_01_crm_audience_import',
      '2202_w12_05_telegram_operations',
      '2203_w13_100_student_gamification',
    ],
    database_url_printed: false,
  },
  worker_manifest_workaround: {
    status: 'used',
    reason:
      'Railway CLI local upload applies the root railway.json. Worker retry used a disposable detached worktree at the same commit with the tracked worker manifest copied to railway.json.',
    disposable_worktree: 'C:/Users/User/OneTimeOneTime-w13-101-worker-deploy-20260718T191641Z',
    app_code_head: runtimeSha,
    manifest_only_diff: true,
  },
  providers_off_during_core_deploy: true,
  real_import_off_during_core_deploy: true,
});
await writeJson('PRODUCTION-DEPLOYMENT.json', productionDeployment);

const productionAcceptance = await readJson('PRODUCTION-ACCEPTANCE.json');
Object.assign(productionAcceptance, {
  updated_at: now,
  status: 'core_routes_live_optional_capabilities_pending',
  checks: [
    {
      id: 'production_health_ready_version',
      status: 'passed',
      evidence:
        'live /health 200, /ready 200 latest=2203_w13_100_student_gamification, /version exact runtime SHA',
    },
    {
      id: 'production_public_landing',
      status: 'passed',
      evidence: 'https://join.onetimeonetime.com/ returned 200',
    },
    {
      id: 'production_auth_pages',
      status: 'passed',
      evidence:
        'login, forgot-password, activate, and reset-password returned 200 with no-store/private cache controls',
    },
    {
      id: 'production_protected_route_denial',
      status: 'passed',
      evidence:
        'dashboard, parent, and student app routes redirect to login; parent/student/session APIs return 401 without a session',
    },
    {
      id: 'production_worker_heartbeat',
      status: 'passed',
      evidence:
        'production-postdeploy audit found worker_heartbeats latest at 2026-07-18T19:20Z and zero ready/dead-letter outbox rows',
    },
    {
      id: 'production_optional_dependencies_disabled',
      status: 'passed',
      evidence: '/ready reports email, WhatsApp, and support bridge disabled by runtime flag',
    },
    {
      id: 'production_pwa_manifests',
      status: 'not_applicable',
      evidence:
        'No One Time app route/test coverage exists for /manifest.json, /parent-manifest.json, or /operations-manifest.json',
    },
  ],
  role_journeys: {
    admin:
      'partially_satisfied_prior_ops11_protected_activation_sent_current_live_login_not_completed_by_codex',
    parent:
      'staging_full_journey_passed_production_unauthenticated_isolation_passed_live_login_pending_accepted_production_identity_path',
    student:
      'staging_full_journey_passed_production_unauthenticated_isolation_passed_live_login_pending_accepted_production_identity_path',
  },
  evidence_files: [
    'ops/codex-runs/W13-101/evidence/production-postdeploy-audit.json',
    'ops/codex-runs/W13-101/evidence/production-route-auth-smoke.json',
    'C:/Users/User/.onetime-w13-101-private/production-runtime-env.private.json',
  ],
  private_values_in_evidence: false,
});
await writeJson('PRODUCTION-ACCEPTANCE.json', productionAcceptance);

const providerCanaries = await readJson('PROVIDER-CANARIES.json');
providerCanaries.updated_at = now;
providerCanaries.status = 'all_optional_providers_off_after_core_deploy';
providerCanaries.default_mode = 'provider_off';
providerCanaries.providers = providerCanaries.providers.map((provider) => ({
  ...provider,
  mode: 'off',
  status: 'disabled_by_runtime_kill_switch',
  effects: 0,
  kill_switch_verified: true,
  evidence:
    '/ready optional dependencies disabled; production safe-core env readback flags false/sink',
}));
await writeJson('PROVIDER-CANARIES.json', providerCanaries);

const importResult = await readJson('IMPORT-RESULT.json');
Object.assign(importResult, {
  updated_at: now,
  status: 'pending_no_accepted_production_apply_manifest',
  approved_manifest_found: false,
  production_import_performed: false,
  counts: {
    source_files: 0,
    preview_rows: 0,
    rehearsed_rows: 0,
    imported_rows: 0,
    quarantined_rows: 0,
    rolled_back_rows: 0,
  },
  notes:
    'OPS-13A artifacts exist only as preflight inputs in prior W12 records; no accepted production apply manifest/hash/count gate was present for this W13-101 run. No CRM import was applied.',
});
await writeJson('IMPORT-RESULT.json', importResult);

const externalEffects = await readJson('EXTERNAL-EFFECTS.json');
externalEffects.updated_at = now;
externalEffects.effects = {
  ...externalEffects.effects,
  emails_sent: 0,
  whatsapp_messages: 0,
  telegram_actions: 0,
  zoom_meetings: 0,
  zoom_registrants: 0,
  vimeo_operations: 0,
  helper_queries: 0,
  buffer_drafts: 0,
  buffer_posts: 0,
  stripe_test_objects: 0,
  stripe_live_objects: 0,
  bna_events: 0,
  railway_deployments: 15,
  database_migrations: 47,
  database_backups: 1,
  database_restores: 2,
  crm_import_rows: 0,
  production_database_writes: 4,
  dns_changes: 0,
  railway_deployment_removals: 2,
  railway_variable_updates: 97,
  staging_identity_proof_runs: 4,
  staging_identity_external_sends: 0,
};
externalEffects.secrets_printed_or_committed = false;
externalEffects.private_destinations_printed_or_committed = false;
await writeJson('EXTERNAL-EFFECTS.json', externalEffects);

const state = await readJson('STATE.json');
state.updated_at = now;
state.status = finalStatus;
state.terminal_status = finalStatus;
state.phase_status = {
  ...state.phase_status,
  phase_7: 'production_safe_core_deployed',
  phase_5: 'optional_provider_canaries_left_off',
  phase_6: 'crm_import_pending_no_accepted_apply_manifest',
  phase_8: 'release_governance_pending_commit_push_tag_and_live_role_login',
};
state.phase_7_evidence = {
  production_url: 'https://join.onetimeonetime.com',
  runtime_source_sha: runtimeSha,
  web_deployment_id: '243b614a-bd51-49fe-9aae-b17b99a6fe22',
  worker_deployment_id: '52226afb-5b5c-4e79-8982-8b26115dfaba',
  web_image_digest: 'sha256:b8a17ddb5e588dbaf13aaa9b086d3ffb66dbdc70984d0e3deb6b24ada68a6718',
  worker_image_digest: 'sha256:8ce30ebc73e6937ff25c175b5aa795aba3c6beeabceea527c4f273b39c3c56b8',
  backup_status: 'passed',
  migration_latest: '2203_w13_100_student_gamification',
  route_smoke: 'passed',
  worker_heartbeat: 'passed',
  optional_transports: 'disabled',
  production_live_role_login: 'not_completed_by_codex',
};
state.blockers = [
  ...(state.blockers ?? []).filter(
    (blocker) => blocker.id !== 'W13-101-PRODUCTION-LIVE-ROLE-LOGIN',
  ),
  {
    id: 'W13-101-PRODUCTION-LIVE-ROLE-LOGIN',
    status: 'operator_action_or_accepted_production_identity_path_needed',
    scope: 'production admin/parent/student live login',
    detail:
      'Core app is deployed and isolated route checks pass. Existing OPS-11 protected admin activation was sent but was time-limited; Codex did not create production identities because the repo provisioning helper explicitly refuses production targets.',
  },
];
state.next_action =
  'Commit/push W13-101 checkpoint evidence, create release tag if approved, and refresh/complete protected production admin/parent/student live login handoff through an accepted production identity path.';
state.external_effects = externalEffects.effects;
await writeJson('STATE.json', state);

const finalReport = `# W13-101 Final Report

Generated: 2026-07-18T17:56:40Z
Updated: ${now}

Status: ${finalStatus}.

## Production Core

- Production URL: https://join.onetimeonetime.com
- Runtime source SHA: ${runtimeSha}
- Web deployment: 243b614a-bd51-49fe-9aae-b17b99a6fe22
- Worker deployment: 52226afb-5b5c-4e79-8982-8b26115dfaba
- /health, /ready, /version, and public landing passed.
- /ready reports latest migration 2203_w13_100_student_gamification.
- Optional email, WhatsApp, and support bridge dependencies are disabled by runtime flag.
- Worker heartbeat and outbox audit passed with zero ready-like and zero dead-letter-like rows.

## Backup And Migration

- Fresh production PG18 native backup/restore proof passed before production writes.
- Backup proof run: w13-101-prod-pg18-20260718T190341Z.
- Production migrations applied: 2200, 2201, 2202, 2203.
- Database URL and secrets were not printed.

## Controlled Identity Status

- Staging owner/admin/parent/student journeys passed completely with no external sends.
- Production auth pages and protected route isolation passed.
- Production live admin/parent/student login was not completed by Codex. The prior OPS-11 protected admin activation was sent to the configured protected destination but was time-limited; a refreshed operator handoff or accepted production identity path remains required.

## Optional Lanes

- Provider canaries remain off; no email, WhatsApp, Telegram, Zoom, Vimeo, Buffer, Stripe live, OpenAI/helper, or BNA support effects were performed.
- CRM import was not applied because no accepted OPS-13A production apply manifest/hash/count gate was present.

## Private Handoff

- Staging private handoff: C:/Users/User/.onetime-w13-101-private/staging-identity-handoff.private.json
- Production runtime env snapshot: C:/Users/User/.onetime-w13-101-private/production-runtime-env.private.json

Secrets, destinations, raw tokens, passwords, DB URLs, and activation/reset links are not committed in this report.
`;
await writeFile(path.join(runDir, 'FINAL-REPORT.md'), finalReport, 'utf8');

const operatorHandoff = `# W13-101 Operator Handoff

Updated: ${now}

Status: ${finalStatus}

Production safe core is deployed at https://join.onetimeonetime.com with providers and real import disabled.

Use these private local files for protected material:

- C:/Users/User/.onetime-w13-101-private/staging-identity-handoff.private.json
- C:/Users/User/.onetime-w13-101-private/staging-runtime-env.private.json
- C:/Users/User/.onetime-w13-101-private/production-runtime-env.private.json

Do not commit or paste private handoff contents. The current remaining operator action is to refresh/complete protected production admin, parent, and student live login through an accepted production identity path. OPS-11 previously delivered a protected production admin activation, but that link was time-limited.

Optional providers and CRM import remain pending; no broad sends, provider writes, live Stripe charges, DNS changes, or production CRM import were performed in W13-101.
`;
await writeFile(path.join(runDir, 'OPERATOR-HANDOFF.md'), operatorHandoff, 'utf8');

const resume = `# W13-101 Resume

Updated: ${now}

Terminal status: ${finalStatus}

Production core is live on ${runtimeSha}.

- Web: 243b614a-bd51-49fe-9aae-b17b99a6fe22
- Worker: 52226afb-5b5c-4e79-8982-8b26115dfaba
- Latest migration: 2203_w13_100_student_gamification
- Fresh backup proof: w13-101-prod-pg18-20260718T190341Z
- Optional providers: off
- CRM import: not applied

Remaining closeout:

1. Commit and push W13-101 checkpoint evidence if the working tree scope is accepted.
2. Create the W13-101 release tag only after commit/push governance is approved.
3. Refresh/complete production admin, parent, and student live login via accepted protected identity handoff.
`;
await writeFile(path.join(runDir, 'RESUME.md'), resume, 'utf8');

const rollback = await readFile(path.join(runDir, 'ROLLBACK-ROLLFORWARD.md'), 'utf8');
const rollbackAppend = `

## Production W13-101 Roll-forward State

Updated: ${now}

- Production web exact-code deployment succeeded: 243b614a-bd51-49fe-9aae-b17b99a6fe22.
- Production worker exact-code deployment succeeded after a worker-manifest retry: 52226afb-5b5c-4e79-8982-8b26115dfaba.
- The first worker upload failed because root railway.json applied the web healthcheck to the worker; the active worker retry used the tracked worker manifest in a disposable detached worktree.
- Staging showed native \`railway down\` is not a safe routine rollback path for this topology. Preferred runtime recovery remains exact-source rebuild/roll-forward. Database restore remains last resort and requires operator approval.
`;
await writeFile(
  path.join(runDir, 'ROLLBACK-ROLLFORWARD.md'),
  `${rollback.trimEnd()}\n${rollbackAppend}`,
  'utf8',
);

const changedFiles = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else changedFiles.push(path.relative(root, full).replace(/\\/g, '/'));
  }
}
await walk(runDir);
changedFiles.sort();
await writeFile(path.join(runDir, 'CHANGED-FILES.txt'), `${changedFiles.join('\n')}\n`, 'utf8');

process.stdout.write(`${JSON.stringify({ status: 'updated', runDir, finalStatus }, null, 2)}\n`);
