import { createHash, randomUUID } from 'node:crypto';
import { inTransaction, type DbPool, type Queryable } from '../index.ts';
import type {
  AdministrativeUpdate,
  CreateLearnerPayload,
  HouseholdOverview,
  LearnerProfile,
  PortalActorContext,
  RewardBalance,
  RewardEvent,
  StudentAccessState,
  UpdateLearnerPayload,
} from '../../../contracts/src/portals/index.ts';
import {
  PortalServiceError,
  type CredentialLifecycleResult,
  type PortalAuditRecord,
  type PortalRepository,
  type RewardWriteInput,
  type StudentAccessOperationType,
} from '../../../domain/src/portals/services.ts';

const MAX_ACTIVE_LEARNERS = 3;

export function createPortalRepository(pool: DbPool): PortalRepository {
  return {
    getHousehold: (args) => getHousehold(pool, args.actor, args.household_key),
    listLearners: (args) =>
      listLearners(pool, args.actor, args.household_key, args.include_archived),
    getLearner: (args) => getLearner(pool, args.actor, args.household_key, args.learner_key),
    createLearner: (args) =>
      createLearner(pool, args.actor, args.household_key, args.payload, args.request_fingerprint),
    updateLearner: (args) =>
      updateLearner(
        pool,
        args.actor,
        args.household_key,
        args.learner_key,
        args.payload,
        args.request_fingerprint,
      ),
    setLearnerStatus: (args) =>
      setLearnerStatus(pool, {
        actor: args.actor,
        householdKey: args.household_key,
        learnerKey: args.learner_key,
        status: args.status,
        version: args.version,
        idempotencyKey: args.idempotency_key,
        requestFingerprint: args.request_fingerprint,
      }),
    getStudentAccessState: (args) => getStudentAccessState(pool, args.actor, args.learner_key),
    recordStudentAccessOperation: (args) =>
      recordStudentAccessOperation(pool, {
        actor: args.actor,
        learnerKey: args.learner_key,
        operationType: args.operation_type,
        idempotencyKey: args.idempotency_key,
        requestFingerprint: args.request_fingerprint,
        adapterResult: args.adapter_result,
      }),
    listUpdates: (args) => listUpdates(pool, args.actor, args.learner_key, args.audience),
    getRewardBalance: (args) => getRewardBalance(pool, args.actor, args.learner_key),
    listRewardEvents: (args) => listRewardEvents(pool, args.actor, args.learner_key, args.limit),
    addRewardEvent: (args) =>
      addRewardEvent(pool, args.actor, args.input, args.source_type, args.request_fingerprint),
    recordAudit: (record) => recordAudit(pool, record),
  };
}

async function getHousehold(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  householdKey: string,
): Promise<HouseholdOverview | null> {
  const result = await target.query(
    `SELECT households.household_key, households.display_name, households.version,
            count(learners.learner_key)::int AS active_learner_count
       FROM onetime.portal_households AS households
       LEFT JOIN onetime.portal_learners AS learners
         ON learners.account_key = households.account_key
        AND learners.product_key = households.product_key
        AND learners.household_key = households.household_key
        AND learners.learner_status = 'active'
      WHERE households.account_key = $1
        AND households.product_key = $2
        AND households.household_key = $3
        AND households.status = 'active'
      GROUP BY households.household_key, households.display_name, households.version`,
    [actor.account_key, actor.product_key, householdKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const activeLearnerCount = Number(row.active_learner_count ?? 0);
  return {
    household_key: String(row.household_key),
    display_name: String(row.display_name),
    active_learner_count: activeLearnerCount,
    max_active_learners: MAX_ACTIVE_LEARNERS,
    consent_status: 'not_required',
    learner_limit_reached: activeLearnerCount >= MAX_ACTIVE_LEARNERS,
    version: Number(row.version),
  };
}

async function listLearners(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  householdKey: string,
  includeArchived = false,
): Promise<LearnerProfile[]> {
  const result = await target.query(
    `SELECT learner_key, household_key, display_name, hebrew_name, grade_label,
            learner_status, version, created_at, updated_at
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND ($4::boolean OR learner_status <> 'archived')
      ORDER BY created_at ASC, learner_key ASC`,
    [actor.account_key, actor.product_key, householdKey, includeArchived],
  );
  return result.rows.map((row) => mapLearner(row as Record<string, unknown>));
}

async function getLearner(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  householdKey: string,
  learnerKey: string,
): Promise<LearnerProfile | null> {
  const result = await target.query(
    `SELECT learner_key, household_key, display_name, hebrew_name, grade_label,
            learner_status, version, created_at, updated_at
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND learner_key = $4`,
    [actor.account_key, actor.product_key, householdKey, learnerKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapLearner(row) : null;
}

async function createLearner(
  pool: DbPool,
  actor: PortalActorContext,
  householdKey: string,
  payload: CreateLearnerPayload,
  requestFingerprint: string,
) {
  return inTransaction(pool, async (client) => {
    const scope = `learner.create:${householdKey}`;
    const replay = await readIdempotency<LearnerProfile>(
      client,
      actor,
      scope,
      payload.idempotency_key,
      requestFingerprint,
    );
    if (replay) return replay;

    await lockHousehold(client, actor, householdKey);
    const count = await activeLearnerCount(client, actor, householdKey);
    if (count >= MAX_ACTIVE_LEARNERS) {
      throw new PortalServiceError(
        'LEARNER_LIMIT_REACHED',
        'A household can have at most three active learners in V1.',
      );
    }

    const learnerKey = `learner_${randomUUID()}`;
    const accessStateKey = `student_access_${randomUUID()}`;
    const inserted = await client.query(
      `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name, hebrew_name, grade_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING learner_key, household_key, display_name, hebrew_name, grade_label,
                 learner_status, version, created_at, updated_at`,
      [
        learnerKey,
        actor.account_key,
        actor.product_key,
        householdKey,
        payload.display_name,
        payload.hebrew_name ?? null,
        payload.grade_label ?? null,
      ],
    );
    await client.query(
      `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, status)
       VALUES ($1,$2,$3,$4,$5,'not_configured')`,
      [accessStateKey, actor.account_key, actor.product_key, householdKey, learnerKey],
    );
    const learner = mapLearner(inserted.rows[0] as Record<string, unknown>);
    await writeIdempotency(
      client,
      actor,
      scope,
      payload.idempotency_key,
      requestFingerprint,
      learner,
    );
    await recordAudit(client, {
      action_type: 'learner_created',
      actor,
      household_key: householdKey,
      learner_key: learnerKey,
    });
    return learner;
  });
}

async function updateLearner(
  pool: DbPool,
  actor: PortalActorContext,
  householdKey: string,
  learnerKey: string,
  payload: UpdateLearnerPayload,
  requestFingerprint: string,
) {
  return inTransaction(pool, async (client) => {
    const scope = `learner.update:${learnerKey}`;
    const replay = await readIdempotency<LearnerProfile>(
      client,
      actor,
      scope,
      payload.idempotency_key,
      requestFingerprint,
    );
    if (replay) return replay;
    const current = await lockLearner(client, actor, householdKey, learnerKey);
    if (Number(current.version) !== payload.version) {
      throw new PortalServiceError(
        'VERSION_CONFLICT',
        'This learner changed in another session.',
        Number(current.version),
      );
    }
    const nextDisplayName = payload.display_name ?? String(current.display_name);
    const nextHebrewName =
      payload.hebrew_name === undefined ? nullableString(current.hebrew_name) : payload.hebrew_name;
    const nextGradeLabel =
      payload.grade_label === undefined ? nullableString(current.grade_label) : payload.grade_label;
    const updated = await client.query(
      `UPDATE onetime.portal_learners
          SET display_name = $5,
              hebrew_name = $6,
              grade_label = $7,
              version = version + 1,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = $3
          AND learner_key = $4
        RETURNING learner_key, household_key, display_name, hebrew_name, grade_label,
                  learner_status, version, created_at, updated_at`,
      [
        actor.account_key,
        actor.product_key,
        householdKey,
        learnerKey,
        nextDisplayName,
        nextHebrewName,
        nextGradeLabel,
      ],
    );
    const learner = mapLearner(updated.rows[0] as Record<string, unknown>);
    await writeIdempotency(
      client,
      actor,
      scope,
      payload.idempotency_key,
      requestFingerprint,
      learner,
    );
    await recordAudit(client, {
      action_type: 'learner_updated',
      actor,
      household_key: householdKey,
      learner_key: learnerKey,
    });
    return learner;
  });
}

async function setLearnerStatus(
  pool: DbPool,
  args: {
    actor: PortalActorContext;
    householdKey: string;
    learnerKey: string;
    status: 'active' | 'archived' | 'suspended';
    version: number;
    idempotencyKey: string;
    requestFingerprint: string;
  },
) {
  return inTransaction(pool, async (client) => {
    const scope = `learner.status:${args.learnerKey}:${args.status}`;
    const replay = await readIdempotency<LearnerProfile>(
      client,
      args.actor,
      scope,
      args.idempotencyKey,
      args.requestFingerprint,
    );
    if (replay) return replay;
    await lockHousehold(client, args.actor, args.householdKey);
    const current = await lockLearner(client, args.actor, args.householdKey, args.learnerKey);
    if (Number(current.version) !== args.version) {
      throw new PortalServiceError(
        'VERSION_CONFLICT',
        'This learner changed in another session.',
        Number(current.version),
      );
    }
    if (args.status === 'active' && String(current.learner_status) !== 'active') {
      const count = await activeLearnerCount(client, args.actor, args.householdKey);
      if (count >= MAX_ACTIVE_LEARNERS) {
        throw new PortalServiceError(
          'LEARNER_LIMIT_REACHED',
          'A household can have at most three active learners in V1.',
        );
      }
    }
    const updated = await client.query(
      `UPDATE onetime.portal_learners
          SET learner_status = $5,
              archived_at = CASE WHEN $5 = 'archived' THEN now() ELSE NULL END,
              suspended_at = CASE WHEN $5 = 'suspended' THEN now() ELSE NULL END,
              version = version + 1,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = $3
          AND learner_key = $4
        RETURNING learner_key, household_key, display_name, hebrew_name, grade_label,
                  learner_status, version, created_at, updated_at`,
      [
        args.actor.account_key,
        args.actor.product_key,
        args.householdKey,
        args.learnerKey,
        args.status,
      ],
    );
    if (args.status !== 'active') {
      await client.query(
        `UPDATE onetime.portal_student_access_state
            SET status = CASE WHEN $5 = 'suspended' THEN 'suspended' ELSE 'disabled' END,
                last_operation_type = CASE WHEN $5 = 'suspended' THEN 'suspend' ELSE last_operation_type END,
                last_operation_at = now(),
                version = version + 1,
                updated_at = now()
          WHERE account_key = $1
            AND product_key = $2
            AND household_key = $3
            AND learner_key = $4`,
        [
          args.actor.account_key,
          args.actor.product_key,
          args.householdKey,
          args.learnerKey,
          args.status,
        ],
      );
    }
    const learner = mapLearner(updated.rows[0] as Record<string, unknown>);
    await writeIdempotency(
      client,
      args.actor,
      scope,
      args.idempotencyKey,
      args.requestFingerprint,
      learner,
    );
    await recordAudit(client, {
      action_type: `learner_${args.status}`,
      actor: args.actor,
      household_key: args.householdKey,
      learner_key: args.learnerKey,
    });
    return learner;
  });
}

async function getStudentAccessState(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  learnerKey: string,
): Promise<StudentAccessState> {
  const result = await target.query(
    `SELECT access_state_key, learner_key, status, student_user_ref,
            last_operation_type, last_operation_at, version
       FROM onetime.portal_student_access_state
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
      ORDER BY created_at DESC
      LIMIT 1`,
    [actor.account_key, actor.product_key, learnerKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return {
      access_state_key: `student_access_missing_${learnerKey}`,
      learner_key: learnerKey,
      status: 'not_configured',
      student_user_ref: null,
      last_operation_type: null,
      last_operation_at: null,
      version: 1,
    };
  }
  return mapStudentAccess(row);
}

async function recordStudentAccessOperation(
  pool: DbPool,
  args: {
    actor: PortalActorContext;
    learnerKey: string;
    operationType: StudentAccessOperationType;
    idempotencyKey: string;
    requestFingerprint: string;
    adapterResult: CredentialLifecycleResult;
  },
) {
  return inTransaction(pool, async (client) => {
    const scope = `student-access.${args.operationType}:${args.learnerKey}`;
    const replay = await readIdempotency<StudentAccessState>(
      client,
      args.actor,
      scope,
      args.idempotencyKey,
      args.requestFingerprint,
    );
    if (replay) return replay;
    const learner = await findLearnerForUpdate(client, args.actor, args.learnerKey);
    if (!learner) {
      throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
    }
    await client.query(
      `INSERT INTO onetime.portal_student_access_operations
       (operation_key, account_key, product_key, household_key, learner_key, operation_type,
        requested_by_user_ref, adapter_operation_ref_digest, proof_digest, proof_expires_at,
        idempotency_key, request_hash, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        `student_access_op_${randomUUID()}`,
        args.actor.account_key,
        args.actor.product_key,
        String(learner.household_key),
        args.learnerKey,
        args.operationType,
        args.actor.actor_user_ref,
        digest(args.adapterResult.operation_ref),
        args.adapterResult.operation_ref
          ? digest(`proof:${args.adapterResult.operation_ref}`)
          : null,
        args.adapterResult.expires_at,
        args.idempotencyKey,
        args.requestFingerprint,
        args.adapterResult.status,
      ],
    );
    const updated = await client.query(
      `UPDATE onetime.portal_student_access_state
          SET status = $5,
              last_operation_type = $6,
              last_operation_at = now(),
              version = version + 1,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = $3
          AND learner_key = $4
        RETURNING access_state_key, learner_key, status, student_user_ref,
                  last_operation_type, last_operation_at, version`,
      [
        args.actor.account_key,
        args.actor.product_key,
        String(learner.household_key),
        args.learnerKey,
        args.adapterResult.status,
        args.operationType,
      ],
    );
    const state = mapStudentAccess(updated.rows[0] as Record<string, unknown>);
    await writeIdempotency(
      client,
      args.actor,
      scope,
      args.idempotencyKey,
      args.requestFingerprint,
      state,
    );
    return state;
  });
}

async function listUpdates(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  learnerKey: string,
  audience: 'parent' | 'student',
): Promise<AdministrativeUpdate[]> {
  const result = await target.query(
    `SELECT updates.update_key, updates.learner_key, updates.audience, updates.title,
            updates.body, updates.published_at, read_state.read_at
       FROM onetime.portal_administrative_updates AS updates
       LEFT JOIN onetime.portal_update_read_state AS read_state
         ON read_state.account_key = updates.account_key
        AND read_state.product_key = updates.product_key
        AND read_state.update_key = updates.update_key
        AND read_state.actor_user_ref = $4
      WHERE updates.account_key = $1
        AND updates.product_key = $2
        AND updates.learner_key = $3
        AND updates.status = 'published'
        AND updates.audience IN ($5, 'both')
      ORDER BY updates.published_at DESC NULLS LAST, updates.created_at DESC
      LIMIT 20`,
    [actor.account_key, actor.product_key, learnerKey, actor.actor_user_ref, audience],
  );
  return result.rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      update_key: String(record.update_key),
      learner_key: String(record.learner_key),
      audience: record.audience as 'parent' | 'student' | 'both',
      title: String(record.title),
      body: String(record.body),
      published_at: toNullableIso(record.published_at),
      read_at: toNullableIso(record.read_at),
    };
  });
}

async function getRewardBalance(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  learnerKey: string,
): Promise<RewardBalance> {
  const result = await target.query(
    `SELECT COALESCE(sum(points_delta), 0)::int AS balance, count(*)::int AS event_count
       FROM onetime.portal_reward_events
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3`,
    [actor.account_key, actor.product_key, learnerKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return {
    learner_key: learnerKey,
    balance: Number(row?.balance ?? 0),
    event_count: Number(row?.event_count ?? 0),
  };
}

async function listRewardEvents(
  target: DbPool | Queryable,
  actor: PortalActorContext,
  learnerKey: string,
  limit = 20,
): Promise<RewardEvent[]> {
  const result = await target.query(
    `SELECT reward_event_key, learner_key, points_delta, reason_code, reason_label,
            actor_ref, source_type, correction_of_event_key, occurred_at
       FROM onetime.portal_reward_events
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
      ORDER BY occurred_at DESC, reward_event_key DESC
      LIMIT $4`,
    [actor.account_key, actor.product_key, learnerKey, limit],
  );
  return result.rows.map((row) => mapRewardEvent(row as Record<string, unknown>));
}

async function addRewardEvent(
  pool: DbPool,
  actor: PortalActorContext,
  input: RewardWriteInput,
  sourceType: 'admin' | 'parent_capability' | 'system',
  requestFingerprint: string,
) {
  return inTransaction(pool, async (client) => {
    const scope = `reward.add:${input.learner_key}`;
    const replay = await readIdempotency<RewardEvent>(
      client,
      actor,
      scope,
      input.idempotency_key,
      requestFingerprint,
    );
    if (replay) return replay;
    const learner = await findLearnerForUpdate(client, actor, input.learner_key);
    if (!learner) {
      throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
    }
    assertActorCanAccessLearner(actor, learner);
    const inserted = await client.query(
      `INSERT INTO onetime.portal_reward_events
       (reward_event_key, account_key, product_key, household_key, learner_key,
        points_delta, reason_code, reason_label, actor_ref, source_type,
        correction_of_event_key, idempotency_key, request_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING reward_event_key, learner_key, points_delta, reason_code, reason_label,
                 actor_ref, source_type, correction_of_event_key, occurred_at`,
      [
        `reward_${randomUUID()}`,
        actor.account_key,
        actor.product_key,
        String(learner.household_key),
        input.learner_key,
        input.points_delta,
        input.reason_code,
        input.reason_label,
        actor.actor_user_ref,
        sourceType,
        input.correction_of_event_key ?? null,
        input.idempotency_key,
        requestFingerprint,
      ],
    );
    const event = mapRewardEvent(inserted.rows[0] as Record<string, unknown>);
    await writeIdempotency(client, actor, scope, input.idempotency_key, requestFingerprint, event);
    await recordAudit(client, {
      action_type: 'reward_event_added',
      actor,
      household_key: String(learner.household_key),
      learner_key: input.learner_key,
      metadata: { reward_event_key: event.reward_event_key, points_delta: input.points_delta },
    });
    return event;
  });
}

async function lockHousehold(client: Queryable, actor: PortalActorContext, householdKey: string) {
  const result = await client.query(
    `SELECT household_key
       FROM onetime.portal_households
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND status = 'active'
      FOR UPDATE`,
    [actor.account_key, actor.product_key, householdKey],
  );
  if (!result.rowCount) {
    throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
  }
}

async function lockLearner(
  client: Queryable,
  actor: PortalActorContext,
  householdKey: string,
  learnerKey: string,
) {
  const result = await client.query(
    `SELECT learner_key, household_key, display_name, hebrew_name, grade_label,
            learner_status, version, created_at, updated_at
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND learner_key = $4
      FOR UPDATE`,
    [actor.account_key, actor.product_key, householdKey, learnerKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
  }
  return row;
}

async function findLearnerForUpdate(
  client: Queryable,
  actor: PortalActorContext,
  learnerKey: string,
) {
  const result = await client.query(
    `SELECT learner_key, household_key, learner_status
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
      FOR UPDATE`,
    [actor.account_key, actor.product_key, learnerKey],
  );
  return result.rows[0] as Record<string, unknown> | undefined;
}

async function activeLearnerCount(
  client: Queryable,
  actor: PortalActorContext,
  householdKey: string,
) {
  const result = await client.query(
    `SELECT count(*)::int AS count
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND learner_status = 'active'`,
    [actor.account_key, actor.product_key, householdKey],
  );
  return Number((result.rows[0] as Record<string, unknown> | undefined)?.count ?? 0);
}

async function readIdempotency<T>(
  client: Queryable,
  actor: PortalActorContext,
  operationScope: string,
  idempotencyKey: string,
  requestHash: string,
) {
  const existing = await client.query(
    `SELECT request_hash, response_json
       FROM onetime.portal_mutation_idempotency_records
      WHERE account_key = $1
        AND product_key = $2
        AND actor_user_ref = $3
        AND operation_scope = $4
        AND idempotency_key = $5
      FOR UPDATE`,
    [actor.account_key, actor.product_key, actor.actor_user_ref, operationScope, idempotencyKey],
  );
  const row = existing.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  if (String(row.request_hash) !== requestHash) {
    throw new PortalServiceError(
      'IDEMPOTENCY_CONFLICT',
      'This request key was already used for different information.',
    );
  }
  return row.response_json as T;
}

async function writeIdempotency(
  client: Queryable,
  actor: PortalActorContext,
  operationScope: string,
  idempotencyKey: string,
  requestHash: string,
  response: unknown,
) {
  await client.query(
    `INSERT INTO onetime.portal_mutation_idempotency_records
     (account_key, product_key, actor_user_ref, operation_scope, idempotency_key, request_hash, response_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (account_key, product_key, actor_user_ref, operation_scope, idempotency_key)
     DO NOTHING`,
    [
      actor.account_key,
      actor.product_key,
      actor.actor_user_ref,
      operationScope,
      idempotencyKey,
      requestHash,
      JSON.stringify(response),
    ],
  );
}

async function recordAudit(target: DbPool | Queryable, record: PortalAuditRecord) {
  await target.query(
    `INSERT INTO onetime.portal_audit_actions
     (audit_key, account_key, product_key, actor_user_ref, actor_role, household_key,
      learner_key, action_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      `portal_audit_${randomUUID()}`,
      record.actor.account_key,
      record.actor.product_key,
      record.actor.actor_user_ref,
      record.actor.actor_role,
      record.household_key ?? null,
      record.learner_key ?? null,
      record.action_type,
      JSON.stringify(record.metadata ?? {}),
    ],
  );
}

function mapLearner(row: Record<string, unknown>): LearnerProfile {
  return {
    learner_key: String(row.learner_key),
    household_key: String(row.household_key),
    display_name: String(row.display_name),
    hebrew_name: nullableString(row.hebrew_name),
    grade_label: nullableString(row.grade_label),
    learner_status: row.learner_status as LearnerProfile['learner_status'],
    version: Number(row.version),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function mapStudentAccess(row: Record<string, unknown>): StudentAccessState {
  return {
    access_state_key: String(row.access_state_key),
    learner_key: String(row.learner_key),
    status: row.status as StudentAccessState['status'],
    student_user_ref: nullableString(row.student_user_ref),
    last_operation_type: row.last_operation_type as StudentAccessState['last_operation_type'],
    last_operation_at: toNullableIso(row.last_operation_at),
    version: Number(row.version),
  };
}

function mapRewardEvent(row: Record<string, unknown>): RewardEvent {
  return {
    reward_event_key: String(row.reward_event_key),
    learner_key: String(row.learner_key),
    points_delta: Number(row.points_delta),
    reason_code: String(row.reason_code),
    reason_label: String(row.reason_label),
    actor_ref: String(row.actor_ref),
    source_type: row.source_type as RewardEvent['source_type'],
    correction_of_event_key: nullableString(row.correction_of_event_key),
    occurred_at: toIso(row.occurred_at),
  };
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function toNullableIso(value: unknown) {
  return value ? toIso(value) : null;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function assertActorCanAccessLearner(actor: PortalActorContext, learner: Record<string, unknown>) {
  if (actor.actor_role !== 'parent') return;
  const householdKey = String(learner.household_key);
  const authorized = actor.authorized_households.some(
    (subject) => subject.household_key === householdKey && subject.authority !== 'support_only',
  );
  if (!authorized) {
    throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
  }
}
