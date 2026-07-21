import { describe, expect, it } from 'vitest';
import {
  assertRailwayCommandAllowed,
  buildLaunchEvidence,
  buildRailwayCommandPlan,
  evaluateDeploymentRecords,
  evaluateMigrationStatusForOperation,
  evaluateRailwayStatus,
  evaluateVersionDeploymentProof,
  type Fetcher,
  type LaunchManifest,
  parseLaunchManifest,
  validateCurrentGitHead,
  validateLaunchManifest,
  verifyHttpEndpoints,
} from './railway-launch-toolkit.ts';
import { buildMigrationStatusReport } from './migration-status.ts';

const CANDIDATE_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const PREDEPLOY_SHA = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const DIGEST = `sha256:${'c'.repeat(64)}`;

function manifest(overrides: Partial<LaunchManifest> = {}): LaunchManifest {
  return {
    schema_version: 'onetime.w12_100.railway_launch_manifest.v1',
    lane_id: 'W12-100-10',
    repository: 'shloimie-beep/onetimev2',
    target: {
      environment_kind: 'staging',
      base_url: 'https://w12-100-staging.example.test',
      railway: {
        project_id: 'railway-project-123',
        environment_id: 'railway-env-staging-123',
        web_service_id: 'railway-web-service-123',
        worker_service_id: 'railway-worker-service-123',
        database_service_id: 'railway-postgres-service-123',
        environment_name: 'staging',
        web_service_name: 'one-time-web',
        worker_service_name: 'one-time-worker',
        database_service_name: 'one-time-postgres',
      },
    },
    candidate: {
      commit_sha: CANDIDATE_SHA,
      expected_image_digest: DIGEST,
      branch: 'integration/w12-final-convergence-20260717T123715Z',
    },
    predeploy: {
      expected_version: 'ops11-1197673',
      expected_commit_sha: PREDEPLOY_SHA,
    },
    rollback: {
      predeploy_commit_sha: PREDEPLOY_SHA,
      predeploy_image_digest: DIGEST,
    },
    provider_transports: {
      email: 'disabled',
      whatsapp: 'disabled',
      telegram: 'disabled',
      payments: 'disabled',
      zoom: 'sink',
      buffer: 'not_configured',
      openai_helper: 'disabled',
    },
    limits: {
      worker_heartbeat_max_age_ms: 120_000,
      queue_ready_max_count: 50,
      queue_oldest_ready_max_age_ms: 600_000,
      backup_max_age_minutes: 1440,
    },
    ...overrides,
  };
}

describe('W12-100 Railway launch toolkit', () => {
  it('parses and validates immutable launch identity', () => {
    const parsed = parseLaunchManifest(manifest());
    const checks = validateLaunchManifest(parsed, 'preflight-staging');
    expect(checks.every((check) => check.status === 'passed')).toBe(true);
  });

  it('rejects production-like targets for staging operations', () => {
    const checks = validateLaunchManifest(
      manifest({
        target: {
          ...manifest().target,
          base_url: 'https://join.onetimeonetime.com',
          railway: {
            ...manifest().target.railway,
            environment_name: 'production',
          },
        },
      }),
      'deploy-staging',
    );
    expect(checks.find((check) => check.id === 'operation_environment')).toMatchObject({
      status: 'blocked',
    });
  });

  it('requires the exact checked-out source for deploy and rollback', () => {
    expect(validateCurrentGitHead(manifest(), 'deploy-staging', CANDIDATE_SHA)).toMatchObject({
      status: 'passed',
    });
    expect(validateCurrentGitHead(manifest(), 'rollback-staging', PREDEPLOY_SHA)).toMatchObject({
      status: 'passed',
    });
    expect(validateCurrentGitHead(manifest(), 'rollback-staging', CANDIDATE_SHA)).toMatchObject({
      status: 'blocked',
    });
  });

  it('builds only allowlisted Railway commands and refuses destructive commands', () => {
    const plans = buildRailwayCommandPlan(manifest(), 'deploy-staging');
    expect(plans.map((plan) => plan.id)).toEqual([
      'railway-status',
      'deploy-web',
      'deploy-worker',
      'deployment-list-web',
      'deployment-list-worker',
    ]);
    for (const plan of plans) assertRailwayCommandAllowed(plan);
    expect(() =>
      assertRailwayCommandAllowed({
        id: 'delete-db',
        mutates: true,
        args: ['service', 'delete', '--service', 'railway-postgres-service-123'],
        redacted_command: 'railway service delete --service railway-postgres-service-123',
      }),
    ).toThrow(/not allowed|forbidden/);
  });

  it('requires Railway status to contain exact immutable IDs and no env values', () => {
    const checks = evaluateRailwayStatus(manifest(), {
      project: { id: 'railway-project-123' },
      environment: { id: 'railway-env-staging-123' },
      services: [
        { id: 'railway-web-service-123', name: 'one-time-web' },
        { id: 'railway-worker-service-123', name: 'one-time-worker' },
        { id: 'railway-postgres-service-123', name: 'one-time-postgres' },
      ],
    });
    expect(checks.every((check) => check.status === 'passed')).toBe(true);

    const blocked = evaluateRailwayStatus(manifest(), {
      project: { id: 'railway-project-123' },
      variables: { DATABASE_URL: 'postgres://private.example.invalid/never-print' },
    });
    expect(blocked.some((check) => check.status === 'blocked')).toBe(true);
  });

  it('verifies health, readiness, version, worker heartbeat, and queue limits', async () => {
    const requestedUrls: string[] = [];
    const fetcher: Fetcher = async (url) => {
      requestedUrls.push(url);
      if (url.endsWith('/version')) {
        return {
          status: 200,
          json: async () => ({
            version: 'candidate',
            commit_sha: CANDIDATE_SHA,
            target_app: 'one-time',
            deployment: {
              provider: 'railway',
              deployment_id: 'deploy-web-123',
              snapshot_id: 'snapshot-web-123',
              project_id: 'railway-project-123',
              environment_id: 'railway-env-staging-123',
              service_id: 'railway-web-service-123',
              service_name: 'one-time-web',
              git_commit_sha: CANDIDATE_SHA,
            },
          }),
        };
      }
      if (url.endsWith('/health')) {
        return { status: 200, json: async () => ({ ok: true, service: 'onetime-web' }) };
      }
      if (url.endsWith('/ready')) {
        return {
          status: 200,
          json: async () => ({
            ok: true,
            optional_dependencies: [
              { name: 'email_transport', status: 'disabled' },
              { name: 'whatsapp_transport', status: 'disabled' },
            ],
          }),
        };
      }
      return {
        status: 200,
        json: async () => ({
          success: true,
          snapshot: {
            workers: [{ worker_type: 'delivery_outbox', state: 'ready', heartbeat_age_ms: 10_000 }],
            queues: [
              {
                queue: 'delivery_outbox',
                ready_count: 0,
                oldest_ready_age_ms: null,
                retry_count: 0,
                dead_letter_count: 0,
              },
            ],
          },
        }),
      };
    };

    const checks = await verifyHttpEndpoints({
      manifest: manifest(),
      operation: 'verify-staging',
      fetcher,
      opsProbeToken: 'probe-token-value',
    });
    expect(checks.every((check) => check.status === 'passed')).toBe(true);
    expect(requestedUrls).toEqual([
      'https://w12-100-staging.example.test/version',
      'https://w12-100-staging.example.test/health',
      'https://w12-100-staging.example.test/ready',
      'https://w12-100-staging.example.test/api/internal/ops/diagnostics',
    ]);
  });

  it('validates /version runtime deployment proof without requiring raw env values', () => {
    const checks = evaluateVersionDeploymentProof(manifest(), 'verify-staging', {
      version: 'candidate',
      commit_sha: CANDIDATE_SHA,
      target_app: 'one-time',
      deployment: {
        provider: 'railway',
        deployment_id: 'deploy-web-123',
        snapshot_id: 'snapshot-web-123',
        project_id: 'railway-project-123',
        environment_id: 'railway-env-staging-123',
        service_id: 'railway-web-service-123',
        service_name: 'one-time-web',
      },
    });
    expect(checks.filter((check) => check.status === 'blocked')).toEqual([]);
    expect(checks.find((check) => check.id === 'version_git_commit_sha_present')).toMatchObject({
      status: 'warning',
    });
    expect(JSON.stringify(checks)).not.toMatch(/DATABASE_URL|SECRET|TOKEN|PASSWORD/);
  });

  it('records deployment IDs and digests without environment values', () => {
    const records = [
      {
        service_id: 'railway-web-service-123',
        deployment_id: 'deploy-web-123',
        image_digest: DIGEST,
        source_sha: CANDIDATE_SHA,
      },
      {
        service_id: 'railway-worker-service-123',
        deployment_id: 'deploy-worker-123',
        image_digest: DIGEST,
        source_sha: CANDIDATE_SHA,
      },
    ];
    const checks = evaluateDeploymentRecords(manifest(), 'verify-staging', records);
    const evidence = buildLaunchEvidence({
      manifest: manifest(),
      operation: 'verify-staging',
      execute: false,
      checks,
      commandPlan: [],
      deploymentRecords: records,
    });
    expect(evidence.deployment_records).toHaveLength(2);
    expect(JSON.stringify(evidence)).not.toContain('DATABASE_URL');
    expect(evidence.external_actions).toBe(0);
    expect(evidence.production_mutations).toBe(0);
  });

  it('builds counts-only pending migration evidence', () => {
    const report = buildMigrationStatusReport({
      localIds: ['0001_onetime_lead_slice', '2202_w12_05_telegram_operations'],
      appliedIds: ['0001_onetime_lead_slice'],
      environmentKind: 'staging',
    });
    expect(report).toMatchObject({
      status: 'blocked',
      pending_migrations: 1,
      database_mutation_performed: false,
      raw_source_rows_included: false,
      private_values_recorded: false,
    });
    expect(report.pending_ids_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(report)).not.toContain('DATABASE_URL');

    const migrateChecks = evaluateMigrationStatusForOperation('migrate-staging', report);
    expect(migrateChecks.find((check) => check.id === 'pending_migration_count')).toMatchObject({
      status: 'warning',
    });

    const verifyChecks = evaluateMigrationStatusForOperation('verify-staging', report);
    expect(verifyChecks.find((check) => check.id === 'pending_migration_count')).toMatchObject({
      status: 'blocked',
    });
  });
});
