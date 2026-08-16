import { createHash } from 'node:crypto';
import {
  PARENT_HOUSEHOLD_ERROR_CODES,
  STANDARD_FAMILY_STUDENT_ALLOWANCE,
  type ParentHouseholdMutationOperation,
  type ParentHouseholdPrincipal,
  type ParentHouseholdRecord,
  type ParentHouseholdRepository,
  type ParentManagedStudent,
} from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import type { DbPool, Queryable } from '../../../../../../../packages/db/src/index.ts';
import { accountAccessRequestHash } from '../../../../../../../packages/domain/src/access/service.ts';
import {
  CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT,
  CONTROLLER_DUAL_ROLE_PROVISIONING_ACTOR,
  CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
  controllerDualRoleAccessIdempotencyKey,
  controllerDualRoleAccessSourceReference,
  controllerDualRoleProvisionAuditKey,
  controllerDualRoleProvisionAuditMetadata,
  controllerDualRoleProvisioningIdentityKeys,
  isControllerDualRoleProvisioningSyntheticTestFixture,
  isControllerDualRoleProvisioningTarget,
} from '../../../../../../../packages/domain/src/accounts/controller-dual-role-provisioning-policy.ts';
import { ParentHouseholdError } from '../../../../../../../packages/domain/src/portals/parent-household/index.ts';

type Row = Record<string, unknown>;
type Scope = {
  product: 'one_time_mishnayos';
  runtimeTier: 'isolated_staging' | 'production';
  verificationEnvironmentId:
    | 'ci'
    | 'provider_sandbox'
    | 'persistent_staging'
    | 'production_read_only'
    | 'production_operator_canary'
    | 'production_broad';
  ownerHumanAccountId: string;
  seatLimit: number;
};
type PortalAccessSourceKind = 'free_pilot' | 'admin_override' | 'legacy_preview';

export type ParentHouseholdPostgresOptions = {
  acceptedServiceAccountVersion: string;
  immutableEvidenceReference: string;
  portalAccountKey: string;
  portalProductKey: string;
  clock?: () => Date;
};

const SHA256 = /^[0-9a-f]{64}$/u;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,63}$/u;
const ARGON2ID = /^argon2id-v1\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/u;

export function createPostgresParentHouseholdRepository(
  pool: DbPool,
  options: ParentHouseholdPostgresOptions,
): ParentHouseholdRepository {
  const clock = options.clock ?? (() => new Date());
  assertOption(options.acceptedServiceAccountVersion, 'service-account policy version');
  assertOption(options.immutableEvidenceReference, 'service-account evidence reference');
  assertOption(options.portalAccountKey, 'portal account key');
  assertOption(options.portalProductKey, 'portal product key');

  return {
    async loadOwnedHousehold(principal) {
      const loaded = await loadOwnedHousehold(pool, principal, clock(), false);
      return loaded?.record ?? null;
    },

    async isUsernameAvailable(input) {
      const loaded = await loadOwnedHousehold(pool, input.principal, clock(), false);
      if (!loaded) return false;
      const normalized = normalizedUsername(input.username);
      const result = await pool.query(
        `SELECT student_id
           FROM onetime.v21_student_profiles
          WHERE product_key = $1
            AND runtime_tier = $2
            AND verification_environment_id = $3
            AND normalized_username = $4
            AND ($5::text IS NULL OR student_id <> $5)
          LIMIT 1`,
        [
          loaded.scope.product,
          loaded.scope.runtimeTier,
          loaded.scope.verificationEnvironmentId,
          normalized,
          input.except_student_id ?? null,
        ],
      );
      if ((result.rowCount ?? 0) !== 0) return false;
      const projected = await pool.query(
        `SELECT learner_key
           FROM onetime.portal_student_access_state
          WHERE account_key = $1
            AND product_key = $2
            AND normalized_username = $3
            AND status <> 'disabled'
            AND ($4::text IS NULL OR learner_key <> $4)
          LIMIT 1`,
        [
          options.portalAccountKey,
          options.portalProductKey,
          normalized,
          input.except_student_id ?? null,
        ],
      );
      return (projected.rowCount ?? 0) === 0;
    },

    async findMutation(input) {
      assertContext(input.context);
      const loaded = await loadOwnedHousehold(pool, input.principal, clock(), false);
      if (!loaded) return null;
      return findReceipt(pool, loaded.scope, input.operation, input.context);
    },

    async commitMutation(input) {
      assertContext(input.context);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await advisoryLock(
          client,
          `${input.principal.household_id}:${input.context.idempotency_key}`,
        );
        const loaded = await loadOwnedHousehold(client, input.principal, clock(), true);
        if (!loaded) unavailable();
        if (loaded.scope.verificationEnvironmentId === 'production_read_only') {
          throw invariant('Parent household mutations are disabled in production_read_only.');
        }
        if (loaded.record.access_state === 'inactive') {
          throw new ParentHouseholdError(
            PARENT_HOUSEHOLD_ERROR_CODES.accessInactive,
            'Student management is unavailable while household access is inactive.',
          );
        }

        const replay = await findReceipt(
          client,
          loaded.scope,
          input.audit.action,
          input.context,
          true,
        );
        if (replay) {
          await client.query('COMMIT');
          return replay;
        }

        validateMutation(input, loaded.record, loaded.scope);
        await resolvePortalHouseholdAccessSource(
          client,
          loaded,
          input.context.occurred_at,
          options,
        );
        const target = requiredTarget(input.next, input.audit.student_id);
        const current = loaded.record.students.find(
          (student) => student.student_id === input.audit.student_id,
        );
        await assertUsernameAvailable(
          client,
          loaded.scope,
          options,
          target.username,
          target.student_id,
        );
        const passwordHash = input.password_hash_factory
          ? await input.password_hash_factory()
          : null;
        validatePasswordHash(passwordHash);

        const auditId = stableId('parent_audit', input.context.idempotency_key);
        const acceptanceId = stableId(
          'service_acceptance',
          input.principal.household_id,
          target.student_id,
          options.acceptedServiceAccountVersion,
        );
        const enrollmentId = stableId('student_enrollment', target.student_id);

        if (input.audit.action === 'student_created') {
          await insertStudent(client, loaded, target, passwordHash!, input.context.occurred_at);
          await insertServiceAcceptance(client, {
            loaded,
            target,
            acceptanceId,
            context: input.context,
            options,
          });
          await insertEnrollment(client, {
            loaded,
            target,
            enrollmentId,
            acceptanceId,
            occurredAt: input.context.occurred_at,
            options,
          });
        } else {
          await updateStudent(client, loaded, current!, target, input, passwordHash);
          if (input.canonical_enrollment !== 'unchanged') {
            await transitionEnrollment(client, {
              loaded,
              target,
              enrollmentId,
              state: input.canonical_enrollment === 'enroll' ? 'active' : 'revoked',
              occurredAt: input.context.occurred_at,
              options,
            });
          }
        }

        await synchronizePortalStudentProjection(
          client,
          loaded,
          target,
          input,
          passwordHash,
          options,
        );

        await insertAudit(client, loaded, input, auditId);
        const readbackId = input.revoke_student_sessions
          ? await revokeStudentAccess(client, loaded, target, enrollmentId, auditId, input)
          : null;

        if (passwordHash) {
          await insertCredentialEvidence(client, {
            loaded,
            target,
            passwordHash,
            kind: input.audit.action === 'student_created' ? 'initial_activation' : 'reset',
            readbackId,
            context: input.context,
          });
        }

        const activeSeatCount = activeDependentSeatCount(input.next.students);
        const householdUpdate = await client.query(
          `UPDATE onetime.v21_households
              SET active_seat_count = $1,
                  version = version + 1,
                  updated_at = $2
            WHERE household_id = $3
              AND owner_adult_id = $4
              AND product_key = $5
              AND runtime_tier = $6
              AND verification_environment_id = $7
              AND version = $8`,
          [
            activeSeatCount,
            input.context.occurred_at,
            input.principal.household_id,
            input.principal.adult_id,
            loaded.scope.product,
            loaded.scope.runtimeTier,
            loaded.scope.verificationEnvironmentId,
            input.expected_revision,
          ],
        );
        if (householdUpdate.rowCount !== 1) conflict();

        await insertReceipt(client, loaded.scope, input);
        await client.query('COMMIT');
        return {
          disposition: 'committed',
          operation: input.audit.action,
          student_id: target.student_id,
          household_revision: input.next.revision,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw translatePostgresError(error);
      } finally {
        client.release();
      }
    },
  };
}

async function loadOwnedHousehold(
  db: Queryable,
  principal: ParentHouseholdPrincipal,
  now: Date,
  forUpdate: boolean,
): Promise<{ record: ParentHouseholdRecord; scope: Scope } | null> {
  const result = await db.query(
    `SELECT household.household_id,
            household.owner_adult_id,
            household.owner_human_account_id,
            household.classification,
            household.seat_limit,
            household.version,
            household.product_key,
            household.runtime_tier,
            household.verification_environment_id,
            adult.display_name AS owner_display_name,
            access.current_state AS access_state
       FROM onetime.v21_households AS household
       JOIN onetime.v21_adult_identities AS adult
         ON adult.adult_id = household.owner_adult_id
        AND adult.product_key = household.product_key
        AND adult.runtime_tier = household.runtime_tier
        AND adult.verification_environment_id = household.verification_environment_id
        AND adult.state = 'active'
       JOIN onetime.v21_human_accounts AS account
         ON account.human_account_id = household.owner_human_account_id
        AND account.adult_id = adult.adult_id
        AND account.product_key = household.product_key
        AND account.runtime_tier = household.runtime_tier
        AND account.verification_environment_id = household.verification_environment_id
        AND account.state = 'active'
       JOIN onetime.v21_human_account_role_memberships AS membership
         ON membership.human_account_id = account.human_account_id
        AND membership.role = 'parent'
        AND membership.revoked_at IS NULL
        AND membership.product_key = household.product_key
        AND membership.runtime_tier = household.runtime_tier
        AND membership.verification_environment_id = household.verification_environment_id
       JOIN onetime.v21_adult_sessions AS session
         ON session.session_id = $3
        AND session.human_account_id = account.human_account_id
        AND session.active_role = 'parent'
        AND session.active_household_id = household.household_id
        AND session.product_key = household.product_key
        AND session.runtime_tier = household.runtime_tier
        AND session.verification_environment_id = household.verification_environment_id
        AND session.security_version = account.security_version
        AND session.revoked_at IS NULL
        AND session.idle_expires_at > $4
        AND session.absolute_expires_at > $4
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = household.household_id
        AND access.product_key = household.product_key
        AND access.runtime_tier = household.runtime_tier
        AND access.verification_environment_id = household.verification_environment_id
        AND access.current_state IN ('free', 'active', 'grace', 'inactive')
        AND access.archived_at IS NULL
      WHERE household.household_id = $1
        AND household.owner_adult_id = $2
        AND household.classification = 'family'
        AND household.state = 'active'
      LIMIT 1
      ${forUpdate ? 'FOR UPDATE' : ''}`,
    [principal.household_id, principal.adult_id, principal.session_id, now.toISOString()],
  );
  if (result.rowCount !== 1) return null;
  const row = result.rows[0] as Row;
  const scope: Scope = {
    product: exact(row.product_key, ['one_time_mishnayos']),
    runtimeTier: exact(row.runtime_tier, ['isolated_staging', 'production']),
    verificationEnvironmentId: exact(row.verification_environment_id, [
      'ci',
      'provider_sandbox',
      'persistent_staging',
      'production_read_only',
      'production_operator_canary',
      'production_broad',
    ]),
    ownerHumanAccountId: text(row.owner_human_account_id, 'owner HumanAccount'),
    seatLimit: integer(row.seat_limit, 'seat limit'),
  };
  const students = await db.query(
    `SELECT student_id, household_id, actual_name, display_name, username,
            relationship, state, credential_version, version
       FROM onetime.v21_student_profiles
      WHERE household_id = $1
        AND product_key = $2
        AND runtime_tier = $3
        AND verification_environment_id = $4
      ORDER BY created_at, student_id
      ${forUpdate ? 'FOR UPDATE' : ''}`,
    [principal.household_id, scope.product, scope.runtimeTier, scope.verificationEnvironmentId],
  );
  const classification = exact(row.classification, ['family']);
  return {
    scope,
    record: {
      household_id: text(row.household_id, 'household'),
      owner_adult_id: text(row.owner_adult_id, 'owner adult'),
      display_name: `${text(row.owner_display_name, 'owner display name')} ${classification === 'family' ? 'household' : 'school'}`,
      access_state: exact(row.access_state, ['free', 'active', 'grace', 'inactive']),
      student_allowance: Math.min(STANDARD_FAMILY_STUDENT_ALLOWANCE, scope.seatLimit),
      revision: integer(row.version, 'household revision'),
      students: students.rows.map(studentFromRow),
    },
  };
}

function studentFromRow(row: Row): ParentManagedStudent {
  return {
    student_id: text(row.student_id, 'Student'),
    household_id: text(row.household_id, 'Student household'),
    actual_name: text(row.actual_name, 'actual name'),
    display_name: nullableText(row.display_name),
    username: text(row.username, 'username'),
    relationship: exact(row.relationship, ['self', 'dependent']),
    state: exact(row.state, ['active', 'archived']),
    credential_version: integer(row.credential_version, 'credential version'),
    version: integer(row.version, 'Student version'),
  };
}

async function findReceipt(
  db: Queryable,
  scope: Scope,
  operation: ParentHouseholdMutationOperation,
  context: { idempotency_key: string; canonical_request_hash: string },
  forUpdate = false,
) {
  const result = await db.query(
    `SELECT request_hash, operation, result_ref, result_version
       FROM onetime.admin_directory_receipts
      WHERE product_key = $1
        AND runtime_tier = $2
        AND verification_environment_id = $3
        AND idempotency_key = $4
      ${forUpdate ? 'FOR UPDATE' : ''}`,
    [scope.product, scope.runtimeTier, scope.verificationEnvironmentId, context.idempotency_key],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  if (result.rowCount !== 1) throw invariant('The idempotency key resolved ambiguously.');
  const row = result.rows[0] as Row;
  const expectedOperation = directoryOperation(operation);
  const resultRef = text(row.result_ref, 'mutation result reference');
  const prefix = `${operation}:`;
  if (
    row.request_hash !== context.canonical_request_hash ||
    row.operation !== expectedOperation ||
    !resultRef.startsWith(prefix)
  ) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.idempotencyConflict,
      'This idempotency key was already used for another request.',
    );
  }
  return {
    disposition: 'replayed' as const,
    operation,
    student_id: resultRef.slice(prefix.length),
    household_revision: integer(row.result_version, 'receipt result version'),
  };
}

function validateMutation(
  input: Parameters<ParentHouseholdRepository['commitMutation']>[0],
  current: ParentHouseholdRecord,
  scope: Scope,
) {
  if (
    input.principal.role !== 'parent' ||
    input.audit.actor_adult_id !== input.principal.adult_id ||
    input.audit.household_id !== input.principal.household_id ||
    input.next.household_id !== current.household_id ||
    input.next.owner_adult_id !== current.owner_adult_id ||
    input.expected_revision !== current.revision ||
    input.next.revision !== current.revision + 1
  ) {
    conflict();
  }
  if (current.access_state === 'inactive') {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.accessInactive,
      'Student management is unavailable while household access is inactive.',
    );
  }
  const target = requiredTarget(input.next, input.audit.student_id);
  const previous = current.students.find((student) => student.student_id === target.student_id);
  const activeSeats = activeDependentSeatCount(input.next.students);
  if (
    activeSeats > STANDARD_FAMILY_STUDENT_ALLOWANCE ||
    activeSeats > scope.seatLimit ||
    input.next.students.some((student) => student.household_id !== current.household_id)
  ) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.seatLimit,
      'This household already uses all three active Student seats.',
    );
  }
  validateStudent(target);
  assertOnlyTargetChanged(current.students, input.next.students, target.student_id);

  switch (input.audit.action) {
    case 'student_created':
      if (
        previous ||
        target.relationship !== 'dependent' ||
        target.state !== 'active' ||
        input.next.students.length !== current.students.length + 1 ||
        activeSeats !== activeDependentSeatCount(current.students) + 1 ||
        !input.password_hash_factory ||
        input.revoke_student_sessions ||
        input.canonical_enrollment !== 'enroll'
      ) {
        throw invariant('The Student-create mutation is inconsistent.');
      }
      break;
    case 'student_profile_updated':
      if (
        !previous ||
        target.state !== previous.state ||
        input.next.students.length !== current.students.length ||
        input.password_hash_factory !== null ||
        input.canonical_enrollment !== 'unchanged' ||
        input.revoke_student_sessions !== (target.username !== previous.username)
      ) {
        throw invariant('The Student-profile mutation is inconsistent.');
      }
      break;
    case 'student_archived':
      if (
        !previous ||
        previous.state !== 'active' ||
        target.state !== 'archived' ||
        input.password_hash_factory !== null ||
        !input.revoke_student_sessions ||
        input.canonical_enrollment !== 'disable'
      ) {
        throw invariant('The Student-archive mutation is inconsistent.');
      }
      break;
    case 'student_restored':
      if (
        !previous ||
        previous.state !== 'archived' ||
        target.state !== 'active' ||
        input.password_hash_factory !== null ||
        input.revoke_student_sessions ||
        input.canonical_enrollment !== 'enroll'
      ) {
        throw invariant('The Student-restore mutation is inconsistent.');
      }
      break;
    case 'student_credential_reset':
      if (
        !previous ||
        previous.state !== 'active' ||
        target.state !== 'active' ||
        !input.password_hash_factory ||
        !input.revoke_student_sessions ||
        input.canonical_enrollment !== 'unchanged'
      ) {
        throw invariant('The Student-credential mutation is inconsistent.');
      }
      break;
  }
}

function activeDependentSeatCount(students: readonly ParentManagedStudent[]) {
  return students.filter(
    (student) => student.state === 'active' && student.relationship === 'dependent',
  ).length;
}

function validatePasswordHash(passwordHash: string | null) {
  if (passwordHash !== null && !ARGON2ID.test(passwordHash)) {
    throw invariant('The replacement credential hash violates the Argon2id policy.');
  }
}

function assertOnlyTargetChanged(
  current: readonly ParentManagedStudent[],
  next: readonly ParentManagedStudent[],
  targetId: string,
) {
  const nextById = new Map(next.map((student) => [student.student_id, student]));
  for (const student of current) {
    if (student.student_id === targetId) continue;
    if (JSON.stringify(nextById.get(student.student_id)) !== JSON.stringify(student)) {
      throw invariant('A Parent mutation attempted to alter another Student.');
    }
  }
}

function validateStudent(student: ParentManagedStudent) {
  if (
    !unicodeNonblank(student.actual_name) ||
    student.actual_name.length > 100 ||
    (student.display_name !== null &&
      (!unicodeNonblank(student.display_name) || student.display_name.length > 100)) ||
    normalizedUsername(student.username) !== student.username ||
    student.version < 1 ||
    student.credential_version < 1
  ) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.invalidInput,
      'The Student profile is invalid.',
    );
  }
}

async function assertUsernameAvailable(
  db: Queryable,
  scope: Scope,
  options: ParentHouseholdPostgresOptions,
  username: string,
  studentId: string,
) {
  const result = await db.query(
    `SELECT student_id
       FROM onetime.v21_student_profiles
      WHERE product_key = $1
        AND runtime_tier = $2
        AND verification_environment_id = $3
        AND normalized_username = $4
        AND student_id <> $5
      LIMIT 1
      FOR UPDATE`,
    [scope.product, scope.runtimeTier, scope.verificationEnvironmentId, username, studentId],
  );
  if ((result.rowCount ?? 0) > 0) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.usernameUnavailable,
      'Choose another Student username.',
    );
  }
  const projected = await db.query(
    `SELECT learner_key
       FROM onetime.portal_student_access_state
      WHERE account_key = $1
        AND product_key = $2
        AND normalized_username = $3
        AND learner_key <> $4
        AND status <> 'disabled'
      LIMIT 1
      FOR UPDATE`,
    [options.portalAccountKey, options.portalProductKey, username, studentId],
  );
  if ((projected.rowCount ?? 0) > 0) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.usernameUnavailable,
      'Choose another Student username.',
    );
  }
}

async function insertStudent(
  db: Queryable,
  loaded: { record: ParentHouseholdRecord; scope: Scope },
  target: ParentManagedStudent,
  passwordHash: string,
  occurredAt: string,
) {
  const result = await db.query(
    `INSERT INTO onetime.v21_student_profiles
       (student_id, household_id, relationship, self_adult_id, actual_name, display_name,
        username, normalized_username, credential_hash, credential_version, credential_state,
        credential_history_ref, relationship_history_ref, state, version,
        product_key, runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,'active',$10,$11,'active',$12,$13,$14,$15,$16,$16)`,
    [
      target.student_id,
      loaded.record.household_id,
      target.relationship,
      target.relationship === 'self' ? loaded.record.owner_adult_id : null,
      target.actual_name,
      target.display_name,
      target.username,
      passwordHash,
      target.credential_version,
      `credential:${target.student_id}`,
      `relationship:${target.student_id}`,
      target.version,
      loaded.scope.product,
      loaded.scope.runtimeTier,
      loaded.scope.verificationEnvironmentId,
      occurredAt,
    ],
  );
  if (result.rowCount !== 1) throw invariant('The Student insert did not commit exactly once.');
}

async function updateStudent(
  db: Queryable,
  loaded: { record: ParentHouseholdRecord; scope: Scope },
  current: ParentManagedStudent,
  target: ParentManagedStudent,
  input: Parameters<ParentHouseholdRepository['commitMutation']>[0],
  passwordHash: string | null,
) {
  const credentialState = target.state === 'archived' ? 'disabled' : 'active';
  const result = await db.query(
    `UPDATE onetime.v21_student_profiles
        SET actual_name = $1,
            display_name = $2,
            username = $3,
            normalized_username = $3,
            state = $4,
            credential_hash = COALESCE($5, credential_hash),
            credential_version = $6,
            credential_state = $7,
            version = $8,
            updated_at = $9
      WHERE student_id = $10
        AND household_id = $11
        AND product_key = $12
        AND runtime_tier = $13
        AND verification_environment_id = $14
        AND version = $15`,
    [
      target.actual_name,
      target.display_name,
      target.username,
      target.state,
      passwordHash,
      target.credential_version,
      credentialState,
      target.version,
      input.context.occurred_at,
      target.student_id,
      loaded.record.household_id,
      loaded.scope.product,
      loaded.scope.runtimeTier,
      loaded.scope.verificationEnvironmentId,
      current.version,
    ],
  );
  if (result.rowCount !== 1) conflict();
}

async function synchronizePortalStudentProjection(
  db: Queryable,
  loaded: { record: ParentHouseholdRecord; scope: Scope },
  target: ParentManagedStudent,
  input: Parameters<ParentHouseholdRepository['commitMutation']>[0],
  replacementPasswordHash: string | null,
  options: ParentHouseholdPostgresOptions,
) {
  const occurredAt = input.context.occurred_at;
  const accountKey = options.portalAccountKey;
  const productKey = options.portalProductKey;
  const household = await db.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name, status, version,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,'active',$5,$6,$6)
     ON CONFLICT (household_key)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       status = 'active',
       version = onetime.portal_households.version + 1,
       updated_at = EXCLUDED.updated_at
     WHERE onetime.portal_households.account_key = EXCLUDED.account_key
       AND onetime.portal_households.product_key = EXCLUDED.product_key
     RETURNING household_key`,
    [
      loaded.record.household_id,
      accountKey,
      productKey,
      loaded.record.display_name,
      input.next.revision,
      occurredAt,
    ],
  );
  if (household.rowCount !== 1) {
    throw invariant('The portal household projection conflicts with another scope.');
  }

  await ensurePortalHouseholdAccessProjection(db, loaded, input, options);

  const canonicalCredential = await db.query(
    `SELECT credential_hash
       FROM onetime.v21_student_profiles
      WHERE student_id = $1
        AND household_id = $2
        AND product_key = $3
        AND runtime_tier = $4
        AND verification_environment_id = $5
      LIMIT 1
      FOR UPDATE`,
    [
      target.student_id,
      loaded.record.household_id,
      loaded.scope.product,
      loaded.scope.runtimeTier,
      loaded.scope.verificationEnvironmentId,
    ],
  );
  if (canonicalCredential.rowCount !== 1) {
    throw invariant('The canonical Student credential is unavailable for portal projection.');
  }
  const credentialHash = text(
    (canonicalCredential.rows[0] as Row).credential_hash,
    'canonical Student credential hash',
  );
  validatePasswordHash(credentialHash);
  if (replacementPasswordHash !== null && replacementPasswordHash !== credentialHash) {
    throw invariant('The canonical and replacement Student credential hashes disagree.');
  }

  const projectedLinks = await db.query(
    `SELECT user_key
       FROM onetime.account_learner_identity_links
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
      LIMIT 2
      FOR UPDATE`,
    [accountKey, productKey, target.student_id],
  );
  if ((projectedLinks.rowCount ?? 0) > 1) {
    throw invariant('The Student identity link is ambiguous.');
  }
  const projectedAccess = await db.query(
    `SELECT access_state_key, student_user_ref
       FROM onetime.portal_student_access_state
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
      LIMIT 2
      FOR UPDATE`,
    [accountKey, productKey, target.student_id],
  );
  if ((projectedAccess.rowCount ?? 0) > 1) {
    throw invariant('The Student access projection is ambiguous.');
  }
  const linkedUserKey = nullableText((projectedLinks.rows[0] as Row | undefined)?.user_key);
  const accessUserKey = nullableText(
    (projectedAccess.rows[0] as Row | undefined)?.student_user_ref,
  );
  if (linkedUserKey && accessUserKey && linkedUserKey !== accessUserKey) {
    throw invariant('The Student identity projections disagree.');
  }
  const userKey =
    linkedUserKey ??
    accessUserKey ??
    stableId('student_user', accountKey, productKey, target.student_id);
  const accessStateKey =
    nullableText((projectedAccess.rows[0] as Row | undefined)?.access_state_key) ??
    stableId('student_access', accountKey, productKey, target.student_id);
  const archived = target.state === 'archived';
  const displayName = target.display_name ?? target.actual_name;

  const learner = await db.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name,
        learner_status, version, created_at, updated_at, archived_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9)
     ON CONFLICT (learner_key)
     DO UPDATE SET
       household_key = EXCLUDED.household_key,
       display_name = EXCLUDED.display_name,
       learner_status = EXCLUDED.learner_status,
       version = onetime.portal_learners.version + 1,
       updated_at = EXCLUDED.updated_at,
       archived_at = EXCLUDED.archived_at,
       suspended_at = NULL
     WHERE onetime.portal_learners.account_key = EXCLUDED.account_key
       AND onetime.portal_learners.product_key = EXCLUDED.product_key
     RETURNING learner_key`,
    [
      target.student_id,
      accountKey,
      productKey,
      loaded.record.household_id,
      displayName,
      archived ? 'archived' : 'active',
      target.version,
      occurredAt,
      archived ? occurredAt : null,
    ],
  );
  if (learner.rowCount !== 1) {
    throw invariant('The portal learner projection conflicts with another scope.');
  }

  const accountUser = await db.query(
    `INSERT INTO onetime.account_users
       (user_key, account_key, product_key, email_normalized, display_name, role,
        password_hash, password_updated_at, mfa_capable, status, security_version,
        security_policy_updated_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'student',$6,$7,false,$8,$9,$7,$7,$7)
     ON CONFLICT (user_key)
     DO UPDATE SET
       email_normalized = EXCLUDED.email_normalized,
       display_name = EXCLUDED.display_name,
       role = 'student',
       password_hash = EXCLUDED.password_hash,
       password_updated_at = CASE
         WHEN $10::boolean THEN EXCLUDED.password_updated_at
         ELSE onetime.account_users.password_updated_at
       END,
       mfa_capable = false,
       status = EXCLUDED.status,
       security_version = onetime.account_users.security_version +
         CASE WHEN $11::boolean THEN 1 ELSE 0 END,
       security_policy_updated_at = CASE
         WHEN $11::boolean THEN EXCLUDED.security_policy_updated_at
         ELSE onetime.account_users.security_policy_updated_at
       END,
       updated_at = EXCLUDED.updated_at
     WHERE onetime.account_users.account_key = EXCLUDED.account_key
       AND onetime.account_users.product_key = EXCLUDED.product_key
       AND onetime.account_users.role = 'student'
     RETURNING security_version`,
    [
      userKey,
      accountKey,
      productKey,
      `student:${target.username}`,
      displayName,
      credentialHash,
      occurredAt,
      archived ? 'disabled' : 'active',
      target.credential_version,
      replacementPasswordHash !== null,
      input.revoke_student_sessions,
    ],
  );
  if (accountUser.rowCount !== 1) {
    throw invariant('The Student account projection conflicts with another identity.');
  }
  const securityVersion = integer(
    (accountUser.rows[0] as Row).security_version,
    'Student security version',
  );

  if (input.revoke_student_sessions) {
    await db.query(
      `UPDATE onetime.user_sessions
          SET revoked_at = COALESCE(revoked_at, $4)
        WHERE account_key = $1
          AND product_key = $2
          AND user_key = $3
          AND revoked_at IS NULL`,
      [accountKey, productKey, userKey, occurredAt],
    );
  }

  await exactlyOne(
    db,
    `INSERT INTO onetime.account_learner_identity_links
       (link_key, account_key, product_key, household_key, learner_key, user_key,
        link_state, created_at, suspended_at, disabled_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9)
     ON CONFLICT (account_key, product_key, learner_key)
     DO UPDATE SET
       household_key = EXCLUDED.household_key,
       user_key = EXCLUDED.user_key,
       link_state = EXCLUDED.link_state,
       suspended_at = NULL,
       disabled_at = EXCLUDED.disabled_at`,
    [
      stableId('student_link', accountKey, productKey, target.student_id),
      accountKey,
      productKey,
      loaded.record.household_id,
      target.student_id,
      userKey,
      archived ? 'disabled' : 'active',
      occurredAt,
      archived ? occurredAt : null,
    ],
    'Student identity link projection',
  );

  const operation = portalCredentialOperation(input.audit.action);
  await exactlyOne(
    db,
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key,
        student_user_ref, status, last_operation_type, last_operation_at, version,
        created_at, updated_at, username_display, normalized_username,
        password_hash_ref, credential_status, password_version, security_version,
        failed_login_count, rate_limited_until, last_reset_at,
        last_session_revoked_at, last_parent_actor_ref, credential_policy_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $8::text IS NULL THEN NULL ELSE $9::timestamptz END,
             $10,$9,$9,$11,$11,$12,$13,$14,$15,
             0,NULL,$16,$17,$18,'v21-parent-managed-argon2id-v1')
     ON CONFLICT (access_state_key)
     DO UPDATE SET
       household_key = EXCLUDED.household_key,
       learner_key = EXCLUDED.learner_key,
       student_user_ref = EXCLUDED.student_user_ref,
       status = EXCLUDED.status,
       last_operation_type = COALESCE(EXCLUDED.last_operation_type,
                                      onetime.portal_student_access_state.last_operation_type),
       last_operation_at = COALESCE(EXCLUDED.last_operation_at,
                                    onetime.portal_student_access_state.last_operation_at),
       version = onetime.portal_student_access_state.version + 1,
       updated_at = EXCLUDED.updated_at,
       username_display = EXCLUDED.username_display,
       normalized_username = EXCLUDED.normalized_username,
       password_hash_ref = EXCLUDED.password_hash_ref,
       credential_status = EXCLUDED.credential_status,
       password_version = EXCLUDED.password_version,
       security_version = EXCLUDED.security_version,
       failed_login_count = CASE WHEN $19::boolean THEN 0
                                 ELSE onetime.portal_student_access_state.failed_login_count END,
       rate_limited_until = CASE WHEN $19::boolean THEN NULL
                                 ELSE onetime.portal_student_access_state.rate_limited_until END,
       last_reset_at = COALESCE(EXCLUDED.last_reset_at,
                                onetime.portal_student_access_state.last_reset_at),
       last_session_revoked_at = COALESCE(EXCLUDED.last_session_revoked_at,
                                          onetime.portal_student_access_state.last_session_revoked_at),
       last_parent_actor_ref = EXCLUDED.last_parent_actor_ref,
       credential_policy_version = EXCLUDED.credential_policy_version
     WHERE onetime.portal_student_access_state.account_key = EXCLUDED.account_key
       AND onetime.portal_student_access_state.product_key = EXCLUDED.product_key`,
    [
      accessStateKey,
      accountKey,
      productKey,
      loaded.record.household_id,
      target.student_id,
      userKey,
      archived ? 'disabled' : 'active',
      operation,
      occurredAt,
      target.version,
      target.username,
      credentialHash,
      archived ? 'disabled' : 'parent_managed',
      target.credential_version,
      securityVersion,
      input.audit.action === 'student_credential_reset' ? occurredAt : null,
      input.revoke_student_sessions ? occurredAt : null,
      loaded.scope.ownerHumanAccountId,
      input.audit.action === 'student_credential_reset',
    ],
    'Student access projection',
  );
}

async function ensurePortalHouseholdAccessProjection(
  db: Queryable,
  loaded: { record: ParentHouseholdRecord; scope: Scope },
  input: Parameters<ParentHouseholdRepository['commitMutation']>[0],
  options: ParentHouseholdPostgresOptions,
) {
  const current = await db.query(
    `SELECT access_key
       FROM onetime.account_access_projections
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
      LIMIT 2
      FOR UPDATE`,
    [options.portalAccountKey, options.portalProductKey, loaded.record.household_id],
  );
  if (current.rowCount === 1) return;
  if ((current.rowCount ?? 0) > 1) {
    throw invariant('The portal household access projection is ambiguous.');
  }

  const { effectiveAt, expiresAt, sourceKind } = await resolvePortalHouseholdAccessSource(
    db,
    loaded,
    input.context.occurred_at,
    options,
  );

  await exactlyOne(
    db,
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, revocation_reason,
        access_version, last_event_key, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
             'v21-parent-student-compatibility-v1',NULL,1,$13,$11,$11)`,
    [
      stableId(
        'account_access',
        options.portalAccountKey,
        options.portalProductKey,
        loaded.record.household_id,
      ),
      options.portalAccountKey,
      options.portalProductKey,
      loaded.record.household_id,
      loaded.record.access_state === 'free' ? 'active' : loaded.record.access_state,
      sourceKind,
      effectiveAt,
      expiresAt,
      stableId('v21_access_source', loaded.record.household_id),
      input.expected_revision,
      input.context.occurred_at,
      input.context.canonical_request_hash,
      stableId('v21_access_event', input.context.idempotency_key),
    ],
    'portal household access projection',
  );
}

async function resolvePortalHouseholdAccessSource(
  db: Queryable,
  loaded: { record: ParentHouseholdRecord; scope: Scope },
  occurredAt: string,
  options: Pick<ParentHouseholdPostgresOptions, 'portalAccountKey' | 'portalProductKey'>,
) {
  let effectiveAt = occurredAt;
  let expiresAt: string | null = null;
  let sourceKind: PortalAccessSourceKind = 'admin_override';
  if (loaded.record.access_state === 'free' || loaded.record.access_state === 'grace') {
    const provisionedOverride = await resolveActiveControllerDualRoleAccessOverride(
      db,
      loaded,
      occurredAt,
      options,
    );
    if (provisionedOverride) return provisionedOverride;
    const signup = await db.query(
      `SELECT free_access_expires_at, signup_committed_at
         FROM onetime.family_signup_access_projections
        WHERE household_id = $1
          AND product = $2
          AND runtime_tier = $3
          AND verification_environment_id = $4
        LIMIT 2
        FOR UPDATE`,
      [
        loaded.record.household_id,
        loaded.scope.product,
        loaded.scope.runtimeTier,
        loaded.scope.verificationEnvironmentId,
      ],
    );
    if (signup.rowCount === 1) {
      expiresAt = timestamp(
        (signup.rows[0] as Row).free_access_expires_at,
        'free-access expiration',
      );
      effectiveAt = timestamp((signup.rows[0] as Row).signup_committed_at, 'signup commit time');
      sourceKind = 'free_pilot';
      if (Date.parse(expiresAt) <= Date.parse(occurredAt)) {
        throw invariant('The time-bounded household access source has expired.');
      }
    } else if ((signup.rowCount ?? 0) > 1 || loaded.record.access_state === 'grace') {
      throw invariant('The time-bounded household access source is unavailable.');
    } else if (await hasPreFamilySignupLegacyFreeAccess(db, loaded)) {
      sourceKind = 'legacy_preview';
    } else {
      const correction = await resolveActiveFamilySignupAccessCorrection(db, loaded, occurredAt);
      if (!correction) throw invariant('The household access source is unavailable.');
      effectiveAt = correction.effectiveAt;
      expiresAt = correction.expiresAt;
      sourceKind = 'admin_override';
    }
  }
  return { effectiveAt, expiresAt, sourceKind };
}

/**
 * Accepts the controller's bounded dual-role grant only when every durable
 * projection and its applied event still agree. This is not a general Admin
 * override escape hatch: arbitrary, partial, stale, expired, paid, signup, or
 * consent-shaped records remain ineligible.
 */
async function resolveActiveControllerDualRoleAccessOverride(
  db: Queryable,
  loaded: { record: ParentHouseholdRecord; scope: Scope },
  occurredAt: string,
  options: Pick<ParentHouseholdPostgresOptions, 'portalAccountKey' | 'portalProductKey'>,
) {
  if (loaded.record.access_state !== 'free') return null;
  const expectedSourceReference = controllerDualRoleAccessSourceReference(
    loaded.record.household_id,
  );
  const expectedSourceDigest = createHash('sha256')
    .update(expectedSourceReference, 'utf8')
    .digest('hex');
  const result = await db.query(
    `SELECT adult.adult_id, adult.normalized_email, adult.display_name,
            account.human_account_id,
            projection.effective_at, projection.expires_at,
            projection.source_request_hash
       FROM onetime.v21_households AS household
       JOIN onetime.v21_adult_identities AS adult
         ON adult.adult_id = household.owner_adult_id
        AND adult.product_key = household.product_key
        AND adult.runtime_tier = household.runtime_tier
        AND adult.verification_environment_id = household.verification_environment_id
        AND adult.state = 'active'
       JOIN onetime.v21_human_accounts AS account
         ON account.human_account_id = household.owner_human_account_id
        AND account.adult_id = household.owner_adult_id
        AND account.product_key = household.product_key
        AND account.runtime_tier = household.runtime_tier
        AND account.verification_environment_id = household.verification_environment_id
        AND account.state = 'active'
       JOIN onetime.v21_human_account_role_memberships AS admin_membership
         ON admin_membership.human_account_id = account.human_account_id
        AND admin_membership.product_key = account.product_key
        AND admin_membership.runtime_tier = account.runtime_tier
        AND admin_membership.verification_environment_id = account.verification_environment_id
        AND admin_membership.role = 'admin'
        AND admin_membership.revoked_at IS NULL
        AND admin_membership.granted_at <= $8::timestamptz
       JOIN onetime.v21_human_account_role_memberships AS parent_membership
         ON parent_membership.human_account_id = account.human_account_id
        AND parent_membership.product_key = account.product_key
        AND parent_membership.runtime_tier = account.runtime_tier
        AND parent_membership.verification_environment_id = account.verification_environment_id
        AND parent_membership.role = 'parent'
        AND parent_membership.revoked_at IS NULL
        AND parent_membership.granted_at <= $8::timestamptz
       JOIN onetime.canonical_aggregate_states AS canonical_access
         ON canonical_access.aggregate_kind = 'access'
        AND canonical_access.aggregate_key = household.household_id
        AND canonical_access.product_key = household.product_key
        AND canonical_access.runtime_tier = household.runtime_tier
        AND canonical_access.verification_environment_id = household.verification_environment_id
        AND canonical_access.current_state = 'free'
        AND canonical_access.version = 1
        AND canonical_access.archived_at IS NULL
       JOIN onetime.canonical_state_transition_events AS canonical_transition
         ON canonical_transition.transition_key = canonical_access.last_transition_key
        AND canonical_transition.aggregate_kind = 'access'
        AND canonical_transition.aggregate_key = household.household_id
        AND canonical_transition.product_key = household.product_key
        AND canonical_transition.runtime_tier = household.runtime_tier
        AND canonical_transition.verification_environment_id = household.verification_environment_id
        AND canonical_transition.previous_state IS NULL
        AND canonical_transition.next_state = 'free'
        AND canonical_transition.expected_version = 0
        AND canonical_transition.resulting_version = 1
        AND canonical_transition.access_cause = 'free_period'
        AND canonical_transition.actor_kind = 'system'
        AND canonical_transition.actor_key = $5
        AND canonical_transition.created_at <= $8::timestamptz
       JOIN onetime.portal_households AS portal
         ON portal.household_key = household.household_id
        AND portal.account_key = $6
        AND portal.product_key = $7
        AND portal.status = 'active'
       JOIN onetime.account_access_projections AS projection
         ON projection.account_key = portal.account_key
        AND projection.product_key = portal.product_key
        AND projection.household_key = portal.household_key
        AND projection.state = 'active'
        AND projection.source_kind = 'admin_override'
        AND projection.effective_at <= $8::timestamptz
        AND projection.effective_at = canonical_transition.created_at
        AND projection.source_updated_at <= $8::timestamptz
        AND projection.expires_at = $9::timestamptz
        AND projection.expires_at > $8::timestamptz
        AND projection.opaque_source_reference = $10
        AND projection.source_revision = 1
        AND projection.policy_version = $11
        AND projection.revocation_reason IS NULL
       JOIN onetime.account_access_source_states AS source
         ON source.account_key = projection.account_key
        AND source.product_key = projection.product_key
        AND source.household_key = projection.household_key
        AND source.source_slot = 'complimentary'
        AND source.source_kind = projection.source_kind
        AND source.state = projection.state
        AND source.effective_at = projection.effective_at
        AND source.expires_at = projection.expires_at
        AND source.opaque_source_reference = projection.opaque_source_reference
        AND source.source_revision = projection.source_revision
        AND source.source_updated_at = projection.source_updated_at
        AND source.source_request_hash = projection.source_request_hash
        AND source.policy_version = projection.policy_version
        AND source.revocation_reason IS NULL
        AND source.last_event_key = projection.last_event_key
       JOIN onetime.account_access_events AS event
         ON event.event_key = projection.last_event_key
        AND event.account_key = projection.account_key
        AND event.product_key = projection.product_key
        AND event.household_key = projection.household_key
        AND event.idempotency_key = $12
        AND event.request_hash = projection.source_request_hash
        AND event.source_kind = projection.source_kind
        AND event.source_reference_digest = $13
        AND event.source_revision = projection.source_revision
        AND event.source_updated_at = projection.source_updated_at
        AND event.previous_state IS NULL
        AND event.next_state = 'active'
        AND event.decision = 'applied'
        AND event.actor_kind = 'provisioner'
        AND event.created_at <= $8::timestamptz
      WHERE household.household_id = $1
        AND household.product_key = $2
        AND household.runtime_tier = $3
        AND household.verification_environment_id = $4
        AND household.classification = 'family'
        AND household.state = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM onetime.family_signup_requests AS signup_request
           WHERE signup_request.household_id = $1
             AND signup_request.product = $2
             AND signup_request.runtime_tier = $3
             AND signup_request.verification_environment_id = $4
        )
        AND NOT EXISTS (
          SELECT 1 FROM onetime.family_signup_access_projections AS signup_access
           WHERE signup_access.household_id = $1
             AND signup_access.product = $2
             AND signup_access.runtime_tier = $3
             AND signup_access.verification_environment_id = $4
        )
        AND NOT EXISTS (
          SELECT 1 FROM onetime.family_signup_receipts AS signup_receipt
           WHERE signup_receipt.household_id = $1
             AND signup_receipt.product = $2
             AND signup_receipt.runtime_tier = $3
             AND signup_receipt.verification_environment_id = $4
        )
        AND NOT EXISTS (
          SELECT 1 FROM onetime.family_signup_outbox AS signup_outbox
           WHERE signup_outbox.household_id = $1
             AND signup_outbox.product = $2
             AND signup_outbox.runtime_tier = $3
             AND signup_outbox.verification_environment_id = $4
        )
      LIMIT 2
      FOR UPDATE`,
    [
      loaded.record.household_id,
      loaded.scope.product,
      loaded.scope.runtimeTier,
      loaded.scope.verificationEnvironmentId,
      CONTROLLER_DUAL_ROLE_PROVISIONING_ACTOR,
      options.portalAccountKey,
      options.portalProductKey,
      occurredAt,
      CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT,
      expectedSourceReference,
      CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
      controllerDualRoleAccessIdempotencyKey(loaded.record.household_id),
      expectedSourceDigest,
    ],
  );
  if (result.rowCount !== 1) return null;
  const row = result.rows[0] as Row;
  const target = {
    normalizedEmail: String(row.normalized_email ?? ''),
    displayName: String(row.display_name ?? ''),
  };
  const isolatedSyntheticFixture =
    loaded.scope.runtimeTier === 'isolated_staging' &&
    loaded.scope.verificationEnvironmentId === 'ci' &&
    isControllerDualRoleProvisioningSyntheticTestFixture(target);
  if (!isControllerDualRoleProvisioningTarget(target) && !isolatedSyntheticFixture) return null;
  const policyScope = {
    accountKey: options.portalAccountKey,
    productKey: options.portalProductKey,
    runtimeTier: loaded.scope.runtimeTier,
    verificationEnvironmentId: loaded.scope.verificationEnvironmentId,
    normalizedEmail: target.normalizedEmail,
  };
  const identityKeys = controllerDualRoleProvisioningIdentityKeys(policyScope);
  if (
    row.adult_id !== identityKeys.adultId ||
    row.human_account_id !== identityKeys.humanAccountId ||
    loaded.record.household_id !== identityKeys.householdId
  ) {
    return null;
  }
  const effectiveAt = timestamp(row.effective_at, 'provisioned access effective time');
  const expectedRequestHash = accountAccessRequestHash({
    accountKey: options.portalAccountKey,
    productKey: options.portalProductKey,
    sourceKind: 'admin_override',
    command: {
      household_key: loaded.record.household_id,
      state: 'active',
      effective_at: effectiveAt,
      expires_at: new Date(CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT).toISOString(),
      opaque_source_reference: expectedSourceReference,
      source_revision: 1,
      source_updated_at: effectiveAt,
      policy_version: CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
      revocation_reason: null,
    },
  });
  if (row.source_request_hash !== expectedRequestHash) return null;
  const audit = await db.query(
    `SELECT created_at
       FROM onetime.account_lifecycle_audit_events
      WHERE audit_key=$1 AND account_key=$2 AND product_key=$3
        AND actor_user_key IS NULL AND subject_user_key IS NULL AND token_key IS NULL
        AND action_type='controller_dual_role_adult_provisioned'
        AND success=true AND reason IS NULL AND metadata=$4::jsonb
        AND created_at=$5::timestamptz AND created_at<=$6::timestamptz
      LIMIT 2`,
    [
      controllerDualRoleProvisionAuditKey(policyScope),
      options.portalAccountKey,
      options.portalProductKey,
      JSON.stringify(controllerDualRoleProvisionAuditMetadata(identityKeys)),
      effectiveAt,
      occurredAt,
    ],
  );
  if (audit.rows.length !== 1) return null;
  return {
    effectiveAt,
    expiresAt: timestamp(row.expires_at, 'provisioned access expiration'),
    sourceKind: 'admin_override' as const,
  };
}

/**
 * A legacy free household may be projected only when the immutable canonical
 * transition proves it existed before the Family-signup access model. A
 * missing Family-signup row by itself is corruption, not entitlement.
 */
async function hasPreFamilySignupLegacyFreeAccess(
  db: Queryable,
  loaded: { record: ParentHouseholdRecord; scope: Scope },
) {
  const result = await db.query(
    `SELECT transition.transition_key
       FROM onetime.canonical_state_transition_events AS transition
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = transition.aggregate_kind
        AND access.aggregate_key = transition.aggregate_key
        AND access.product_key = transition.product_key
        AND access.runtime_tier = transition.runtime_tier
        AND access.verification_environment_id = transition.verification_environment_id
        AND access.last_transition_key = transition.transition_key
        AND access.version = transition.resulting_version
        AND access.version = 1
        AND access.current_state = 'free'
        AND access.archived_at IS NULL
       JOIN onetime.schema_migrations AS family_signup_cutover
         ON family_signup_cutover.id = '2248_v21_family_signup'
      WHERE transition.aggregate_kind = 'access'
        AND transition.aggregate_key = $1
        AND transition.product_key = $2
        AND transition.runtime_tier = $3
        AND transition.verification_environment_id = $4
        AND transition.previous_state IS NULL
        AND transition.next_state = 'free'
        AND transition.expected_version = 0
        AND transition.resulting_version = 1
        AND transition.access_cause IS NULL
        AND transition.created_at < family_signup_cutover.applied_at
      LIMIT 2`,
    [
      loaded.record.household_id,
      loaded.scope.product,
      loaded.scope.runtimeTier,
      loaded.scope.verificationEnvironmentId,
    ],
  );
  return result.rowCount === 1;
}

/**
 * A correction is a separately governed, bounded source for one historical
 * free-period record. It never creates or rewrites signup, consent, receipt,
 * or provider evidence. The mutation is intentionally unavailable from the
 * ordinary Parent portal; a later controller-authorized operation must create
 * the immutable correction receipt first.
 */
async function resolveActiveFamilySignupAccessCorrection(
  db: Queryable,
  loaded: { record: ParentHouseholdRecord; scope: Scope },
  occurredAt: string,
) {
  const result = await db.query(
    `SELECT correction.source_effective_at, correction.expires_at
       FROM onetime.family_signup_access_source_correction_receipts AS correction
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = correction.household_id
        AND access.product_key = correction.product
        AND access.runtime_tier = correction.runtime_tier
        AND access.verification_environment_id = correction.verification_environment_id
        AND access.current_state = 'free'
        AND access.version = 1
        AND access.last_transition_key = correction.source_transition_key
        AND access.archived_at IS NULL
       JOIN onetime.canonical_state_transition_events AS transition
         ON transition.transition_key = correction.source_transition_key
        AND transition.aggregate_kind = 'access'
        AND transition.aggregate_key = correction.household_id
        AND transition.product_key = correction.product
        AND transition.runtime_tier = correction.runtime_tier
        AND transition.verification_environment_id = correction.verification_environment_id
        AND transition.previous_state IS NULL
        AND transition.next_state = 'free'
        AND transition.expected_version = 0
        AND transition.resulting_version = 1
        AND transition.access_cause = 'free_period'
        AND transition.created_at = correction.source_effective_at
        AND correction.source_effective_at = timestamptz '2026-08-04T12:05:49.000Z'
        AND correction.expires_at = timestamptz '2026-09-11T18:00:00+03:00'
      WHERE correction.household_id = $1
        AND correction.product = $2
        AND correction.runtime_tier = $3
        AND correction.verification_environment_id = $4
        AND correction.correction_state = 'active'
        AND correction.expires_at > $5::timestamptz
      LIMIT 2`,
    [
      loaded.record.household_id,
      loaded.scope.product,
      loaded.scope.runtimeTier,
      loaded.scope.verificationEnvironmentId,
      occurredAt,
    ],
  );
  if (result.rowCount !== 1) return null;
  const row = result.rows[0] as Row;
  return {
    effectiveAt: timestamp(row.source_effective_at, 'access correction effective time'),
    expiresAt: timestamp(row.expires_at, 'access correction expiration'),
  };
}

function portalCredentialOperation(operation: ParentHouseholdMutationOperation) {
  if (operation === 'student_created') return 'setup' as const;
  if (operation === 'student_archived') return 'suspend' as const;
  if (operation === 'student_restored') return 'restore' as const;
  if (operation === 'student_credential_reset') return 'reset' as const;
  return null;
}

async function insertServiceAcceptance(
  db: Queryable,
  input: {
    loaded: { record: ParentHouseholdRecord; scope: Scope };
    target: ParentManagedStudent;
    acceptanceId: string;
    context: { canonical_request_hash: string; occurred_at: string };
    options: ParentHouseholdPostgresOptions;
  },
) {
  await exactlyOne(
    db,
    `INSERT INTO onetime.admin_service_account_acceptances
       (acceptance_id, household_id, student_id, accepted_by_adult_id,
        accepted_service_account_version, canonical_request_hash,
        immutable_evidence_reference, accepted_at, product_key, runtime_tier,
        verification_environment_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      input.acceptanceId,
      input.loaded.record.household_id,
      input.target.student_id,
      input.loaded.record.owner_adult_id,
      input.options.acceptedServiceAccountVersion,
      input.context.canonical_request_hash,
      input.options.immutableEvidenceReference,
      input.context.occurred_at,
      input.loaded.scope.product,
      input.loaded.scope.runtimeTier,
      input.loaded.scope.verificationEnvironmentId,
    ],
    'service-account acceptance',
  );
}

async function insertEnrollment(
  db: Queryable,
  input: {
    loaded: { record: ParentHouseholdRecord; scope: Scope };
    target: ParentManagedStudent;
    enrollmentId: string;
    acceptanceId: string;
    occurredAt: string;
    options: ParentHouseholdPostgresOptions;
  },
) {
  await exactlyOne(
    db,
    `INSERT INTO onetime.admin_canonical_student_enrollments
       (enrollment_id, household_id, student_id, service_account_acceptance_id,
        state, version, updated_at, product_key, runtime_tier, verification_environment_id)
     VALUES ($1,$2,$3,$4,'active',1,$5,$6,$7,$8)`,
    [
      input.enrollmentId,
      input.loaded.record.household_id,
      input.target.student_id,
      input.acceptanceId,
      input.occurredAt,
      input.loaded.scope.product,
      input.loaded.scope.runtimeTier,
      input.loaded.scope.verificationEnvironmentId,
    ],
    'canonical Student enrollment',
  );
  await synchronizeClassSeriesEnrollment(db, {
    ...input,
    state: 'active',
  });
}

async function transitionEnrollment(
  db: Queryable,
  input: {
    loaded: { record: ParentHouseholdRecord; scope: Scope };
    target: ParentManagedStudent;
    enrollmentId: string;
    state: 'active' | 'revoked';
    occurredAt: string;
    options: ParentHouseholdPostgresOptions;
  },
) {
  const result = await db.query(
    `UPDATE onetime.admin_canonical_student_enrollments
        SET state = $1,
            version = version + 1,
            updated_at = $2
      WHERE enrollment_id = $3
        AND household_id = $4
        AND student_id = $5
        AND product_key = $6
        AND runtime_tier = $7
        AND verification_environment_id = $8`,
    [
      input.state,
      input.occurredAt,
      input.enrollmentId,
      input.loaded.record.household_id,
      input.target.student_id,
      input.loaded.scope.product,
      input.loaded.scope.runtimeTier,
      input.loaded.scope.verificationEnvironmentId,
    ],
  );
  if (result.rowCount !== 1) throw invariant('The canonical Student enrollment is missing.');
  await synchronizeClassSeriesEnrollment(db, input);
}

async function synchronizeClassSeriesEnrollment(
  db: Queryable,
  input: {
    loaded: { record: ParentHouseholdRecord; scope: Scope };
    target: ParentManagedStudent;
    enrollmentId: string;
    state: 'active' | 'revoked';
    occurredAt: string;
    options: ParentHouseholdPostgresOptions;
  },
) {
  const result = await db.query(
    `INSERT INTO onetime.class_series_enrollments
       (enrollment_key, account_key, product_key, class_series_key, learner_key,
        household_key, enrollment_state, source, effective_at, revoked_at,
        idempotency_key, audit_ref, version)
     SELECT $1, series.account_key, series.product_key, series.class_series_key, $2,
            $3, $4, 'parent_household_v21', $5::timestamptz,
            CASE WHEN $4 = 'revoked' THEN $5::timestamptz ELSE NULL END,
            $6, $7, 1
       FROM onetime.class_series AS series
      WHERE series.account_key = $8
        AND series.product_key = $9
        AND series.is_canonical = true
        AND series.status = 'active'
        AND series.series_state = 'active'
     ON CONFLICT (account_key, product_key, class_series_key, learner_key)
     DO UPDATE SET enrollment_state = EXCLUDED.enrollment_state,
                   effective_at = EXCLUDED.effective_at,
                   revoked_at = EXCLUDED.revoked_at,
                   source = EXCLUDED.source,
                   audit_ref = EXCLUDED.audit_ref,
                   version = onetime.class_series_enrollments.version + 1
     RETURNING enrollment_key`,
    [
      input.enrollmentId,
      input.target.student_id,
      input.loaded.record.household_id,
      input.state,
      input.occurredAt,
      `parent-v21-class-enrollment:${input.target.student_id}`,
      `parent-household:${input.enrollmentId}`,
      input.options.portalAccountKey,
      input.options.portalProductKey,
    ],
  );
  if (result.rowCount !== 1) {
    throw invariant('The canonical class series is unavailable for Student enrollment.');
  }
}

async function insertAudit(
  db: Queryable,
  loaded: { record: ParentHouseholdRecord; scope: Scope },
  input: Parameters<ParentHouseholdRepository['commitMutation']>[0],
  auditId: string,
) {
  await exactlyOne(
    db,
    `INSERT INTO onetime.admin_directory_audit_events
       (event_id, actor_human_account_id, operation, target_ref, household_id,
        request_hash, occurred_at, contains_sensitive_data, product_key,
        runtime_tier, verification_environment_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,$9,$10)`,
    [
      auditId,
      loaded.scope.ownerHumanAccountId,
      directoryOperation(input.audit.action),
      `${input.audit.action}:${input.audit.student_id}`,
      loaded.record.household_id,
      input.context.canonical_request_hash,
      input.context.occurred_at,
      loaded.scope.product,
      loaded.scope.runtimeTier,
      loaded.scope.verificationEnvironmentId,
    ],
    'Parent Student audit event',
  );
}

async function revokeStudentAccess(
  db: Queryable,
  loaded: { record: ParentHouseholdRecord; scope: Scope },
  target: ParentManagedStudent,
  enrollmentId: string,
  auditId: string,
  input: Parameters<ParentHouseholdRepository['commitMutation']>[0],
) {
  const grants = await db.query(
    `UPDATE onetime.classroom_launch_grants_v21
        SET revoked_at = $1,
            version = version + 1
      WHERE student_id = $2
        AND household_id = $3
        AND product = $4
        AND runtime_tier = $5
        AND verification_environment_id = $6
        AND revoked_at IS NULL
        AND used_at IS NULL
      RETURNING grant_id`,
    [
      input.context.occurred_at,
      target.student_id,
      loaded.record.household_id,
      loaded.scope.product,
      loaded.scope.runtimeTier,
      loaded.scope.verificationEnvironmentId,
    ],
  );
  const sessions = await db.query(
    `UPDATE onetime.live_student_classroom_sessions
        SET state = 'revoked',
            revoked_at = $1,
            revoked_by_admin_id = $2,
            revoke_audit_ref = $3,
            version = version + 1
      WHERE student_id = $4
        AND household_id = $5
        AND product = $6
        AND runtime_tier = $7
        AND verification_environment_id = $8
        AND state = 'active'
      RETURNING live_session_id`,
    [
      input.context.occurred_at,
      loaded.scope.ownerHumanAccountId,
      auditId,
      target.student_id,
      loaded.record.household_id,
      loaded.scope.product,
      loaded.scope.runtimeTier,
      loaded.scope.verificationEnvironmentId,
    ],
  );
  const readbackId = stableId('student_revocation', input.context.idempotency_key);
  await exactlyOne(
    db,
    `INSERT INTO onetime.admin_access_revocation_readbacks
       (readback_id, subject_type, subject_id, complete,
        active_session_ids_revoked, classroom_grant_ids_revoked,
        playback_grant_ids_revoked, enrollment_ids_revoked, revoked_at,
        product_key, runtime_tier, verification_environment_id)
     VALUES ($1,'student',$2,true,$3::text[],$4::text[],$5::text[],$6::text[],$7,$8,$9,$10)`,
    [
      readbackId,
      target.student_id,
      sessions.rows.map((row) => text((row as Row).live_session_id, 'live session')),
      grants.rows.map((row) => text((row as Row).grant_id, 'classroom grant')),
      [],
      input.canonical_enrollment === 'disable' ? [enrollmentId] : [],
      input.context.occurred_at,
      loaded.scope.product,
      loaded.scope.runtimeTier,
      loaded.scope.verificationEnvironmentId,
    ],
    'Student access-revocation readback',
  );
  return readbackId;
}

async function insertCredentialEvidence(
  db: Queryable,
  input: {
    loaded: { record: ParentHouseholdRecord; scope: Scope };
    target: ParentManagedStudent;
    passwordHash: string;
    kind: 'initial_activation' | 'reset';
    readbackId: string | null;
    context: { idempotency_key: string; occurred_at: string };
  },
) {
  if (input.kind === 'reset' && !input.readbackId) {
    throw invariant('A credential reset requires a complete revocation readback.');
  }
  await exactlyOne(
    db,
    `INSERT INTO onetime.admin_student_credential_resets
       (reset_id, kind, student_id, credential_id, replacement_credential_hash,
        credential_version, revocation_readback_id, disclose_existing_password,
        created_at, product_key, runtime_tier, verification_environment_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,$9,$10,$11)`,
    [
      stableId('student_credential', input.context.idempotency_key),
      input.kind,
      input.target.student_id,
      `credential:${input.target.student_id}`,
      input.passwordHash,
      input.target.credential_version,
      input.readbackId,
      input.context.occurred_at,
      input.loaded.scope.product,
      input.loaded.scope.runtimeTier,
      input.loaded.scope.verificationEnvironmentId,
    ],
    'Student credential evidence',
  );
}

async function insertReceipt(
  db: Queryable,
  scope: Scope,
  input: Parameters<ParentHouseholdRepository['commitMutation']>[0],
) {
  await exactlyOne(
    db,
    `INSERT INTO onetime.admin_directory_receipts
       (idempotency_key, request_hash, operation, result_ref, result_version,
        committed_at, product_key, runtime_tier, verification_environment_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.context.idempotency_key,
      input.context.canonical_request_hash,
      directoryOperation(input.audit.action),
      `${input.audit.action}:${input.audit.student_id}`,
      input.next.revision,
      input.context.occurred_at,
      scope.product,
      scope.runtimeTier,
      scope.verificationEnvironmentId,
    ],
    'Parent mutation receipt',
  );
}

function directoryOperation(operation: ParentHouseholdMutationOperation) {
  if (operation === 'student_created' || operation === 'student_profile_updated') {
    return 'student_upsert' as const;
  }
  if (operation === 'student_archived' || operation === 'student_restored') {
    return 'student_transition' as const;
  }
  return 'student_credential_reset' as const;
}

async function advisoryLock(db: Queryable, value: string) {
  const digest = createHash('sha256').update(value, 'utf8').digest();
  await db.query('SELECT pg_advisory_xact_lock($1)', [digest.readInt32BE(0)]);
}

async function exactlyOne(db: Queryable, sql: string, values: readonly unknown[], name: string) {
  const result = await db.query(sql, [...values]);
  if (result.rowCount !== 1) throw invariant(`The ${name} did not commit exactly once.`);
}

function requiredTarget(record: ParentHouseholdRecord, studentId: string) {
  const target = record.students.find((student) => student.student_id === studentId);
  if (!target) throw invariant('The mutation target is missing from the next household state.');
  return target;
}

function normalizedUsername(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!USERNAME.test(normalized) || normalized.includes('@')) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.invalidInput,
      'Choose a valid Student username.',
    );
  }
  return normalized;
}

function unicodeNonblank(value: string) {
  return (
    value.trim().replace(/[\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/gu, '')
      .length > 0
  );
}

function assertContext(context: {
  idempotency_key: string;
  canonical_request_hash: string;
  occurred_at: string;
}) {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(context.idempotency_key) ||
    !SHA256.test(context.canonical_request_hash) ||
    !Number.isFinite(Date.parse(context.occurred_at))
  ) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.invalidInput,
      'The mutation request binding is invalid.',
    );
  }
}

function stableId(prefix: string, ...parts: string[]) {
  return `${prefix}_${createHash('sha256').update(parts.join('\0'), 'utf8').digest('hex').slice(0, 32)}`;
}

function assertOption(value: string, name: string) {
  if (!value.trim() || value.length > 240) throw new Error(`A valid ${name} is required.`);
}

function text(value: unknown, name: string) {
  if (typeof value !== 'string' || value.length === 0) throw invariant(`The ${name} is missing.`);
  return value;
}

function nullableText(value: unknown) {
  if (value === null || value === undefined) return null;
  return text(value, 'nullable text');
}

function timestamp(value: unknown, name: string) {
  const parsed = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  if (!parsed || !Number.isFinite(parsed.getTime())) {
    throw invariant(`The ${name} is missing or invalid.`);
  }
  return parsed.toISOString();
}

function integer(value: unknown, name: string) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw invariant(`The ${name} is invalid.`);
  return parsed;
}

function exact<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): Values[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw invariant('A persisted enum value is invalid.');
  }
  return value as Values[number];
}

function translatePostgresError(error: unknown) {
  if (error instanceof ParentHouseholdError) return error;
  const code = (error as { code?: unknown })?.code;
  const constraint = String((error as { constraint?: unknown })?.constraint ?? '');
  if (code === '23505' && /username/u.test(constraint)) {
    return new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.usernameUnavailable,
      'Choose another Student username.',
    );
  }
  if (code === '23505' && /receipt|idempot/u.test(constraint)) {
    return new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.idempotencyConflict,
      'This idempotency key was already used for another request.',
    );
  }
  return error instanceof Error ? error : invariant('The Parent household transaction failed.');
}

function conflict(): never {
  throw new ParentHouseholdError(
    PARENT_HOUSEHOLD_ERROR_CODES.conflict,
    'The household changed. Refresh before trying again.',
  );
}

function unavailable(): never {
  throw new ParentHouseholdError(
    PARENT_HOUSEHOLD_ERROR_CODES.householdMissing,
    'This Parent household is unavailable.',
  );
}

function invariant(message: string) {
  return new ParentHouseholdError(PARENT_HOUSEHOLD_ERROR_CODES.persistenceInvariant, message);
}
