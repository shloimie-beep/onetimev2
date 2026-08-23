import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DataType, newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';
import {
  createMemoryPool,
  runMigrations,
  verifyMigrations,
  type DbPool,
} from '../../../packages/db/src/index.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const SOURCE_FACTS = {
  adultEvidenceState: 'proven',
  studentOrMinorState: 'absent',
  schoolContactState: 'absent',
  activeOrCurrentSubscriberState: 'absent',
  consentState: 'opted_in',
  deliverabilityState: 'deliverable',
  providerSuppressionState: 'active',
  identityMatchState: 'exact',
  sourceJoinCount: 1,
  sourceFactsHash: HASH_C,
} as const;

describe('migration 2260 governed campaign audience decisions', () => {
  it('applies and replays the exact current migration inventory with an exact 2260 ledger row', async () => {
    const pool = createMemoryPool();
    try {
      const first = await runMigrations(pool);
      const replay = await runMigrations(replayMemoryPool(pool));
      const verification = await verifyMigrations(pool);

      const migrationCount = verification.migration_file_count;
      expect(migrationCount).toBeGreaterThan(0);
      expect(first).toHaveLength(migrationCount);
      expect(first.at(-1)).toMatchObject({ status: 'applied' });
      expect(replay).toHaveLength(migrationCount);
      expect(replay.at(-1)?.id).toBe(first.at(-1)?.id);
      expect(replay.every(({ status }) => status === 'already_applied')).toBe(true);
      expect(verification).toMatchObject({
        ok: true,
        status: 'verified',
        migration_file_count: migrationCount,
        ledger_row_count: migrationCount,
        applied_count: migrationCount,
        pending_count: 0,
        issues: [],
      });
    } finally {
      await pool.end();
    }
  }, 30_000);

  it('keeps current decisions isolated by runtime and verification environment', async () => {
    const pool = createMemoryPool();
    try {
      await runMigrations(pool);
      await pool.query(
        `INSERT INTO onetime.contacts (
           contact_key, account_key, product_key, display_name,
           family_school_classification, family_or_school, location_text,
           timezone, email_normalized, reminder_preference, source, public_contact_id
         ) VALUES (
           'migration-2260-contact', 'one_time', 'one_time_mishnah_class',
           'Synthetic Contact', 'family', 'Synthetic Family', 'Test',
           'Asia/Jerusalem', 'migration-2260@example.invalid', 'email', 'test',
           'migration-2260-public-contact'
         )`,
      );
      await insertDecision(pool, {
        runtimeTier: 'isolated_staging',
        verificationEnvironmentId: 'migration-2260-a',
        decisionKey: 'decision-a',
        providerContactRefHash: HASH_A,
        contactKey: 'migration-2260-contact',
      });
      await insertDecision(pool, {
        runtimeTier: 'isolated_staging',
        verificationEnvironmentId: 'migration-2260-b',
        decisionKey: 'decision-a',
        providerContactRefHash: HASH_A,
      });
      await insertDecision(pool, {
        runtimeTier: 'production',
        verificationEnvironmentId: 'migration-2260-a',
        decisionKey: 'decision-a',
        providerContactRefHash: HASH_A,
      });

      const current = await pool.query<{
        runtime_tier: string;
        verification_environment_id: string;
        rows: string | number;
      }>(
        `SELECT runtime_tier, verification_environment_id, count(*) AS rows
           FROM onetime.governed_campaign_audience_current
          WHERE account_key = 'one_time'
            AND product_key = 'one_time_mishnah_class'
            AND campaign_key = 'ot-15-former-member-reactivation'
          GROUP BY runtime_tier, verification_environment_id
          ORDER BY runtime_tier, verification_environment_id`,
      );
      expect(
        current.rows.map((row) => ({
          runtimeTier: row.runtime_tier,
          verificationEnvironmentId: row.verification_environment_id,
          rows: Number(row.rows),
        })),
      ).toEqual([
        {
          runtimeTier: 'isolated_staging',
          verificationEnvironmentId: 'migration-2260-a',
          rows: 1,
        },
        {
          runtimeTier: 'isolated_staging',
          verificationEnvironmentId: 'migration-2260-b',
          rows: 1,
        },
        {
          runtimeTier: 'production',
          verificationEnvironmentId: 'migration-2260-a',
          rows: 1,
        },
      ]);

      await expect(
        insertDecision(pool, {
          runtimeTier: 'isolated_staging',
          verificationEnvironmentId: 'migration-2260-a',
          decisionKey: 'uppercase-hash',
          providerContactRefHash: HASH_B.toUpperCase(),
        }),
      ).rejects.toBeDefined();
      await expect(
        insertDecision(pool, {
          runtimeTier: 'isolated_staging',
          verificationEnvironmentId: 'migration-2260-a',
          accountKey: 'cross-scope-account',
          decisionKey: 'cross-scope-contact',
          providerContactRefHash: HASH_B,
          contactKey: 'migration-2260-contact',
        }),
      ).rejects.toBeDefined();
    } finally {
      await pool.end();
    }
  }, 30_000);

  it('pins the native append-only and exact sanitized-source boundary without backfill', async () => {
    const migration = await readFile(
      path.resolve(
        process.cwd(),
        'packages/db/migrations/2260_v21_governed_campaign_audience_decisions.sql',
      ),
      'utf8',
    );

    expect(migration).toContain('governed_campaign_source_facts_are_sanitized');
    expect(migration).toContain('governed_campaign_reason_codes_are_sanitized');
    expect(migration).toContain("candidate ->> 'sourceFactsHash' ~ '^[0-9a-f]{64}$'");
    expect(migration).toContain('only a one-way NULL-to-timestamp supersession is allowed');
    expect(migration).toContain('WHERE superseded_at IS NULL');
    expect(migration).toContain("provider_location_id = 'pBSnOK2nkdxp6gf9Rg3o'");
    expect(migration).toContain("provider_campaign_id = '6a71a64c28f7a5dbb3aec1be'");
    expect(migration).toContain("provider_workflow_id = '09051378-5917-4172-afda-f425619dd23d'");
    expect(migration).toContain("provider_launch_tag_id = 'IcOGsLgSIOYGFlHF4kQ0'");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+onetime\./iu);
    expect(migration).not.toMatch(
      /ALTER\s+TABLE\s+onetime\.(?!governed_campaign_audience_decisions)/iu,
    );
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|VIEW|COLUMN|CONSTRAINT)/iu);
  });

  it('adds only the append-only adult OT-16 F05 context with exact durable foreign keys', async () => {
    const migration = await readFile(
      path.resolve(process.cwd(), 'packages/db/migrations/2271_ot16_f05_dispatch_context.sql'),
      'utf8',
    );

    expect(migration).toContain('CREATE TABLE onetime.ot16_f05_dispatch_context');
    expect(migration).toContain('REFERENCES onetime.communication_decision(operation_id)');
    expect(migration).toContain('REFERENCES onetime.job_outbox(job_id)');
    expect(migration).toContain('REFERENCES onetime.v21_adult_identities');
    expect(migration).toContain('REFERENCES onetime.v21_households');
    expect(migration).toContain("CHECK (sender_key = 'office')");
    expect(migration).toContain("CHECK (transport = 'GHL')");
    expect(migration).toContain('OT-16 F05 dispatch context is append-only');
    expect(migration).not.toMatch(/INSERT\s+INTO\s+onetime\./iu);
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|VIEW|COLUMN|CONSTRAINT)/iu);
  });

  it('restores the isolated pg-mem migration state after a synthetic write', async () => {
    const { pool, restore } = await isolatedMigrationMemoryPool();
    try {
      await insertDecision(pool, {
        runtimeTier: 'isolated_staging',
        verificationEnvironmentId: 'migration-2260-rollback',
        decisionKey: 'rolled-back',
        providerContactRefHash: HASH_B,
      });
      const beforeRestore = await pool.query<{ rows: string | number }>(
        `SELECT count(*) AS rows
           FROM onetime.governed_campaign_audience_decisions
          WHERE decision_key = 'rolled-back'`,
      );
      expect(Number(beforeRestore.rows[0]?.rows)).toBe(1);

      restore();
      const afterRestore = await pool.query<{ rows: string | number }>(
        `SELECT count(*) AS rows
           FROM onetime.governed_campaign_audience_decisions
          WHERE decision_key = 'rolled-back'`,
      );
      expect(Number(afterRestore.rows[0]?.rows)).toBe(0);
    } finally {
      await pool.end();
    }
  });
});

type DecisionTarget = {
  query(text: string, values?: unknown[]): Promise<unknown>;
};

async function insertDecision(
  target: DecisionTarget,
  input: {
    runtimeTier: 'isolated_staging' | 'production';
    verificationEnvironmentId: string;
    accountKey?: string;
    decisionKey: string;
    providerContactRefHash: string;
    contactKey?: string | null;
  },
) {
  await target.query(
    `INSERT INTO onetime.governed_campaign_audience_decisions (
       runtime_tier, verification_environment_id, account_key, product_key,
       campaign_key, provider_location_id, provider_campaign_id,
       provider_workflow_id, provider_launch_tag_id, decision_key,
       provider_contact_ref_hash, contact_key, decision, primary_reason,
       reason_codes, source_facts, snapshot_hash, source_observed_at,
       decision_version, idempotency_key, request_hash, created_by_user_key,
       created_at
     ) VALUES (
       $1, $2, $3, 'one_time_mishnah_class',
       'ot-15-former-member-reactivation', 'pBSnOK2nkdxp6gf9Rg3o',
       '6a71a64c28f7a5dbb3aec1be', '09051378-5917-4172-afda-f425619dd23d',
       'IcOGsLgSIOYGFlHF4kQ0', $4, $5, $6, 'include',
       'eligible_inactive_adult', $7::jsonb, $8::jsonb, $9,
       '2026-08-04T12:00:00.000Z', 1, $10, $11, 'f02-migration-proof',
       '2026-08-04T12:00:00.000Z'
     )`,
    [
      input.runtimeTier,
      input.verificationEnvironmentId,
      input.accountKey ?? 'one_time',
      input.decisionKey,
      input.providerContactRefHash,
      input.contactKey ?? null,
      JSON.stringify(['eligible_inactive_adult']),
      JSON.stringify(SOURCE_FACTS),
      HASH_B,
      `${input.decisionKey}:idempotency`,
      HASH_A,
    ],
  );
}

function replayMemoryPool(pool: DbPool): DbPool {
  return Object.assign(Object.create(pool), {
    __memory: true,
    query: pool.query.bind(pool),
    end: pool.end.bind(pool),
    connect: async () => {
      const client = await pool.connect();
      return Object.assign(Object.create(client), {
        query: async (text: string, values?: unknown[]) => {
          if (
            /CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+onetime[\s\S]*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+onetime\.schema_migrations/iu.test(
              text,
            )
          ) {
            return { rows: [], rowCount: 0 };
          }
          return client.query(text, values);
        },
        release: () => client.release(),
      });
    },
  }) as DbPool;
}

async function isolatedMigrationMemoryPool() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: 'length',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (value: string) => value.length,
  });
  db.public.registerFunction({
    name: 'jsonb_typeof',
    args: [DataType.jsonb],
    returns: DataType.text,
    implementation: (value: unknown) => {
      if (Array.isArray(value)) return 'array';
      if (value !== null && typeof value === 'object') return 'object';
      return typeof value;
    },
  });
  db.public.none(`
    CREATE SCHEMA onetime;
    CREATE TABLE onetime.contacts (
      account_key text NOT NULL,
      product_key text NOT NULL,
      contact_key text NOT NULL,
      UNIQUE (account_key, product_key, contact_key)
    );
  `);
  const migration = await readFile(
    path.resolve(
      process.cwd(),
      'packages/db/migrations/2260_v21_governed_campaign_audience_decisions.sql',
    ),
    'utf8',
  );
  db.public.none(
    migration.replace(
      /-- @postgres-only-begin[\s\S]*?-- @postgres-only-end/gu,
      '-- postgres-only migration block skipped by pg-mem tests',
    ),
  );
  const backup = db.backup();
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool() as unknown as DbPool;
  return { pool, restore: () => backup.restore() };
}
