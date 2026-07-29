import { describe, expect, it } from 'vitest';
import {
  OPERATIONS_PROVIDER_KEYS,
  OperationsIdentityError,
  assertCandidateIdentity,
  assertRuntimeIdentity,
  buildOperationsHealthSnapshot,
  computeMigrationInventoryDigest,
  evaluateMigrationHealth,
  evaluateRuntimeAgreement,
  redactOperationalData,
  scanOperationalLeakage,
  type RuntimeIdentity,
} from './index.ts';
import {
  candidateIdentity,
  DIGEST,
  GIT_SHA,
  healthyInput,
  MIGRATIONS,
  OBSERVED_AT,
  runtimeIdentities,
} from './test-fixtures.ts';

describe('P33 corrected runtime identity contract', () => {
  it('requires the exact declared runtime inventory and never self-compares artifacts', () => {
    const candidate = candidateIdentity();
    expect(evaluateRuntimeAgreement({ candidate, runtimes: runtimeIdentities() })).toEqual({
      ok: true,
      issues: [],
    });

    const missing = evaluateRuntimeAgreement({
      candidate,
      runtimes: runtimeIdentities().slice(0, 1),
    });
    expect(missing.issues).toContainEqual(
      expect.objectContaining({ code: 'runtime_identity_missing', severity: 'sev1' }),
    );

    const extraRuntime: RuntimeIdentity = {
      ...runtimeIdentities()[1]!,
      runtime_id: 'scheduled-extra',
      service_role: 'scheduled',
      artifact_digest: 'f'.repeat(64),
    };
    const extra = evaluateRuntimeAgreement({
      candidate,
      runtimes: [...runtimeIdentities(), extraRuntime],
    });
    expect(extra.issues).toContainEqual(
      expect.objectContaining({ code: 'runtime_identity_extra', severity: 'sev1' }),
    );

    const wrongArtifact = evaluateRuntimeAgreement({
      candidate: {
        ...candidate,
        operations_inventory: {
          ...candidate.operations_inventory,
          runtime_expectations: [
            ...candidate.operations_inventory.runtime_expectations,
            {
              runtime_id: 'scheduled-main',
              service_role: 'scheduled',
              artifact_digest: '1'.repeat(64),
            },
          ],
        },
      },
      runtimes: [
        ...runtimeIdentities(),
        { ...extraRuntime, runtime_id: 'scheduled-main', artifact_digest: '2'.repeat(64) },
      ],
    });
    expect(wrongArtifact.issues).toContainEqual(
      expect.objectContaining({ code: 'runtime_candidate_mismatch', severity: 'sev1' }),
    );
  });

  it('rejects empty or duplicate candidate-required inventories', () => {
    const candidate = candidateIdentity();
    expect(() =>
      assertCandidateIdentity({
        ...candidate,
        operations_inventory: { ...candidate.operations_inventory, required_queues: [] },
      }),
    ).toThrowError(expect.objectContaining({ code: 'required_queues_empty' }));
    expect(() =>
      assertCandidateIdentity({
        ...candidate,
        operations_inventory: {
          ...candidate.operations_inventory,
          required_workers: [{ worker_type: 'delivery' }, { worker_type: 'delivery' }],
        },
      }),
    ).toThrowError(expect.objectContaining({ code: 'required_workers_duplicate' }));
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
});

describe('P33 corrected health evidence', () => {
  it('reports ready only with the exact healthy queue, worker, provider, and migration inventory', () => {
    const snapshot = buildOperationsHealthSnapshot(healthyInput());
    expect(snapshot).toMatchObject({
      status: 'ok',
      evidence_ready: true,
      runtime_agreement: true,
      migration_drift: false,
    });
    expect(snapshot.queues).toHaveLength(7);
    expect(snapshot.workers).toHaveLength(1);
    expect(snapshot.providers.map((provider) => provider.provider)).toEqual(
      OPERATIONS_PROVIDER_KEYS,
    );
  });

  it.each([
    [
      'missing queue',
      (input: ReturnType<typeof healthyInput>) => {
        input.queues = input.queues.slice(1);
      },
    ],
    [
      'duplicate queue',
      (input: ReturnType<typeof healthyInput>) => {
        input.queues = [...input.queues, { ...input.queues[0]! }];
      },
    ],
    [
      'stale worker',
      (input: ReturnType<typeof healthyInput>) => {
        input.workers[0]!.observed_at = '2026-07-29T00:00:00.000Z';
      },
    ],
    [
      'unqualified provider',
      (input: ReturnType<typeof healthyInput>) => {
        input.providers[0]!.evidence_qualified = false;
      },
    ],
    [
      'malformed number',
      (input: ReturnType<typeof healthyInput>) => {
        input.queues[0]!.depth = Number.NaN;
      },
    ],
  ])('makes %s Sev1 and non-ready', (_name, mutate) => {
    const input = structuredClone(healthyInput());
    mutate(input);
    const snapshot = buildOperationsHealthSnapshot(input);
    expect(snapshot.status).toBe('sev1');
    expect(snapshot.evidence_ready).toBe(false);
  });

  it('makes a required unavailable provider without age Sev1', () => {
    const input = structuredClone(healthyInput());
    input.providers.find((provider) => provider.provider === 'resend')!.state = 'unavailable';
    const snapshot = buildOperationsHealthSnapshot(input);
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({ code: 'provider_unavailable_age_missing', severity: 'sev1' }),
    );
  });

  it('binds qualified fresh migration readback to the exact candidate digest', () => {
    const input = healthyInput();
    expect(
      evaluateMigrationHealth({
        observation: input.migrations,
        candidate: input.candidate,
        generated_at: input.generated_at,
      }),
    ).toEqual({ ok: true, issues: [] });

    const drifted = {
      ...input.migrations,
      expected: [{ ...MIGRATIONS[0]!, sha256: 'f'.repeat(64) }],
      applied: [{ ...MIGRATIONS[0]!, sha256: 'f'.repeat(64) }],
    };
    expect(
      evaluateMigrationHealth({
        observation: drifted,
        candidate: input.candidate,
        generated_at: input.generated_at,
      }).issues,
    ).toContainEqual(
      expect.objectContaining({ code: 'migration_candidate_digest_mismatch', severity: 'sev1' }),
    );
    expect(computeMigrationInventoryDigest(MIGRATIONS)).toBe(
      input.candidate.migration_inventory_digest,
    );
  });

  it.each([
    {
      expected: [],
      applied: [],
      code: 'migration_expected_inventory_empty',
    },
    {
      expected: [{ ordinal: -1, name: '001_init.sql', sha256: DIGEST }],
      applied: [],
      code: 'migration_expected_entry_invalid',
    },
    {
      expected: [...MIGRATIONS, { ordinal: 1, name: '002_duplicate.sql', sha256: DIGEST }],
      applied: MIGRATIONS,
      code: 'migration_expected_entry_duplicate',
    },
  ])('rejects malformed migration inventory with $code', ({ expected, applied, code }) => {
    const input = healthyInput();
    const result = evaluateMigrationHealth({
      observation: { ...input.migrations, expected, applied },
      candidate: input.candidate,
      generated_at: input.generated_at,
    });
    expect(result.issues).toContainEqual(expect.objectContaining({ code, severity: 'sev1' }));
  });
});

describe('P33 strict operational leakage prevention', () => {
  it('accepts only safe operational identifiers and evidence fields', () => {
    expect(
      scanOperationalLeakage({
        candidate_id: 'candidate-2026-07-29',
        runtime_id: 'worker-primary',
        generated_at: OBSERVED_AT,
        repository_sha: GIT_SHA,
        credential_expires_in_ms: 10_000,
      }),
    ).toMatchObject({ passed: true, finding_counts: {} });
  });

  it.each([
    [{ stripe_secret_key: 'sk_live_literal' }, 'secret_field'],
    [{ authorization: 'Basic dXNlcjpwYXNz' }, 'basic_auth'],
    [{ authorization: 'Bearer private-literal' }, 'bearer_token'],
    [{ secret_hash: DIGEST }, 'secret_field'],
    [{ safe_context: { message: 'token=private-literal' } }, 'secret_assignment'],
    [{ url: 'https://example.test/file?X-Amz-Signature=private' }, 'signed_url'],
    [{ safe_account_ref: 'private@example.test' }, 'unsafe_identifier'],
  ])('blocks protected payload %# with %s and emits no excerpt', (payload, expectedCode) => {
    const result = scanOperationalLeakage(payload);
    expect(result.passed).toBe(false);
    expect(result.finding_counts).toHaveProperty(expectedCode);
    expect(JSON.stringify(result)).not.toContain('private-literal');
    expect(JSON.stringify(redactOperationalData(payload))).not.toContain('private-literal');
  });
});
