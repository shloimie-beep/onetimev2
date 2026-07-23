import { createDecipheriv, createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  acceptOwnerAdminInvitation,
  acceptParentActivation,
  acceptStudentSetup,
} from '../../../packages/domain/src/accounts/lifecycle.ts';
import { readHouseholdAccess } from '../../../packages/domain/src/access/service.ts';
import { hashPassword } from '../../../packages/domain/src/auth/service.ts';
import { normalizeEmail, stableKey } from '../../../packages/domain/src/lead/normalize.ts';
import { runW13ProductionRoleAccessTask } from '../../../scripts/w13-103/identity/production-role-access.ts';

const RUNTIME_SHA = '007e0215d1186ca51163dea3b1c15303bf52a860';
const AUTH_PHRASE = 'w13-103-test-authorization';
const HANDOFF_KEY = Buffer.alloc(32, 7).toString('base64url');
const NOW = new Date('2026-07-19T05:00:00.000Z');
const ADMIN_EMAIL = 'admin+w13-103@example.test';
const PARENT_EMAIL = 'parent+w13-103@example.test';
const STUDENT_EMAIL = 'student+w13-103@example.test';

let pool: DbPool;
let config: AppConfig;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: RUNTIME_SHA,
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_ACCOUNT_KEY: 'one_time',
    ONE_TIME_PRODUCT_KEY: 'one_time_mishnah_class',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
});

describe('W13-103 production role access command', () => {
  it('blocks incomplete manifests without printing destinations or setup material', async () => {
    const report = await runW13ProductionRoleAccessTask({
      pool,
      config,
      now: NOW,
      mode: 'dry-run',
      manifest: {
        run_id: 'W13-103',
        expires_at: '2026-07-19T06:00:00.000Z',
        expected_runtime_source_sha: RUNTIME_SHA,
        authorization_phrase_sha256: sha256(AUTH_PHRASE),
        recipients: {
          administrator: { operator_controlled: true, send_now: true, max_message_count: 1 },
          parent: { operator_controlled: true, send_now: true, max_message_count: 1 },
          student: { operator_controlled: true, send_now: true, max_message_count: 1 },
        },
      },
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('administrator_destination_missing');
    expect(report.blockers).toContain('parent_destination_missing');
    expect(report.blockers).toContain('student_destination_missing');
    expect(JSON.stringify(report)).not.toMatch(/@|token=|reset-password#token=|activate#token=/i);
  });

  it('plans administrator, parent, and deferred student access without mutating lifecycle tables', async () => {
    await seedUser('owner+w13-103@example.test', 'Owner', 'owner');

    const report = await runW13ProductionRoleAccessTask({
      pool,
      config,
      now: NOW,
      mode: 'dry-run',
      manifest: manifest(),
    });

    expect(report.status).toBe('dry_run_ready');
    expect(report.roles).toEqual([
      expect.objectContaining({ role: 'administrator', operation: 'owner_admin_invitation' }),
      expect.objectContaining({ role: 'parent', operation: 'parent_activation' }),
      expect.objectContaining({
        role: 'student',
        operation: 'student_setup_after_parent_acceptance',
      }),
    ]);
    expect(await tableCount('account_lifecycle_tokens')).toBe(0);
    expect(await tableCount('account_lifecycle_delivery_outbox')).toBe(0);
    expect(JSON.stringify(report)).not.toContain(ADMIN_EMAIL);
    expect(JSON.stringify(report)).not.toContain(PARENT_EMAIL);
    expect(JSON.stringify(report)).not.toContain(STUDENT_EMAIL);
  });

  it('applies initial administrator and parent handoff with encrypted-only setup links', async () => {
    await seedUser('owner+w13-103@example.test', 'Owner', 'owner');

    const report = await runW13ProductionRoleAccessTask({
      pool,
      config,
      now: NOW,
      mode: 'apply-initial',
      manifest: manifest(),
      authorizationPhrase: AUTH_PHRASE,
      handoffEncryptionKey: HANDOFF_KEY,
    });

    expect(report.status).toBe('applied');
    const applied = report as AppliedReport;
    expect(applied.mutation_deltas).toEqual(
      expect.objectContaining({
        account_users_delta: 0,
        household_delta: 1,
        learner_delta: 1,
        lifecycle_token_delta: 2,
        lifecycle_outbox_delta: 2,
        private_handoff_links: 2,
        external_sends: 0,
      }),
    );
    expect(JSON.stringify(report)).not.toMatch(/@|token=|reset-password#token=|activate#token=/i);

    const handoff = decryptHandoff(applied);
    expect(handoff.links).toHaveLength(2);
    expect(handoff.links.map((entry) => entry.role).sort()).toEqual(['administrator', 'parent']);
  });

  it('uses an active parent to create student access, then issues final resets and revokes sessions exactly', async () => {
    await seedUser('owner+w13-103@example.test', 'Owner', 'owner');
    const initial = await runW13ProductionRoleAccessTask({
      pool,
      config,
      now: NOW,
      mode: 'apply-initial',
      manifest: manifest(),
      authorizationPhrase: AUTH_PHRASE,
      handoffEncryptionKey: HANDOFF_KEY,
    });
    const initialHandoff = decryptHandoff(initial as AppliedReport);
    await acceptOwnerAdminInvitation({
      pool,
      config,
      now: new Date('2026-07-19T05:05:00.000Z'),
      payload: {
        token: tokenFromLink(linkFor(initialHandoff, 'administrator')),
        password: 'AdminW13!2345',
      },
    });
    await acceptParentActivation({
      pool,
      config,
      now: new Date('2026-07-19T05:06:00.000Z'),
      payload: {
        token: tokenFromLink(linkFor(initialHandoff, 'parent')),
        password: 'ParentW13!2345',
      },
    });
    const parentAccess = await readHouseholdAccess({
      db: pool,
      accountKey: config.accountKey,
      productKey: config.productKey,
      householdKey: 'w13_103_operator_test_household',
      now: new Date('2026-07-19T05:06:00.000Z'),
    });
    expect(parentAccess).toEqual(
      expect.objectContaining({
        state: 'active',
        source_kind: 'free_pilot',
        grants_access: true,
        expires_at: '2026-09-17T05:00:00.000Z',
        opaque_source_reference: 'w13_103_operator_free_pilot_v1',
      }),
    );

    const student = await runW13ProductionRoleAccessTask({
      pool,
      config,
      now: new Date('2026-07-19T05:07:00.000Z'),
      mode: 'apply-student',
      manifest: manifest(),
      authorizationPhrase: AUTH_PHRASE,
      handoffEncryptionKey: HANDOFF_KEY,
    });
    const appliedStudent = student as AppliedReport;
    const studentHandoff = decryptHandoff(appliedStudent);
    expect(student.status).toBe('applied');
    expect(appliedStudent.mutation_deltas).toEqual(
      expect.objectContaining({
        account_users_delta: 0,
        household_delta: 0,
        learner_delta: 0,
        lifecycle_token_delta: 1,
        lifecycle_outbox_delta: 1,
        private_handoff_links: 1,
      }),
    );
    await acceptStudentSetup({
      pool,
      config,
      now: new Date('2026-07-19T05:08:00.000Z'),
      payload: {
        token: tokenFromLink(linkFor(studentHandoff, 'student')),
        password: 'StudentW13!2345',
      },
    });

    await seedSessionFor(ADMIN_EMAIL, 'administrator');
    await seedSessionFor(PARENT_EMAIL, 'parent');
    await seedSessionFor(STUDENT_EMAIL, 'student');

    const final = await runW13ProductionRoleAccessTask({
      pool,
      config,
      now: new Date('2026-07-19T05:09:00.000Z'),
      mode: 'final-reset',
      manifest: manifest(),
      authorizationPhrase: AUTH_PHRASE,
      handoffEncryptionKey: HANDOFF_KEY,
    });

    expect(final.status).toBe('applied');
    expect(final.roles).toEqual([
      expect.objectContaining({ role: 'administrator', sessions_revoked: 1 }),
      expect.objectContaining({ role: 'parent', sessions_revoked: 1 }),
      expect.objectContaining({ role: 'student', sessions_revoked: 1 }),
    ]);
    const appliedFinal = final as AppliedReport;
    expect(appliedFinal.mutation_deltas).toEqual(
      expect.objectContaining({
        account_users_delta: 0,
        household_delta: 0,
        learner_delta: 0,
        lifecycle_token_delta: 3,
        lifecycle_outbox_delta: 3,
        private_handoff_links: 3,
        external_sends: 0,
      }),
    );
    expect(JSON.stringify(final)).not.toMatch(/@|token=|reset-password#token=|activate#token=/i);
    expect(decryptHandoff(appliedFinal).links).toHaveLength(3);
    expect(await activeSessionCount()).toBe(0);
  });
});

function manifest() {
  return {
    schema_version: 'onetime.w13_103.role_access.private.v1',
    run_id: 'W13-103',
    expires_at: '2026-07-19T06:00:00.000Z',
    expected_runtime_source_sha: RUNTIME_SHA,
    authorization_phrase_sha256: sha256(AUTH_PHRASE),
    mutation_budget: {
      users_created: 3,
      households_created: 1,
      learners_created: 1,
      lifecycle_tokens_issued: 6,
    },
    account_key: 'one_time',
    product_key: 'one_time_mishnah_class',
    railway: {
      project_id: 'ce55ef20-1418-4ad3-aafa-f877fb992dc8',
      environment_id: 'f911acfc-e206-44df-a569-9d69d709b94b',
      web_service_id: 'd175ad94-5e3c-41c2-8cbc-daa1a299077d',
    },
    recipients: {
      administrator: {
        destination: ADMIN_EMAIL,
        display_name: 'W13-103 Admin',
        operator_controlled: true,
        send_now: true,
        max_message_count: 1,
        destination_source: 'test_fixture',
      },
      parent: {
        destination: PARENT_EMAIL,
        display_name: 'W13-103 Parent',
        operator_controlled: true,
        send_now: true,
        max_message_count: 1,
        destination_source: 'test_fixture',
        household_key: 'w13_103_operator_test_household',
        relationship_key: 'w13_103_operator_parent',
        relationship_label: 'Parent',
        authority: 'primary_guardian',
        free_pilot: {
          expires_at: '2026-09-17T05:00:00.000Z',
          policy_version: 'w13-103-controlled-free-pilot-v1',
          opaque_source_reference: 'w13_103_operator_free_pilot_v1',
        },
      },
      student: {
        destination: STUDENT_EMAIL,
        display_name: 'W13-103 Student',
        operator_controlled: true,
        send_now: true,
        max_message_count: 1,
        destination_source: 'test_fixture',
        household_key: 'w13_103_operator_test_household',
        learner_key: 'w13_103_operator_test_learner',
        learner_display_identity: 'W13-103 Learner',
        grade_label: 'Operator test',
      },
    },
  };
}

async function seedUser(
  email: string,
  displayName: string,
  role: 'owner' | 'admin' | 'parent' | 'student',
) {
  const normalized = normalizeEmail(email);
  await pool.query(
    `INSERT INTO onetime.account_users
       (user_key, account_key, product_key, email_normalized, display_name, role,
        password_hash, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$8)`,
    [
      stableKey('test_user', [config.accountKey, config.productKey, normalized]),
      config.accountKey,
      config.productKey,
      normalized,
      displayName,
      role,
      await hashPassword('W13TestPass!234'),
      NOW,
    ],
  );
}

async function seedSessionFor(email: string, label: string) {
  const normalized = normalizeEmail(email);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const user = await pool.query(
    `SELECT user_key FROM onetime.account_users
      WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3`,
    [config.accountKey, config.productKey, normalized],
  );
  const userKey = String(user.rows[0]?.user_key);
  await pool.query(
    `INSERT INTO onetime.user_sessions
       (session_key, account_key, product_key, user_key, token_hash, csrf_token_hash,
        expires_at, created_at, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
    [
      stableKey('session', [config.accountKey, config.productKey, label]),
      config.accountKey,
      config.productKey,
      userKey,
      sha256(`token-${label}`),
      sha256(`csrf-${label}`),
      expiresAt,
      NOW,
    ],
  );
}

async function tableCount(tableName: string) {
  const result = await pool.query(`SELECT count(*)::int AS count FROM onetime.${tableName}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function activeSessionCount() {
  const result = await pool.query(
    `SELECT count(*)::int AS count
       FROM onetime.user_sessions
      WHERE account_key = $1 AND product_key = $2 AND revoked_at IS NULL`,
    [config.accountKey, config.productKey],
  );
  return Number(result.rows[0]?.count ?? 0);
}

function decryptHandoff(report: { encrypted_handoff?: EncryptedHandoff }) {
  const encrypted = report.encrypted_handoff;
  if (!encrypted) throw new Error('encrypted_handoff missing');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(HANDOFF_KEY, 'base64url'),
    Buffer.from(encrypted.iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(decrypted) as {
    links: Array<{ role: 'administrator' | 'parent' | 'student'; url: string }>;
  };
}

function linkFor(
  handoff: { links: Array<{ role: 'administrator' | 'parent' | 'student'; url: string }> },
  role: 'administrator' | 'parent' | 'student',
) {
  const link = handoff.links.find((entry) => entry.role === role)?.url;
  if (!link) throw new Error(`${role} link missing`);
  return link;
}

function tokenFromLink(link: string) {
  const token = new URL(link).hash.replace(/^#token=/, '');
  return decodeURIComponent(token);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

type EncryptedHandoff = {
  alg: 'A256GCM';
  iv: string;
  tag: string;
  ciphertext: string;
};

type AppliedReport = {
  mutation_deltas: {
    account_users_delta: number;
    household_delta: number;
    learner_delta: number;
    lifecycle_token_delta: number;
    lifecycle_outbox_delta: number;
    private_handoff_links: number;
    external_sends: number;
    foundation_checked: boolean;
  };
  encrypted_handoff: EncryptedHandoff;
};
