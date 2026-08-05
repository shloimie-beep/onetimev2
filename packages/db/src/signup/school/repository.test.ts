import { readFile } from 'node:fs/promises';
import { DataType, newDb } from 'pg-mem';
import { afterEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../../index.ts';
import { createSchoolSignupService } from '../../../../../apps/web/src/server/features/signup/school/service.ts';
import {
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE,
  type ApprovedSchoolConfigurationCommand,
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
const crmBinding = {
  accountKey: 'one-time-account',
  productKey: 'one_time_mishnayos',
};

afterEach(async () => {
  while (pools.length > 0) await pools.pop()?.end();
});

describe('P09 PostgreSQL School-signup repository', () => {
  it('atomically persists one inquiry and one pending acknowledgment and deduplicates replay', async () => {
    const pool = await schoolDatabase();
    let allocation = 0;
    const service = createSchoolSignupService({
      repository: createPostgresSchoolSignupRepository(pool, crmBinding),
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
    const contact = await pool.query(
      `SELECT display_name, family_school_classification, family_or_school,
              email_normalized, phone_normalized, reminder_preference,
              suppression_state, source, lead_status
         FROM onetime.contacts`,
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
    expect(contact.rows).toEqual([
      {
        display_name: 'Ari Levi',
        family_school_classification: 'school',
        family_or_school: 'Yeshiva One',
        email_normalized: 'ari@example.com',
        phone_normalized: null,
        reminder_preference: 'none',
        suppression_state: 'active',
        source: 'one_time_school_inquiry',
        lead_status: 'new',
      },
    ]);
  });

  it('preserves existing CRM suppression, archive, source, phone, and consent state', async () => {
    const pool = await schoolDatabase();
    await pool.query(
      `INSERT INTO onetime.contacts
         (contact_key, public_contact_id, account_key, product_key, display_name,
          family_school_classification, family_or_school, location_text, timezone,
          email_normalized, phone_normalized, reminder_preference,
          consent_policy_version, consent_recorded_at, suppression_state, source,
          lead_status, last_activity_at, created_at, updated_at)
       VALUES
         ('existing-contact', 'existing-public', $1, $2, 'Existing Adult',
          'family', 'Existing Family', 'Brooklyn', 'America/New_York',
          'ari@example.com', '+12125550199', 'email',
          'existing-policy', '2026-07-01T00:00:00.000Z', 'suppressed',
          'existing-source', 'archived', now(), now(), now())`,
      [crmBinding.accountKey, crmBinding.productKey],
    );
    const service = createSchoolSignupService({
      repository: createPostgresSchoolSignupRepository(pool, crmBinding),
      allocateLeadId: () => 'school-lead-existing-contact',
    });

    await service.submitInquiry({
      scope,
      command: { ...command(), phone: '+12125550000' },
    });

    await expect(
      pool.query(
        `SELECT contact_key, display_name, family_school_classification, family_or_school,
                location_text, timezone, phone_normalized, reminder_preference,
                consent_policy_version, consent_recorded_at, suppression_state, source,
                lead_status
           FROM onetime.contacts`,
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          contact_key: 'existing-contact',
          display_name: 'Ari Levi',
          family_school_classification: 'school',
          family_or_school: 'Yeshiva One',
          location_text: 'Brooklyn',
          timezone: 'America/New_York',
          phone_normalized: '+12125550199',
          reminder_preference: 'email',
          consent_policy_version: 'existing-policy',
          suppression_state: 'suppressed',
          source: 'existing-source',
          lead_status: 'archived',
        },
      ],
    });
  });

  it('fails closed on a changed canonical request for the same normalized email', async () => {
    const pool = await schoolDatabase();
    const service = createSchoolSignupService({
      repository: createPostgresSchoolSignupRepository(pool, crmBinding),
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
      repository: createPostgresSchoolSignupRepository(pool, crmBinding),
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

  it('creates, reads back, and exactly replays only canonical approved-School authority', async () => {
    const pool = await schoolDatabase();
    const service = createSchoolSignupService({
      repository: createPostgresSchoolSignupRepository(pool, crmBinding),
      allocateLeadId: () => 'unused',
    });
    const command = approvedSchoolCommand();
    const first = await service.configureApprovedSchool({
      actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
      authorized_at: '2026-07-31T14:00:00.000Z',
      command,
    });
    const replay = await service.configureApprovedSchool({
      actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
      authorized_at: '2026-07-31T15:00:00.000Z',
      command,
    });

    expect(first).toMatchObject({
      disposition: 'created',
      configuration: {
        expected_prior_version: 0,
        configuration_version: 1,
        account_model: 'parent_student',
        school_role_created: false,
        school_portal_created: false,
        bulk_roster_created: false,
        automated_nurture_created: false,
      },
      provider_effects_completed_inline: 0,
    });
    expect(replay).toMatchObject({
      disposition: 'replayed',
      configuration: first.configuration,
    });
    await expect(
      pool.query(
        `SELECT configuration_version, expected_prior_version, seat_allowance,
                price_minor_units, adult_account_manager_id, household_id,
                immutable_contract_reference, idempotency_key, canonical_request_hash
           FROM onetime.approved_school_configuration_authority_v21`,
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          configuration_version: 1,
          expected_prior_version: 0,
          seat_allowance: 75,
          price_minor_units: 125000,
          adult_account_manager_id: 'adult-manager-1',
          household_id: 'household-1',
          immutable_contract_reference: 'contract/school-1',
          idempotency_key: 'school-config-1',
        },
      ],
    });
  });

  it('permits one optimistic update winner and rejects replay mismatch and stale version', async () => {
    const pool = await schoolDatabase();
    const service = createSchoolSignupService({
      repository: createPostgresSchoolSignupRepository(pool, crmBinding),
      allocateLeadId: () => 'unused',
    });
    const originalCommand = approvedSchoolCommand();
    await service.configureApprovedSchool({
      actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
      authorized_at: '2026-07-31T14:00:00.000Z',
      command: originalCommand,
    });
    await snapshotApprovedSchoolHistory(pool);
    await expect(
      service.configureApprovedSchool({
        actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
        authorized_at: '2026-07-31T14:01:00.000Z',
        command: approvedSchoolCommand({ seat_allowance: 76 }),
      }),
    ).rejects.toThrow('school_configuration_mismatch');

    const update = approvedSchoolCommand({
      idempotency_key: 'school-config-2',
      audit_ref: 'approved-school:school-config-2',
      expected_configuration_version: 1,
      seat_allowance: 80,
    });
    await expect(
      service.configureApprovedSchool({
        actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
        authorized_at: '2026-07-31T15:00:00.000Z',
        command: update,
      }),
    ).resolves.toMatchObject({
      disposition: 'updated',
      configuration: { expected_prior_version: 1, configuration_version: 2 },
    });
    await expect(
      service.configureApprovedSchool({
        actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
        authorized_at: '2026-07-31T15:00:30.000Z',
        command: originalCommand,
      }),
    ).resolves.toMatchObject({
      disposition: 'replayed',
      configuration: { configuration_version: 1, seat_allowance: 75 },
    });
    await expect(
      service.configureApprovedSchool({
        actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
        authorized_at: '2026-07-31T15:00:45.000Z',
        command: { ...originalCommand, price_minor_units: 125_001 },
      }),
    ).rejects.toThrow('school_configuration_mismatch');
    await expect(
      service.configureApprovedSchool({
        actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
        authorized_at: '2026-07-31T15:01:00.000Z',
        command: approvedSchoolCommand({
          idempotency_key: 'school-config-stale',
          audit_ref: 'approved-school:school-config-stale',
          expected_configuration_version: 1,
        }),
      }),
    ).rejects.toThrow('school_configuration_mismatch');
    const readback = await pool.query(
      `SELECT COUNT(*)::int AS count, configuration_version, seat_allowance
         FROM onetime.approved_school_configuration_authority_v21
        GROUP BY configuration_version, seat_allowance`,
    );
    expect(readback.rows).toEqual([{ count: 1, configuration_version: 2, seat_allowance: 80 }]);
    const repositorySource = await readFile(new URL('./repository.ts', import.meta.url), 'utf8');
    expect(repositorySource).toContain(
      'FROM onetime.approved_school_configuration_history_v21 AS history',
    );
    expect(repositorySource).not.toMatch(
      /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+onetime\.approved_school_configuration_history_v21/iu,
    );
  });

  it('rejects writes in production_read_only before inserting durable state', async () => {
    const pool = await schoolDatabase();
    const service = createSchoolSignupService({
      repository: createPostgresSchoolSignupRepository(pool, crmBinding),
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

function approvedSchoolCommand(
  overrides: Partial<ApprovedSchoolConfigurationCommand> = {},
): ApprovedSchoolConfigurationCommand {
  return {
    approved_school_id: 'approved-school-1',
    adult_account_manager_id: 'adult-manager-1',
    household_id: 'household-1',
    seat_allowance: 75,
    price_minor_units: 125_000,
    currency: 'USD',
    billing_starts_at: '2026-09-01T00:00:00.000Z',
    terms_reference: 'terms/school-2026-v1',
    immutable_contract_reference: 'contract/school-1',
    authorization_reason: 'Approved contractual School terms',
    idempotency_key: 'school-config-1',
    expected_configuration_version: 0,
    audit_ref: 'approved-school:school-config-1',
    ...overrides,
  };
}

async function count(pool: DbPool, table: string): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM onetime.${table}`);
  return Number(result.rows[0]?.count);
}

async function snapshotApprovedSchoolHistory(pool: DbPool): Promise<void> {
  await pool.query(`
    INSERT INTO onetime.approved_school_configuration_history_v21 (
      product_key, runtime_tier, verification_environment_id,
      approved_school_id, household_id, adult_account_manager_id,
      seat_allowance, price_minor_units, currency, billing_starts_at,
      terms_reference, immutable_contract_reference, authorization_reason,
      authorized_by_human_account_id, authorized_at, idempotency_key,
      canonical_request_hash, expected_prior_version, configuration_version,
      audit_ref, committed_at
    )
    SELECT product_key, runtime_tier, verification_environment_id,
           approved_school_id, household_id, adult_account_manager_id,
           seat_allowance, price_minor_units, currency, billing_starts_at,
           terms_reference, immutable_contract_reference, authorization_reason,
           authorized_by_human_account_id, authorized_at, idempotency_key,
           canonical_request_hash, expected_prior_version, configuration_version,
           audit_ref, updated_at
      FROM onetime.approved_school_configuration_authority_v21
  `);
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
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => '00000000-0000-4000-8000-000000000001',
  });
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool() as DbPool;
  pools.push(pool);
  await pool.query(`
    CREATE SCHEMA onetime;

    CREATE TABLE onetime.contacts (
      contact_key text NOT NULL UNIQUE,
      public_contact_id text NOT NULL UNIQUE,
      account_key text NOT NULL,
      product_key text NOT NULL,
      display_name text NOT NULL,
      family_school_classification text NOT NULL,
      family_or_school text NOT NULL,
      location_text text NOT NULL,
      timezone text NOT NULL,
      email_normalized text NOT NULL,
      phone_normalized text,
      reminder_preference text NOT NULL,
      consent_policy_version text,
      consent_recorded_at timestamptz,
      suppression_state text NOT NULL,
      source text NOT NULL,
      lead_status text NOT NULL,
      last_activity_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      version bigint NOT NULL DEFAULT 1,
      identity_version bigint NOT NULL DEFAULT 1,
      UNIQUE (account_key, product_key, email_normalized)
    );

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

    CREATE TABLE onetime.approved_school_configuration_authority_v21 (
      product_key text NOT NULL,
      runtime_tier text NOT NULL,
      verification_environment_id text NOT NULL,
      approved_school_id text NOT NULL,
      household_id text NOT NULL,
      adult_account_manager_id text NOT NULL,
      seat_allowance integer NOT NULL,
      price_minor_units bigint NOT NULL,
      currency text NOT NULL,
      billing_starts_at timestamptz NOT NULL,
      terms_reference text NOT NULL,
      immutable_contract_reference text NOT NULL,
      authorization_reason text NOT NULL,
      authorized_by_human_account_id text NOT NULL,
      authorized_at timestamptz NOT NULL,
      idempotency_key text NOT NULL,
      canonical_request_hash text NOT NULL,
      expected_prior_version bigint NOT NULL,
      configuration_version bigint NOT NULL,
      audit_ref text NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      PRIMARY KEY (product_key, runtime_tier, verification_environment_id, approved_school_id),
      UNIQUE (product_key, runtime_tier, verification_environment_id, idempotency_key)
    );

    CREATE TABLE onetime.approved_school_configuration_history_v21 (
      product_key text NOT NULL,
      runtime_tier text NOT NULL,
      verification_environment_id text NOT NULL,
      approved_school_id text NOT NULL,
      household_id text NOT NULL,
      adult_account_manager_id text NOT NULL,
      seat_allowance integer NOT NULL,
      price_minor_units bigint NOT NULL,
      currency text NOT NULL,
      billing_starts_at timestamptz NOT NULL,
      terms_reference text NOT NULL,
      immutable_contract_reference text NOT NULL,
      authorization_reason text NOT NULL,
      authorized_by_human_account_id text NOT NULL,
      authorized_at timestamptz NOT NULL,
      idempotency_key text NOT NULL,
      canonical_request_hash text NOT NULL,
      expected_prior_version bigint NOT NULL,
      configuration_version bigint NOT NULL,
      audit_ref text NOT NULL,
      committed_at timestamptz NOT NULL,
      PRIMARY KEY (
        product_key, runtime_tier, verification_environment_id,
        approved_school_id, configuration_version
      ),
      UNIQUE (product_key, runtime_tier, verification_environment_id, idempotency_key)
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
