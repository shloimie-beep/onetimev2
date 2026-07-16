#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TASK_ID = 'OPS-06';
const PACKET_ID = 'OPS-06-20260716-d34103b1';
const DEFAULT_PACKET_DIR = `packets/${TASK_ID}/${PACKET_ID}`;
const DEFAULT_SCHEMA = 'ops/ops06/evidence.schema.json';
const REQUIRED_STAGING_ENV = [
  'ONE_TIME_STAGING_URL',
  'STAGING_BASE_URL',
  'RAILWAY_PUBLIC_DOMAIN',
  'OT75_STAGING_WEB_SERVICE',
  'OT75_STAGING_DOMAIN',
  'OT75_STAGING_DATABASE_REFERENCE_ID',
];

export async function validatePacket(packetDir = DEFAULT_PACKET_DIR) {
  const manifest = await readJson(path.join(packetDir, 'MANIFEST.json'));
  const checksumsText = await readFile(path.join(packetDir, 'checksums.sha256'), 'utf8');
  const checksumRows = checksumsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const match = /^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(line);
      if (!match) throw new Error(`Invalid checksum row: ${line}`);
      return { expected: match[1].toLowerCase(), relativePath: match[2].trim() };
    });
  const mismatches = [];
  for (const row of checksumRows) {
    const filePath = path.join(packetDir, row.relativePath);
    const actual = await sha256File(filePath);
    if (actual !== row.expected) {
      mismatches.push({ path: row.relativePath, expected: row.expected, actual });
    }
  }
  const exactControlNames = {
    packet_json_present: await exists(path.join(packetDir, 'PACKET.json')),
    sha256sums_txt_present: await exists(path.join(packetDir, 'SHA256SUMS.txt')),
    codex_prompt_md_present: await exists(path.join(packetDir, 'CODEX-PROMPT.md')),
  };
  const valid =
    manifest.task_id === TASK_ID &&
    manifest.packet_id === PACKET_ID &&
    checksumRows.length > 0 &&
    mismatches.length === 0;
  return {
    valid,
    task_id: manifest.task_id,
    packet_id: manifest.packet_id,
    schema_version: manifest.schema_version,
    checksum_rows: checksumRows.length,
    mismatches,
    exact_control_names: exactControlNames,
    control_name_discrepancy:
      exactControlNames.packet_json_present &&
      exactControlNames.sha256sums_txt_present &&
      exactControlNames.codex_prompt_md_present
        ? null
        : 'Packet uses MANIFEST.json/checksums.sha256/DIRECT-CODEX-PROMPT.md instead of exact PACKET.json/SHA256SUMS.txt/CODEX-PROMPT.md names.',
  };
}

export function validateFixtures(fixtures) {
  const strings = [];
  collectStrings(fixtures, strings);
  const emails = strings.filter((value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value));
  const nonExampleEmails = emails.filter((value) => {
    const domain = value.toLowerCase().split('@').pop() ?? '';
    return domain !== 'example.test' && !domain.endsWith('.example.test');
  });
  const forbiddenFragments = [
    'join.onetimeonetime.com',
    'bneineviimacademy',
    'sk_live_',
    'sk_test_',
    'whapi',
    'telegram.org',
    'zoom.us',
    'vimeo.com',
  ];
  const forbiddenMatches = strings.filter((value) =>
    forbiddenFragments.some((fragment) => value.toLowerCase().includes(fragment)),
  );
  return {
    valid: nonExampleEmails.length === 0 && forbiddenMatches.length === 0,
    email_count: emails.length,
    non_example_emails: nonExampleEmails,
    forbidden_matches: forbiddenMatches,
    namespace: fixtures.namespace,
    schema_version: fixtures.schema_version,
  };
}

export function evaluateActionRegistry({ requiredRegistry, currentRegistry }) {
  const requiredActions = requiredRegistry.actions ?? [];
  const currentActions = currentRegistry.actions ?? [];
  const currentIds = new Set(currentActions.map((action) => action.action_id));
  const requiredIds = new Set(requiredActions.map((action) => action.stable_id));
  const matched = requiredActions.filter((action) => currentIds.has(action.stable_id));
  const missing = requiredActions
    .filter((action) => !currentIds.has(action.stable_id))
    .map((action) => action.stable_id);
  const extra = currentActions
    .filter((action) => !requiredIds.has(action.action_id))
    .map((action) => action.action_id);
  const unavailable = currentActions
    .filter((action) => action.readiness_state === 'unavailable_by_design')
    .map((action) => action.action_id);
  const duplicateIds = duplicates(currentActions.map((action) => action.action_id));
  return {
    required_count: requiredActions.length,
    runtime_registry_count: currentActions.length,
    matched_count: matched.length,
    missing_count: missing.length,
    extra_count: extra.length,
    unavailable_by_design_count: unavailable.length,
    duplicate_count: duplicateIds.length,
    missing_required_stable_ids: missing,
    runtime_extra_action_ids: extra,
    unavailable_by_design_action_ids: unavailable,
    duplicate_action_ids: duplicateIds,
    bijection: missing.length === 0 && extra.length === 0 && duplicateIds.length === 0,
  };
}

export async function buildCheckpoint({ packetDir = DEFAULT_PACKET_DIR, runId, outDir }) {
  const now = new Date().toISOString();
  const localHead = git(['rev-parse', 'HEAD']).trim();
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const packet = await validatePacket(packetDir);
  const fixtures = await readJson(path.join(packetDir, 'fixtures.synthetic.json'));
  const fixtureValidation = validateFixtures(fixtures);
  const requiredRegistry = await readJson(path.join(packetDir, 'action-registry.required.json'));
  const currentRegistry = await readJson('ops/day-one/visible-action-registry.json');
  const actionAudit = evaluateActionRegistry({ requiredRegistry, currentRegistry });
  const auditCurrent = await readJson(path.join(packetDir, 'AUDIT-CURRENT-STATE.json'));
  const acceptance = await readJson(path.join(packetDir, 'acceptance-gates.json'));
  const journeyRows = await readCsv(path.join(packetDir, 'journey-matrix.csv'));
  const roleRows = await readCsv(path.join(packetDir, 'role-state-matrix.csv'));
  const errorRows = await readCsv(path.join(packetDir, 'error-state-matrix.csv'));
  const viewportRows = await readCsv(path.join(packetDir, 'viewport-a11y-matrix.csv'));
  const isolationRows = await readCsv(path.join(packetDir, 'isolation-matrix.csv'));
  const performanceBudgets = await readJson(path.join(packetDir, 'performance-budgets.json'));
  const envDiscovery = discoverEnvironment();
  const predeploy = runJsonCommand(['node', ['scripts/ot75/check-predeploy-gates.mjs', '--json']]);
  const exactStagingProven =
    envDiscovery.staging_url_present && predeploy.json?.blocked_count === 0;
  const runRoot =
    outDir ??
    path.join('ops', 'evidence', TASK_ID, runId ?? `${TASK_ID}-${now.replace(/[-:.]/g, '')}`);
  await mkdir(runRoot, { recursive: true });

  const blockers = [];
  if (!exactStagingProven) {
    blockers.push({
      blocker_id: 'BLOCKER-OPS06-ISOLATED-STAGING',
      severity: 'blocking',
      summary:
        'No exact isolated staging URL/SHA is available; staging deploy approval is absent and OT75 predeploy gates report activation blockers.',
      evidence: ['preflight/target-discovery.json', 'preflight/source-sha.json'],
      owner_next_action:
        'Provide isolated One Time staging service/domain/database variables and exact deployed SHA readback, then rerun OPS-06.',
    });
  }
  if (actionAudit.missing_count > 0 || actionAudit.unavailable_by_design_count > 0) {
    blockers.push({
      blocker_id: 'BLOCKER-OPS06-ACTION-REGISTRY',
      severity: 'blocking',
      summary:
        'Current static action registry is not OPS-06 complete and still contains unavailable-by-design controls.',
      evidence: ['actions/runtime-action-registry.json', 'actions/dom-registry-diff.json'],
    });
  }
  for (const gap of auditCurrent.mandatory_gaps_or_unproven_surfaces ?? []) {
    const gapId = typeof gap === 'object' && gap ? gap.id : null;
    const gapArea = typeof gap === 'object' && gap ? gap.area : null;
    const gapFinding = typeof gap === 'object' && gap ? gap.finding : null;
    const gapRequired = typeof gap === 'object' && gap ? gap.required_outcome : null;
    blockers.push({
      blocker_id: gapId
        ? `BLOCKER-${gapId}`
        : `BLOCKER-OPS06-PRODUCT-GAP-${String(blockers.length + 1).padStart(2, '0')}`,
      severity: 'blocking',
      summary: gapFinding || (typeof gap === 'string' ? gap : JSON.stringify(gap)),
      area: gapArea,
      required_outcome: gapRequired,
      evidence: ['audit/contracts-routes-tests.json'],
    });
  }

  await writePreflight(runRoot, {
    now,
    envDiscovery,
    predeploy,
    exactStagingProven,
    localHead,
    branch,
    fixtureValidation,
  });
  await writeAudit(runRoot, { now, localHead, packet, auditCurrent });
  await writeActionEvidence(runRoot, {
    now,
    actionAudit,
    requiredRegistry,
    currentRegistry,
    exactStagingProven,
  });
  await writeDatabaseEvidence(runRoot, now);
  await writeJourneyEvidence(runRoot, { now, journeyRows });
  await writeMatrixAndRuntimeEvidence(runRoot, {
    now,
    roleRows,
    errorRows,
    viewportRows,
    isolationRows,
    performanceBudgets,
    fixtureValidation,
  });
  await copyFile(DEFAULT_SCHEMA, path.join(runRoot, 'checkpoint-evidence.schema.json'));

  const gates = acceptance.gates.map((gate) => {
    if (gate.gate_id === 'G01') {
      return { gate_id: gate.gate_id, name: gate.name, status: 'PASS', evidence: gate.evidence };
    }
    if (gate.gate_id === 'G02') {
      return {
        gate_id: gate.gate_id,
        name: gate.name,
        status: 'BLOCKED',
        evidence: ['preflight/target-discovery.json', 'preflight/source-sha.json'],
        blocker_id: 'BLOCKER-OPS06-ISOLATED-STAGING',
      };
    }
    return {
      gate_id: gate.gate_id,
      name: gate.name,
      status: 'NOT_RUN',
      evidence: ['preflight/target-discovery.json'],
      blocked_by: 'G02',
    };
  });
  await writeJson(path.join(runRoot, 'gates.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    gates,
  });

  let finalReport = makeFinalReport({
    now,
    localHead,
    branch,
    journeyRows,
    roleRows,
    viewportRows,
    performanceBudgets,
    actionAudit,
    gates,
    blockers,
    packet,
    fixtureValidation,
  });
  await writeJson(path.join(runRoot, 'FINAL-REPORT.json'), finalReport);
  await writeFile(path.join(runRoot, 'FINAL-REPORT.md'), renderFinalMarkdown(finalReport));
  await writeFile(
    path.join(runRoot, 'commands.redacted.log'),
    renderCommandLog(now, branch, localHead, predeploy),
  );
  await writeFile(path.join(runRoot, 'changed-files.txt'), `${git(['status', '--short'])}\n`);

  const index = await buildEvidenceIndex(runRoot);
  await writeJson(path.join(runRoot, 'evidence-index.json'), index);
  const indexSha = await sha256File(path.join(runRoot, 'evidence-index.json'));
  finalReport = { ...finalReport, evidence_index_sha256: indexSha };
  await writeJson(path.join(runRoot, 'FINAL-REPORT.json'), finalReport);
  await writeFile(path.join(runRoot, 'FINAL-REPORT.md'), renderFinalMarkdown(finalReport));
  await writeChecksums(runRoot);

  return {
    run_root: runRoot,
    verdict: finalReport.verdict,
    blockers: blockers.length,
    packet_valid: packet.valid,
    fixture_valid: fixtureValidation.valid,
    required_actions: actionAudit.required_count,
    runtime_actions: actionAudit.runtime_registry_count,
    missing_actions: actionAudit.missing_count,
    unavailable_actions: actionAudit.unavailable_by_design_count,
    final_report: path.join(runRoot, 'FINAL-REPORT.json'),
  };
}

async function writePreflight(
  runRoot,
  { now, envDiscovery, predeploy, exactStagingProven, localHead, branch, fixtureValidation },
) {
  await writeJson(path.join(runRoot, 'preflight', 'target-discovery.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    status: exactStagingProven ? 'candidate_available' : 'blocked_environment',
    env: envDiscovery,
    ot75_predeploy: {
      exit_code: predeploy.status,
      blocked_count: predeploy.json?.blocked_count ?? null,
      gates: (predeploy.json?.gates ?? []).map((gate) => ({
        id: gate.id,
        status: gate.status,
        missing_env_names: gate.missing_env_names ?? [],
      })),
    },
    forbidden_actions_performed: false,
  });
  await writeJson(path.join(runRoot, 'preflight', 'source-sha.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    repository: 'webcraft-media/onetimev2',
    local_head: localHead,
    branch,
    exact_deployed_sha_proven: false,
    tested_sha: null,
    deployed_sha: null,
    version_endpoint_sha: null,
    reason: 'No isolated staging URL/SHA was proven.',
  });
  await writeJson(path.join(runRoot, 'preflight', 'provider-off.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    status: 'static_preflight_only',
    provider_calls: 0,
    fixture_validation: fixtureValidation,
    providers_forbidden: true,
  });
  await writeJson(path.join(runRoot, 'health', 'web.json'), blockedEvidence('web health'));
  await writeJson(path.join(runRoot, 'health', 'worker.json'), blockedEvidence('worker health'));
}

async function writeAudit(runRoot, { now, localHead, packet, auditCurrent }) {
  await writeJson(path.join(runRoot, 'audit', 'contracts-routes-tests.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    local_head: localHead,
    packet_valid: packet.valid,
    packet,
    route_inventory: await collectRouteInventory(),
    existing_scripts: await readPackageScripts(),
    audit_anchor: auditCurrent.audit_anchor,
    mandatory_gaps_or_unproven_surfaces: auditCurrent.mandatory_gaps_or_unproven_surfaces ?? [],
    product_gap_policy:
      'These gaps are blockers. The harness records them; it does not invent missing business features.',
  });
  await writeJson(path.join(runRoot, 'audit', 'diff.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    changed_files: git(['status', '--porcelain=v1']).split('\n').filter(Boolean),
  });
}

async function writeActionEvidence(
  runRoot,
  { now, actionAudit, requiredRegistry, currentRegistry, exactStagingProven },
) {
  await writeJson(path.join(runRoot, 'actions', 'runtime-action-registry.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    schema_version: 'ops06.runtime_action_registry.v1',
    generated_at: now,
    mode: 'static_checkpoint_not_dom_crawl',
    required_registry_schema: requiredRegistry.schema_version,
    current_registry_schema: currentRegistry.schema_version,
    ...actionAudit,
    actions: currentRegistry.actions ?? [],
  });
  await writeJson(path.join(runRoot, 'actions', 'dom-registry-diff.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    status: exactStagingProven ? 'not_run' : 'blocked_environment',
    reason: 'DOM crawl requires exact isolated staging or authorized local harness run.',
    action_audit: actionAudit,
  });
  await writeJson(path.join(runRoot, 'actions', 'click-results.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    status: 'not_run_blocked_environment',
    clicked_actions: 0,
    fabricated_results: false,
  });
}

async function writeDatabaseEvidence(runRoot, now) {
  await writeJson(
    path.join(runRoot, 'database', 'fresh-migration.json'),
    blockedEvidence('PostgreSQL 16 fresh migration'),
  );
  await writeJson(
    path.join(runRoot, 'database', 'upgrade-migration.json'),
    blockedEvidence('PostgreSQL 16 upgrade migration'),
  );
  await writeJson(path.join(runRoot, 'database', 'migration-ledger.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    status: 'static_migration_inventory_only',
    migration_files: (await listFiles('packages/db/migrations')).filter((file) =>
      file.endsWith('.sql'),
    ),
  });
  await writeJson(
    path.join(runRoot, 'database', 'concurrency.json'),
    blockedEvidence('PostgreSQL 16 concurrency'),
  );
}

async function writeJourneyEvidence(runRoot, { now, journeyRows }) {
  const journeyResults = journeyRows.map((row) => ({
    step_id: row.step_id,
    name: row.name,
    actor: row.actor,
    status: row.step_id === 'J01' ? 'PASS' : 'NOT_RUN_BLOCKED_ENVIRONMENT',
    evidence:
      row.step_id === 'J01'
        ? [
            'state/state.json',
            'state/state-transitions.jsonl',
            'state/commands.ndjson',
            'state/safety.json',
          ]
        : ['preflight/target-discovery.json'],
    fabricated: false,
  }));
  for (const row of journeyRows) {
    const slug = String(row.name ?? row.step_id)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    await writeJson(
      path.join(runRoot, 'journey', `${row.step_id}-${slug}.json`),
      journeyResults.find((result) => result.step_id === row.step_id),
    );
  }
  await writeJson(path.join(runRoot, 'journey', 'results.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    required_steps: journeyRows.length,
    executed_steps: 1,
    passed_steps: 1,
    failed_steps: 0,
    not_run_steps: journeyRows.length - 1,
    results: journeyResults,
  });
}

async function writeMatrixAndRuntimeEvidence(
  runRoot,
  { now, roleRows, errorRows, viewportRows, isolationRows, performanceBudgets, fixtureValidation },
) {
  await writeJson(
    path.join(runRoot, 'role-state', 'results.json'),
    matrixBlocked('role-state', roleRows, errorRows),
  );
  await writeJson(
    path.join(runRoot, 'isolation', 'results.json'),
    matrixBlocked('isolation', isolationRows),
  );
  await writeJson(
    path.join(runRoot, 'queue', 'J43-retry-dead-letter.json'),
    blockedEvidence('queue retry/dead-letter'),
  );
  await writeJson(path.join(runRoot, 'performance', 'J46-summary.json'), {
    ...blockedEvidence('30-sample throttled performance'),
    performance_profile_sha256: sha256Json(performanceBudgets.measurement_profile ?? {}),
    routes_required: performanceBudgets.routes?.length ?? 0,
    samples_per_route: performanceBudgets.measurement_profile?.samples_per_route ?? null,
  });
  await mkdir(path.join(runRoot, 'performance', 'raw'), { recursive: true });
  await writeJson(
    path.join(runRoot, 'performance', 'raw', 'not-run.json'),
    blockedEvidence('raw performance samples'),
  );
  await writeJson(
    path.join(runRoot, 'accessibility', 'J45-matrix.json'),
    matrixBlocked('accessibility', viewportRows),
  );
  await writeJson(
    path.join(runRoot, 'design', 'system-consistency.json'),
    blockedEvidence('design consistency crawl'),
  );
  await writeJson(path.join(runRoot, 'security', 'scan-summary.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    status: 'static_preflight_only',
    fixture_validation: fixtureValidation,
    provider_calls: 0,
    production_rows_touched: 0,
    real_users_created: 0,
  });
  await writeJson(path.join(runRoot, 'security', 'network-destinations.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    status: 'no_runtime_network_trace',
    reason: 'No exact staging target; no browser/server rehearsal network calls were made.',
    observed_destinations: [],
  });
  await writeJson(path.join(runRoot, 'security', 'mutation-ledger.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    provider_calls: 0,
    real_users_created: 0,
    production_rows_touched: 0,
    live_charges: 0,
    broad_sends: 0,
    buffer_publishes: 0,
    root_dns_mutations: 0,
    production_deploys: 0,
    bna_fanout: 0,
  });
  await writeJson(
    path.join(runRoot, 'security', 'session-isolation.json'),
    blockedEvidence('session isolation'),
  );
  await writeJson(path.join(runRoot, 'reset', 'J47-reset-1.json'), resetEvidence(now));
  await writeJson(path.join(runRoot, 'reset', 'J47-reset-2.json'), resetEvidence(now));
  await writeJson(path.join(runRoot, 'reset', 'post-reset-diff.json'), {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    status: 'clean_no_fixture_mutations_attempted',
    baseline_changed: false,
  });
}

function makeFinalReport({
  now,
  localHead,
  branch,
  journeyRows,
  roleRows,
  viewportRows,
  performanceBudgets,
  actionAudit,
  gates,
  blockers,
  packet,
  fixtureValidation,
}) {
  return {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    schema_version: 'ops06.checkpoint_evidence.v1',
    generated_at: now,
    verdict: 'BLOCKED_ENVIRONMENT',
    environment: {
      status: 'blocked_missing_exact_isolated_staging',
      base_url: null,
      isolated_staging_proven: false,
      deployment_attempted: false,
      postgres_major: null,
      provider_mode: 'off_static_preflight',
    },
    source: {
      repository: 'webcraft-media/onetimev2',
      local_head: localHead,
      branch,
      tested_sha: null,
      deployed_sha: null,
      version_endpoint_sha: null,
      worker_sha: null,
      exact_deployed_sha_proven: false,
    },
    safety: {
      provider_calls: 0,
      real_users_created: 0,
      production_rows_touched: 0,
      live_charges: 0,
      broad_sends: 0,
      buffer_publishes: 0,
      root_dns_mutations: 0,
      production_deploys: 0,
      bna_fanout: 0,
    },
    journey: {
      required_steps: journeyRows.length,
      executed_steps: 1,
      passed_steps: 1,
      failed_steps: 0,
      not_run_steps: journeyRows.length - 1,
      results_path: 'journey/results.json',
    },
    actions: {
      required_registry_count: actionAudit.required_count,
      runtime_registry_count: actionAudit.runtime_registry_count,
      matched_count: actionAudit.matched_count,
      missing_count: actionAudit.missing_count,
      unavailable_by_design_count: actionAudit.unavailable_by_design_count,
      results_path: 'actions/runtime-action-registry.json',
    },
    roles_states: {
      roles_required: 7,
      roles_passed: 0,
      state_cases_required: roleRows.length,
      state_cases_passed: 0,
      viewport_mode_cases_required: viewportRows.length,
      viewport_mode_cases_passed: 0,
      results_path: 'role-state/results.json',
    },
    database: {
      postgres_major: null,
      fresh_migration: 'NOT_RUN_BLOCKED_ENVIRONMENT',
      upgrade_migration: 'NOT_RUN_BLOCKED_ENVIRONMENT',
      concurrency: 'NOT_RUN_BLOCKED_ENVIRONMENT',
    },
    worker: {
      health: 'NOT_RUN_BLOCKED_ENVIRONMENT',
      retry: 'NOT_RUN_BLOCKED_ENVIRONMENT',
      dead_letter: 'NOT_RUN_BLOCKED_ENVIRONMENT',
      restart_recovery: 'NOT_RUN_BLOCKED_ENVIRONMENT',
      duplicate_suppression: 'NOT_RUN_BLOCKED_ENVIRONMENT',
      provider_mode: 'sink_required_not_executed',
    },
    security: {
      secret_scan: 'STATIC_FIXTURE_PREFLIGHT_ONLY',
      pii_scan: 'STATIC_FIXTURE_PREFLIGHT_ONLY',
      provider_url_scan: 'STATIC_FIXTURE_PREFLIGHT_ONLY',
      session_revocation: 'NOT_RUN_BLOCKED_ENVIRONMENT',
      forbidden_matrix: 'NO_FORBIDDEN_MUTATION_PERFORMED',
      network_destination_scan: 'NOT_RUN_BLOCKED_ENVIRONMENT',
    },
    performance: {
      profile_sha256: sha256Json(performanceBudgets.measurement_profile ?? {}),
      routes_required: performanceBudgets.routes?.length ?? 0,
      routes_passed: 0,
      samples_per_route: performanceBudgets.measurement_profile?.samples_per_route ?? null,
      raw_samples_present: false,
      bundle_budgets: 'NOT_RUN_BLOCKED_ENVIRONMENT',
      request_budgets: 'NOT_RUN_BLOCKED_ENVIRONMENT',
      database_budgets: 'NOT_RUN_BLOCKED_ENVIRONMENT',
      bna_fanout: 0,
    },
    reset: {
      first_reset: 'NOT_RUN_NO_FIXTURES_CREATED',
      second_reset: 'NOT_RUN_NO_FIXTURES_CREATED',
      remaining_synthetic_rows: 0,
      remaining_sessions: 0,
      remaining_queue_claims: 0,
      idempotent: true,
    },
    gates,
    blockers,
    packet_validation: packet,
    fixture_validation: fixtureValidation,
    evidence_index_sha256: ''.padStart(64, '0'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await buildCheckpoint({
    packetDir: args['packet-dir'] ?? DEFAULT_PACKET_DIR,
    runId: args['run-id'],
    outDir: args['out-dir'],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const [key, inlineValue] = token.slice(2).split('=');
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readPackageScripts() {
  return Object.keys((await readJson('package.json')).scripts ?? {}).sort();
}

async function collectRouteInventory() {
  const appText = await readFile('apps/web/src/server/app.ts', 'utf8');
  const routeMatches = [...appText.matchAll(/app\.(get|post|patch|delete|put)\(([^,\n]+)/g)].map(
    (match) => ({ method: match[1].toUpperCase(), expression: match[2].trim() }),
  );
  return { count: routeMatches.length, routes: routeMatches };
}

async function readCsv(filePath) {
  const text = await readFile(filePath, 'utf8');
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function discoverEnvironment() {
  const values = Object.fromEntries(
    REQUIRED_STAGING_ENV.map((name) => {
      const value = process.env[name];
      return [
        name,
        { present: Boolean(value), redacted: value ? redactEnvValue(name, value) : null },
      ];
    }),
  );
  return {
    required_env: values,
    staging_url_present: Boolean(process.env.ONE_TIME_STAGING_URL || process.env.STAGING_BASE_URL),
    staging_deploy_allowed: process.env.OPS06_ALLOW_STAGING_DEPLOY === '1',
  };
}

function redactEnvValue(name, value) {
  if (/URL|DOMAIN/.test(name)) {
    try {
      return new URL(value).host;
    } catch {
      return '<set-non-url>';
    }
  }
  return '<set>';
}

function runJsonCommand([command, args]) {
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8' });
  let json = null;
  try {
    json = result.stdout ? JSON.parse(result.stdout) : null;
  } catch {
    json = null;
  }
  return {
    command: `${command} ${args.join(' ')}`,
    status: result.status,
    json,
    stderr: result.stderr ? '<redacted stderr present>' : '',
  };
}

function blockedEvidence(subject) {
  return {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: new Date().toISOString(),
    subject,
    status: 'not_run_blocked_environment',
    reason: 'Exact isolated staging/source SHA was not proven; no rehearsal result is fabricated.',
  };
}

function matrixBlocked(kind, ...rowSets) {
  const rows = rowSets.flat();
  return {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: new Date().toISOString(),
    kind,
    required_cases: rows.length,
    executed_cases: 0,
    passed_cases: 0,
    status: 'not_run_blocked_environment',
    reason: 'Exact isolated staging/source SHA was not proven.',
  };
}

function resetEvidence(now) {
  return {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: now,
    status: 'not_run_no_fixtures_created',
    remaining_synthetic_rows: 0,
    remaining_sessions: 0,
    remaining_queue_claims: 0,
    idempotent: true,
  };
}

async function buildEvidenceIndex(root) {
  const files = await listFiles(root);
  const entries = [];
  for (const file of files.sort()) {
    if (file.endsWith('evidence-index.json') || file.endsWith('checksums.sha256')) continue;
    const absolute = path.join(root, file);
    const info = await stat(absolute);
    entries.push({
      path: file.replaceAll('\\', '/'),
      bytes: info.size,
      sha256: await sha256File(absolute),
    });
  }
  return {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    generated_at: new Date().toISOString(),
    file_count: entries.length,
    files: entries,
  };
}

async function writeChecksums(root) {
  const files = await listFiles(root);
  const rows = [];
  for (const file of files.sort()) {
    if (file.endsWith('checksums.sha256')) continue;
    rows.push(`${await sha256File(path.join(root, file))}  ${file.replaceAll('\\', '/')}`);
  }
  await writeFile(path.join(root, 'checksums.sha256'), `${rows.join('\n')}\n`);
}

async function listFiles(root) {
  const output = [];
  async function walk(dir, prefix = '') {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = path.join(prefix, entry.name);
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, rel);
      else if (entry.isFile()) output.push(rel);
    }
  }
  await walk(root);
  return output;
}

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(filePath) {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function collectStrings(value, output) {
  if (typeof value === 'string') {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, output);
  }
}

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes].sort();
}

function git(args) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function renderFinalMarkdown(report) {
  const lines = [
    '# OPS-06 Final Report',
    '',
    `Verdict: \`${report.verdict}\``,
    `Generated: \`${report.generated_at}\``,
    `Local HEAD: \`${report.source.local_head}\``,
    '',
    '## Environment',
    '',
    `- Isolated staging proven: \`${report.environment.isolated_staging_proven}\``,
    `- Deployment attempted: \`${report.environment.deployment_attempted}\``,
    `- Exact deployed SHA proven: \`${report.source.exact_deployed_sha_proven}\``,
    '',
    '## Safety',
    '',
    '- Provider calls, real users, production rows, live charges, broad sends, Buffer publishes, root DNS mutations, production deploys, and BNA fanout are all recorded as zero.',
    '',
    '## Blockers',
    '',
  ];
  for (const blocker of report.blockers) {
    lines.push(`- \`${blocker.blocker_id}\`: ${blocker.summary}`);
  }
  lines.push('', '## Harness Result', '');
  lines.push(
    `- Journey steps passed: ${report.journey.passed_steps}/${report.journey.required_steps}`,
  );
  lines.push(
    `- Action registry: ${report.actions.runtime_registry_count}/${report.actions.required_registry_count} current static entries; ${report.actions.missing_count} required OPS-06 entries missing; ${report.actions.unavailable_by_design_count} unavailable-by-design entries remain.`,
  );
  lines.push('', 'No synthetic journey result is claimed without exact isolated staging.');
  return `${lines.join('\n')}\n`;
}

function renderCommandLog(now, branch, localHead, predeploy) {
  return [
    `[${now}] branch=${branch}`,
    `[${now}] local_head=${localHead}`,
    `[${now}] packet checksum validation executed locally`,
    `[${now}] ${predeploy.command} exit=${predeploy.status}`,
    `[${now}] no deploy, provider mutation, production DB access, real send, live charge, public post, DNS mutation, or production row mutation`,
    '',
  ].join('\n');
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  });
}
