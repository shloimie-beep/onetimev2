import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  archiveContact,
  createAccountUser,
  createAdminHousehold,
  createAdminLearner,
  createContact,
  getContactDetail,
  inviteAdminUser,
  listAdminHouseholds,
  listAdminLearners,
  listAdminUsers,
  reactivateContact,
  requestAdminUserPasswordReset,
  setAdminHouseholdStatus,
  setAdminLearnerStatus,
  setAdminUserStatus,
  updateAdminHousehold,
  updateAdminLearner,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let ownerUserKey: string;

const actor = () => ({ userKey: ownerUserKey, role: 'owner' });

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    ONE_TIME_ACCOUNT_KEY: 'admin_directory_account',
    ONE_TIME_PRODUCT_KEY: 'admin_directory_product',
    OUTBOX_TRANSPORT_MODE: 'sink',
    HIGHLEVEL_EVENT_SYNC_MODE: 'disabled',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  ownerUserKey = await createAccountUser({
    pool,
    config,
    email: 'directory.owner@example.test',
    password: 'DirectoryOwner!234',
    displayName: 'Directory Owner',
    role: 'owner',
  });
});

afterEach(async () => {
  await pool.end();
});

describe('Admin directory database flows', () => {
  it('creates, edits, lists, and version-protects households without provider effects', async () => {
    const created = await createAdminHousehold({
      pool,
      config,
      actor: actor(),
      payload: {
        display_name: 'Cohen Family',
        idempotency_key: 'household-create-0001',
      },
    });
    expect(created).toMatchObject({
      display_name: 'Cohen Family',
      status: 'active',
      version: 1,
      active_learner_count: 0,
    });

    const replay = await createAdminHousehold({
      pool,
      config,
      actor: actor(),
      payload: {
        display_name: 'Cohen Family',
        idempotency_key: 'household-create-0001',
      },
    });
    expect(replay.household_key).toBe(created.household_key);

    await expect(
      createAdminHousehold({
        pool,
        config,
        actor: actor(),
        payload: {
          display_name: 'cohen family',
          idempotency_key: 'household-create-0002',
        },
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE' });

    const updated = await updateAdminHousehold({
      pool,
      config,
      actor: actor(),
      householdKey: created.household_key,
      payload: { display_name: 'Cohen Household', version: created.version },
    });
    expect(updated).toMatchObject({ display_name: 'Cohen Household', version: 2 });

    await expect(
      updateAdminHousehold({
        pool,
        config,
        actor: actor(),
        householdKey: created.household_key,
        payload: { display_name: 'Stale Household', version: 1 },
      }),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', currentVersion: 2 });

    const listed = await listAdminHouseholds({ pool, config, query: { search: 'cohen' } });
    expect(listed).toEqual([
      expect.objectContaining({
        household_key: created.household_key,
        display_name: 'Cohen Household',
        setup_state: 'not_started',
      }),
    ]);
    expect(await providerEffectCounts()).toEqual({ highlevel: 0 });
  });

  it('enforces three active learners transactionally and archive/restore seat semantics', async () => {
    const household = await createHousehold('Seat Limit Family', 'seat-household-0001');
    const learners = [];
    for (let index = 1; index <= 3; index += 1) {
      learners.push(
        await createAdminLearner({
          pool,
          config,
          actor: actor(),
          payload: {
            household_key: household.household_key,
            display_name: `Learner ${index}`,
            hebrew_name: null,
            grade_label: `Grade ${index}`,
            idempotency_key: `seat-learner-000${index}`,
          },
        }),
      );
    }

    await expect(
      createAdminLearner({
        pool,
        config,
        actor: actor(),
        payload: {
          household_key: household.household_key,
          display_name: 'Learner 4',
          hebrew_name: null,
          grade_label: null,
          idempotency_key: 'seat-learner-0004',
        },
      }),
    ).rejects.toMatchObject({
      code: 'LEARNER_LIMIT_REACHED',
      message: expect.stringContaining('three active learners'),
    });

    const archived = await setAdminLearnerStatus({
      pool,
      config,
      actor: actor(),
      learnerKey: learners[0]!.learner_key,
      status: 'archived',
      payload: { version: learners[0]!.version },
    });
    expect(archived.learner_status).toBe('archived');

    const replacement = await createAdminLearner({
      pool,
      config,
      actor: actor(),
      payload: {
        household_key: household.household_key,
        display_name: 'Replacement Learner',
        hebrew_name: null,
        grade_label: null,
        idempotency_key: 'seat-replacement-0001',
      },
    });
    expect(replacement.learner_status).toBe('active');

    await expect(
      setAdminLearnerStatus({
        pool,
        config,
        actor: actor(),
        learnerKey: archived.learner_key,
        status: 'active',
        payload: { version: archived.version },
      }),
    ).rejects.toMatchObject({ code: 'LEARNER_LIMIT_REACHED' });

    const listed = await listAdminLearners({ pool, config, query: {} });
    expect(listed.filter((learner) => learner.learner_status === 'active')).toHaveLength(3);
    expect(listed.filter((learner) => learner.learner_status === 'archived')).toHaveLength(1);
  });

  it('keeps legacy synthetic preview and live-demo identities out of the ordinary directory', async () => {
    const ordinaryHousehold = await createHousehold('Ordinary Family', 'ordinary-household-0001');
    const ordinaryLearner = await createAdminLearner({
      pool,
      config,
      actor: actor(),
      payload: {
        household_key: ordinaryHousehold.household_key,
        display_name: 'Ordinary Learner',
        hebrew_name: null,
        grade_label: 'Grade 5',
        idempotency_key: 'ordinary-learner-0001',
      },
    });

    await pool.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name)
       VALUES
         ('live_demo_household_legacy', $1, $2, 'Live Demo Legacy'),
         ('full_app_preview_household_legacy', $1, $2, 'Preview Legacy')`,
      [config.accountKey, config.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_learners
         (learner_key, account_key, product_key, household_key, display_name, grade_label)
       VALUES
         ('live_demo_learner_legacy', $1, $2, 'live_demo_household_legacy',
          'Demo Learner', 'Demo'),
         ('full_app_preview_student_legacy', $1, $2, 'full_app_preview_household_legacy',
          'Preview Learner', 'Preview')`,
      [config.accountKey, config.productKey],
    );

    const households = await listAdminHouseholds({ pool, config, query: {} });
    const learners = await listAdminLearners({ pool, config, query: {} });

    expect(households.map((household) => household.household_key)).toEqual([
      ordinaryHousehold.household_key,
    ]);
    expect(learners.map((learner) => learner.learner_key)).toEqual([ordinaryLearner.learner_key]);
  });

  it('updates learners with optimistic conflicts and blocks household archive with dependents', async () => {
    const household = await createHousehold('Conflict Family', 'conflict-household-0001');
    const learner = await createAdminLearner({
      pool,
      config,
      actor: actor(),
      payload: {
        household_key: household.household_key,
        display_name: 'Original Learner',
        hebrew_name: null,
        grade_label: null,
        idempotency_key: 'conflict-learner-0001',
      },
    });
    const updated = await updateAdminLearner({
      pool,
      config,
      actor: actor(),
      learnerKey: learner.learner_key,
      payload: {
        display_name: 'Updated Learner',
        hebrew_name: 'Updated Hebrew',
        grade_label: 'Grade 5',
        version: learner.version,
      },
    });
    expect(updated).toMatchObject({
      display_name: 'Updated Learner',
      hebrew_name: 'Updated Hebrew',
      version: 2,
    });
    await expect(
      updateAdminLearner({
        pool,
        config,
        actor: actor(),
        learnerKey: learner.learner_key,
        payload: {
          display_name: 'Stale Learner',
          hebrew_name: null,
          grade_label: null,
          version: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', currentVersion: 2 });
    await expect(
      setAdminHouseholdStatus({
        pool,
        config,
        actor: actor(),
        householdKey: household.household_key,
        status: 'archived',
        payload: { version: household.version },
      }),
    ).rejects.toMatchObject({
      code: 'IDENTITY_CONFLICT',
      message: expect.stringContaining('Archive learners'),
    });
  });

  it('creates protected Admin/Rabbi/Parent setup records and controls existing user access', async () => {
    const household = await createHousehold('Account Family', 'account-household-0001');
    await inviteAdminUser({
      pool,
      config,
      actor: actor(),
      payload: {
        display_name: 'Invited Admin',
        email: 'invited.admin@example.test',
        role: 'admin',
        relationship_label: 'Parent',
        authority: 'guardian',
        idempotency_key: 'invite-admin-0001',
      },
    });
    await inviteAdminUser({
      pool,
      config,
      actor: actor(),
      payload: {
        display_name: 'Invited Rabbi',
        email: 'invited.rabbi@example.test',
        role: 'rabbi',
        relationship_label: 'Parent',
        authority: 'guardian',
        idempotency_key: 'invite-rabbi-0001',
      },
    });
    await inviteAdminUser({
      pool,
      config,
      actor: actor(),
      payload: {
        display_name: 'Invited Parent',
        email: 'invited.parent@example.test',
        role: 'parent',
        household_key: household.household_key,
        relationship_label: 'Mother',
        authority: 'primary_guardian',
        idempotency_key: 'invite-parent-0001',
      },
    });
    const pending = await listAdminUsers({ pool, config, query: {} });
    expect(pending).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          display_name: 'Invited Admin',
          role: 'admin',
          status: 'pending_setup',
        }),
        expect.objectContaining({
          display_name: 'Invited Rabbi',
          role: 'rabbi',
          status: 'pending_setup',
        }),
        expect.objectContaining({
          display_name: 'Invited Parent',
          role: 'parent',
          household_key: household.household_key,
          status: 'pending_setup',
        }),
      ]),
    );

    const parentUserKey = await createAccountUser({
      pool,
      config,
      email: 'active.parent@example.test',
      password: 'ActiveParent!234',
      displayName: 'Active Parent',
      role: 'parent',
    });
    const active = (await listAdminUsers({ pool, config, query: { search: 'active.parent' } }))[0]!;
    const disabled = await setAdminUserStatus({
      pool,
      config,
      actor: actor(),
      userKey: parentUserKey,
      status: 'disabled',
      payload: { version: active.version },
    });
    expect(disabled).toMatchObject({ status: 'disabled', version: active.version + 1 });
    const restored = await setAdminUserStatus({
      pool,
      config,
      actor: actor(),
      userKey: parentUserKey,
      status: 'active',
      payload: { version: disabled.version },
    });
    expect(restored.status).toBe('active');

    const effects = await providerEffectCounts();
    expect(effects).toEqual({ highlevel: 0 });
    const deliveries = await pool.query(
      `SELECT count(*)::int AS count,
              bool_and(delivery_state = 'sink_queued') AS sink_only
         FROM onetime.account_lifecycle_delivery_intents`,
    );
    expect(Number(deliveries.rows[0]?.count)).toBe(3);
    expect(deliveries.rows[0]?.sink_only).toBe(true);
  });

  it('dispatches linked Student recovery to the adult-delivered PIN reset flow', async () => {
    const household = await createHousehold('Student Reset Family', 'student-reset-household-0001');
    const learner = await createAdminLearner({
      pool,
      config,
      actor: actor(),
      payload: {
        household_key: household.household_key,
        display_name: 'Student Reset Learner',
        hebrew_name: null,
        grade_label: 'Grade 4',
        idempotency_key: 'student-reset-learner-0001',
      },
    });
    const parentUserKey = await createAccountUser({
      pool,
      config,
      email: 'student-reset.parent@example.test',
      password: 'StudentResetParent!234',
      displayName: 'Student Reset Parent',
      role: 'parent',
    });
    const studentUserKey = await createAccountUser({
      pool,
      config,
      email: 'student:student.reset',
      password: '000123',
      displayName: 'Student Reset Learner',
      role: 'student',
    });
    const contactKey = 'contact_student_reset_parent';
    await pool.query(
      `INSERT INTO onetime.contacts
         (contact_key, account_key, product_key, display_name,
          family_school_classification, family_or_school, location_text, timezone,
          email_normalized, reminder_preference, suppression_state, source,
          created_at, updated_at)
       VALUES ($1, $2, $3, 'Student Reset Parent',
               'family', 'Student Reset Family', 'Jerusalem', 'Asia/Jerusalem',
               'student-reset.parent@example.test', 'email', 'active', 'admin_manual',
               now(), now())`,
      [contactKey, config.accountKey, config.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.adult_household_contact_links
         (link_key, account_key, product_key, contact_key, household_key,
          guardian_user_ref, highlevel_location_id, sync_state)
       VALUES ('link_student_reset_parent', $1, $2, $3, $4, $5,
               'location_student_reset', 'sync_pending')`,
      [config.accountKey, config.productKey, contactKey, household.household_key, parentUserKey],
    );
    await pool.query(
      `INSERT INTO onetime.account_learner_identity_links
         (link_key, account_key, product_key, household_key, learner_key, user_key, link_state)
       VALUES ('identity_student_reset', $1, $2, $3, $4, $5, 'active')`,
      [
        config.accountKey,
        config.productKey,
        household.household_key,
        learner.learner_key,
        studentUserKey,
      ],
    );
    await pool.query(
      `UPDATE onetime.portal_student_access_state
          SET student_user_ref = $4,
              status = 'active',
              credential_status = 'parent_managed'
        WHERE account_key = $1 AND product_key = $2 AND learner_key = $3`,
      [config.accountKey, config.productKey, learner.learner_key, studentUserKey],
    );

    const reset = await requestAdminUserPasswordReset({
      pool,
      config,
      actor: actor(),
      userKey: studentUserKey,
      payload: { idempotency_key: 'admin-student-pin-reset-0001' },
    });
    expect(reset).toMatchObject({
      user_key: studentUserKey,
      reset_kind: 'student_pin',
      request_accepted: true,
      external_send_performed: false,
    });
    const resetRows = await pool.query(
      `SELECT token_type, target_role, subject_user_key, learner_key, email_normalized
         FROM onetime.account_lifecycle_tokens
        WHERE subject_user_key = $1 AND token_type = 'student_reset'`,
      [studentUserKey],
    );
    expect(resetRows.rows).toEqual([
      expect.objectContaining({
        token_type: 'student_reset',
        target_role: 'student',
        subject_user_key: studentUserKey,
        learner_key: learner.learner_key,
        email_normalized: 'student-reset.parent@example.test',
      }),
    ]);
    const adultResetRows = await pool.query(
      `SELECT 1
         FROM onetime.account_lifecycle_tokens
        WHERE subject_user_key = $1 AND token_type = 'password_reset'`,
      [studentUserKey],
    );
    expect(adultResetRows.rowCount).toBe(0);

    await pool.query(
      `UPDATE onetime.account_learner_identity_links
          SET link_state = 'disabled', disabled_at = now()
        WHERE user_key = $1`,
      [studentUserKey],
    );
    await expect(
      requestAdminUserPasswordReset({
        pool,
        config,
        actor: actor(),
        userKey: studentUserKey,
        payload: { idempotency_key: 'admin-student-pin-reset-0002' },
      }),
    ).rejects.toMatchObject({ code: 'IDENTITY_CONFLICT' });
  });

  it('restores an archived contact to its prior status without creating a duplicate', async () => {
    const contact = await createContact({
      pool,
      config,
      actorUserKey: ownerUserKey,
      actorRole: 'owner',
      payload: {
        display_name: 'Restorable Person',
        family_school_classification: 'family',
        email: 'restorable.person@example.test',
        phone: '+972501112233',
        location: 'Jerusalem',
        timezone: 'Asia/Jerusalem',
        lead_status: 'contacted',
        assigned_user_key: undefined,
        internal_note: '',
        idempotency_key: 'restorable-contact-0001',
      },
    });
    await archiveContact({
      pool,
      config,
      contactId: contact.contact_id,
      actorUserKey: ownerUserKey,
      reason: 'integration_test',
    });
    const archived = await getContactDetail({
      pool,
      config,
      contactId: contact.contact_id,
    });
    expect(archived?.lead_status).toBe('archived');
    await reactivateContact({
      pool,
      config,
      contactId: contact.contact_id,
      actorUserKey: ownerUserKey,
    });
    const restored = await getContactDetail({
      pool,
      config,
      contactId: contact.contact_id,
    });
    expect(restored).toMatchObject({
      contact_id: contact.contact_id,
      lead_status: 'contacted',
      email: 'restorable.person@example.test',
    });
  });
});

async function createHousehold(displayName: string, idempotencyKey: string) {
  return createAdminHousehold({
    pool,
    config,
    actor: actor(),
    payload: { display_name: displayName, idempotency_key: idempotencyKey },
  });
}

async function providerEffectCounts() {
  const result = await pool.query(
    `SELECT count(*)::int AS highlevel
       FROM onetime.outbox_events
      WHERE channel = 'highlevel'`,
  );
  return {
    highlevel: Number(result.rows[0]?.highlevel ?? 0),
  };
}
