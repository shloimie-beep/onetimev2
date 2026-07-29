import { describe, expect, it } from 'vitest';
import {
  OPERATIONS_PROVIDER_KEYS,
  QUEUE_ACTIVE_LEASE_MAX_AGE_MS,
  OperationsIdentityError,
  assertCandidateIdentity,
  assertRuntimeIdentity,
  buildOperationsHealthSnapshot,
  computeMigrationInventoryDigest,
  evaluateMigrationHealth,
  evaluateOperationsAlerts,
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

  it('requires exact immutable build timestamp and migration schema version', () => {
    const candidate = candidateIdentity();
    const runtimes = runtimeIdentities();
    const mismatch = evaluateRuntimeAgreement({
      candidate,
      runtimes: runtimes.map((runtime, index) =>
        index === 0
          ? {
              ...runtime,
              build_timestamp: '2026-07-29T00:46:00.000Z',
              migration_schema_version: 'schema-2026.07.29.2',
            }
          : runtime,
      ),
    });
    expect(mismatch.issues).toContainEqual(
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

  it('includes exact runtime tier and verification environment on every alert', () => {
    const input = healthyInput();
    input.queues = input.queues.slice(1);
    const snapshot = buildOperationsHealthSnapshot(input);
    const alerts = evaluateOperationsAlerts(snapshot);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runtime_tier: 'isolated_staging',
          verification_environment_id: 'persistent_staging',
        }),
      ]),
    );
    expect(
      alerts.every(
        (alert) =>
          alert.runtime_tier === snapshot.runtime_tier &&
          alert.verification_environment_id === snapshot.verification_environment_id,
      ),
    ).toBe(true);
  });

  it.each([
    [
      'lease without fencing evidence',
      (input: ReturnType<typeof healthyInput>) => {
        input.queues[0]!.active_lease_count = 1;
      },
    ],
    [
      'unfenced active lease',
      (input: ReturnType<typeof healthyInput>) => {
        input.queues[0]!.active_lease_count = 1;
        input.queues[0]!.oldest_lease_age_ms = 1_000;
        input.queues[0]!.fencing_token_high_watermark = 4;
        input.queues[0]!.unfenced_active_lease_count = 1;
      },
    ],
    [
      'inconsistent retry evidence',
      (input: ReturnType<typeof healthyInput>) => {
        input.queues[0]!.retry_scheduled_count = 1;
      },
    ],
    [
      'inconsistent content progress evidence',
      (input: ReturnType<typeof healthyInput>) => {
        const queue = input.queues.find(
          (observation) => observation.queue_class === 'content_processing',
        )!;
        queue.depth = 1;
        queue.last_progress_at = OBSERVED_AT;
        queue.content_progress_age_ms = 60_000;
      },
    ],
  ])('rejects %s as inconsistent queue evidence', (_name, mutate) => {
    const input = structuredClone(healthyInput());
    mutate(input);
    const snapshot = buildOperationsHealthSnapshot(input);
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({ code: 'queue_observation_inconsistent', severity: 'sev1' }),
    );
  });

  it('rejects retry_count 9 without matching scheduled or exhausted evidence', () => {
    const input = healthyInput();
    input.queues[0]!.depth = 10;
    input.queues[0]!.retry_count = 9;
    const snapshot = buildOperationsHealthSnapshot(input);
    expect(snapshot.evidence_ready).toBe(false);
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({ code: 'queue_observation_inconsistent', severity: 'sev1' }),
    );
  });

  it('rejects an active lease aged 600000ms even with valid fencing', () => {
    expect(QUEUE_ACTIVE_LEASE_MAX_AGE_MS).toBe(5 * 60_000);
    const input = healthyInput();
    input.queues[0]!.active_lease_count = 1;
    input.queues[0]!.oldest_lease_age_ms = 600_000;
    input.queues[0]!.fencing_token_high_watermark = 1;
    const snapshot = buildOperationsHealthSnapshot(input);
    expect(snapshot.evidence_ready).toBe(false);
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({
        code: 'queue_active_lease_stale',
        severity: 'sev1',
        safe_context: expect.objectContaining({ observed: 600_000 }),
      }),
    );
  });

  it('rejects stalled content progress using exact progress evidence', () => {
    const input = healthyInput();
    const queue = input.queues.find(
      (observation) => observation.queue_class === 'content_processing',
    )!;
    queue.depth = 1;
    queue.throughput_15m = 0;
    queue.last_progress_at = '2026-07-29T00:29:00.000Z';
    queue.content_progress_age_ms = 31 * 60_000;
    const snapshot = buildOperationsHealthSnapshot(input);
    expect(snapshot.status).toBe('sev2');
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({ code: 'queue_age_critical', severity: 'sev2' }),
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

  it.each([
    ['resend', 'https://api.resend.com/emails/abc'],
    ['ghl', 'https://services.leadconnectorhq.com/contacts/abc'],
    ['stripe', 'https://dashboard.stripe.com/customers/abc'],
    ['zoom', 'https://zoom.us/j/123'],
    ['vimeo', 'https://vimeo.com/123'],
    ['drive', 'https://drive.google.com/file/d/abc'],
    ['telegram', 'https://api.telegram.org/bot123/sendMessage'],
  ])('blocks raw %s links', (_provider, link) => {
    expect(scanOperationalLeakage({ link })).toMatchObject({
      passed: false,
      finding_counts: { provider_url: 1 },
    });
  });

  it('blocks the reproduced street_address PII key and redacts its value', () => {
    const payload = { street_address: 'private-value' };
    expect(scanOperationalLeakage(payload)).toMatchObject({
      passed: false,
      finding_counts: { pii_field: 1 },
    });
    expect(redactOperationalData(payload)).toEqual({ street_address: '[redacted]' });
  });

  it.each([
    'first_name',
    'last_name',
    'date_of_birth',
    'address_line_1',
    'street_line_2',
    'mailing_address',
    'shipping_address_line_1',
    'billing-address',
    'postal_code',
    'ip_address',
  ])('blocks common PII key %s', (key) => {
    expect(scanOperationalLeakage({ [key]: 'private-value' }).finding_counts).toHaveProperty(
      'pii_field',
    );
  });
});
