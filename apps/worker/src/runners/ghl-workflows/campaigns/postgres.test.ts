import { describe, expect, it, vi } from 'vitest';

import { createMemoryPool, runMigrations } from '../../../../../../packages/db/src/index.ts';
import { ot16OperationId } from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import { createPostgresOt16CampaignReadModel } from './postgres.ts';

const expiryAt = '2026-09-11T15:00:00.000Z';
const observedAt = new Date('2026-09-04T15:05:00.000Z');
const digest = (value: string) => value.repeat(64).slice(0, 64);

describe('OT-16 canonical PostgreSQL read model', () => {
  it('selects only the current 24-hour checkpoint window and excludes every reserved operation', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          { adult_id: 'adult-1', household_id: 'household-1', free_access_expires_at: expiryAt },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const model = readModel(query);

    await expect(model.listDueCheckpoints()).resolves.toEqual([
      {
        adultId: 'adult-1',
        expiryAt,
        checkpointDays: 7,
        expectedVersion: 0,
      },
    ]);
    expect(query).toHaveBeenCalledTimes(2);
    const [dueSql, dueValues] = query.mock.calls[0]!;
    expect(dueSql).toContain('onetime.family_signup_access_projections');
    expect(dueSql).toContain("consent.consent_scope = 'general_marketing'");
    expect(dueSql).toContain("role.role = 'parent'");
    expect(dueSql).not.toContain('v21_student');
    expect(dueValues).toEqual(['one_time_mishnayos', 'production', 'production_broad', expiryAt]);

    const operationId = ot16OperationId({
      adult_id: 'adult-1',
      expiry_at: expiryAt,
      checkpoint_days: 7,
    });
    const reservedQuery = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          { adult_id: 'adult-1', household_id: 'household-1', free_access_expires_at: expiryAt },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ operation_id: operationId }], rowCount: 1 });
    await expect(readModel(reservedQuery).listDueCheckpoints()).resolves.toEqual([]);

    const ambiguousHouseholds = vi.fn(async () => ({
      rows: [
        { adult_id: 'adult-1', household_id: 'household-1', free_access_expires_at: expiryAt },
        { adult_id: 'adult-1', household_id: 'household-2', free_access_expires_at: expiryAt },
      ],
      rowCount: 2,
    }));
    await expect(readModel(ambiguousHouseholds).listDueCheckpoints()).resolves.toEqual([]);
    expect(ambiguousHouseholds).toHaveBeenCalledOnce();
  });

  it('returns one adult-only candidate with exact F06 identity, mapping, billing, consent, and suppression evidence', async () => {
    const query = vi.fn(async () => ({ rows: [facts()], rowCount: 1 }));
    const model = readModel(query);
    const checkpoint = {
      adultId: 'adult-1',
      expiryAt,
      checkpointDays: 7 as const,
      expectedVersion: 0,
    };

    await expect(model.preflight(checkpoint)).resolves.toMatchObject({
      ready: true,
      identityLinkState: 'linked',
      mappingReconciliationState: 'in_sync',
      candidate: {
        subject: { kind: 'adult', adult_id: 'adult-1', household_id: 'household-1' },
        current_account_owner: true,
        active_parent: true,
        verified_paid_access: false,
        explicitly_declined: false,
        custom_school_terms: false,
        marketing_permission: true,
      },
      suppression: {
        adult_id: 'adult-1',
        captured_at: observedAt.toISOString(),
        email_dnd: false,
        unsubscribed: false,
        marketing_suppressed: false,
        complaint: false,
        hard_bounce: false,
        invalid_address: false,
      },
    });
    await expect(model.suppression.readCurrent('adult-1')).resolves.toMatchObject({
      adult_id: 'adult-1',
      marketing_suppressed: false,
    });
    await expect(model.eligibility.readCurrent('adult-1')).resolves.toMatchObject({
      subject: { kind: 'adult', adult_id: 'adult-1' },
      verified_paid_access: false,
    });
    expect(query).toHaveBeenCalledTimes(3);
    for (const [sql, values] of query.mock.calls as unknown as Array<
      [string, readonly unknown[]]
    >) {
      expect(sql).toContain('onetime.adult_ghl_identity_link');
      expect(sql).toContain('onetime.household_provider_mapping');
      expect(sql).toContain('onetime.billing_entitlement_projections');
      expect(sql).toContain('onetime.billing_subscription_projections');
      expect(sql).toContain('onetime.highlevel_contact_preferences');
      expect(values).toEqual([
        'one_time_mishnayos',
        'production',
        'production_broad',
        expiryAt,
        'adult-1',
      ]);
    }

    const serviceSuppressed = readModel(
      vi.fn(async () => ({
        rows: [
          facts({ suppression_json: { ...facts().suppression_json, service_suppressed: true } }),
        ],
        rowCount: 1,
      })),
    );
    await expect(serviceSuppressed.suppression.readCurrent('adult-1')).resolves.toMatchObject({
      marketing_suppressed: true,
      optional_reminder_suppressed: true,
    });
  });

  it('fails closed on missing suppression proof, ambiguous mappings, or checkpoint-scope drift', async () => {
    const missingSuppression = readModel(
      vi.fn(async () => ({
        rows: [facts({ preferences_present: false, email_dnd: null, all_dnd: null })],
        rowCount: 1,
      })),
    );
    await expect(
      missingSuppression.preflight({
        adultId: 'adult-1',
        expiryAt,
        checkpointDays: 7,
        expectedVersion: 0,
      }),
    ).resolves.toEqual({ ready: false, reason: 'ot16_suppression_evidence_unavailable' });

    const ambiguous = readModel(vi.fn(async () => ({ rows: [facts(), facts()], rowCount: 2 })));
    await expect(
      ambiguous.preflight({
        adultId: 'adult-1',
        expiryAt,
        checkpointDays: 7,
        expectedVersion: 0,
      }),
    ).resolves.toEqual({ ready: false, reason: 'ot16_adult_evidence_unavailable' });

    const untouched = vi.fn();
    await expect(
      readModel(untouched).preflight({
        adultId: 'adult-1',
        expiryAt: '2026-09-12T15:00:00.000Z',
        checkpointDays: 7,
        expectedVersion: 0,
      }),
    ).resolves.toEqual({ ready: false, reason: 'ot16_checkpoint_scope_mismatch' });
    expect(untouched).not.toHaveBeenCalled();
  });

  it('executes the canonical due and preflight SQL against the complete migration inventory', async () => {
    const pool = createMemoryPool();
    try {
      await runMigrations(pool);
      const model = createPostgresOt16CampaignReadModel({
        pool,
        runtimeTier: 'isolated_staging',
        verificationEnvironmentId: 'ci',
        canonicalExpiryAt: expiryAt,
        now: () => observedAt,
      });
      await expect(model.listDueCheckpoints()).resolves.toEqual([]);
      await expect(
        model.preflight({
          adultId: 'adult-missing',
          expiryAt,
          checkpointDays: 7,
          expectedVersion: 0,
        }),
      ).resolves.toEqual({ ready: false, reason: 'ot16_adult_evidence_unavailable' });
    } finally {
      await pool.end();
    }
  }, 15_000);
});

function readModel(query: ReturnType<typeof vi.fn>) {
  return createPostgresOt16CampaignReadModel({
    pool: { query } as never,
    runtimeTier: 'production',
    verificationEnvironmentId: 'production_broad',
    canonicalExpiryAt: expiryAt,
    now: () => observedAt,
  });
}

function facts(overrides: Record<string, unknown> = {}) {
  return {
    adult_id: 'adult-1',
    household_id: 'household-1',
    current_account_owner: true,
    active_parent: true,
    marketing_permission: true,
    newsletter_permission: true,
    verified_paid_access: false,
    explicitly_declined: false,
    custom_school_terms: false,
    link_state: 'linked',
    mapping_reconciliation_state: 'in_sync',
    suppression_json: {
      marketing_suppressed: false,
      service_suppressed: false,
      evidence_digest: digest('a'),
      version: 3,
    },
    preferences_present: true,
    email_dnd: false,
    all_dnd: false,
    contact_suppression_state: 'active',
    ...overrides,
  };
}
