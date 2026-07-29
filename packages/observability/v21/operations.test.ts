import { describe, expect, it } from 'vitest';
import {
  OPERATIONS_PROVIDER_KEYS,
  OperationsIdentityError,
  assertRuntimeIdentity,
  buildOperationsHealthSnapshot,
  evaluateRuntimeAgreement,
  redactOperationalData,
  scanOperationalLeakage,
  type RuntimeIdentity,
} from './index.ts';
import { candidateIdentity, GIT_SHA, healthyInput, runtimeIdentities } from './test-fixtures.ts';

describe('P33 runtime operations contract', () => {
  it('requires an exact web and worker candidate identity', () => {
    const candidate = candidateIdentity();
    const runtimes = runtimeIdentities();
    expect(evaluateRuntimeAgreement({ candidate, runtimes })).toEqual({ ok: true, issues: [] });

    const mismatched = runtimes.map((runtime) =>
      runtime.service_role === 'worker'
        ? { ...runtime, configuration_digest: 'f'.repeat(64) }
        : runtime,
    );
    const result = evaluateRuntimeAgreement({ candidate, runtimes: mismatched });
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'runtime_candidate_mismatch', severity: 'sev1' }),
    );
  });

  it('fails closed for an environment and runtime-tier mismatch', () => {
    const runtime = {
      ...runtimeIdentities()[0],
      runtime_tier: 'production',
      verification_environment_id: 'persistent_staging',
    } as RuntimeIdentity;
    expect(() => assertRuntimeIdentity(runtime)).toThrowError(
      expect.objectContaining<Partial<OperationsIdentityError>>({
        code: 'runtime_environment_mismatch',
      }),
    );
  });

  it('raises safe Sev1 diagnostics for migration drift and duplicate-effect risk', () => {
    const input = healthyInput();
    const snapshot = buildOperationsHealthSnapshot({
      ...input,
      migrations: {
        ...input.migrations,
        applied: [{ ordinal: 1, name: '001_init.sql', sha256: 'f'.repeat(64) }],
      },
      queues: [
        {
          queue: 'security_mail',
          queue_class: 'security_delivery',
          depth: 1,
          oldest_ready_age_ms: 1,
          oldest_lease_age_ms: null,
          retry_count: 0,
          acceptance_unknown_count: 1,
          dead_letter_count: 0,
          expired_lease_count: 0,
          throughput_15m: 0,
          duplicate_effect_risk: true,
        },
      ],
    });
    expect(snapshot.status).toBe('sev1');
    expect(snapshot.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'migration_checksum_drift',
        'queue_duplicate_effect_risk',
        'queue_acceptance_unknown',
      ]),
    );
    expect(JSON.stringify(snapshot)).not.toContain('Bearer ');
  });

  it('reports a healthy migration, heartbeat, queues, and every provider', () => {
    const snapshot = buildOperationsHealthSnapshot(healthyInput());
    expect(snapshot).toMatchObject({
      status: 'ok',
      runtime_agreement: true,
      migration_drift: false,
    });
    expect(snapshot.providers.map((provider) => provider.provider)).toEqual(
      OPERATIONS_PROVIDER_KEYS,
    );
    expect(snapshot.issues).toEqual([]);
  });

  it('keeps provider absence truthful and preserves each missing provider', () => {
    const input = healthyInput();
    const snapshot = buildOperationsHealthSnapshot({ ...input, providers: [] });
    const missing = snapshot.issues.filter((issue) => issue.code === 'provider_status_missing');
    expect(missing).toHaveLength(OPERATIONS_PROVIDER_KEYS.length);
    expect(new Set(missing.map((issue) => issue.safe_context.provider))).toEqual(
      new Set(OPERATIONS_PROVIDER_KEYS),
    );
  });

  it('redacts secrets and identifies protected leakage without emitting excerpts', () => {
    const safe = {
      generated_at: '2026-07-29T01:00:00Z',
      repository_sha: GIT_SHA,
      email_provider_calls: 3,
    };
    expect(scanOperationalLeakage(safe)).toMatchObject({ passed: true, finding_counts: {} });

    const payload = {
      authorization: 'Bearer abc.def.ghi',
      parent_email: 'parent@example.test',
      provider_link: 'https://zoom.us/j/123456',
    };
    const result = scanOperationalLeakage(payload);
    expect(result.passed).toBe(false);
    expect(result.issues.every((issue) => issue.severity === 'sev1')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('parent@example.test');
    expect(redactOperationalData(payload)).toEqual({
      authorization: '[redacted]',
      parent_email: '[redacted]',
      provider_link: '[redacted]',
    });
  });
});
