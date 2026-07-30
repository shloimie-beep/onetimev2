import { createHash } from 'node:crypto';
import type {
  FamilySignupOutboxIntent,
  FamilySignupReceipt,
  FamilySignupRequestBinding,
  FamilySignupResult,
  FamilySignupScope,
} from '../../../../../../../packages/contracts/src/signup/family/index.ts';
import type { DbPool, Queryable } from '../../../../../../../packages/db/src/index.ts';
import type {
  CanonicalFamilySignupRequest,
  ExistingFamilyLocalState,
  FamilySignupGhlEvidence,
  FamilySignupRecoveryRecord,
} from '../../../../../../../packages/domain/src/signup/family/index.ts';
import type { FamilySignupRepository, FamilySignupTransaction } from './service.ts';

type Row = Record<string, unknown>;

export class PostgresFamilySignupRepositoryError extends Error {
  constructor(
    readonly code:
      'invalid_transaction_sequence' | 'persistence_invariant' | 'read_only_environment',
    message: string,
  ) {
    super(message);
    this.name = 'PostgresFamilySignupRepositoryError';
  }
}

export function createPostgresFamilySignupRepository(pool: DbPool): FamilySignupRepository {
  return {
    async transaction<T>(run: (tx: FamilySignupTransaction) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await run(new PostgresFamilySignupTransaction(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

class PostgresFamilySignupTransaction implements FamilySignupTransaction {
  private lockedBinding:
    | {
        scope: FamilySignupScope;
        operation: 'public_family_signup';
        idempotencyKey: string;
      }
    | undefined;

  constructor(private readonly db: Queryable) {}

  async findRequest(input: {
    scope: FamilySignupScope;
    operation: 'public_family_signup';
    idempotency_key: string;
  }): Promise<FamilySignupRecoveryRecord | null> {
    if (this.lockedBinding) {
      throw new PostgresFamilySignupRepositoryError(
        'invalid_transaction_sequence',
        'The Family-signup transaction key was already locked.',
      );
    }
    await advisoryLock(this.db, `family-signup-request:${input.idempotency_key}`);
    this.lockedBinding = {
      scope: { ...input.scope },
      operation: input.operation,
      idempotencyKey: input.idempotency_key,
    };

    const request = await this.db.query(
      `SELECT request.product,
              request.runtime_tier,
              request.verification_environment_id,
              request.operation,
              request.idempotency_key,
              request.canonical_request_digest,
              request.adult_id,
              request.human_account_id,
              request.household_id,
              receipt.result_json
         FROM onetime.family_signup_requests AS request
         JOIN onetime.family_signup_receipts AS receipt
           ON receipt.idempotency_key = request.idempotency_key
        WHERE request.idempotency_key = $1
        FOR SHARE OF request, receipt`,
      [input.idempotency_key],
    );
    if ((request.rowCount ?? 0) === 0) return null;
    if (request.rowCount !== 1) {
      throw invariant('A global Family-signup key resolved to more than one receipt.');
    }

    const row = request.rows[0] as Row;
    const requestBinding = storedBinding(row);
    const result = storedResult(row.result_json);
    assertStoredProjectionBinding(result, row);

    const outboxRows = await this.db.query(
      `SELECT intent_id,
              kind,
              adult_id,
              household_id,
              normalized_email_hash,
              general_marketing_consent,
              parent_newsletter_consent,
              dispatch_state,
              preserve_adult_suppression,
              local_commit_required
         FROM onetime.family_signup_outbox
        WHERE idempotency_key = $1
          AND product = $2
          AND runtime_tier = $3
          AND verification_environment_id = $4
          AND operation = $5
          AND canonical_request_digest = $6
        ORDER BY intent_id`,
      [
        requestBinding.idempotency_key,
        requestBinding.scope.product,
        requestBinding.scope.runtime_tier,
        requestBinding.scope.verification_environment_id,
        requestBinding.operation,
        requestBinding.canonical_request_digest,
      ],
    );
    const outboxIntents = outboxRows.rows.map((outboxRow) =>
      storedOutboxIntent(outboxRow as Row, requestBinding),
    );
    if (
      result.outbox_intent_ids.length !== outboxIntents.length ||
      result.outbox_intent_ids.some(
        (intentId, index) => intentId !== outboxIntents[index]?.intent_id,
      )
    ) {
      throw invariant('The Family-signup receipt and durable outbox disagree.');
    }

    return {
      receipt: {
        request_binding: requestBinding,
        result,
        outbox_intents: outboxIntents,
      },
    };
  }

  async readLocalState(input: {
    scope: FamilySignupScope;
    operation: 'public_family_signup';
    normalized_email: string;
  }): Promise<ExistingFamilyLocalState> {
    this.assertLockedScope(input.scope, input.operation);
    await advisoryLock(
      this.db,
      [
        'family-signup-identity',
        input.scope.product,
        input.scope.runtime_tier,
        input.scope.verification_environment_id,
        input.normalized_email,
      ].join(':'),
    );

    const adults = await this.db.query(
      `SELECT adult_id, normalized_email
         FROM onetime.v21_adult_identities
        WHERE product_key = $1
          AND runtime_tier = $2
          AND verification_environment_id = $3
          AND normalized_email = $4
        FOR UPDATE`,
      [
        input.scope.product,
        input.scope.runtime_tier,
        input.scope.verification_environment_id,
        input.normalized_email,
      ],
    );
    if ((adults.rowCount ?? 0) === 0) {
      return { identity: null, household: null };
    }
    if (adults.rowCount !== 1) {
      throw invariant('A normalized adult email resolved to multiple local identities.');
    }

    const adult = adults.rows[0] as Row;
    const accounts = await this.db.query(
      `SELECT human_account_id, state
         FROM onetime.v21_human_accounts
        WHERE adult_id = $1
          AND product_key = $2
          AND runtime_tier = $3
          AND verification_environment_id = $4
        FOR UPDATE`,
      [
        requiredText(adult.adult_id, 'adult_id'),
        input.scope.product,
        input.scope.runtime_tier,
        input.scope.verification_environment_id,
      ],
    );
    if (accounts.rowCount !== 1) {
      throw invariant('A local adult identity is missing its sole HumanAccount.');
    }
    const account = accounts.rows[0] as Row;
    const humanAccountId = requiredText(account.human_account_id, 'human_account_id');
    const households = await this.db.query(
      `SELECT household.household_id,
              household.state,
              access.access_state,
              access.free_access_expires_at
         FROM onetime.v21_households AS household
         LEFT JOIN onetime.family_signup_access_projections AS access
           ON access.household_id = household.household_id
          AND access.product = household.product_key
          AND access.runtime_tier = household.runtime_tier
          AND access.verification_environment_id = household.verification_environment_id
        WHERE household.owner_adult_id = $1
          AND household.owner_human_account_id = $2
          AND household.product_key = $3
          AND household.runtime_tier = $4
          AND household.verification_environment_id = $5
          AND household.classification = 'family'
        ORDER BY household.created_at, household.household_id
        LIMIT 1
        FOR UPDATE OF household`,
      [
        requiredText(adult.adult_id, 'adult_id'),
        humanAccountId,
        input.scope.product,
        input.scope.runtime_tier,
        input.scope.verification_environment_id,
      ],
    );
    const householdRow = households.rows[0] as Row | undefined;

    return {
      identity: {
        adult_id: requiredText(adult.adult_id, 'adult_id'),
        human_account_id: humanAccountId,
        normalized_email: requiredText(adult.normalized_email, 'normalized_email'),
        human_account_state: enumText(account.state, ['invited', 'active', 'disabled', 'archived']),
      },
      household: householdRow
        ? {
            household_id: requiredText(householdRow.household_id, 'household_id'),
            lifecycle_state: householdLifecycle(householdRow),
          }
        : null,
    };
  }

  async readGhlEvidence(input: {
    scope: FamilySignupScope;
    operation: 'public_family_signup';
    normalized_email_hash: string;
  }): Promise<FamilySignupGhlEvidence> {
    this.assertLockedScope(input.scope, input.operation);
    if (!LOWER_SHA256.test(input.normalized_email_hash)) {
      throw invariant('The normalized adult email hash is malformed.');
    }

    // No current table binds a fresh signup email to canonical provider
    // readback. An absent row must not be converted into a fabricated
    // "unlinked" observation; the durable GHL intent remains quarantined.
    return {
      status: 'evidence_unavailable',
      safe_reason: 'evidence_unavailable',
    };
  }

  async commit(input: {
    request_binding: FamilySignupRequestBinding;
    request: CanonicalFamilySignupRequest;
    password_hash: string;
    receipt: FamilySignupReceipt;
    outbox_intents: readonly FamilySignupOutboxIntent[];
    session_creation_required: boolean;
    ghl_identity_state: 'unlinked' | 'linked' | 'identity_review';
    ghl_contact_ref_hash: string | null;
    ghl_evidence_status: FamilySignupGhlEvidence['status'];
    committed_at: string;
  }): Promise<void> {
    this.assertLockedBinding(input.request_binding);
    assertCommitInput(input);
    if (input.request_binding.scope.verification_environment_id === 'production_read_only') {
      throw new PostgresFamilySignupRepositoryError(
        'read_only_environment',
        'Family signup cannot write in production_read_only.',
      );
    }

    const binding = input.request_binding;
    const projection = input.receipt.result.projection;
    if (!projection) throw invariant('A committed Family signup requires its local projection.');
    const scopeValues = [
      binding.scope.product,
      binding.scope.runtime_tier,
      binding.scope.verification_environment_id,
    ] as const;
    const displayName = `${input.request.first_name} ${input.request.last_name}`.trim();

    await insertExactlyOne(
      this.db,
      `INSERT INTO onetime.v21_adult_identities
         (adult_id, normalized_email, display_name, state, version,
          product_key, runtime_tier, verification_environment_id,
          created_at, updated_at)
       VALUES ($1,$2,$3,'active',1,$4,$5,$6,$7,$7)`,
      [
        projection.adult_id,
        input.request.normalized_email,
        displayName,
        ...scopeValues,
        input.committed_at,
      ],
      'adult identity',
    );
    await insertExactlyOne(
      this.db,
      `INSERT INTO onetime.v21_human_accounts
         (human_account_id, adult_id, state, security_version, version,
          product_key, runtime_tier, verification_environment_id,
          created_at, updated_at)
       VALUES ($1,$2,'active',1,1,$3,$4,$5,$6,$6)`,
      [projection.human_account_id, projection.adult_id, ...scopeValues, input.committed_at],
      'HumanAccount',
    );
    await insertExactlyOne(
      this.db,
      `INSERT INTO onetime.v21_human_account_role_memberships
         (human_account_id, role, granted_at, granted_reason,
          product_key, runtime_tier, verification_environment_id)
       VALUES ($1,'parent',$2,'public_family_signup',$3,$4,$5)`,
      [projection.human_account_id, input.committed_at, ...scopeValues],
      'Parent role membership',
    );
    await insertExactlyOne(
      this.db,
      `INSERT INTO onetime.v21_households
         (household_id, owner_adult_id, owner_human_account_id,
          classification, state, seat_limit, active_seat_count,
          access_aggregate_ref, version, product_key, runtime_tier,
          verification_environment_id, created_at, updated_at)
       VALUES ($1,$2,$3,'family','active',3,0,$4,1,$5,$6,$7,$8,$8)`,
      [
        projection.household_id,
        projection.adult_id,
        projection.human_account_id,
        `access:${projection.household_id}`,
        ...scopeValues,
        input.committed_at,
      ],
      'Family household',
    );
    await insertExactlyOne(
      this.db,
      `INSERT INTO onetime.v21_adult_credentials
         (human_account_id, adult_id, credential_kind, password_hash,
          credential_state, credential_version, product_key, runtime_tier,
          verification_environment_id, created_at, updated_at)
       VALUES ($1,$2,'adult_email_password',$3,'active',1,$4,$5,$6,$7,$7)`,
      [
        projection.human_account_id,
        projection.adult_id,
        input.password_hash,
        ...scopeValues,
        input.committed_at,
      ],
      'adult credential',
    );

    await insertCanonicalTransition(this.db, {
      transitionKey: `${binding.idempotency_key}:human-account-active`,
      aggregateKind: 'human_account',
      aggregateKey: projection.human_account_id,
      nextState: 'active',
      idempotencyKey: `${binding.idempotency_key}:human-account`,
      canonicalRequestHash: binding.canonical_request_digest,
      accessCause: null,
      scope: binding.scope,
      committedAt: input.committed_at,
    });
    await insertCanonicalTransition(this.db, {
      transitionKey: `${binding.idempotency_key}:access-${projection.access_state}`,
      aggregateKind: 'access',
      aggregateKey: projection.household_id,
      nextState: projection.access_state,
      idempotencyKey: `${binding.idempotency_key}:access`,
      canonicalRequestHash: binding.canonical_request_digest,
      accessCause: projection.access_state === 'free' ? 'free_period' : 'administrative_block',
      scope: binding.scope,
      committedAt: input.committed_at,
    });

    await insertExactlyOne(
      this.db,
      `INSERT INTO onetime.family_signup_requests
         (idempotency_key, product, runtime_tier, verification_environment_id,
          operation, canonical_request_digest, adult_id, human_account_id,
          household_id, household_timezone, terms_accepted, privacy_accepted,
          general_marketing_consent, parent_newsletter_consent, committed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,true,$11,$12,$13)`,
      [
        binding.idempotency_key,
        ...scopeValues,
        binding.operation,
        binding.canonical_request_digest,
        projection.adult_id,
        projection.human_account_id,
        projection.household_id,
        input.request.timezone,
        input.request.general_marketing_consent,
        input.request.parent_newsletter_consent,
        input.committed_at,
      ],
      'Family-signup request',
    );
    await insertExactlyOne(
      this.db,
      `INSERT INTO onetime.family_signup_access_projections
         (household_id, product, runtime_tier, verification_environment_id,
          access_branch, access_state, seat_limit, active_seat_count,
          free_access_expires_at, checkout_required,
          checkout_blocked_by_identity_review, rolling_trial_granted,
          card_collected, signup_committed_at)
       VALUES ($1,$2,$3,$4,$5,$6,3,0,$7,$8,$9,false,false,$10)`,
      [
        projection.household_id,
        ...scopeValues,
        projection.access_branch,
        projection.access_state,
        projection.free_access_expires_at,
        projection.checkout_required,
        projection.checkout_blocked_by_identity_review,
        input.committed_at,
      ],
      'Family-signup access projection',
    );

    const consentChoices = [
      ['general_marketing', input.request.general_marketing_consent],
      ['parent_newsletter', input.request.parent_newsletter_consent],
    ] as const;
    for (const [consentScope, choice] of consentChoices) {
      await insertExactlyOne(
        this.db,
        `INSERT INTO onetime.family_signup_consents
           (idempotency_key, product, runtime_tier, verification_environment_id,
            operation, canonical_request_digest, adult_id, consent_scope,
            choice, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          binding.idempotency_key,
          ...scopeValues,
          binding.operation,
          binding.canonical_request_digest,
          projection.adult_id,
          consentScope,
          choice,
          input.committed_at,
        ],
        `${consentScope} consent`,
      );
    }

    await insertExactlyOne(
      this.db,
      `INSERT INTO onetime.family_signup_receipts
         (idempotency_key, product, runtime_tier, verification_environment_id,
          operation, canonical_request_digest, adult_id, human_account_id,
          household_id, result_json, committed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
      [
        binding.idempotency_key,
        ...scopeValues,
        binding.operation,
        binding.canonical_request_digest,
        projection.adult_id,
        projection.human_account_id,
        projection.household_id,
        JSON.stringify(input.receipt.result),
        input.committed_at,
      ],
      'Family-signup receipt',
    );

    for (const intent of input.outbox_intents) {
      const durableIntent = {
        ...intent,
        ghl_identity_state: input.ghl_identity_state,
        verified_contact_ref_hash: input.ghl_contact_ref_hash,
        identity_evidence_status: input.ghl_evidence_status,
      };
      await insertExactlyOne(
        this.db,
        `INSERT INTO onetime.family_signup_outbox
           (intent_id, idempotency_key, product, runtime_tier,
            verification_environment_id, operation, canonical_request_digest,
            kind, adult_id, household_id, normalized_email_hash,
            general_marketing_consent, parent_newsletter_consent,
            dispatch_state, preserve_adult_suppression, local_commit_required,
            intent_json, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,true,$15::jsonb,$16)`,
        [
          intent.intent_id,
          binding.idempotency_key,
          ...scopeValues,
          binding.operation,
          binding.canonical_request_digest,
          intent.kind,
          intent.adult_id,
          intent.household_id,
          intent.normalized_email_hash,
          intent.adult_consent_choices.general_marketing,
          intent.adult_consent_choices.parent_newsletter,
          intent.dispatch_state,
          JSON.stringify(durableIntent),
          input.committed_at,
        ],
        'Family-signup outbox intent',
      );
    }
  }

  private assertLockedScope(scope: FamilySignupScope, operation: 'public_family_signup'): void {
    const locked = this.lockedBinding;
    if (!locked || locked.operation !== operation || !sameScope(locked.scope, scope)) {
      throw new PostgresFamilySignupRepositoryError(
        'invalid_transaction_sequence',
        'Family-signup reads must follow the exact globally locked request binding.',
      );
    }
  }

  private assertLockedBinding(binding: FamilySignupRequestBinding): void {
    this.assertLockedScope(binding.scope, binding.operation);
    if (this.lockedBinding?.idempotencyKey !== binding.idempotency_key) {
      throw new PostgresFamilySignupRepositoryError(
        'invalid_transaction_sequence',
        'Family-signup commit does not match the globally locked request key.',
      );
    }
  }
}

const LOWER_SHA256 = /^[a-f0-9]{64}$/u;
const ADULT_PASSWORD_HASH =
  /^argon2id-v1\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/u;

function assertCommitInput(input: {
  request_binding: FamilySignupRequestBinding;
  request: CanonicalFamilySignupRequest;
  password_hash: string;
  receipt: FamilySignupReceipt;
  outbox_intents: readonly FamilySignupOutboxIntent[];
  session_creation_required: boolean;
  ghl_identity_state: 'unlinked' | 'linked' | 'identity_review';
  ghl_contact_ref_hash: string | null;
  ghl_evidence_status: FamilySignupGhlEvidence['status'];
  committed_at: string;
}): void {
  const binding = input.request_binding;
  const result = input.receipt.result;
  const projection = result.projection;
  if (
    !sameBinding(binding, input.receipt.request_binding) ||
    !LOWER_SHA256.test(binding.canonical_request_digest) ||
    input.request.classification !== 'family' ||
    input.request.terms_accepted !== true ||
    input.request.privacy_accepted !== true ||
    !ADULT_PASSWORD_HASH.test(input.password_hash) ||
    !Number.isFinite(Date.parse(input.committed_at)) ||
    result.disposition !== 'created' ||
    projection === null ||
    result.provider_effects_completed_inline !== 0 ||
    result.setup_email_required !== false ||
    projection.normalized_email !== input.request.normalized_email ||
    projection.seat_limit !== 3 ||
    projection.active_seat_count !== 0 ||
    projection.rolling_trial_granted !== false ||
    projection.card_collected !== false ||
    input.session_creation_required !== (result.next_action === 'signed_in') ||
    input.outbox_intents.length !== 1 ||
    JSON.stringify(input.receipt.outbox_intents) !== JSON.stringify(input.outbox_intents)
  ) {
    throw invariant('The Family-signup commit is not the exact domain-approved plan.');
  }
  const intent = input.outbox_intents[0];
  if (
    !intent ||
    !sameBinding(intent.request_binding, binding) ||
    intent.adult_id !== projection.adult_id ||
    intent.household_id !== projection.household_id ||
    intent.adult_consent_choices.general_marketing !== input.request.general_marketing_consent ||
    intent.adult_consent_choices.parent_newsletter !== input.request.parent_newsletter_consent ||
    !LOWER_SHA256.test(intent.normalized_email_hash) ||
    intent.preserve_adult_suppression !== true ||
    intent.local_commit_required !== true ||
    result.outbox_intent_ids.length !== 1 ||
    result.outbox_intent_ids[0] !== intent.intent_id
  ) {
    throw invariant('The Family-signup outbox is not bound to its approved local commit.');
  }
  if (
    input.ghl_evidence_status === 'evidence_unavailable' &&
    (input.ghl_identity_state !== 'identity_review' ||
      input.ghl_contact_ref_hash !== null ||
      intent.dispatch_state !== 'identity_review')
  ) {
    throw invariant('Unavailable GHL evidence must remain in identity-review quarantine.');
  }
  if (input.ghl_contact_ref_hash !== null && !LOWER_SHA256.test(input.ghl_contact_ref_hash)) {
    throw invariant('The GHL contact reference hash is malformed.');
  }
  if (
    (input.ghl_identity_state === 'linked' &&
      (input.ghl_contact_ref_hash === null || intent.dispatch_state !== 'ready')) ||
    (input.ghl_identity_state === 'unlinked' &&
      (input.ghl_contact_ref_hash !== null || intent.dispatch_state !== 'ready')) ||
    (input.ghl_identity_state === 'identity_review' &&
      (input.ghl_contact_ref_hash !== null || intent.dispatch_state !== 'identity_review'))
  ) {
    throw invariant('The durable GHL identity decision and outbox dispatch state disagree.');
  }
}

async function insertCanonicalTransition(
  db: Queryable,
  input: {
    transitionKey: string;
    aggregateKind: 'human_account' | 'access';
    aggregateKey: string;
    nextState: 'active' | 'free' | 'inactive';
    idempotencyKey: string;
    canonicalRequestHash: string;
    accessCause: 'free_period' | 'administrative_block' | null;
    scope: FamilySignupScope;
    committedAt: string;
  },
): Promise<void> {
  await insertExactlyOne(
    db,
    `INSERT INTO onetime.canonical_state_transition_events
       (transition_key, aggregate_kind, aggregate_key, previous_state,
        next_state, expected_version, resulting_version, product_key,
        runtime_tier, verification_environment_id, actor_kind, actor_key,
        idempotency_key, canonical_request_hash, access_cause, created_at)
     VALUES ($1,$2,$3,NULL,$4,0,1,$5,$6,$7,'system',
             'public_family_signup',$8,$9,$10,$11)`,
    [
      input.transitionKey,
      input.aggregateKind,
      input.aggregateKey,
      input.nextState,
      input.scope.product,
      input.scope.runtime_tier,
      input.scope.verification_environment_id,
      input.idempotencyKey,
      input.canonicalRequestHash,
      input.accessCause,
      input.committedAt,
    ],
    `${input.aggregateKind} canonical transition`,
  );
}

async function advisoryLock(db: Queryable, value: string): Promise<void> {
  const digest = createHash('sha256').update(value, 'utf8').digest();
  await db.query('SELECT pg_advisory_xact_lock($1::bigint)', [digest.readInt32BE(0)]);
}

async function insertExactlyOne(
  db: Queryable,
  text: string,
  values: readonly unknown[],
  aggregate: string,
): Promise<void> {
  const result = await db.query(text, [...values]);
  if (result.rowCount !== 1) {
    throw invariant(`The ${aggregate} insert did not affect exactly one row.`);
  }
}

function storedBinding(row: Row): FamilySignupRequestBinding {
  const product = requiredText(row.product, 'product');
  const runtimeTier = enumText(row.runtime_tier, ['isolated_staging', 'production']);
  const verificationEnvironmentId = enumText(row.verification_environment_id, [
    'ci',
    'provider_sandbox',
    'persistent_staging',
    'production_read_only',
    'production_operator_canary',
    'production_broad',
  ]);
  if (
    product !== 'one_time_mishnayos' ||
    (runtimeTier === 'isolated_staging' &&
      !['ci', 'provider_sandbox', 'persistent_staging'].includes(verificationEnvironmentId)) ||
    (runtimeTier === 'production' &&
      !['production_read_only', 'production_operator_canary', 'production_broad'].includes(
        verificationEnvironmentId,
      ))
  ) {
    throw invariant('The persisted Family-signup scope is invalid.');
  }
  const canonicalRequestDigest = requiredText(
    row.canonical_request_digest,
    'canonical_request_digest',
  );
  if (!LOWER_SHA256.test(canonicalRequestDigest)) {
    throw invariant('The persisted Family-signup request digest is invalid.');
  }
  if (row.operation !== 'public_family_signup') {
    throw invariant('The persisted Family-signup operation is invalid.');
  }
  return {
    scope: {
      product,
      runtime_tier: runtimeTier,
      verification_environment_id: verificationEnvironmentId,
    } as FamilySignupScope,
    operation: 'public_family_signup',
    idempotency_key: requiredText(row.idempotency_key, 'idempotency_key'),
    canonical_request_digest: canonicalRequestDigest,
  };
}

function storedResult(value: unknown): FamilySignupResult {
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  if (!isRecord(parsed)) throw invariant('The persisted Family-signup result is malformed.');
  const result = parsed as unknown as FamilySignupResult;
  if (
    !['created', 'recovered', 'existing_account'].includes(result.disposition) ||
    !['signed_in', 'checkout', 'identity_review', 'sign_in_or_reset'].includes(
      result.next_action,
    ) ||
    result.setup_email_required !== false ||
    result.provider_effects_completed_inline !== 0 ||
    !Array.isArray(result.outbox_intent_ids) ||
    result.outbox_intent_ids.some((value) => typeof value !== 'string') ||
    typeof result.safe_message !== 'string'
  ) {
    throw invariant('The persisted Family-signup result violates its contract.');
  }
  return result;
}

function assertStoredProjectionBinding(result: FamilySignupResult, row: Row): void {
  const projection = result.projection;
  if (
    !projection ||
    projection.adult_id !== row.adult_id ||
    projection.human_account_id !== row.human_account_id ||
    projection.household_id !== row.household_id
  ) {
    throw invariant('The persisted Family-signup receipt changed its local identity binding.');
  }
}

function storedOutboxIntent(
  row: Row,
  requestBinding: FamilySignupRequestBinding,
): FamilySignupOutboxIntent {
  if (
    row.kind !== 'ghl_adult_and_household_sync' ||
    !LOWER_SHA256.test(requiredText(row.normalized_email_hash, 'normalized_email_hash')) ||
    typeof row.general_marketing_consent !== 'boolean' ||
    typeof row.parent_newsletter_consent !== 'boolean' ||
    !['ready', 'identity_review'].includes(String(row.dispatch_state)) ||
    row.preserve_adult_suppression !== true ||
    row.local_commit_required !== true
  ) {
    throw invariant('The persisted Family-signup outbox intent is malformed.');
  }
  return {
    intent_id: requiredText(row.intent_id, 'intent_id'),
    kind: 'ghl_adult_and_household_sync',
    request_binding: requestBinding,
    adult_id: requiredText(row.adult_id, 'adult_id'),
    household_id: requiredText(row.household_id, 'household_id'),
    normalized_email_hash: requiredText(row.normalized_email_hash, 'normalized_email_hash'),
    adult_consent_choices: {
      general_marketing: row.general_marketing_consent,
      parent_newsletter: row.parent_newsletter_consent,
    },
    dispatch_state: row.dispatch_state as 'ready' | 'identity_review',
    preserve_adult_suppression: true,
    local_commit_required: true,
  };
}

function householdLifecycle(row: Row): 'active' | 'expired' | 'archived' | 'inactive' {
  if (row.state === 'archived') return 'archived';
  if (row.state !== 'active') throw invariant('The persisted Family household state is invalid.');
  if (row.access_state === 'inactive') return 'inactive';
  if (row.access_state === 'free' && row.free_access_expires_at !== null) {
    const expiry = new Date(String(row.free_access_expires_at));
    if (!Number.isFinite(expiry.getTime())) {
      throw invariant('The persisted Family free-access expiry is invalid.');
    }
    if (expiry.getTime() <= Date.now()) return 'expired';
  }
  return 'active';
}

function sameBinding(left: FamilySignupRequestBinding, right: FamilySignupRequestBinding): boolean {
  return (
    left.operation === right.operation &&
    left.idempotency_key === right.idempotency_key &&
    left.canonical_request_digest === right.canonical_request_digest &&
    sameScope(left.scope, right.scope)
  );
}

function sameScope(left: FamilySignupScope, right: FamilySignupScope): boolean {
  return (
    left.product === right.product &&
    left.runtime_tier === right.runtime_tier &&
    left.verification_environment_id === right.verification_environment_id
  );
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw invariant(`The persisted ${field} is missing.`);
  }
  return value;
}

function enumText<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): Values[number] {
  const parsed = requiredText(value, 'enum value');
  if (!values.includes(parsed)) throw invariant(`The persisted value ${parsed} is invalid.`);
  return parsed as Values[number];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function invariant(message: string): PostgresFamilySignupRepositoryError {
  return new PostgresFamilySignupRepositoryError('persistence_invariant', message);
}
