import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../../../../packages/config/src/index.ts';
import {
  createMemoryPool,
  runMigrations,
  type DbPool,
} from '../../../../../../packages/db/src/index.ts';
import { governedCampaignProviderContactRefHash } from '../../../../../../packages/domain/src/audience-reconciliation/governed-campaign-census.ts';
import {
  buildOt16Notice,
  ot16OperationId,
} from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import type { WorkerRunnerContext } from '../../registry/index.ts';
import {
  createHighLevelOt16EnrollmentProvider,
  createOt16F05EmailPort,
  runOt16F05Worker,
} from './f05.ts';

const LOCATION_ID = 'pBSnOK2nkdxp6gf9Rg3o';
const CONTACT_ID = 'provider-contact-ot16';
const WORKFLOW_ID = 'provider-workflow-ot16';
const EMAIL = 'parent@example.test';
const OPERATION_ID = 'a'.repeat(64);

describe('OT-16 F05 HighLevel enrollment provider', () => {
  it('resolves one exact adult, proves provider DND inactive, and enrolls by exact workflow ID', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ contacts: [{ id: CONTACT_ID, email: EMAIL, locationId: LOCATION_ID }] }),
      )
      .mockResolvedValueOnce(json({ contact: activeContact() }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const provider = createHighLevelOt16EnrollmentProvider(config(), fetchImplementation);

    const outcome = await provider.enroll(providerInput(), new AbortController().signal);

    expect(outcome).toMatchObject({ kind: 'accepted', completed_locally: true });
    if (outcome.kind === 'accepted') {
      expect(outcome.provider_acceptance_digest).toMatch(/^[a-f0-9]{64}$/u);
    }
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(String(fetchImplementation.mock.calls[0]?.[0])).toContain('/contacts/');
    expect(String(fetchImplementation.mock.calls[2]?.[0])).toContain(
      `/contacts/${CONTACT_ID}/workflow/${WORKFLOW_ID}`,
    );
    expect(headers(fetchImplementation.mock.calls[2]?.[1]).get('Idempotency-Key')).toBe(
      OPERATION_ID,
    );
  });

  it('never enrolls a provider-suppressed or ambiguous adult contact', async () => {
    const suppressedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ contacts: [{ id: CONTACT_ID, email: EMAIL }] }))
      .mockResolvedValueOnce(
        json({ contact: activeContact({ dndSettings: { Email: { status: 'active' } } }) }),
      );
    const suppressed = createHighLevelOt16EnrollmentProvider(config(), suppressedFetch);
    await expect(suppressed.enroll(providerInput(), new AbortController().signal)).resolves.toEqual(
      {
        kind: 'permanently_rejected',
        safe_error_code: 'ot16_provider_contact_suppressed',
      },
    );
    expect(suppressedFetch).toHaveBeenCalledTimes(2);

    const ambiguousFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      json({
        contacts: [
          { id: CONTACT_ID, email: EMAIL },
          { id: 'provider-contact-duplicate', email: EMAIL },
        ],
      }),
    );
    const ambiguous = createHighLevelOt16EnrollmentProvider(config(), ambiguousFetch);
    await expect(ambiguous.enroll(providerInput(), new AbortController().signal)).resolves.toEqual({
      kind: 'permanently_rejected',
      safe_error_code: 'ot16_provider_contact_ambiguous',
    });
    expect(ambiguousFetch).toHaveBeenCalledOnce();
  });

  it('quarantines an unknown POST effect and classifies a rate limit as retry-safe', async () => {
    const unknownFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ contacts: [{ id: CONTACT_ID, email: EMAIL }] }))
      .mockResolvedValueOnce(json({ contact: activeContact() }))
      .mockRejectedValueOnce(new Error('synthetic transport loss'));
    const unknown = createHighLevelOt16EnrollmentProvider(config(), unknownFetch);
    await expect(unknown.enroll(providerInput(), new AbortController().signal)).resolves.toEqual({
      kind: 'acceptance_unknown',
      safe_error_code: 'ot16_provider_transport_failed',
    });

    const rateLimitedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ contacts: [{ id: CONTACT_ID, email: EMAIL }] }))
      .mockResolvedValueOnce(json({ contact: activeContact() }))
      .mockResolvedValueOnce(new Response('{"error":"rate limited"}', { status: 429 }));
    const rateLimited = createHighLevelOt16EnrollmentProvider(config(), rateLimitedFetch);
    await expect(
      rateLimited.enroll(providerInput(), new AbortController().signal),
    ).resolves.toEqual({
      kind: 'not_accepted_retryable',
      safe_error_code: 'ot16_provider_http_429',
      retry_after_ms: 300_000,
    });
  });

  it('fails closed before enrollment when provider contact identity or DND readback drifts', async () => {
    const identityDriftFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ contacts: [{ id: 'different-contact', email: EMAIL }] }));
    const identityDrift = createHighLevelOt16EnrollmentProvider(config(), identityDriftFetch);
    await expect(
      identityDrift.enroll(providerInput(), new AbortController().signal),
    ).resolves.toEqual({
      kind: 'permanently_rejected',
      safe_error_code: 'ot16_provider_contact_identity_mismatch',
    });

    const unknownDndFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ contacts: [{ id: CONTACT_ID, email: EMAIL }] }))
      .mockResolvedValueOnce(
        json({ contact: activeContact({ dndSettings: { email: { status: 'inactive' } } }) }),
      );
    const unknownDnd = createHighLevelOt16EnrollmentProvider(config(), unknownDndFetch);
    await expect(unknownDnd.enroll(providerInput(), new AbortController().signal)).resolves.toEqual(
      {
        kind: 'not_accepted_retryable',
        safe_error_code: 'ot16_provider_suppression_unknown',
        retry_after_ms: 300_000,
      },
    );
    expect(unknownDndFetch).toHaveBeenCalledTimes(2);
  });
});

describe('OT-16 F05 durable email port', () => {
  it('atomically binds one exact job/context and claims only that job before returning its durable receipt', async () => {
    const expiryAt = '2026-09-11T15:00:00.000Z';
    const notice = buildOt16Notice({ checkpoint_days: 14, expiry_at: expiryAt });
    const operationId = ot16OperationId({
      adult_id: 'adult-ot16',
      expiry_at: expiryAt,
      checkpoint_days: 14,
    });
    const jobId = digest(`ot16-f05-job-v1\0${operationId}`);
    const afterOutboxQueries: Array<{ text: string; values?: unknown[] }> = [];
    const claimDueJobs = vi.fn(async () => []);
    const foundation = {
      claimDueJobs,
      heartbeat: vi.fn(),
      markInFlight: vi.fn(),
      recordDispatchOutcome: vi.fn(),
      async executeTransactionalCommand(input: {
        mutate(): Promise<{
          response: unknown;
          resulting_version: number;
          outbox_intents: readonly unknown[];
        }>;
        afterOutbox?: (
          client: { query(text: string, values?: unknown[]): Promise<unknown> },
          jobIds: readonly string[],
        ) => Promise<void>;
      }) {
        const mutation = await input.mutate();
        await input.afterOutbox?.(
          {
            async query(text, values) {
              afterOutboxQueries.push(values === undefined ? { text } : { text, values });
              return { rows: [], rowCount: 1 };
            },
          },
          [jobId],
        );
        return {
          disposition: 'applied' as const,
          response: mutation.response,
          resulting_version: mutation.resulting_version,
          outbox_job_ids: [jobId],
        };
      },
    } as never;
    const poolQuery = vi.fn(async () => ({
      rows: [
        {
          job_id: jobId,
          operation_type: 'ghl.workflow.ot16_checkpoint',
          idempotency_key: operationId,
          state: 'complete',
          version: 3,
          unknown_effect: false,
          provider_acceptance_digest: 'd'.repeat(64),
          safe_error_code: null,
          updated_at: '2026-08-06T03:00:00.000Z',
        },
      ],
      rowCount: 1,
    }));
    const provider = { enroll: vi.fn() };
    const workerContext: WorkerRunnerContext = {
      config: loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://test.invalid/onetime',
        ONE_TIME_FREE_ACCESS_EXPIRES_AT: expiryAt,
        HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'test-provider-token',
        ONE_TIME_OT16_TRANSPORT_MODE: 'canary',
        ONE_TIME_OT16_AUTHORIZATION_ID: 'test-ot16-authorization',
        ONE_TIME_OT16_CANARY_OPERATION_IDS: operationId,
        ONE_TIME_OT16_PER_RUN_BUDGET: '1',
      }),
      pool: { query: poolQuery, connect: vi.fn(), end: vi.fn() } as never,
      source: { NODE_ENV: 'test' },
      workerInstanceKey: 'worker-f05-test',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };
    const port = createOt16F05EmailPort(workerContext, { foundation, provider });

    await expect(
      port.dispatchThroughF05(
        {
          operation_id: operationId,
          adult_id: 'adult-ot16',
          household_id: 'household-ot16',
          expiry_at: expiryAt,
          checkpoint_days: 14,
          sender_key: 'office',
          transport: 'GHL',
          subject: notice.subject,
          body: notice.body,
          cta_label: notice.cta_label,
          content_digest: digest(JSON.stringify(notice)),
          safe_provider_reference: 'c'.repeat(64),
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      outcome: { kind: 'accepted', completed_locally: true },
      durable_job: { job_id: jobId, idempotency_key: operationId, state: 'complete' },
    });
    expect(afterOutboxQueries).toHaveLength(2);
    expect(afterOutboxQueries[0]?.text).toContain('ot16_f05_dispatch_context');
    expect(afterOutboxQueries[1]?.text).toContain('provider_operation_binding');
    expect(claimDueJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        job_ids: [jobId],
        operation_types: ['ghl.workflow.ot16_checkpoint'],
      }),
    );
    expect(provider.enroll).not.toHaveBeenCalled();
  });

  it('executes the empty exact F05 claim and finalizer against the complete migration inventory', async () => {
    const pool = createMemoryPool();
    try {
      await runMigrations(pool);
      const compatiblePool = pgMemF05Pool(pool);
      const workerContext: WorkerRunnerContext = {
        config: loadConfig({
          NODE_ENV: 'test',
          DATABASE_URL: 'postgres://test.invalid/onetime',
          ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-11T15:00:00.000Z',
          HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'test-provider-token',
          ONE_TIME_OT16_TRANSPORT_MODE: 'broad',
          ONE_TIME_OT16_AUTHORIZATION_ID: 'test-ot16-authorization',
          ONE_TIME_OT16_PER_RUN_BUDGET: '1',
        }),
        pool: compatiblePool,
        source: { NODE_ENV: 'test' },
        workerInstanceKey: 'worker-f05-schema-test',
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      };
      const provider = { enroll: vi.fn() };

      await expect(
        runOt16F05Worker(workerContext, {
          inspectAuthority: vi.fn(async () => ({
            ready: true as const,
            safeProviderReference: 'c'.repeat(64),
          })),
          provider,
          clock: () => new Date('2026-08-06T03:00:00.000Z'),
          random: () => 0,
        }),
      ).resolves.toMatchObject({
        enabled: true,
        providerCallsPerformed: false,
        summary: { claimed: 0, finalized: 0 },
      });
      expect(provider.enroll).not.toHaveBeenCalled();
    } finally {
      await pool.end();
    }
  }, 15_000);

  it('maps a canary operation allowlist to its exact deterministic F05 job fence', async () => {
    const expiryAt = '2026-09-11T15:00:00.000Z';
    const operationId = ot16OperationId({
      adult_id: 'adult-ot16-canary',
      expiry_at: expiryAt,
      checkpoint_days: 7,
    });
    const claimDueJobs = vi.fn(async () => []);
    const foundation = {
      claimDueJobs,
      heartbeat: vi.fn(),
      markInFlight: vi.fn(),
      recordDispatchOutcome: vi.fn(),
    } as never;
    const poolQuery = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const workerContext: WorkerRunnerContext = {
      config: loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://test.invalid/onetime',
        ONE_TIME_FREE_ACCESS_EXPIRES_AT: expiryAt,
        HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'test-provider-token',
        ONE_TIME_OT16_TRANSPORT_MODE: 'canary',
        ONE_TIME_OT16_AUTHORIZATION_ID: 'test-ot16-authorization',
        ONE_TIME_OT16_CANARY_OPERATION_IDS: operationId,
        ONE_TIME_OT16_PER_RUN_BUDGET: '1',
      }),
      pool: { query: poolQuery, connect: vi.fn(), end: vi.fn() } as never,
      source: { NODE_ENV: 'test' },
      workerInstanceKey: 'worker-f05-canary-test',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };

    await expect(
      runOt16F05Worker(workerContext, {
        foundation,
        inspectAuthority: vi.fn(async () => ({
          ready: true as const,
          safeProviderReference: 'c'.repeat(64),
        })),
        provider: { enroll: vi.fn() },
      }),
    ).resolves.toMatchObject({
      enabled: true,
      providerCallsPerformed: false,
      summary: { claimed: 0, finalized: 0 },
    });
    expect(claimDueJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        job_ids: [digest(`ot16-f05-job-v1\0${operationId}`)],
        operation_types: ['ghl.workflow.ot16_checkpoint'],
      }),
    );
  });
});

function config() {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://test.invalid/onetime',
    HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'test-provider-token',
  });
}

function providerInput() {
  return {
    operationId: OPERATION_ID,
    normalizedEmail: EMAIL,
    expectedContactRefHash: governedCampaignProviderContactRefHash(LOCATION_ID, CONTACT_ID),
    workflowId: WORKFLOW_ID,
  };
}

function activeContact(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTACT_ID,
    email: EMAIL,
    locationId: LOCATION_ID,
    dnd: false,
    dndSettings: { Email: { status: 'inactive' } },
    ...overrides,
  };
}

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function headers(init: RequestInit | undefined) {
  return new Headers(init?.headers);
}

function digest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function pgMemF05Pool(pool: DbPool): DbPool {
  return Object.assign(Object.create(pool), {
    __memory: true,
    query: pool.query.bind(pool),
    end: pool.end.bind(pool),
    connect: async () => {
      const client = await pool.connect();
      return Object.assign(Object.create(client), {
        query: (text: string, values?: unknown[]) =>
          client.query(text.replace(/\s+FOR UPDATE SKIP LOCKED/gu, ''), values),
        release: () => client.release(),
      });
    },
  }) as DbPool;
}
