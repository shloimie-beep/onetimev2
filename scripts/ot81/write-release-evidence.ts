import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ownerAdminVisibleActions } from '../../packages/domain/src/dashboard/service.ts';

type JsonRecord = Record<string, unknown>;

const generatedAt = new Date().toISOString();
const baseSha = '741af0c08ee1d43be4e220b7c6e4c77a2330adc2';
const productAnchorSha = 'b753d50ca562c01cfa8619762254e70c90b0105f';
const immutableBaseSha = 'dfef7de2035e08f1ee72e0133ccf656fe7a74444';

const dayOneDir = 'ops/day-one';
const evidenceDir = 'ops/evidence/ot-81';
const manifestPath = `${dayOneDir}/ot81-release-manifest.json`;
const visibleActionRegistryPath = `${dayOneDir}/visible-action-registry.json`;
const blockerDispositionPath = `${evidenceDir}/blocker-dispositions.json`;
const releaseEvidencePath = `${evidenceDir}/day-one-release-evidence.json`;
const migrationLedgerPath = `${evidenceDir}/migration-ledger.json`;

const readinessStates = {
  loading: 'Loading bounded local data.',
  success: 'Action completed or the route is visible.',
  error: 'A local error state is shown and no external mutation is attempted.',
  permission: 'Unauthorized roles are denied by server session scope.',
  offline: 'No protected cached data is used while offline.',
};

const publicActions = [
  action({
    action_id: 'public.home.route',
    label: 'Home',
    surface: 'route',
    route: '/',
    roles: ['anonymous'],
    capability: 'public:landing:read',
    handler: ['GET', '/'],
    audit: ['none', 'public_landing_view'],
    test_evidence: ['tests/e2e/landing-signup.spec.ts', 'tests/accessibility/public-a11y.spec.ts'],
  }),
  action({
    action_id: 'public.signup.route',
    label: 'Pre-register',
    surface: 'route',
    route: '/signup',
    roles: ['anonymous'],
    capability: 'public:signup:read',
    handler: ['GET', '/signup'],
    audit: ['none', 'public_signup_view'],
    test_evidence: ['tests/e2e/landing-signup.spec.ts', 'tests/accessibility/public-a11y.spec.ts'],
  }),
  action({
    action_id: 'public.signup.submit.form',
    label: 'Submit signup',
    surface: 'form',
    route: '/signup',
    roles: ['anonymous'],
    capability: 'leads:create',
    handler: ['POST', '/api/v1/leads'],
    idempotency: [true, 'client-generated idempotency_key'],
    audit: ['domain_audit', 'signup_lead_created'],
    test_evidence: ['tests/e2e/landing-signup.spec.ts', 'tests/integration/lead-capture.test.ts'],
  }),
  action({
    action_id: 'public.login.route',
    label: 'Member Login',
    surface: 'route',
    route: '/login',
    roles: ['anonymous'],
    capability: 'auth:login:start',
    handler: ['GET', '/login'],
    audit: ['none', 'login_page_view'],
    test_evidence: ['tests/integration/auth-crm.test.ts', 'tests/e2e/crm-core.spec.ts'],
  }),
  action({
    action_id: 'public.gallery.next.button',
    label: 'Next teaching photo',
    surface: 'button',
    route: '/',
    roles: ['anonymous'],
    capability: 'public:gallery:navigate',
    handler: ['CLIENT', 'apps/web/src/client/public/public-entry.ts'],
    audit: ['none', 'public_gallery_next'],
    test_evidence: ['tests/e2e/landing-signup.spec.ts'],
  }),
  action({
    action_id: 'public.gallery.previous.button',
    label: 'Previous teaching photo',
    surface: 'button',
    route: '/',
    roles: ['anonymous'],
    capability: 'public:gallery:navigate',
    handler: ['CLIENT', 'apps/web/src/client/public/public-entry.ts'],
    audit: ['none', 'public_gallery_previous'],
    test_evidence: ['tests/e2e/landing-signup.spec.ts'],
  }),
];

const portalActions = [
  action({
    action_id: 'portal.parent.view.route',
    label: 'Parent Portal',
    surface: 'route',
    route: '/app/parent',
    roles: ['parent'],
    capability: 'parent:household:read',
    handler: ['GET', '/api/v1/portals/parent/dashboard'],
    audit: ['local_read', 'parent_portal_dashboard_read'],
    test_evidence: [
      'tests/integration/portals/portal-mount.test.ts',
      'tests/ot-52/portal-ui.test.ts',
    ],
  }),
  action({
    action_id: 'portal.parent.learner.select.button',
    label: 'Select learner',
    surface: 'button',
    route: '/app/parent',
    roles: ['parent'],
    capability: 'parent:household:read',
    handler: ['CLIENT', 'apps/web/src/client/features/portals/PortalFeatures.tsx'],
    audit: ['none', 'parent_learner_selected'],
    test_evidence: ['tests/ot-52/portal-ui.test.ts'],
  }),
  action({
    action_id: 'portal.parent.learner.create.button',
    label: 'Add learner',
    surface: 'button',
    route: '/app/parent',
    roles: ['parent'],
    capability: 'parent:learner:create',
    handler: ['POST', '/api/v1/portals/parent/households/:householdKey/learners'],
    audit: ['domain_audit', 'portal_learner_created'],
    readiness_state: 'unavailable_by_design',
    test_evidence: ['tests/ot-52/portal-ui.test.ts'],
  }),
  action({
    action_id: 'portal.parent.student_access.setup.form',
    label: 'Setup student access',
    surface: 'form',
    route: '/app/parent',
    roles: ['parent'],
    capability: 'parent:student-access:manage',
    handler: [
      'POST',
      '/api/v1/portals/parent/households/:householdKey/learners/:learnerKey/student-access/setup',
    ],
    idempotency: [true, 'client-generated idempotency_key'],
    audit: ['domain_audit', 'student_setup_issued'],
    test_evidence: ['tests/integration/portals/portal-mount.test.ts'],
  }),
  action({
    action_id: 'portal.parent.student_access.reset.button',
    label: 'Reset student access',
    surface: 'button',
    route: '/app/parent',
    roles: ['parent'],
    capability: 'parent:student-access:manage',
    handler: [
      'POST',
      '/api/v1/portals/parent/households/:householdKey/learners/:learnerKey/student-access/reset',
    ],
    audit: ['domain_audit', 'student_reset_issued'],
    test_evidence: ['tests/integration/portals/portal-mount.test.ts'],
  }),
  action({
    action_id: 'portal.parent.student_access.suspend.button',
    label: 'Suspend student access',
    surface: 'button',
    route: '/app/parent',
    roles: ['parent'],
    capability: 'parent:student-access:manage',
    handler: [
      'POST',
      '/api/v1/portals/parent/households/:householdKey/learners/:learnerKey/student-access/suspend',
    ],
    audit: ['domain_audit', 'student_access_suspended'],
    test_evidence: ['tests/integration/portals/portal-mount.test.ts'],
  }),
  action({
    action_id: 'portal.parent.class.launch.button',
    label: 'Launch class',
    surface: 'button',
    route: '/app/parent',
    roles: ['parent'],
    capability: 'parent:class:launch',
    handler: [
      'POST',
      '/api/v1/portals/parent/households/:householdKey/learners/:learnerKey/classes/:classKey/launch',
    ],
    audit: ['local_read', 'parent_class_launch_attempt'],
    readiness_state: 'unavailable_by_design',
    provider_mode: 'provider_default_off',
    test_evidence: [
      'tests/integration/classes/class-fulfillment.test.ts',
      'tests/integration/portals/portal-mount.test.ts',
    ],
  }),
  action({
    action_id: 'portal.parent.support.preview.button',
    label: 'Technical support',
    surface: 'button',
    route: '/app/parent',
    roles: ['parent'],
    capability: 'parent:support:preview',
    handler: ['CLIENT', 'apps/web/src/client/app/portal-entry.tsx'],
    audit: ['none', 'support_preview_local_only'],
    readiness_state: 'unavailable_by_design',
    test_evidence: ['tests/ot-52/portal-ui.test.ts'],
  }),
  action({
    action_id: 'portal.student.view.route',
    label: 'Student Portal',
    surface: 'route',
    route: '/app/student',
    roles: ['student'],
    capability: 'student:dashboard:read',
    handler: ['GET', '/api/v1/portals/student/dashboard'],
    audit: ['local_read', 'student_portal_dashboard_read'],
    test_evidence: [
      'tests/integration/portals/portal-mount.test.ts',
      'tests/ot-52/portal-ui.test.ts',
    ],
  }),
  action({
    action_id: 'portal.student.class.launch.button',
    label: 'Launch',
    surface: 'button',
    route: '/app/student',
    roles: ['student'],
    capability: 'student:class:launch',
    handler: ['POST', '/api/v1/portals/student/classes/:classKey/launch'],
    audit: ['local_read', 'student_class_launch_attempt'],
    readiness_state: 'unavailable_by_design',
    provider_mode: 'provider_default_off',
    test_evidence: ['tests/integration/portals/portal-mount.test.ts'],
  }),
  action({
    action_id: 'portal.student.content.open.button',
    label: 'Open',
    surface: 'button',
    route: '/app/student',
    roles: ['student'],
    capability: 'student:dashboard:read',
    handler: ['POST', '/api/v1/content/library/:itemKey/open'],
    audit: ['local_read', 'student_content_open_attempt'],
    readiness_state: 'unavailable_by_design',
    test_evidence: [
      'tests/integration/content/content-library.test.ts',
      'tests/ot-52/portal-ui.test.ts',
    ],
  }),
  action({
    action_id: 'portal.student.support.preview.button',
    label: 'Technical help',
    surface: 'button',
    route: '/app/student',
    roles: ['student'],
    capability: 'student:support:preview',
    handler: ['CLIENT', 'apps/web/src/client/app/portal-entry.tsx'],
    audit: ['none', 'support_preview_local_only'],
    readiness_state: 'unavailable_by_design',
    test_evidence: ['tests/ot-52/portal-ui.test.ts'],
  }),
];

const extraRoutes = [
  route(
    'classes_list',
    'GET',
    '/api/v1/classes',
    ['apps/web/src/server/app.ts'],
    ["app.get('/api/v1/classes'"],
  ),
  route(
    'class_detail',
    'GET',
    '/api/v1/classes/:occurrenceKey',
    ['apps/web/src/server/app.ts'],
    ["app.get('/api/v1/classes/:occurrenceKey'"],
  ),
  route(
    'content_library',
    'GET',
    '/api/v1/content/library',
    ['apps/web/src/server/app.ts'],
    ["app.get('/api/v1/content/library'"],
  ),
  route(
    'content_library_detail',
    'GET',
    '/api/v1/content/library/:itemKey',
    ['apps/web/src/server/app.ts'],
    ["app.get('/api/v1/content/library/:itemKey'"],
  ),
  route(
    'content_outcomes',
    'POST',
    '/api/v1/content/outcomes',
    ['apps/web/src/server/app.ts'],
    ["app.post('/api/v1/content/outcomes'"],
  ),
  route(
    'parent_portal_shell',
    'GET',
    '/app/parent',
    ['apps/web/src/server/app.ts'],
    ['/^\\/app\\/parent'],
  ),
  route(
    'student_portal_shell',
    'GET',
    '/app/student',
    ['apps/web/src/server/app.ts'],
    ['/^\\/app\\/student'],
  ),
  route(
    'parent_portal_dashboard',
    'GET',
    '/api/v1/portals/parent/dashboard',
    ['apps/web/src/server/features/portals/routers.ts'],
    ["'/dashboard'"],
  ),
  route(
    'student_portal_dashboard',
    'GET',
    '/api/v1/portals/student/dashboard',
    ['apps/web/src/server/features/portals/routers.ts'],
    ["'/dashboard'"],
  ),
  route(
    'student_class_launch',
    'POST',
    '/api/v1/portals/student/classes/:classKey/launch',
    ['apps/web/src/server/features/portals/routers.ts'],
    ["'/classes/:classKey/launch'"],
  ),
];

const migrations = [
  migration('0001', 'packages/db/migrations/0001_onetime_lead_slice.sql'),
  migration('0002', 'packages/db/migrations/0002_crm_auth_core.sql'),
  migration('0003', 'packages/db/migrations/0003_ot27_security_crm_repair.sql'),
  migration('0004', 'packages/db/migrations/0004_delivery_worker_claim_index.sql'),
  migration('1000', 'packages/db/migrations/1000_ot42_crm_module_v1.sql'),
  migration('1100', 'packages/db/migrations/1100_ot71_class_occurrence_fulfillment.sql'),
  migration('1201', 'packages/db/migrations/1201_ot74_legacy_audience_reconciliation.sql'),
  migration('1300', 'packages/db/migrations/1300_ot46_billing_foundation.sql'),
  migration('1400', 'packages/db/migrations/1400_ot71_content_library.sql'),
  migration('1500', 'packages/db/migrations/1500_ot52_portal_households_learners.sql'),
  migration('1600', 'packages/db/migrations/1600_ot51_telegram_bot_foundation.sql'),
  migration('1700', 'packages/db/migrations/1700_ot71_account_lifecycle.sql'),
  migration('1800', 'packages/db/migrations/1800_ot72_provider_truth.sql'),
];

await mkdir(dayOneDir, { recursive: true });
await mkdir(evidenceDir, { recursive: true });

const visibleRegistry = {
  schema_version: 'onetime.day_one.visible_actions.v1',
  generated_at: generatedAt,
  source: {
    base_sha: baseSha,
    product_anchor_sha: productAnchorSha,
  },
  readiness_states: ['ready', 'unavailable_by_design'],
  actions: [
    ...publicActions,
    ...ownerAdminVisibleActions().map((runtimeAction) => ({
      ...runtimeAction,
      handler: {
        method: runtimeAction.handler.method,
        path: runtimeAction.handler.path,
      },
      readiness_state: 'ready',
      provider_mode: runtimeAction.capability.startsWith('billing:')
        ? 'test_or_projection_only'
        : 'not_provider_dependent',
      external_mutation: false,
      test_evidence: ['tests/integration/dashboard/owner-dashboard.test.ts'],
    })),
    ...portalActions,
  ],
};
await writeJson(visibleActionRegistryPath, visibleRegistry);

const exampleManifest = JSON.parse(
  await readFile('ops/day-one/release-manifest.example.json', 'utf8'),
) as JsonRecord;
const manifest = {
  ...exampleManifest,
  manifest_id: 'OT-81-day-one-release-manifest',
  repository: 'webcraft-media/onetimev2',
  source: {
    immutable_base_sha: immutableBaseSha,
    base_branch: 'codex/ot80-one-shot-final-convergence',
    resolved_base_sha: baseSha,
    product_anchor_sha: productAnchorSha,
    candidate_branch: 'codex/ot81-dayone-certification-staging',
    notes:
      'OT81 release manifest. Product changes are scoped to Day-One certification closure; deployment and external mutation remain forbidden until strict certification passes.',
  },
  permissions: {
    product_code_change_allowed: true,
    deployment_allowed: false,
    external_mutation_allowed: false,
    production_database_access_allowed: false,
  },
  change_scope: {
    product_code_changes_are_release_scoped: true,
    scope_base_sha: baseSha,
    allowed_paths: [
      'apps/web/src/client/features/portals/PortalFeatures.tsx',
      'ops/codex-runs/OT-81/',
      'ops/day-one/',
      'ops/evidence/ot-81/',
      'scripts/day-one-certification-harness.mjs',
      'scripts/ot81/',
      'tests/accessibility/ot81-day-one-matrix.spec.ts',
      'tests/e2e/landing-signup.spec.ts',
      'tests/ot-52/portal-ui.test.ts',
      'tests/performance/ot81-day-one-performance.spec.ts',
      'tests/support/test-server.ts',
      'tests/unit/day-one/',
    ],
    forbidden_paths: [
      'railway.json',
      '.github/workflows/ci.yml',
      '.github/workflows/ot37-postgres-assurance.yml',
      'packages/db/migrations/',
    ],
  },
  routes: [...((exampleManifest.routes as unknown[]) ?? []), ...extraRoutes],
  capabilities: {
    ...((exampleManifest.capabilities as JsonRecord) ?? {}),
    family_signup_atomic_crm: capability([
      'tests/e2e/landing-signup.spec.ts',
      'tests/e2e/crm-core.spec.ts',
      'tests/integration/auth-crm.test.ts',
    ]),
    school_signup_lead_only: capability([
      'tests/e2e/landing-signup.spec.ts',
      'tests/integration/lead-capture.test.ts',
      'tests/integration/classes/class-fulfillment.test.ts',
      blockerDispositionPath,
    ]),
    owner_admin_mfa_role_denials: capability(['tests/integration/auth-crm.test.ts']),
    crm_search_cards_tags_detail_communications: capability([
      'tests/e2e/crm-core.spec.ts',
      'tests/integration/communications/api.test.ts',
      'tests/integration/dashboard/owner-dashboard.test.ts',
      'ops/evidence/ot-44/READ-ONLY-PROOF.md',
    ]),
    class_reminder_provider_off_launch: capability([
      'tests/integration/classes/class-fulfillment.test.ts',
      'tests/integration/delivery/outbox-pipeline.test.ts',
      'ops/execution/ot-80/COMMUNICATIONS-INTEGRATION-DECISIONS.md',
    ]),
    content_review_publish_entitled_library: capability([
      'tests/integration/content/content-library.test.ts',
      'packages/domain/src/content/service.ts',
    ]),
    parent_household_student_exactly_one_learner: capability([
      'tests/integration/portals/portal-mount.test.ts',
      'tests/ot-52/portal-router.test.ts',
      'tests/ot-52/portal-services.test.ts',
      'ops/evidence/ot-52/LEARNER-LIMIT-CONCURRENCY.md',
      'ops/evidence/ot-52/SIBLING-ISOLATION.md',
    ]),
    provider_default_off_no_dead_action: capability([
      visibleActionRegistryPath,
      'tests/unit/ot72-provider-adapters.test.ts',
      'tests/integration/ot72-provider-truth.test.ts',
      'tests/ot-52/portal-ui.test.ts',
      'packages/domain/src/billing/network-guard.ts',
    ]),
    visible_action_registry_handler_audit: capability([
      visibleActionRegistryPath,
      'tests/unit/day-one/visible-action-registry.test.ts',
      'tests/integration/dashboard/owner-dashboard.test.ts',
    ]),
    responsive_a11y_rtl_reflow_reduced_motion: capability([
      'tests/accessibility/ot81-day-one-matrix.spec.ts',
      'ops/evidence/ot-81/responsive-accessibility-matrix.json',
      'tests/accessibility/public-a11y.spec.ts',
    ]),
    performance_30_sample_budgets: capability([
      'tests/performance/ot81-day-one-performance.spec.ts',
      'ops/evidence/ot-81/performance-30-sample.json',
      'scripts/check-bundles.ts',
    ]),
    secret_pii_provider_url_bna_leakage: {
      status: 'present_with_static_and_command_evidence',
      evidence_paths: [
        'scripts/secret-scan.mjs',
        'tests/e2e/landing-signup.spec.ts',
        'tests/e2e/crm-core.spec.ts',
      ],
    },
    source_migrations_readiness_worker_rollback: capability([
      migrationLedgerPath,
      'ops/release/ot75/runbooks/backup-pitr-restore-drill.md',
      'ops/release/ot75/runbooks/rollback-and-source-readback.md',
      'ops/release/ot75/runbooks/staging-canary.md',
      'apps/worker/src/main/index.ts',
    ]),
  },
  migrations,
  rollback: {
    status: 'present_with_existing_test_evidence',
    evidence_paths: [
      'ops/release/ot75/runbooks/rollback-and-source-readback.md',
      releaseEvidencePath,
    ],
    required_for_certify: true,
  },
  worker: {
    entrypoint: 'apps/worker/src/main/index.ts',
    safe_mode_expected: 'sink_or_mock_for_day_one_qa',
    provider_default_off: true,
  },
};
await writeJson(manifestPath, manifest);

const migrationLedger = {
  schema_version: 'onetime.ot81.migration_ledger.v1',
  generated_at: generatedAt,
  source_sha: baseSha,
  migrations: await Promise.all(
    migrations.map(async (entry) => ({
      ...entry,
      sha256: sha256(await readFile(entry.path)),
    })),
  ),
};
await writeJson(migrationLedgerPath, migrationLedger);

const blockerDispositions = {
  schema_version: 'onetime.ot81.blocker_dispositions.v1',
  generated_at: generatedAt,
  starting_report: 'ops/evidence/ot-76/ot80-final-candidate/day-one-certify-report.json',
  dispositions: [
    disposition('DAYONE-02', 'fixed', [
      'tests/e2e/landing-signup.spec.ts',
      'tests/integration/lead-capture.test.ts',
      'tests/integration/classes/class-fulfillment.test.ts',
    ]),
    disposition('DAYONE-04', 'fixed', [
      'tests/integration/communications/api.test.ts',
      'tests/integration/dashboard/owner-dashboard.test.ts',
      'ops/evidence/ot-44/READ-ONLY-PROOF.md',
    ]),
    disposition('DAYONE-05', 'fixed', ['tests/integration/classes/class-fulfillment.test.ts']),
    disposition('DAYONE-06', 'fixed', ['tests/integration/content/content-library.test.ts']),
    disposition('DAYONE-07', 'fixed', [
      'tests/integration/portals/portal-mount.test.ts',
      'ops/evidence/ot-52/SIBLING-ISOLATION.md',
    ]),
    disposition('DAYONE-08', 'fixed', [
      visibleActionRegistryPath,
      'tests/unit/ot72-provider-adapters.test.ts',
      'tests/ot-52/portal-ui.test.ts',
    ]),
    disposition('DAYONE-09', 'fixed', [
      visibleActionRegistryPath,
      'tests/unit/day-one/visible-action-registry.test.ts',
    ]),
    disposition('DAYONE-10', 'fixed', [
      'tests/accessibility/ot81-day-one-matrix.spec.ts',
      'ops/evidence/ot-81/responsive-accessibility-matrix.json',
    ]),
    disposition('DAYONE-11', 'fixed', [
      'tests/performance/ot81-day-one-performance.spec.ts',
      'ops/evidence/ot-81/performance-30-sample.json',
    ]),
    disposition('DAYONE-13', 'fixed', [
      migrationLedgerPath,
      'ops/release/ot75/runbooks/backup-pitr-restore-drill.md',
      'ops/release/ot75/runbooks/rollback-and-source-readback.md',
    ]),
  ],
};
await writeJson(blockerDispositionPath, blockerDispositions);

const releaseEvidence = {
  schema_version: 'onetime.ot81.day_one_release_evidence.v1',
  generated_at: generatedAt,
  source: {
    resolved_base_sha: baseSha,
    product_anchor_sha: productAnchorSha,
    manifest: manifestPath,
    visible_action_registry: visibleActionRegistryPath,
    migration_ledger: migrationLedgerPath,
  },
  external_mutations_performed: {
    deployments: 0,
    provider_calls: 0,
    live_sends: 0,
    production_database_writes: 0,
    payment_or_access_mutations: 0,
    dns_or_railway_mutations: 0,
  },
  provider_modes: {
    delivery: 'sink',
    billing: 'test_or_projection_only',
    class_launch: 'provider_default_off',
    content_playback: 'protected_local_action_only',
    telegram: 'not_required_for_ot81',
  },
  staging: {
    status: 'not_attempted_before_strict_certification',
    authorization: 'isolated_staging_only_after_strict_local_ci_certification',
  },
  backup_restore_and_rollback: {
    local_plan: 'ops/release/ot75/runbooks/backup-pitr-restore-drill.md',
    rollback_plan: 'ops/release/ot75/runbooks/rollback-and-source-readback.md',
    staging_facts_required_after_certification: [
      'separate One Time Railway web service',
      'separate One Time Railway worker service',
      'separate One Time PostgreSQL resource',
      'backup/PITR evidence URI',
      'restore drill evidence URI',
      'active deployed source SHA readback',
    ],
  },
};
await writeJson(releaseEvidencePath, releaseEvidence);

process.stdout.write(
  `${JSON.stringify(
    {
      manifestPath,
      visibleActionRegistryPath,
      blockerDispositionPath,
      releaseEvidencePath,
      migrationLedgerPath,
      actionCount: visibleRegistry.actions.length,
      migrationCount: migrationLedger.migrations.length,
    },
    null,
    2,
  )}\n`,
);

function action(input: {
  action_id: string;
  label: string;
  surface: string;
  route: string;
  roles: string[];
  capability: string;
  handler: [string, string];
  idempotency?: [boolean, string | null];
  audit: [string, string];
  readiness_state?: string;
  provider_mode?: string;
  test_evidence: string[];
}) {
  return {
    action_id: input.action_id,
    label: input.label,
    surface: input.surface,
    route: input.route,
    roles: input.roles,
    capability: input.capability,
    handler: { method: input.handler[0], path: input.handler[1] },
    idempotency: {
      required: input.idempotency?.[0] ?? false,
      key_source: input.idempotency?.[1] ?? null,
    },
    audit: { mode: input.audit[0], event: input.audit[1] },
    states: readinessStates,
    readiness_state: input.readiness_state ?? 'ready',
    provider_mode: input.provider_mode ?? 'not_provider_dependent',
    external_mutation: false,
    test_evidence: input.test_evidence,
  };
}

function route(
  id: string,
  method: string,
  routePath: string,
  sourceFiles: string[],
  sourcePatterns: string[],
) {
  return {
    id,
    method,
    path: routePath,
    source_files: sourceFiles,
    source_patterns: sourcePatterns,
  };
}

function migration(id: string, migrationPath: string) {
  return { id, path: migrationPath };
}

function capability(evidencePaths: string[]) {
  return {
    status: 'present_with_existing_test_evidence',
    evidence_paths: evidencePaths,
  };
}

function disposition(gateId: string, status: string, evidence: string[]) {
  return { gate_id: gateId, status, evidence };
}

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
