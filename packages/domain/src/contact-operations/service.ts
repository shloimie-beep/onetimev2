import { createHash, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import {
  contactOperationsEnrollmentResultSchema,
  contactOperationsEnrollmentSchema,
  type ContactOperationsCapability,
  type ContactOperationsEnrollmentResult,
  type UserRole,
} from '../../../contracts/src/index.ts';
import { inTransaction, type DbPool, type Queryable } from '../../../db/src/index.ts';
import {
  createStudentReset,
  issueLocalStudentSetupWithClient,
  issueParentActivationWithClient,
  requestPasswordReset,
} from '../accounts/lifecycle.ts';
import {
  applyHouseholdAccessState,
  applyHouseholdAccessStateWithClient,
  readHouseholdAccess,
} from '../access/service.ts';
import { enqueueHighLevelEvent } from '../highlevel/producer.ts';
import { normalizeEmail, normalizePhone, stableKey } from '../lead/normalize.ts';

export type ContactOperationsActor = {
  userKey: string;
  role: UserRole;
  authorizedHouseholds?: string[];
};

export class ContactOperationsError extends Error {
  constructor(
    readonly code:
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'AMBIGUOUS_IDENTITY'
      | 'IDENTITY_CONFLICT'
      | 'IDEMPOTENCY_CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'ContactOperationsError';
  }
}

export function contactOperationsCapabilitiesForRole(
  role: UserRole,
): ContactOperationsCapability[] {
  if (role === 'owner') return ['contact_ops:supervise', 'contact_ops:school_admin'];
  if (role === 'admin') return ['contact_ops:school_admin'];
  if (role === 'parent') return ['contact_ops:parent_self_service'];
  return [];
}

export async function enrollParentHousehold(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ContactOperationsActor;
  payload: unknown;
  now?: Date;
}): Promise<ContactOperationsEnrollmentResult> {
  requireCapability(input.actor, 'contact_ops:school_admin');
  const payload = contactOperationsEnrollmentSchema.parse(input.payload);
  const now = input.now ?? new Date();
  const requestHash = digest(canonicalJson(payload));

  return inTransaction(input.pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [
      advisoryLockKey(input.config.accountKey, input.config.productKey, payload.idempotency_key),
    ]);
    const replay = await readReceipt(client, input.config, input.actor, {
      scope: 'enroll_parent_household',
      idempotencyKey: payload.idempotency_key,
      requestHash,
    });
    if (replay) {
      return contactOperationsEnrollmentResultSchema.parse({ ...replay, replayed: true });
    }

    const email = normalizeEmail(payload.adult.email);
    const phone = normalizePhone(payload.adult.phone);
    const contactKey = await findOrCreateAdultContact(client, input.config, {
      ...payload.adult,
      email,
      phone,
      now,
    });
    const householdKey = await findOrCreateLinkedHousehold(client, input.config, {
      contactKey,
      displayName: payload.household.display_name,
      now,
      ...(payload.household.household_key
        ? { requestedHouseholdKey: payload.household.household_key }
        : {}),
    });
    const relationshipKey = stableKey('guardian_relationship', [
      input.config.accountKey,
      input.config.productKey,
      contactKey,
      householdKey,
    ]);

    const parentActivation = await issueParentActivationWithClient({
      client,
      config: input.config,
      actor: { userKey: input.actor.userKey, role: input.actor.role },
      payload: {
        idempotency_key: stableKey('contact_ops_parent_activation', [
          payload.idempotency_key,
          contactKey,
          householdKey,
        ]),
        email,
        display_name: payload.adult.display_name,
        household_key: householdKey,
        relationship_key: relationshipKey,
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
      now,
      queueHighLevelPortalEvent: false,
    });

    await client.query(
      `INSERT INTO onetime.adult_household_contact_links
         (link_key, account_key, product_key, contact_key, household_key,
          highlevel_location_id, sync_state, projection_revision, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'sync_pending',1,$7,$7)
       ON CONFLICT (account_key, product_key, contact_key)
       DO UPDATE SET
         household_key = EXCLUDED.household_key,
         highlevel_location_id = EXCLUDED.highlevel_location_id,
         sync_state = CASE
           WHEN onetime.adult_household_contact_links.highlevel_contact_id IS NULL
             THEN 'sync_pending'
           ELSE onetime.adult_household_contact_links.sync_state
         END,
         updated_at = EXCLUDED.updated_at`,
      [
        stableKey('adult_household_link', [
          input.config.accountKey,
          input.config.productKey,
          contactKey,
          householdKey,
        ]),
        input.config.accountKey,
        input.config.productKey,
        contactKey,
        householdKey,
        input.config.highLevelLocationId,
        now,
      ],
    );

    const studentSetupTokenRefs: Array<{
      learner_key: string;
      username: string;
      token_ref: string;
    }> = [];
    for (const student of payload.students) {
      const learnerKey = stableKey('learner', [
        input.config.accountKey,
        input.config.productKey,
        householdKey,
        payload.idempotency_key,
        student.username.toLowerCase(),
      ]);
      await client.query(
        `INSERT INTO onetime.portal_learners
           (learner_key, account_key, product_key, household_key, display_name,
            hebrew_name, grade_label, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
         ON CONFLICT (account_key, product_key, learner_key) DO NOTHING`,
        [
          learnerKey,
          input.config.accountKey,
          input.config.productKey,
          householdKey,
          student.display_name,
          student.hebrew_name ?? null,
          student.grade_label ?? null,
          now,
        ],
      );
      await client.query(
        `INSERT INTO onetime.portal_student_access_state
           (access_state_key, account_key, product_key, household_key, learner_key, status,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'not_configured',$6,$6)
         ON CONFLICT DO NOTHING`,
        [
          stableKey('student_access', [
            input.config.accountKey,
            input.config.productKey,
            learnerKey,
          ]),
          input.config.accountKey,
          input.config.productKey,
          householdKey,
          learnerKey,
          now,
        ],
      );
      const setup = await issueLocalStudentSetupWithClient({
        client,
        config: input.config,
        actor: { userKey: input.actor.userKey, role: input.actor.role },
        adultDeliveryEmail: email,
        displayName: student.display_name,
        householdKey,
        learnerKey,
        username: student.username,
        idempotencyKey: stableKey('contact_ops_student_setup', [
          payload.idempotency_key,
          learnerKey,
        ]),
        now,
      });
      studentSetupTokenRefs.push({
        learner_key: learnerKey,
        username: student.username.trim().toLowerCase(),
        token_ref: setup.token_ref,
      });
    }

    const access = await applyHouseholdAccessStateWithClient({
      db: client,
      accountKey: input.config.accountKey,
      productKey: input.config.productKey,
      sourceKind: 'complimentary',
      actorKind: 'provisioner',
      idempotencyKey: stableKey('contact_ops_initial_access', [
        payload.idempotency_key,
        householdKey,
      ]),
      now,
      command: {
        household_key: householdKey,
        state: payload.complimentary ? 'active' : 'revoked',
        effective_at: now.toISOString(),
        expires_at: payload.complimentary?.expires_at ?? null,
        opaque_source_reference:
          payload.complimentary?.opaque_source_reference ??
          stableKey('complimentary_ungranted', [contactKey, householdKey]),
        source_revision: 1,
        source_updated_at: now.toISOString(),
        policy_version: payload.complimentary?.policy_version ?? 'contact-ops-paused-v1',
        revocation_reason: payload.complimentary ? null : 'complimentary_not_granted',
      },
    });

    await enqueueHighLevelEvent(client, input.config, {
      eventName: 'parent.household.sync_requested',
      contactKey,
      idempotencyKey: stableKey('parent_household_projection', [contactKey, householdKey, '1']),
      actor: { kind: 'admin', reference: input.actor.userKey },
      occurredAt: now,
      protectedPath: '/app/parent',
      data: {
        household_key: householdKey,
        classification: payload.adult.classification,
        portal_status: 'invited',
      },
    });

    const result = contactOperationsEnrollmentResultSchema.parse({
      replayed: false,
      contact_key: contactKey,
      household_key: householdKey,
      relationship_key: relationshipKey,
      parent_activation_token_ref: parentActivation.token_ref,
      student_setup_token_refs: studentSetupTokenRefs,
      access_state: access.projection.state,
      sync_state: 'sync_pending',
      child_highlevel_operations: 0,
      plaintext_credentials_stored: false,
      payment_history_written: false,
    });
    await writeReceipt(client, input.config, input.actor, {
      scope: 'enroll_parent_household',
      idempotencyKey: payload.idempotency_key,
      requestHash,
      response: result,
      now,
    });
    await auditContactOperation(client, input.config, input.actor, {
      capability: 'contact_ops:school_admin',
      contactKey,
      householdKey,
      actionType: 'parent_household_enrolled',
      metadata: {
        student_count: payload.students.length,
        complimentary_granted: Boolean(payload.complimentary),
        child_highlevel_operations: 0,
        plaintext_credentials_stored: false,
        payment_history_written: false,
      },
      now,
    });
    return result;
  });
}

export async function setContactOperationsAccess(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ContactOperationsActor;
  householdKey: string;
  operation: 'grant_complimentary' | 'revoke_complimentary' | 'suspend' | 'release';
  idempotencyKey: string;
  expiresAt?: string | null;
  policyVersion: string;
  reason?: string;
  now?: Date;
}) {
  requireCapability(input.actor, 'contact_ops:school_admin');
  const now = input.now ?? new Date();
  const suspension = input.operation === 'suspend' || input.operation === 'release';
  const current = await input.pool.query(
    `SELECT source_revision, opaque_source_reference, effective_at
       FROM onetime.account_access_source_states
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND source_slot = $4
      LIMIT 1`,
    [
      input.config.accountKey,
      input.config.productKey,
      input.householdKey,
      suspension ? 'admin_suspension' : 'complimentary',
    ],
  );
  const row = current.rows[0] as Record<string, unknown> | undefined;
  const result = await applyHouseholdAccessState({
    pool: input.pool,
    accountKey: input.config.accountKey,
    productKey: input.config.productKey,
    sourceKind: suspension ? 'admin_suspension' : 'complimentary',
    actorKind: 'admin',
    idempotencyKey: input.idempotencyKey,
    now,
    command: {
      household_key: input.householdKey,
      state:
        input.operation === 'grant_complimentary'
          ? 'active'
          : input.operation === 'suspend'
            ? 'suspended'
            : 'revoked',
      effective_at: row?.effective_at
        ? new Date(String(row.effective_at)).toISOString()
        : now.toISOString(),
      expires_at: input.operation === 'grant_complimentary' ? (input.expiresAt ?? null) : null,
      opaque_source_reference:
        typeof row?.opaque_source_reference === 'string'
          ? row.opaque_source_reference
          : stableKey(suspension ? 'admin_suspension' : 'complimentary', [
              input.config.accountKey,
              input.config.productKey,
              input.householdKey,
            ]),
      source_revision: Number(row?.source_revision ?? 0) + 1,
      source_updated_at: now.toISOString(),
      policy_version: input.policyVersion,
      revocation_reason:
        input.operation === 'grant_complimentary'
          ? null
          : (input.reason ??
            (input.operation === 'suspend'
              ? 'administrative_suspension_billing_unchanged'
              : input.operation === 'release'
                ? 'administrative_suspension_released_billing_unchanged'
                : 'complimentary_access_revoked')),
    },
  });
  return {
    ...result,
    billing_mutated: false as const,
    payment_history_written: false as const,
  };
}

export async function readAdultContactLink(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ContactOperationsActor;
  householdKey: string;
}) {
  requireCapability(input.actor, 'contact_ops:school_admin');
  const result = await input.pool.query(
    `SELECT contact_key, household_key, guardian_user_ref, highlevel_contact_id,
            sync_state, projection_revision
       FROM onetime.adult_household_contact_links
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
      LIMIT 2`,
    [input.config.accountKey, input.config.productKey, input.householdKey],
  );
  if (result.rows.length !== 1) {
    throw new ContactOperationsError(
      result.rows.length ? 'AMBIGUOUS_IDENTITY' : 'NOT_FOUND',
      'The adult Parent link is unavailable.',
    );
  }
  const row = result.rows[0] as Record<string, unknown>;
  const providerContactId =
    typeof row.highlevel_contact_id === 'string' ? row.highlevel_contact_id : null;
  return {
    contact_key: String(row.contact_key),
    household_key: String(row.household_key),
    guardian_user_ref: typeof row.guardian_user_ref === 'string' ? row.guardian_user_ref : null,
    sync_state: String(row.sync_state),
    highlevel_contact_linked: Boolean(providerContactId),
    open_in_highlevel_url: providerContactId
      ? `https://app.gohighlevel.com/v2/location/${encodeURIComponent(
          input.config.highLevelLocationId,
        )}/contacts/detail/${encodeURIComponent(providerContactId)}`
      : null,
    projection_revision: Number(row.projection_revision),
    payment_data_present: false as const,
  };
}

export async function reconcileAdultContactLink(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ContactOperationsActor;
  householdKey: string;
  idempotencyKey: string;
  now?: Date;
}) {
  requireCapability(input.actor, 'contact_ops:school_admin');
  const now = input.now ?? new Date();
  const requestHash = digest(
    canonicalJson({
      household_key: input.householdKey,
      operation: 'reconcile_adult_parent',
    }),
  );
  return inTransaction(input.pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [
      advisoryLockKey(input.config.accountKey, input.config.productKey, input.idempotencyKey),
    ]);
    const replay = (await readReceipt(client, input.config, input.actor, {
      scope: 'reconcile_adult_parent',
      idempotencyKey: input.idempotencyKey,
      requestHash,
    })) as {
      sync_state: 'sync_pending';
      projection_revision: number;
      child_highlevel_operations: 0;
    } | null;
    if (replay) return { ...replay, duplicate: true as const };

    const link = await client.query(
      `SELECT contact_key, projection_revision
         FROM onetime.adult_household_contact_links
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = $3
        FOR UPDATE`,
      [input.config.accountKey, input.config.productKey, input.householdKey],
    );
    if (link.rows.length !== 1) {
      throw new ContactOperationsError('NOT_FOUND', 'The adult Parent link is unavailable.');
    }
    const contactKey = String(link.rows[0]?.contact_key);
    const revision = Number(link.rows[0]?.projection_revision) + 1;
    const queued = await enqueueHighLevelEvent(client, input.config, {
      eventName: 'parent.household.sync_requested',
      contactKey,
      idempotencyKey: stableKey('parent_household_reconcile', [
        input.idempotencyKey,
        contactKey,
        input.householdKey,
      ]),
      actor: { kind: 'admin', reference: input.actor.userKey },
      occurredAt: now,
      protectedPath: '/app/parent',
      data: { household_key: input.householdKey },
    });
    if (queued.state === 'blocked') {
      throw new ContactOperationsError('IDENTITY_CONFLICT', 'The Parent cannot be reconciled.');
    }
    await client.query(
      `UPDATE onetime.adult_household_contact_links
          SET projection_revision = $4,
              sync_state = 'sync_pending',
              updated_at = $5
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = $3`,
      [input.config.accountKey, input.config.productKey, input.householdKey, revision, now],
    );
    const result = {
      sync_state: 'sync_pending' as const,
      projection_revision: revision,
      duplicate: queued.state === 'duplicate',
      child_highlevel_operations: 0 as const,
    };
    await writeReceipt(client, input.config, input.actor, {
      scope: 'reconcile_adult_parent',
      idempotencyKey: input.idempotencyKey,
      requestHash,
      response: result,
      now,
    });
    await auditContactOperation(client, input.config, input.actor, {
      capability: 'contact_ops:school_admin',
      contactKey,
      householdKey: input.householdKey,
      actionType: 'adult_parent_reconcile_queued',
      metadata: {
        projection_revision: revision,
        duplicate_outbox_event: queued.state === 'duplicate',
        child_highlevel_operations: 0,
      },
      now,
    });
    return result;
  });
}

export async function parentAccessShell(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ContactOperationsActor;
  displayName: string;
}) {
  if (input.actor.role !== 'parent') {
    throw new ContactOperationsError('FORBIDDEN', 'This shell is only available to Parents.');
  }
  const households = await input.pool.query(
    `SELECT relationships.household_key
       FROM onetime.portal_guardian_relationships AS relationships
       JOIN onetime.portal_households AS households
         ON households.account_key = relationships.account_key
        AND households.product_key = relationships.product_key
        AND households.household_key = relationships.household_key
        AND households.status = 'active'
      WHERE relationships.account_key = $1
        AND relationships.product_key = $2
        AND relationships.guardian_user_ref = $3
        AND relationships.status = 'active'
        AND relationships.authority <> 'support_only'
      ORDER BY relationships.created_at, relationships.relationship_key`,
    [input.config.accountKey, input.config.productKey, input.actor.userKey],
  );
  if (!households.rowCount) {
    throw new ContactOperationsError('FORBIDDEN', 'No Parent household is available.');
  }
  let active = false;
  for (const row of households.rows) {
    active ||= Boolean(
      (
        await readHouseholdAccess({
          db: input.pool,
          accountKey: input.config.accountKey,
          productKey: input.config.productKey,
          householdKey: String(row.household_key),
        })
      )?.grants_access,
    );
  }
  return {
    mode: active ? ('active' as const) : ('paused' as const),
    display_name: input.displayName,
    household_count: households.rows.length,
    primary_household_key: String(households.rows[0]?.household_key),
    learning_routes_available: active,
    identity_profile_available: true as const,
    recovery_available: true as const,
    support_available: true as const,
  };
}

export async function requestParentResetForHousehold(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ContactOperationsActor;
  householdKey: string;
  idempotencyKey: string;
  now?: Date;
}) {
  assertHouseholdAuthority(input.actor, input.householdKey);
  const result = await input.pool.query(
    `SELECT contacts.email_normalized
       FROM onetime.adult_household_contact_links AS links
       JOIN onetime.contacts AS contacts
         ON contacts.account_key = links.account_key
        AND contacts.product_key = links.product_key
        AND contacts.contact_key = links.contact_key
      WHERE links.account_key = $1
        AND links.product_key = $2
        AND links.household_key = $3
      LIMIT 2`,
    [input.config.accountKey, input.config.productKey, input.householdKey],
  );
  if (result.rows.length !== 1) {
    throw new ContactOperationsError('NOT_FOUND', 'The Parent recovery target is unavailable.');
  }
  await requestPasswordReset({
    pool: input.pool,
    config: input.config,
    payload: {
      idempotency_key: input.idempotencyKey,
      email: String(result.rows[0]?.email_normalized),
    },
    ...(input.now ? { now: input.now } : {}),
  });
  return { request_accepted: true as const, password_exposed: false as const };
}

export async function requestStudentResetForHousehold(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ContactOperationsActor;
  householdKey: string;
  learnerKey: string;
  idempotencyKey: string;
  now?: Date;
}) {
  assertHouseholdAuthority(input.actor, input.householdKey);
  const target = await input.pool.query(
    `SELECT learners.learner_key, contacts.email_normalized
       FROM onetime.portal_learners AS learners
       JOIN onetime.adult_household_contact_links AS links
         ON links.account_key = learners.account_key
        AND links.product_key = learners.product_key
        AND links.household_key = learners.household_key
       JOIN onetime.contacts AS contacts
         ON contacts.account_key = links.account_key
        AND contacts.product_key = links.product_key
        AND contacts.contact_key = links.contact_key
      WHERE learners.account_key = $1
        AND learners.product_key = $2
        AND learners.household_key = $3
        AND learners.learner_key = $4
        AND learners.learner_status <> 'archived'
      LIMIT 2`,
    [input.config.accountKey, input.config.productKey, input.householdKey, input.learnerKey],
  );
  if (target.rows.length !== 1) {
    throw new ContactOperationsError('NOT_FOUND', 'The Student recovery target is unavailable.');
  }
  const issued = await createStudentReset({
    pool: input.pool,
    config: input.config,
    actor: { userKey: input.actor.userKey, role: input.actor.role },
    payload: {
      idempotency_key: input.idempotencyKey,
      learner_key: input.learnerKey,
      email: String(target.rows[0]?.email_normalized),
    },
    ...(input.now ? { now: input.now } : {}),
  });
  return {
    token_ref: issued.token_ref,
    delivery: issued.delivery,
    plaintext_credential_stored: false as const,
    sessions_revoked_on_completion: true as const,
    child_highlevel_operations: 0 as const,
  };
}

async function findOrCreateAdultContact(
  client: Queryable,
  config: AppConfig,
  input: {
    display_name: string;
    classification: 'family' | 'school';
    family_or_school: string;
    location: string;
    timezone: string;
    email: string;
    phone: string | null;
    now: Date;
  },
) {
  const matches = await client.query(
    `SELECT contact_key, email_normalized, phone_normalized
       FROM onetime.contacts
      WHERE account_key = $1
        AND product_key = $2
        AND archived_at IS NULL
        AND (
          email_normalized = $3
          OR ($4::text IS NOT NULL AND phone_normalized = $4)
        )
      ORDER BY contact_key
      FOR UPDATE`,
    [config.accountKey, config.productKey, input.email, input.phone],
  );
  if (matches.rows.length > 1) {
    throw new ContactOperationsError(
      'AMBIGUOUS_IDENTITY',
      'More than one adult contact matches this identity.',
    );
  }
  const existing = matches.rows[0] as Record<string, unknown> | undefined;
  if (
    existing &&
    (String(existing.email_normalized) !== input.email ||
      (input.phone &&
        existing.phone_normalized &&
        String(existing.phone_normalized) !== input.phone))
  ) {
    throw new ContactOperationsError(
      'IDENTITY_CONFLICT',
      'The adult email and phone resolve to different identity facts.',
    );
  }
  if (existing) {
    await client.query(
      `UPDATE onetime.contacts
          SET display_name = $4,
              family_school_classification = $5,
              family_or_school = $6,
              location_text = $7,
              timezone = $8,
              phone_normalized = COALESCE($9, phone_normalized),
              updated_at = $10,
              last_activity_at = $10
        WHERE account_key = $1
          AND product_key = $2
          AND contact_key = $3`,
      [
        config.accountKey,
        config.productKey,
        existing.contact_key,
        input.display_name,
        input.classification,
        input.family_or_school,
        input.location,
        input.timezone,
        input.phone,
        input.now,
      ],
    );
    return String(existing.contact_key);
  }

  const contactKey = `contact_${randomUUID()}`;
  await client.query(
    `INSERT INTO onetime.contacts
       (contact_key, public_contact_id, account_key, product_key, display_name,
        family_school_classification, family_or_school, location_text, timezone,
        email_normalized, phone_normalized, reminder_preference, suppression_state,
        source, lead_status, last_activity_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'none','active',
             'contact_operations','new',$12,$12,$12)`,
    [
      contactKey,
      randomUUID(),
      config.accountKey,
      config.productKey,
      input.display_name,
      input.classification,
      input.family_or_school,
      input.location,
      input.timezone,
      input.email,
      input.phone,
      input.now,
    ],
  );
  return contactKey;
}

async function findOrCreateLinkedHousehold(
  client: Queryable,
  config: AppConfig,
  input: {
    contactKey: string;
    requestedHouseholdKey?: string;
    displayName: string;
    now: Date;
  },
) {
  const contactLink = await client.query(
    `SELECT household_key
       FROM onetime.adult_household_contact_links
      WHERE account_key = $1 AND product_key = $2 AND contact_key = $3
      FOR UPDATE`,
    [config.accountKey, config.productKey, input.contactKey],
  );
  if (
    contactLink.rowCount &&
    input.requestedHouseholdKey &&
    String(contactLink.rows[0]?.household_key) !== input.requestedHouseholdKey
  ) {
    throw new ContactOperationsError(
      'IDENTITY_CONFLICT',
      'The adult contact is already linked to another household.',
    );
  }
  const householdKey =
    (contactLink.rows[0]?.household_key as string | undefined) ??
    input.requestedHouseholdKey ??
    stableKey('household', [config.accountKey, config.productKey, input.contactKey]);
  const householdLink = await client.query(
    `SELECT contact_key
       FROM onetime.adult_household_contact_links
      WHERE account_key = $1 AND product_key = $2 AND household_key = $3
      FOR UPDATE`,
    [config.accountKey, config.productKey, householdKey],
  );
  if (householdLink.rowCount && String(householdLink.rows[0]?.contact_key) !== input.contactKey) {
    throw new ContactOperationsError(
      'IDENTITY_CONFLICT',
      'The household is already linked to another adult contact.',
    );
  }
  await client.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'active',$5,$5)
     ON CONFLICT (account_key, product_key, household_key)
     DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = EXCLUDED.updated_at`,
    [householdKey, config.accountKey, config.productKey, input.displayName, input.now],
  );
  return householdKey;
}

function requireCapability(actor: ContactOperationsActor, capability: ContactOperationsCapability) {
  if (!contactOperationsCapabilitiesForRole(actor.role).includes(capability)) {
    throw new ContactOperationsError('FORBIDDEN', 'This contact operation is not permitted.');
  }
}

function assertHouseholdAuthority(actor: ContactOperationsActor, householdKey: string) {
  if (contactOperationsCapabilitiesForRole(actor.role).includes('contact_ops:school_admin')) return;
  if (actor.role === 'parent' && actor.authorizedHouseholds?.includes(householdKey)) {
    return;
  }
  throw new ContactOperationsError('FORBIDDEN', 'This household is outside your authority.');
}

async function readReceipt(
  client: Queryable,
  config: AppConfig,
  actor: ContactOperationsActor,
  input: { scope: string; idempotencyKey: string; requestHash: string },
) {
  const result = await client.query(
    `SELECT request_hash, response_json
       FROM onetime.contact_operation_receipts
      WHERE account_key = $1
        AND product_key = $2
        AND actor_user_key = $3
        AND operation_scope = $4
        AND idempotency_key = $5
      FOR UPDATE`,
    [config.accountKey, config.productKey, actor.userKey, input.scope, input.idempotencyKey],
  );
  if (!result.rowCount) return null;
  if (String(result.rows[0]?.request_hash) !== input.requestHash) {
    throw new ContactOperationsError(
      'IDEMPOTENCY_CONFLICT',
      'The operation key was already used for different information.',
    );
  }
  return result.rows[0]?.response_json;
}

async function writeReceipt(
  client: Queryable,
  config: AppConfig,
  actor: ContactOperationsActor,
  input: {
    scope: string;
    idempotencyKey: string;
    requestHash: string;
    response: unknown;
    now: Date;
  },
) {
  await client.query(
    `INSERT INTO onetime.contact_operation_receipts
       (receipt_key, account_key, product_key, actor_user_key, operation_scope,
        idempotency_key, request_hash, response_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [
      stableKey('contact_operation_receipt', [
        config.accountKey,
        config.productKey,
        actor.userKey,
        input.scope,
        input.idempotencyKey,
      ]),
      config.accountKey,
      config.productKey,
      actor.userKey,
      input.scope,
      input.idempotencyKey,
      input.requestHash,
      JSON.stringify(input.response),
      input.now,
    ],
  );
}

async function auditContactOperation(
  client: Queryable,
  config: AppConfig,
  actor: ContactOperationsActor,
  input: {
    capability: ContactOperationsCapability;
    contactKey?: string;
    householdKey?: string;
    learnerKey?: string;
    actionType: string;
    metadata?: Record<string, unknown>;
    now: Date;
  },
) {
  await client.query(
    `INSERT INTO onetime.contact_operation_audit_events
       (audit_key, account_key, product_key, actor_user_key, actor_capability,
        contact_key, household_key, learner_key, action_type, metadata, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
    [
      stableKey('contact_operation_audit', [
        config.accountKey,
        config.productKey,
        actor.userKey,
        input.actionType,
        randomUUID(),
      ]),
      config.accountKey,
      config.productKey,
      actor.userKey,
      input.capability,
      input.contactKey ?? null,
      input.householdKey ?? null,
      input.learnerKey ?? null,
      input.actionType,
      JSON.stringify(input.metadata ?? {}),
      input.now,
    ],
  );
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function advisoryLockKey(accountKey: string, productKey: string, idempotencyKey: string) {
  const value = Number.parseInt(
    digest([accountKey, productKey, idempotencyKey].join('\0')).slice(0, 8),
    16,
  );
  return value > 0x7fffffff ? value - 0x100000000 : value;
}
