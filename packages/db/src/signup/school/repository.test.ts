import { readFile } from 'node:fs/promises';
import { DataType, newDb } from 'pg-mem';
import { afterEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../../index.ts';
import { createSchoolSignupService } from '../../../../../apps/web/src/server/features/signup/school/service.ts';
import {
  APPROVED_SCHOOL_CONFIGURATION_OPERATION,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE,
  type SchoolInquiryCommand,
  type SchoolSignupScope,
} from '../../../../contracts/src/signup/school/index.ts';
import { createPostgresSchoolSignupRepository } from './repository.ts';

const pools: DbPool[] = [];
const scope: SchoolSignupScope = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
};

afterEach(async () => {
  while (pools.length > 0) await pools.pop()?.end();
});

describe('P09 PostgreSQL School-signup repository', () => {
  it('atomically persists one inquiry and one pending acknowledgment and deduplicates replay', async () => {
    const pool = await schoolDatabase();
    let allocation = 0;
    const service = createSchoolSignupService({
      repository: createPostgresSchoolSignupRepository(pool),
      allocateLeadId: () => `school-lead-${++allocation}`,
    });

    const first = await service.submitInquiry({ scope, command: command() });
    const second = await service.submitInquiry({
      scope,
      command: { ...command(), email: 'ari@example.com' },
    });

    expect([first.disposition, second.disposition].sort()).toEqual(['created', 'deduplicated']);
    expect(new Set([first.acknowledgment_intent_id, second.acknowledgment_intent_id]).size).toBe(1);

    const inquiry = await pool.query(
      `SELECT COUNT(*)::int AS count,
              bool_and(product_account_created = false) AS no_account,
              bool_and(household_created = false) AS no_household,
              bool_and(student_accounts_created = 0) AS no_students,
              bool_and(subscription_created = false) AS no_subscription,
              bool_and(product_access_granted = false) AS no_access,
              bool_and(nurture_enrolled = false) AS no_nurture,
              bool_and(provider_identity_ref IS NULL) AS no_provider_identity
         FROM onetime.school_inquiries_v21`,
    );
    const acknowledgment = await pool.query(
      `SELECT COUNT(*)::int AS count, workflow_id, template_id, template_version,
              sender_key, rendered_subject, content_digest, delivery_state
         FROM onetime.school_inquiry_acknowledgments_v21
        GROUP BY workflow_id, template_id, template_version, sender_key,
                 rendered_subject, content_digest, delivery_state`,
    );

    expect(inquiry.rows[0]).toMatchObject({
      count: 1,
      no_account: true,
      no_household: true,
      no_students: true,
      no_subscription: true,
      no_access: true,
      no_nurture: true,
      no_provider_identity: true,
    });
    expect(acknowledgment.rows[0]).toMatchObject({
      count: 1,
      workflow_id: SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.workflow_id,
      template_id: SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_id,
      template_version: SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_version,
      sender_key: SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.sender_key,
      rendered_subject: SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.subject,
      content_digest: SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
      delivery_state: 'pending',
    });
  });

  it('fails closed on a changed canonical request for the same normalized email', async () => {
    const pool = await schoolDatabase();
    const service = createSchoolSignupService({
      repository: createPostgresSchoolSignupRepository(pool),
      allocateLeadId: () => 'school-lead-fixed',
    });
    await service.submitInquiry({ scope, command: command() });

    await expect(
      service.submitInquiry({
        scope,
        command: { ...command(), school_name: 'Different School' },
      }),
    ).rejects.toThrow('school_inquiry_conflict');
    await expect(count(pool, 'school_inquiries_v21')).resolves.toBe(1);
    await expect(count(pool, 'school_inquiry_acknowledgments_v21')).resolves.toBe(1);
  });

  it('rolls back the inquiry if its acknowledgment cannot be committed', async () => {
    const pool = await schoolDatabase();
    const service = createSchoolSignupService({
      repository: createPostgresSchoolSignupRepository(pool),
      allocateLeadId: () => 'shared-lead-id',
    });
    await service.submitInquiry({ scope, command: command() });

    await expect(
      service.submitInquiry({
        scope,
        command: { ...command(), email: 'second@example.com' },
      }),
    ).rejects.toThrow();
    await expect(count(pool, 'school_inquiries_v21')).resolves.toBe(1);
    await expect(count(pool, 'school_inquiry_acknowledgments_v21')).resolves.toBe(1);
  });

  it('updates only an already approved Parent/Student configuration with optimistic versioning', async () => {
    const pool = await schoolDatabase();
    await pool.query(`
      INSERT INTO onetime.v21_adult_identities
        (adult_id, product_key, runtime_tier, verification_environment_id)
      VALUES
        ('adult-manager-1','one_time_mishnayos','isolated_staging','ci');
      INSERT INTO onetime.v21_households
        (household_id, product_key, runtime_tier, verification_environment_id)
      VALUES
        ('household-1','one_time_mishnayos','isolated_staging','ci');
    `);
    await pool.query(
      `INSERT INTO onetime.approved_school_configurations_v21
         (approved_school_id, product, runtime_tier, verification_environment_id,
          operation, approval_state, adult_account_manager_id, household_id,
          seat_allowance, price_minor_units, currency, billing_starts_at,
          terms_reference, configuration_version)
       VALUES
         ('approved-school-1','one_time_mishnayos','isolated_staging','ci',
          $1,'approved','adult-manager-1','household-1',10,50000,'USD',
          '2026-08-01T00:00:00.000Z','terms/old',3)`,
      [APPROVED_SCHOOL_CONFIGURATION_OPERATION],
    );
    const service = createSchoolSignupService({
      repository: createPostgresSchoolSignupRepository(pool),
      allocateLeadId: () => 'unused',
    });

    await expect(
      service.configureApprovedSchool({
        actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
        command: {
          approved_school_id: 'approved-school-1',
          adult_account_manager_id: 'adult-manager-1',
          household_id: 'household-1',
          seat_allowance: 75,
          price_minor_units: 125_000,
          currency: 'USD',
          billing_starts_at: '2026-09-01T00:00:00.000Z',
          terms_reference: 'terms/school-2026-v1',
          expected_configuration_version: 3,
        },
      }),
    ).resolves.toMatchObject({
      configuration_version: 4,
      account_model: 'parent_student',
      adult_account_manager_role: 'parent',
      student_account_role: 'student',
      school_role_created: false,
      school_portal_created: false,
      bulk_roster_created: false,
      automated_nurture_created: false,
    });
    await expect(
      pool.query(
        `SELECT configuration_version, seat_allowance, price_minor_units,
                adult_account_manager_id, household_id
           FROM onetime.approved_school_configurations_v21`,
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          configuration_version: 4,
          seat_allowance: 75,
          price_minor_units: 125000,
          adult_account_manager_id: 'adult-manager-1',
          household_id: 'household-1',
        },
      ],
    });
  });

  it('rejects writes in production_read_only before inserting durable state', async () => {
    const pool = await schoolDatabase();
    const service = createSchoolSignupService({
      repository: createPostgresSchoolSignupRepository(pool),
      allocateLeadId: () => 'school-lead-read-only',
    });
    await expect(
      service.submitInquiry({
        scope: {
          product: 'one_time_mishnayos',
          runtime_tier: 'production',
          verification_environment_id: 'production_read_only',
        },
        command: command(),
      }),
    ).rejects.toMatchObject({
      code: 'read_only_environment',
    });
    await expect(count(pool, 'school_inquiries_v21')).resolves.toBe(0);
    await expect(count(pool, 'school_inquiry_acknowledgments_v21')).resolves.toBe(0);
  });
});

function command(): SchoolInquiryCommand {
  return {
    school_name: 'Yeshiva One',
    contact_first_name: 'Ari',
    contact_last_name: 'Levi',
    email: ' Ari@Example.com ',
  };
}

async function count(pool: DbPool, table: string): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM onetime.${table}`);
  return Number(result.rows[0]?.count);
}

async function schoolDatabase(): Promise<DbPool> {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: 'btrim',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (value: string) => value.trim(),
  });
  db.public.registerFunction({
    name: 'length',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (value: string) => value.length,
  });
  db.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: [DataType.integer],
    returns: DataType.integer,
    implementation: () => 1,
  });
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool() as DbPool;
  pools.push(pool);
  await pool.query(`
    CREATE SCHEMA onetime;

    CREATE TABLE onetime.v21_adult_identities (
      adult_id text NOT NULL,
      product_key text NOT NULL,
      runtime_tier text NOT NULL,
      verification_environment_id text NOT NULL,
      PRIMARY KEY (adult_id, product_key, runtime_tier, verification_environment_id)
    );

    CREATE TABLE onetime.v21_households (
      household_id text NOT NULL,
      product_key text NOT NULL,
      runtime_tier text NOT NULL,
      verification_environment_id text NOT NULL,
      PRIMARY KEY (household_id, product_key, runtime_tier, verification_environment_id)
    );
  `);
  const migration = await readFile(
    new URL('../../../migrations/2249_v21_school_inquiry.sql', import.meta.url),
    'utf8',
  );
  await pool.query(
    migration.replace(
      /-- @postgres-only-begin[\s\S]*?-- @postgres-only-end/gu,
      '-- PostgreSQL-only trigger proof is exercised by native migration verification.',
    ),
  );
  return pool;
}
