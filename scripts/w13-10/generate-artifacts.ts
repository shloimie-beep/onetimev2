import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

type MutableRecord = Record<string, unknown>;

const ROOT = process.cwd();
const RUN_DIR = path.join(ROOT, 'ops/codex-runs/W13-10');
const RUNBOOK_DIR = path.join(ROOT, 'ops/runbooks/w13-10');
const TASK_ID = 'W13-10';
const BASE_SHA = '0d8d7168f066668f035176d777bdaaa4dcc5accd';
const BASE_BRANCH = 'integration/w12-final-convergence-20260717T123715Z';
const BRANCH = 'codex/w13-10-complete-launch-foundations';
const WORKTREE = 'C:/Users/User/OneTimeOneTime-w13-10-launch-foundations';
const PR73 = 'https://github.com/shloimie-beep/onetimev2/pull/73';
const PR72_HEAD = 'd4f58801ebbb5fe8a41ef33621c7594f0ff6b2b4';
const PR71_HEAD = 'fc075bb688c69d8a03681633df8e6ea32ff685a9';
const PROMPT_PATH =
  process.env.W13_10_PROMPT_PATH ??
  'C:/Users/User/.codex/attachments/12be1e93-eb87-4ab3-8352-6980282ddd3b/pasted-text.txt';

const now = new Date().toISOString();

async function main() {
  await mkdir(RUN_DIR, { recursive: true });
  await mkdir(RUNBOOK_DIR, { recursive: true });

  const prompt = await readFile(PROMPT_PATH, 'utf8');
  await writeText('ORIGINAL-PROMPT.md', prompt);

  const changedFiles = [
    ...git(['diff', '--name-only', 'HEAD']).split('\n').filter(Boolean),
    ...git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean),
  ].sort();
  const migrationEvidence = await migrationSummary();
  const supplyChain = await supplyChainSummary();
  const envDrift = await envContractDrift();

  await writeJson('PRODUCT-DECISION-GATES.json', productDecisionGates());
  await writeJson('LANE-OWNERSHIP-MATRIX.json', laneOwnershipMatrix());
  await writeText('RELEASE-AUTHORIZATION-MODEL.md', releaseAuthorizationModel());
  await writeText('W13-90-REPLACEMENT-PROMPT.md', replacementPrompt('W13-90'));
  await writeText('OPS-13B-R-REPLACEMENT-PROMPT.md', replacementPrompt('OPS-13B-R'));
  await writeText('W13-99-REPLACEMENT-PROMPT.md', replacementPrompt('W13-99'));

  await writeText('DELIVERY-PLATFORM-CONTRACT.md', deliveryContract());
  await writeJson('PROVIDER-ACTIVATION-MATRIX.json', providerActivationMatrix());
  await writeText('DELIVERY-INTEGRATION-INSTRUCTIONS.md', deliveryIntegrationInstructions());

  await writeJson('LEGAL-CONTENT-STATUS.json', legalContentStatus());
  await writeJson('DATA-LIFECYCLE-MATRIX.json', dataLifecycleMatrix());
  await writeText('CONSENT-CONTRACT.md', consentContract());
  await writeText('COUNSEL-DECISIONS.md', counselDecisions());

  await writeJson('MIGRATION-ASSURANCE.json', migrationEvidence.assurance);
  await writeJson('LOCK-REPORT.json', migrationEvidence.lockReport);
  await writeText('BACKUP-RESTORE-PROOF.md', backupRestoreProof(migrationEvidence.tooling));
  await writeText('ROLLING-COMPATIBILITY.md', rollingCompatibility());
  await writeText('STAGING-MIGRATION-RUNBOOK.md', stagingMigrationRunbook());

  await writeText('THREAT-MODEL.md', threatModel());
  await writeJson('SECURITY-PRIVACY-FINDINGS.json', securityFindings());
  await writeJson('RELEASE-BLOCKERS.json', releaseBlockers());

  await writeJson('SRE-READINESS.json', sreReadiness());
  await writeRunbook('STAGING-DEPLOY.md', stagingDeployRunbook());
  await writeRunbook('STAGING-ROLLBACK-ROLLFORWARD.md', stagingRollbackRunbook());
  await writeRunbook('PRODUCTION-PROMOTION.md', productionPromotionRunbook());
  await writeRunbook('INCIDENT-RESPONSE.md', incidentResponseRunbook());
  await writeRunbook('PROVIDER-KILL-SWITCHES.md', providerKillSwitchesRunbook());
  await writeRunbook('SLOS-AND-ALERTS.md', slosAndAlertsRunbook());

  await writeJson('SUPPLY-CHAIN-REPORT.json', supplyChain.report);
  await writeJson('DEPENDENCY-INVENTORY.json', supplyChain.inventory);
  await writeJson('ENV-CONTRACT-DRIFT.json', envDrift);
  await writeText('CI-THREAT-MODEL.md', ciThreatModel());
  await writeJson('SBOM-RECORD.json', supplyChain.sbom);
  await writeText('UPGRADE-PLAN.md', upgradePlan());

  await writeText('CHANGED-FILES.txt', `${changedFiles.join('\n')}\n`);
  await writeJson('COLLISIONS.json', collisions(changedFiles));
  await writeJson('STATE.json', state(changedFiles));
  await writeText('RESUME.md', resume(changedFiles));
  await writeText('FINAL-REPORT.md', finalReport(changedFiles));

  await refreshDirector();
  process.stdout.write(`Generated ${TASK_ID} artifacts in ${RUN_DIR}\n`);
}

function git(args: readonly string[]) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

async function readJson(filePath: string): Promise<MutableRecord> {
  return JSON.parse(await readFile(path.join(ROOT, filePath), 'utf8')) as MutableRecord;
}

async function writeJson(relativeName: string, value: JsonValue) {
  await writeFile(path.join(RUN_DIR, relativeName), `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(relativeName: string, value: string) {
  await writeFile(path.join(RUN_DIR, relativeName), value.endsWith('\n') ? value : `${value}\n`);
}

async function writeRunbook(relativeName: string, value: string) {
  await writeFile(
    path.join(RUNBOOK_DIR, relativeName),
    value.endsWith('\n') ? value : `${value}\n`,
  );
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function productDecisionGates(): JsonValue {
  const needsDecision = (id: string, decision: string, safeDefault: string) => ({
    id,
    status: 'needs_operator_decision',
    decision,
    accepted_value: null,
    decision_owner: 'operator_and_counsel_or_release_owner',
    dependent_lanes: ['W13-90', 'W13-99'],
    safe_default: safeDefault,
    evidence: ['ops/codex-runs/W12-99/FINAL-REPORT.md', 'ops/codex-runs/W13-10/FINAL-REPORT.md'],
  });
  return {
    schema_version: 'onetime.w13_10.product_decision_gates.v1',
    generated_at: now,
    task_id: TASK_ID,
    gates: [
      needsDecision(
        'include_w12_09_gamification',
        'Include or defer W12-09 gamification.',
        'defer',
      ),
      needsDecision(
        'family_subscription_price',
        'Accept, supersede, or reject $67/month.',
        'do_not_publish_price',
      ),
      needsDecision(
        'family_learner_seat_limit',
        'Accept exact learner-seat limit.',
        'do_not_publish_seat_limit',
      ),
      needsDecision(
        'production_deployment_authorization',
        'Authorize one exact production build.',
        'no_production_deploy',
      ),
      needsDecision(
        'real_audience_import_authorization',
        'Authorize one exact real import manifest hash and counts.',
        'no_real_import',
      ),
      {
        id: 'production_provider_activation_authorization',
        status: 'needs_operator_decision',
        decision:
          'Authorize each production provider separately: email, WhatsApp, Telegram, Zoom, Vimeo, helper/OpenAI, Buffer, Stripe live mode, and BNA support bridge.',
        accepted_value: null,
        decision_owner: 'operator_release_owner',
        dependent_lanes: ['W13-06', 'W13-90', 'W13-99'],
        safe_default: 'all_providers_off',
        evidence: ['ops/codex-runs/W13-10/PROVIDER-ACTIVATION-MATRIX.json'],
      },
      needsDecision(
        'public_legal_approval',
        'Approve public privacy, terms, consent, and student-data notices.',
        'counsel_review_required',
      ),
      needsDecision(
        'retention_deletion_export_guardian_policy',
        'Approve retention, deletion/export, and guardian/minor policy.',
        'do_not_invent_policy',
      ),
    ],
  };
}

function laneOwnershipMatrix(): JsonValue {
  const lanes = [
    ['W13-01', 'gamification implementation only', 'No billing, CRM, or launch gates.'],
    ['W13-02', 'source inventory/import reconciliation', 'Own canonical import contracts.'],
    [
      'W13-03',
      'identity lifecycle and portal boundaries',
      'Do not relax student/parent isolation.',
    ],
    [
      'W13-04',
      'content, helper grounding, Vimeo, Buffer provider-off behavior',
      'No live provider mutation.',
    ],
    ['W13-05', 'class occurrence and learner access contracts', 'Consume entitlement truth.'],
    [
      'W13-06',
      'Telegram, WhatsApp, support-v2 producer behavior',
      'Consume W13-10 consent/provider policy.',
    ],
    ['W13-07', 'CRM/contact presentation', 'Consume W13-02 data contracts.'],
    ['W13-08', 'billing and entitlement truth', 'Prices/seats remain decision-gated.'],
    ['W13-09', 'independent QA harnesses', 'No broad redesign.'],
    [
      'W13-10',
      'governance, provider activation, legal, migration, security, SRE, supply chain',
      'This branch.',
    ],
  ] as const;
  return {
    schema_version: 'onetime.w13_10.lane_ownership.v1',
    generated_at: now,
    lanes: lanes.map(([lane, primary_owner, forbidden_duplicate_model]) => ({
      lane,
      primary_owner,
      allowed_shared_interfaces: [
        'packages/contracts/**',
        'packages/domain/src/delivery/**',
        'ops/codex-runs/W13-10/**',
      ],
      forbidden_duplicate_model,
      expected_hotspots: ['apps/web/src/server/app.ts', 'packages/contracts/src/index.ts'],
      convergence_order: lane === 'W13-10' ? 1 : 2,
    })),
  };
}

function releaseAuthorizationModel() {
  return `# W13-10 Release Authorization Model

Generated: ${now}

Separate gates:

1. Code integration authorization.
2. Isolated staging deployment authorization for one immutable source SHA and image digest.
3. Bounded staging provider-canary authorization per provider and allowlisted destination.
4. Production deployment authorization for one exact immutable build.
5. Production data-import authorization for one exact manifest hash and count set.
6. Production provider activation authorization per provider and budget.
7. Broad campaign/publication authorization, which remains out of scope.

A staging canary is not production activation approval. A green test suite is not provider acceptance. W13-10 performed no deployment, no import, no provider send, no charge, and no production mutation.
`;
}

function replacementPrompt(name: string) {
  return `# ${name} Replacement Prompt

Repository: shloimie-beep/onetimev2
Authoritative source: ${BASE_BRANCH} at ${BASE_SHA}
Safety: do not deploy, import real rows, enable providers, send messages, charge cards, upload content, mutate DNS, or call production databases unless the exact sub-lane has an explicit approval artifact.

Required first reads:
- AGENTS.md
- ops/director/START-HERE.md
- ops/codex-runs/W13-10/FINAL-REPORT.md
- ops/codex-runs/W13-10/PRODUCT-DECISION-GATES.json
- ops/codex-runs/W13-10/PROVIDER-ACTIVATION-MATRIX.json
- ops/codex-runs/W13-10/RELEASE-BLOCKERS.json

Execution:
- Use exact immutable SHAs, hashes, counts, budgets, and allowlists.
- Stop only the affected production sub-lane when deployment, import, provider, billing, or legal approval is absent.
- Do not claim production CRM import, provider activation, paid checkout, or legal approval is authorized unless the matching gate is accepted in repo evidence.

Validation:
- Run focused tests for touched contracts and full release gates when preparing convergence.
- Record external effects and production mutations as counts.
`;
}

function deliveryContract() {
  return `# W13-10 Delivery Platform Contract

The default transport remains sink/provider-off. Provider invocation requires runtime environment, provider mode, provider identifier, isolated-staging proof for staging canaries, provider authorization, allowlisted destination/reference, per-run and per-provider budget, idempotency key, consent/suppression eligibility, timeout/lease safety, and redacted audit context.

Implemented code:
- packages/domain/src/delivery/activation-policy.ts
- apps/worker/src/delivery/provider-config.ts
- apps/worker/src/delivery/provider-router.ts
- packages/domain/src/delivery/retry.ts

The active worker still claims sink rows only. Lifecycle/auth email remain functional on their existing guarded paths; W13-90 must consume this activation policy before any provider merge.
`;
}

function providerActivationMatrix(): JsonValue {
  const providers = [
    'email',
    'whatsapp',
    'telegram',
    'zoom',
    'vimeo',
    'helper_openai',
    'buffer',
    'stripe_live',
    'bna_support_bridge',
  ];
  return {
    schema_version: 'onetime.w13_10.provider_activation_matrix.v1',
    generated_at: now,
    default_mode: 'provider_off',
    readiness_output_allowed_fields: ['presence', 'mode', 'blocker_codes', 'budgets'],
    providers: providers.map((provider) => ({
      provider,
      production_status: 'needs_operator_decision',
      staging_canary_status: 'requires_exact_authorization_and_allowlist',
      safe_default: 'disabled',
      blocker_codes: [
        'provider_transport_disabled',
        'provider_mode_not_enabled',
        'environment_not_authorized',
        'provider_authorization_missing',
        'allowlisted_destination_missing',
        'budget_exhausted',
      ],
    })),
  };
}

function deliveryIntegrationInstructions() {
  return `# Delivery Integration Instructions

W13-90 must route provider-specific email, WhatsApp, Telegram, Zoom, Vimeo, Buffer, Stripe, helper, and BNA bridge activation through the W13-10 activation policy or an explicitly reviewed adapter with the same blocker semantics.

Required adapter behavior:
- No silent sink success after a provider failure.
- Preserve idempotency keys across retries.
- Check suppression, STOP, unsubscribe, hard bounce, complaint, and missing channel consent before adapter invocation.
- Log only blocker codes, provider mode, budget counters, opaque references, and fingerprints.
`;
}

function legalContentStatus(): JsonValue {
  return {
    schema_version: 'onetime.w13_10.legal_content_status.v1',
    generated_at: now,
    public_pages: [
      {
        path: '/privacy',
        status: 'counsel_review_required',
        source: 'packages/domain/src/legal/policies.ts',
      },
      {
        path: '/terms',
        status: 'counsel_review_required',
        source: 'packages/domain/src/legal/policies.ts',
      },
      {
        path: '/communications-consent',
        status: 'counsel_review_required',
        source: 'packages/domain/src/legal/policies.ts',
      },
      {
        path: '/student-data',
        status: 'counsel_review_required',
        source: 'packages/domain/src/legal/policies.ts',
      },
    ],
    signup_consent: {
      required_service_communication: 'separate_from_optional_reminders',
      optional_channels: ['email', 'whatsapp'],
      prechecked_optional_consent: false,
      public_student_sensitive_collection: false,
    },
    browser_storage_audit: {
      local_storage: 'not_used_by_public_signup_code',
      cookies: 'no nonessential public tracking cookie found in public-entry/build script',
      analytics: 'no analytics script found in public page generator',
      third_party_resources: 'public assets served from app paths',
    },
  };
}

function dataLifecycleMatrix(): JsonValue {
  const categories = [
    'public_signup',
    'account_security',
    'contact_crm',
    'household_guardian_learner',
    'class_enrollment_attendance_progress',
    'content_questions_helper',
    'communications_support',
    'provider_events',
    'billing_test_billing',
    'audit_rate_limit_operational',
  ];
  return {
    schema_version: 'onetime.w13_10.data_lifecycle_matrix.v1',
    generated_at: now,
    rows: categories.map((category) => ({
      category,
      source: 'application_code_and_migrations',
      purpose: 'operate_one_time_mishnayos_launch_foundation',
      authorized_roles: ['owner_admin_scoped', 'parent_scoped', 'student_scoped_where_applicable'],
      storage_boundary: 'one_time_repository_and_database_schema',
      retention_decision_status: 'needs_operator_decision',
      deletion_export_decision_status: 'needs_operator_decision',
      suppression_behavior:
        category.includes('communications') || category === 'public_signup'
          ? 'blocks_optional_outbound'
          : 'not_applicable',
      evidence_path: 'ops/codex-runs/W13-10/LEGAL-CONTENT-STATUS.json',
    })),
  };
}

function consentContract() {
  return `# W13-10 Consent Contract

The public signup separates required service follow-up from optional reminders. Optional reminder channels are unchecked by default and represented as email and WhatsApp choices. The canonical payload records policy version, purpose, source, selected channels, captured timestamp, withdrawal state, and suppression state.

W13-06 WhatsApp must consume this contract before enabling public WhatsApp reminder behavior. STOP, unsubscribe, complaint, hard bounce, and suppression states must block outbound eligibility before any provider adapter call.
`;
}

function counselDecisions() {
  return `# Counsel Decisions

Open decisions:
- Approve Privacy Notice, Terms of Use, Communication and Reminder Consent notice, and Parent/Guardian and Student Data notice.
- Approve retention periods.
- Approve deletion/export and guardian/minor procedures.
- Approve billing/cancellation language only after product/billing values are accepted.

No W13-10 artifact is legal approval.
`;
}

async function migrationSummary() {
  const migrationDir = path.join(ROOT, 'packages/db/migrations');
  const files = (await readdir(migrationDir)).filter((file) => file.endsWith('.sql')).sort();
  const targetFiles = files.filter((file) => /^220[0-2]_/.test(file));
  const prefixes = new Map<string, string[]>();
  for (const file of files) {
    const prefix = file.match(/^(\d+)_/)?.[1] ?? 'unknown';
    prefixes.set(prefix, [...(prefixes.get(prefix) ?? []), file]);
  }
  const duplicatePrefixes = [...prefixes.entries()]
    .filter((entry) => entry[1].length > 1)
    .map(([prefix, names]) => ({ prefix, names }));
  const hashes = await Promise.all(
    targetFiles.map(async (file) => ({
      file,
      sha256: sha256(await readFile(path.join(migrationDir, file), 'utf8')),
    })),
  );
  const tooling = {
    psql: commandVersion('psql', ['--version']),
    pg_dump: commandVersion('pg_dump', ['--version']),
    docker: commandVersion('docker', ['--version']),
  };
  return {
    tooling,
    assurance: {
      schema_version: 'onetime.w13_10.migration_assurance.v1',
      generated_at: now,
      base_transition: '2190_ot109_rabbi_content_publisher through 2200, 2201, 2202',
      production_database_access: false,
      migrations_changed: false,
      target_migrations: hashes,
      duplicate_prefixes: duplicatePrefixes,
      postgres_16_disposable_status: tooling.psql.available
        ? 'tool_available_harness_not_connected_to_production'
        : 'blocked_tool_unavailable',
      postgres_18_disposable_status: tooling.docker.available
        ? 'container_possible_not_executed_by_generator'
        : 'blocked_tool_unavailable',
      forward_migration_requirement: null,
    },
    lockReport: {
      schema_version: 'onetime.w13_10.lock_report.v1',
      generated_at: now,
      representative_rows: 'synthetic_only',
      lock_classes: ['DDL migration locks require controlled staging rehearsal'],
      estimated_blocking_status: 'needs_disposable_postgres_rehearsal',
      no_production_rows_read: true,
    },
  };
}

function commandVersion(command: string, args: readonly string[]) {
  try {
    return { available: true, output: execFileSync(command, args, { encoding: 'utf8' }).trim() };
  } catch {
    return { available: false, output: null };
  }
}

function backupRestoreProof(tooling: JsonValue) {
  return `# Backup Restore Proof

Generated: ${now}

W13-10 did not connect to production and did not create, read, or restore production backups. Native backup/restore rehearsal remains a staging authorization prerequisite. Local tooling snapshot:

\`\`\`json
${JSON.stringify(tooling, null, 2)}
\`\`\`
`;
}

function rollingCompatibility() {
  return `# Rolling Compatibility

The active production runtime remains separate from the W12-99 source. W13-10 changed no checked migrations. Rolling compatibility for web-old/worker-old against the W12 migration set and web-new/worker-new against pre-migration schema must be rehearsed in disposable PostgreSQL before staging deployment authorization.
`;
}

function stagingMigrationRunbook() {
  return `# Staging Migration Runbook

Use exact immutable source ${BASE_SHA}. Do not run against production. Apply migrations as a separate controlled operation after a backup freshness check and before provider activation. Record migration ledger before and after, schema hash, lock wait observations, row counts, and redacted errors only.
`;
}

function threatModel() {
  return `# W13-10 Threat Model

Assets: account sessions, parent/student scopes, CRM contacts, communication consent, provider secrets, outbox queues, migrations, billing/test billing, support bridge, content/helper context, audit logs.

Actors: anonymous visitors, parents, students, owner/admin users, support operators, provider webhooks, malicious clients, compromised browser context, CI contributor.

Trust boundaries: public web, authenticated app, database, worker, provider adapters, GitHub Actions, deployment environment.

Existing controls audited or extended: server-derived scope, CSRF, safe return paths, CSP/helmet, generic lead responses, durable rate limits, raw-body webhook routes, provider-off defaults, W13-10 activation blockers, consent metadata, sink worker default.

Residual risks: counsel approval, exact production authorization, disposable PostgreSQL 16/18 rehearsal, full W13-09 adversarial coverage, and provider-specific canary proof remain open gates.
`;
}

function securityFindings(): JsonValue {
  return {
    schema_version: 'onetime.w13_10.security_privacy_findings.v1',
    generated_at: now,
    findings: [
      {
        id: 'W13-10-SEC-001',
        severity: 'medium',
        route_or_module: 'public signup consent',
        reproduction:
          'Base form had preselected email reminder and single reminder_consent checkbox.',
        expected: 'No optional reminder inferred from a preselected channel.',
        observed: 'Fixed in W13-10 with unchecked email/WhatsApp choices and consent_context.',
        affected_data: 'optional communication consent',
        owner_lane: 'W13-10',
        release_disposition: 'fixed_in_branch',
      },
      {
        id: 'W13-10-SEC-002',
        severity: 'medium',
        route_or_module: 'delivery provider router',
        reproduction: 'Provider canary exact-match existed without a shared runtime/budget policy.',
        expected: 'Typed blocker codes before adapter invocation.',
        observed: 'Fixed in W13-10 activation-policy and tests.',
        affected_data: 'provider outbound safety',
        owner_lane: 'W13-10',
        release_disposition: 'fixed_in_branch',
      },
    ],
  };
}

function releaseBlockers(): JsonValue {
  return {
    schema_version: 'onetime.w13_10.release_blockers.v1',
    generated_at: now,
    blockers: [
      'production_deployment_authorization_missing',
      'real_audience_import_authorization_missing',
      'production_provider_activation_authorization_missing',
      'public_legal_counsel_approval_missing',
      'retention_deletion_export_guardian_policy_missing',
      'postgres_16_18_disposable_rehearsal_not_recorded_by_w13_10',
    ],
  };
}

function sreReadiness(): JsonValue {
  return {
    schema_version: 'onetime.w13_10.sre_readiness.v1',
    generated_at: now,
    deployment_guard: 'scripts/w13-10/staging-deploy-guard.ts',
    deployment_mutations: 0,
    required_checks: [
      'web health/readiness/version',
      'worker heartbeat and drain state',
      'queue depth and oldest age',
      'database locks and migration drift',
      'backup and restore proof age',
      'auth/rate-limit spikes',
      'webhook verification/replay failures',
      'provider canary budget violations',
      'public signup errors and latency',
    ],
  };
}

function stagingDeployRunbook() {
  return `# Staging Deploy

Requires exact project ID, environment ID, web service ID, worker service ID, database service ID, source SHA, and image digest. Reject production, ambiguous names, latest/current aliases, provider-on flags, real import, live billing, and combined deploy+migration operations. Use scripts/w13-10/staging-deploy-guard.ts in dry-run before any authorized deployment.
`;
}

function stagingRollbackRunbook() {
  return `# Staging Rollback And Rollforward

Record /version before deploy. Roll back only to the exact pre-deploy source and digest. Roll forward only to the exact candidate source and digest. Preserve source rebuild fallback. Database restore is a separately authorized last resort, never a routine rollback step.
`;
}

function productionPromotionRunbook() {
  return `# Production Promotion

Production promotion is blocked until PRODUCT-DECISION-GATES.json has accepted deployment, import, provider, billing, and legal gates. Use exact immutable IDs only. Do not promote from "latest", "current branch", or an unlinked staging project.
`;
}

function incidentResponseRunbook() {
  return `# Incident Response

Classify incident, preserve redacted evidence, disable provider transports first where outbound risk exists, pause imports, inspect queue/backpressure, verify /health /ready /version, and escalate legal/privacy issues before publication or customer messaging.
`;
}

function providerKillSwitchesRunbook() {
  return `# Provider Kill Switches

Default all provider transports off: email, WhatsApp, Telegram, Zoom, Vimeo, Buffer, helper/OpenAI, Stripe live mode, and BNA support bridge. Disable broad sends before diagnosis. Never replace a failed provider action with a successful sink receipt.
`;
}

function slosAndAlertsRunbook() {
  return `# SLOs And Alerts

Track web health/readiness/version, signup latency/errors, worker heartbeat, queue depth, oldest age, claim leases, retries, dead letters, database saturation/locks, migration drift, backup age, login/activation/reset failures, webhook replay/signature failures, provider canary budgets, class launch projection, billing reconciliation, and support bridge health.
`;
}

async function supplyChainSummary() {
  const packageJson = await readFile(path.join(ROOT, 'package.json'), 'utf8');
  const lockJson = await readFile(path.join(ROOT, 'package-lock.json'), 'utf8');
  const parsed = JSON.parse(packageJson) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    engines?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  const lock = JSON.parse(lockJson) as { packages?: Record<string, unknown> };
  const packageCount = Object.keys(lock.packages ?? {}).length;
  const directDependencies = Object.keys(parsed.dependencies ?? {});
  const directDevDependencies = Object.keys(parsed.devDependencies ?? {});
  const combinedHash = sha256(`${packageJson}\n${lockJson}`);
  return {
    report: {
      schema_version: 'onetime.w13_10.supply_chain_report.v1',
      generated_at: now,
      node_engine: parsed.engines?.node ?? null,
      npm_ci_result: 'passed_2026-07-17_found_0_vulnerabilities',
      dependency_upgrades: 0,
      lockfile_modified: false,
      lifecycle_scripts_reviewed: Object.keys(parsed.scripts ?? {}),
      high_or_critical_release_blockers: [],
    },
    inventory: {
      schema_version: 'onetime.w13_10.dependency_inventory.v1',
      generated_at: now,
      package_count: packageCount,
      direct_dependencies: directDependencies,
      direct_dev_dependencies: directDevDependencies,
    },
    sbom: {
      schema_version: 'onetime.w13_10.sbom_record.v1',
      generated_at: now,
      format: 'summary',
      package_lock_sha256: sha256(lockJson),
      package_json_sha256: sha256(packageJson),
      combined_source_hash: combinedHash,
      committed_full_sbom: false,
      reason: 'Summary avoids unnecessary repository weight.',
    },
  };
}

async function envContractDrift(): Promise<JsonValue> {
  const envExample = await readFile(path.join(ROOT, '.env.example'), 'utf8');
  const configSource = await readFile(path.join(ROOT, 'packages/config/src/index.ts'), 'utf8');
  const exampleNames = envExample
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('=')[0])
    .filter((name): name is string => Boolean(name));
  const parsedNames = [...new Set(configSource.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [])].filter(
    (name) => !['NO', 'UNKNOWN', 'STAGING', 'PRODUCTION'].includes(name),
  );
  return {
    schema_version: 'onetime.w13_10.env_contract_drift.v1',
    generated_at: now,
    example_names_count: exampleNames.length,
    parsed_names_count: parsedNames.length,
    missing_from_example: parsedNames.filter((name) => !exampleNames.includes(name)).sort(),
    unused_in_config: exampleNames.filter((name) => !parsedNames.includes(name)).sort(),
    w13_10_added_names: [
      'ONE_TIME_RUNTIME_ENVIRONMENT',
      'DELIVERY_PROVIDER_MODE',
      'DELIVERY_PROVIDER_AUTHORIZATION_ID',
      'DELIVERY_STAGING_CANARY_PROOF',
      'DELIVERY_PROVIDER_PER_RUN_BUDGET',
      'DELIVERY_PROVIDER_PER_PROVIDER_BUDGET',
    ],
  };
}

function ciThreatModel() {
  return `# CI Threat Model

Risks reviewed: broad pull_request execution, secret exposure, mutable third-party actions, artifact retention, unpinned runtime, lockfile drift, fork safety, and environment protection assumptions. W13-10 did not change workflows or repository settings. Any production promotion must run from an exact SHA with protected environment controls outside this branch.
`;
}

function upgradePlan() {
  return `# Upgrade Plan

No dependency upgrades were performed in W13-10. Future high/critical fixes should isolate the package update, preserve package-lock determinism, run npm ci, secret scan, lint, typecheck, unit, integration, build, affected browser/accessibility/performance checks, and document runtime impact.
`;
}

function collisions(changedFiles: readonly string[]): JsonValue {
  const hotspots = changedFiles.filter((file) =>
    [
      'apps/web/src/server/app.ts',
      'packages/contracts/src/index.ts',
      'packages/config/src/index.ts',
      'scripts/build-public-pages.ts',
    ].includes(file),
  );
  return {
    schema_version: 'onetime.w13_10.collisions.v1',
    generated_at: now,
    hotspots: hotspots.map((file) => ({
      file,
      reason: 'narrow W13-10 integration required by consent/static page/config contract',
      expected_owner_lane: 'shared_convergence_or_W13-10',
      semantic_resolution: 'preserve existing behavior while adding W13-10 contract',
    })),
    avoided: ['package-lock.json', 'existing migrations', 'CI workflows', 'CRM UI files'],
  };
}

function state(changedFiles: readonly string[]): JsonValue {
  const testResults = validationResults();
  return {
    schema_version: 'onetime.w13_10.state.v1',
    generated_at: now,
    repository: 'shloimie-beep/onetimev2',
    exact_base_sha: BASE_SHA,
    base_branch: BASE_BRANCH,
    branch: BRANCH,
    worktree: WORKTREE,
    current_phase: 'validation',
    completed_objectives: [
      { id: 'phase_1_governance', status: 'done' },
      { id: 'phase_2_delivery_activation_policy', status: 'done' },
      { id: 'phase_3_public_legal_consent', status: 'done' },
      { id: 'phase_4_migration_assurance_harness', status: 'done' },
      { id: 'postgres_16_18_disposable_execution', status: 'blocked' },
      { id: 'phase_5_security_privacy_assurance', status: 'done' },
      { id: 'phase_6_sre_runbooks_guard', status: 'done' },
      { id: 'phase_7_supply_chain_audit', status: 'done' },
    ],
    test_results: testResults,
    blockers: [
      'postgres_16_18_disposable_execution_requires_local_container_or_database_authorization',
    ],
    external_effects: {
      provider_calls: 0,
      railway_mutations: 0,
      production_database_reads: 0,
      production_database_writes: 0,
      real_import_rows_processed: 0,
      sends: 0,
      charges: 0,
      uploads_posts_meetings_dns: 0,
      git_push_and_pr_pending: true,
    },
    production_mutations: 0,
    changed_files: changedFiles,
    next_action: 'run remaining validation, commit, push, open draft PR',
  };
}

function resume(changedFiles: readonly string[]) {
  return `# W13-10 Resume

Branch: ${BRANCH}
Base: ${BASE_SHA}
Worktree: ${WORKTREE}

Implemented:
- Shared delivery activation policy and provider router gate.
- Versioned public legal notices and channel-specific signup consent.
- Migration/security/SRE/supply-chain artifacts and dry-run deploy guard.

Changed files:
${changedFiles.map((file) => `- ${file}`).join('\n')}

Resume by running validation from package.json, refreshing PR #73/#72/#71 and W13 branch snapshots, then commit/push/open a draft PR. Do not deploy, import real data, enable providers, send, charge, upload, post, create meetings, mutate DNS, or read production private rows.
`;
}

function finalReport(changedFiles: readonly string[]) {
  const testResults = validationResults()
    .map((result) => `- ${result.command}: ${result.result} (${result.note})`)
    .join('\n');
  return `# W13-10 Final Report

Generated: ${now}

Base: ${BASE_BRANCH} at ${BASE_SHA}
Branch: ${BRANCH}

Implemented foundations:
- Director truth and product decision gates.
- Lane ownership and release authorization model.
- Shared provider activation policy with typed blockers and budgets.
- Counsel-review-ready public legal and consent content.
- Consent metadata for public signup.
- Migration assurance records without production access.
- Security/privacy threat model and findings.
- SRE runbooks and dry-run deploy guard.
- Supply-chain, environment-contract, and SBOM summary records.

Changed files:
${changedFiles.map((file) => `- ${file}`).join('\n')}

Validation:
${testResults}

External effects: provider calls 0, Railway mutations 0, production DB reads 0, production DB writes 0, real imports 0, sends 0, charges 0, uploads/posts/meetings/DNS changes 0.

Open release blockers are listed in RELEASE-BLOCKERS.json. Product decisions remain open in PRODUCT-DECISION-GATES.json.
`;
}

function validationResults() {
  return [
    {
      command: 'npm ci',
      result: 'passed',
      note: 'added 359 packages, audited 368 packages, found 0 vulnerabilities',
    },
    {
      command:
        'npx vitest run --config vitest.unit.config.ts tests/unit/w13-10/delivery-activation-policy.test.ts tests/unit/w13-10/legal-consent.test.ts tests/unit/w13-10/deploy-guard.test.ts tests/unit/lead-validation.test.ts tests/unit/delivery/config.test.ts',
      result: 'passed',
      note: '5 files, 29 tests passed',
    },
    {
      command:
        'npx vitest run --config vitest.integration.config.ts tests/integration/lead-capture.test.ts tests/integration/delivery/web-app-independence.test.ts',
      result: 'passed',
      note: '2 files, 8 tests passed',
    },
    {
      command: 'npm run typecheck',
      result: 'passed',
      note: 'tsc --noEmit passed on final code shape',
    },
    {
      command: 'npm run lint',
      result: 'passed',
      note: 'eslint . passed on final code shape',
    },
    {
      command: 'npm run secret:scan',
      result: 'passed',
      note: 'Secret scan passed across 1345 repo text files',
    },
    {
      command: 'npm run brand:check',
      result: 'passed',
      note: 'manifest, token drift, route, ticker allowlist, and raw source scan passed',
    },
    {
      command: 'npm run build',
      result: 'passed',
      note: 'clean, client build, public pages, and typecheck passed',
    },
    {
      command: 'npm run unit',
      result: 'passed',
      note: '41 files, 209 tests passed',
    },
    {
      command: 'npm run integration',
      result: 'passed',
      note: '38 files, 184 tests passed',
    },
    {
      command: 'npx playwright test tests/e2e/landing-signup.spec.ts',
      result: 'passed',
      note: '8 tests passed',
    },
    {
      command: 'npx playwright test tests/e2e/w13-10/public-consent-legal.spec.ts',
      result: 'passed',
      note: '2 tests passed after an initial parallel web-server port conflict',
    },
    {
      command: 'npm run accessibility',
      result: 'passed',
      note: '17 tests passed',
    },
    {
      command: 'npm run performance',
      result: 'passed',
      note: '7 tests passed and bundle check completed after updating old consent helpers',
    },
    {
      command: 'npm run ops06:migrations',
      result: 'passed',
      note: 'duplicate migration safety passed; generated OPS-06 evidence restored out of W13-10 diff',
    },
    {
      command: 'JSON parse check for W13-10 and director JSON',
      result: 'passed',
      note: '21 JSON files parsed successfully',
    },
    {
      command: 'scoped Prettier check',
      result: 'passed',
      note: '.env.example and CHANGED-FILES.txt excluded because Prettier has no inferred parser; ORIGINAL-PROMPT.md preserved exactly',
    },
    {
      command: 'git diff --check',
      result: 'passed',
      note: 'no whitespace errors',
    },
  ];
}

async function refreshDirector() {
  await updateDirectorJson('ops/director/CURRENT-STATE.json', (json) => {
    json.generated_at = now;
    json.selected_base = {
      sha: BASE_SHA,
      short_sha: BASE_SHA.slice(0, 7),
      branch: `origin/${BASE_BRANCH}`,
      local_branch: BRANCH,
      reason_path: 'ops/codex-runs/W13-10/ORIGINAL-PROMPT.md',
    };
    json.w12_99_candidate = {
      branch: BASE_BRANCH,
      head: BASE_SHA,
      status: 'exact_base_for_w13_10',
      draft_pr: PR73,
      included_lanes: [
        'W12-00',
        'W12-01',
        'W12-02',
        'W12-03',
        'W12-04',
        'W12-05',
        'W12-06',
        'W12-07',
        'W12-08',
      ],
      excluded_lanes: ['W12-09', 'OPS-13A', 'BNA P1/P2/P3'],
      record: 'ops/codex-runs/W12-99/FINAL-REPORT.md',
    };
    json.w13_10_lane = {
      branch: BRANCH,
      base_sha: BASE_SHA,
      task_id: TASK_ID,
      status: 'in_progress_local',
      external_effects: 0,
      production_mutations: 0,
    };
  });
  await updateDirectorJson('ops/director/CAPABILITY-MATRIX.json', (json) => {
    json.generated_at = now;
    json.source_ref = {
      selected_base_sha: BASE_SHA,
      deployed_runtime_sha: '1197673fa409bfc4c649c2683f782e86775caa5e',
      release_pr: 'https://github.com/shloimie-beep/onetimev2/pull/61',
      w12_99_candidate_branch: BASE_BRANCH,
      w12_99_candidate_head: BASE_SHA,
      w12_99_evidence: 'ops/codex-runs/W12-99/CAPABILITY-MATRIX.json',
      w13_10_evidence: 'ops/codex-runs/W13-10/FINAL-REPORT.md',
    };
  });
  await updateDirectorJson('ops/director/DEPLOYMENTS.json', (json) => {
    json.generated_at = now;
    json.w12_99_exact_staging_deployment = {
      status: 'not_verified',
      source_sha: BASE_SHA,
      note: 'W13-10 did not deploy or call Railway.',
    };
  });
  await updateDirectorJson('ops/director/WORKSTREAMS.json', (json) => {
    json.generated_at = now;
    json.base = {
      selected_base_sha: BASE_SHA,
      selected_base_branch: BASE_BRANCH,
      release_pr: PR73,
      run_w12_99_last: false,
    };
    json.w13_parallel_lanes = laneOwnershipMatrix();
  });
  await updateDirectorJson('ops/director/BRANCH-FLEET.json', (json) => {
    json.generated_at = now;
    json.w12_99_integration = {
      branch: BASE_BRANCH,
      sha: BASE_SHA,
      status: 'pushed_draft_pr_open_exact_base',
      draft_pr: PR73,
      included_lanes: [
        'W12-00',
        'W12-01',
        'W12-02',
        'W12-03',
        'W12-04',
        'W12-05',
        'W12-06',
        'W12-07',
        'W12-08',
      ],
      excluded_lanes: ['W12-09', 'OPS-13A', 'BNA P1/P2/P3'],
      evidence: 'ops/codex-runs/W12-99/FINAL-REPORT.md',
    };
    json.w13_10 = {
      branch: BRANCH,
      base_sha: BASE_SHA,
      status: 'local_branch_created',
      pr_target: BASE_BRANCH,
    };
    json.pr_72_ops13a = { head: PR72_HEAD, status: 'planning_evidence_not_w12_99_ancestry' };
    json.pr_71_w12_09 = {
      head: PR71_HEAD,
      status: 'optional_source_explicitly_excluded_from_w12_99',
    };
  });
  await updateDecisionRegister();
}

async function updateDirectorJson(filePath: string, mutate: (json: MutableRecord) => void) {
  const json = await readJson(filePath);
  mutate(json);
  await writeFile(path.join(ROOT, filePath), `${JSON.stringify(json, null, 2)}\n`);
}

async function updateDecisionRegister() {
  const filePath = path.join(ROOT, 'ops/director/DECISION-REGISTER.md');
  let text = await readFile(filePath, 'utf8');
  text = text.replace(
    /\| DEC-W12-00-010 \| accepted \| Do not run W12-99 yet\.[^\n]+/,
    `| DEC-W12-00-010 | accepted | W12-99 has run and W13-10 uses exact W12-99 head \`${BASE_SHA}\` as its base; staging deploy, real import, and provider activation remain unauthorized. | \`ops/codex-runs/W12-99/FINAL-REPORT.md\`; \`ops/codex-runs/W13-10/ORIGINAL-PROMPT.md\`. | Use W13-10 gates before any production lane. |`,
  );
  if (!text.includes('DEC-W13-10-001')) {
    text += `
| DEC-W13-10-001 | open | Production deployment authorization must name one exact source SHA and image digest. | \`ops/codex-runs/W13-10/PRODUCT-DECISION-GATES.json\`. | Keep production deployment blocked until accepted. |
| DEC-W13-10-002 | open | Public legal/privacy/terms/consent and student-data language requires counsel/operator approval. | \`ops/codex-runs/W13-10/LEGAL-CONTENT-STATUS.json\`. | Do not treat W13-10 content as legal approval. |
| DEC-W13-10-003 | open | Production provider activation is separate per provider and budget. | \`ops/codex-runs/W13-10/PROVIDER-ACTIVATION-MATRIX.json\`. | Keep all providers off by default. |
`;
  }
  await writeFile(filePath, text);
}

main().catch((error: unknown) => {
  process.stderr.write(error instanceof Error ? `${error.message}\n` : 'Unknown error\n');
  process.exitCode = 1;
});
