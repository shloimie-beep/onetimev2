import { createHash } from 'node:crypto';
import {
  APPROVED_SCHOOL_CONFIGURATION_OPERATION,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE,
  SCHOOL_INQUIRY_OPERATION,
  type ApprovedSchoolConfiguration,
  type ApprovedSchoolRecord,
  type SchoolInquiryReceipt,
  type SchoolInquiryRequestBinding,
  type SchoolSignupScope,
} from '../../../../contracts/src/signup/school/index.ts';
import type { CanonicalSchoolInquiry } from '../../../../domain/src/signup/school/index.ts';

type SqlRow = Record<string, unknown>;

export type SchoolSignupSqlResult = {
  rows: readonly SqlRow[];
  rowCount: number | null;
};

export interface SchoolSignupSqlClient {
  query(sql: string, values?: readonly unknown[]): Promise<SchoolSignupSqlResult>;
  release?(): void;
}

export interface SchoolSignupSqlPool {
  connect(): Promise<SchoolSignupSqlClient>;
}

export interface SchoolSignupCrmBinding {
  accountKey: string;
  productKey: string;
}

export class PostgresSchoolSignupRepositoryError extends Error {
  constructor(
    readonly code:
      'invalid_transaction_sequence' | 'persistence_invariant' | 'read_only_environment',
    message: string,
  ) {
    super(message);
    this.name = 'PostgresSchoolSignupRepositoryError';
  }
}

export function createPostgresSchoolSignupRepository(
  pool: SchoolSignupSqlPool,
  crmBinding: SchoolSignupCrmBinding,
) {
  return {
    async transaction<T>(
      run: (transaction: PostgresSchoolSignupTransaction) => Promise<T>,
    ): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await run(new PostgresSchoolSignupTransaction(client, crmBinding));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release?.();
      }
    },
  };
}

export class PostgresSchoolSignupTransaction {
  private inquiryLock:
    | {
        scope: SchoolSignupScope;
        operation: typeof SCHOOL_INQUIRY_OPERATION;
        normalizedEmail: string;
      }
    | undefined;
  private approvedSchoolIdempotencyLock:
    { scope: SchoolSignupScope; idempotencyKey: string } | undefined;
  private approvedSchoolAggregateLock:
    { scope: SchoolSignupScope; approvedSchoolId: string } | undefined;

  constructor(
    private readonly db: SchoolSignupSqlClient,
    private readonly crmBinding: SchoolSignupCrmBinding,
  ) {}

  async findInquiry(input: {
    scope: SchoolSignupScope;
    operation: typeof SCHOOL_INQUIRY_OPERATION;
    normalized_email: string;
  }): Promise<SchoolInquiryReceipt | null> {
    if (this.inquiryLock) {
      throw sequenceError('A School-inquiry transaction may lock only one deduplication key.');
    }
    await advisoryLock(
      this.db,
      [
        'school-inquiry',
        input.scope.product,
        input.scope.runtime_tier,
        input.scope.verification_environment_id,
        input.operation,
        input.normalized_email,
      ].join(':'),
    );
    this.inquiryLock = {
      scope: { ...input.scope },
      operation: input.operation,
      normalizedEmail: input.normalized_email,
    };
    return loadInquiry(this.db, input);
  }

  async createInquiryOrReadExisting(input: {
    request_binding: SchoolInquiryRequestBinding;
    request: CanonicalSchoolInquiry;
    receipt: SchoolInquiryReceipt;
  }): Promise<
    | { disposition: 'created'; receipt: SchoolInquiryReceipt }
    | { disposition: 'existing'; receipt: SchoolInquiryReceipt }
  > {
    this.assertInquiryLock(input.request_binding);
    if (input.request_binding.scope.verification_environment_id === 'production_read_only') {
      throw new PostgresSchoolSignupRepositoryError(
        'read_only_environment',
        'School inquiries cannot write in production_read_only.',
      );
    }
    assertCreateInput(input);

    const binding = input.request_binding;
    const lead = input.receipt.lead;
    const acknowledgment = input.receipt.acknowledgment;
    if (this.crmBinding.productKey !== binding.scope.product) {
      throw invariant('The School-inquiry CRM product binding does not match the request scope.');
    }
    const inserted = await this.db.query(
      `INSERT INTO onetime.school_inquiries_v21
         (lead_id, product, runtime_tier, verification_environment_id,
          operation, normalized_email, canonical_request_digest, school_name,
          contact_first_name, contact_last_name, phone, note,
          adult_contact_kind, sales_state, acknowledgment_intent_id,
          receipt_json, product_account_created, parent_login_created,
          passwordless_claim_created, household_created, student_accounts_created,
          subscription_created, product_access_granted, nurture_enrolled,
          provider_identity_ref)
       VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
          'adult','pending_manual_follow_up',$13,$14::jsonb,
          false,false,false,false,0,false,false,false,NULL)
       ON CONFLICT (product, runtime_tier, verification_environment_id, normalized_email)
       DO NOTHING
       RETURNING lead_id`,
      [
        lead.lead_id,
        binding.scope.product,
        binding.scope.runtime_tier,
        binding.scope.verification_environment_id,
        binding.operation,
        binding.normalized_email,
        binding.canonical_request_digest,
        input.request.school_name,
        input.request.contact_first_name,
        input.request.contact_last_name,
        input.request.phone,
        input.request.note,
        acknowledgment.intent_id,
        JSON.stringify(input.receipt),
      ],
    );

    if (inserted.rowCount === 0) {
      const existing = await loadInquiry(this.db, {
        scope: binding.scope,
        operation: binding.operation,
        normalized_email: binding.normalized_email,
      });
      if (!existing) {
        throw invariant(
          'The School-inquiry deduplication key conflicted without a durable winning receipt.',
        );
      }
      return { disposition: 'existing', receipt: existing };
    }
    if (inserted.rowCount !== 1) {
      throw invariant('The School-inquiry insert did not affect exactly one row.');
    }

    await upsertSchoolInquiryCrmContact(this.db, {
      accountKey: this.crmBinding.accountKey,
      productKey: this.crmBinding.productKey,
      contactKey: `contact_${lead.lead_id}`,
      displayName: `${input.request.contact_first_name} ${input.request.contact_last_name}`.trim(),
      schoolName: input.request.school_name,
      normalizedEmail: binding.normalized_email,
      phone: input.request.phone,
    });

    await insertExactlyOne(
      this.db,
      `INSERT INTO onetime.school_inquiry_acknowledgments_v21
         (intent_id, lead_id, product, runtime_tier, verification_environment_id,
          normalized_email, normalized_email_hash, kind, workflow_id, template_id,
          template_version, sender_key, rendered_subject, content_digest,
          delivery_state, local_commit_required, notification_json)
       VALUES
         ($1,$2,$3,$4,$5,$6,$7,'school_inquiry_acknowledgment',
          $8,$9,$10,$11,$12,$13,'pending',true,$14::jsonb)`,
      [
        acknowledgment.intent_id,
        lead.lead_id,
        binding.scope.product,
        binding.scope.runtime_tier,
        binding.scope.verification_environment_id,
        binding.normalized_email,
        acknowledgment.normalized_email_hash,
        acknowledgment.notification.workflow_id,
        acknowledgment.notification.template_id,
        acknowledgment.notification.template_version,
        acknowledgment.notification.sender_key,
        acknowledgment.notification.subject,
        acknowledgment.notification.content_digest,
        JSON.stringify(acknowledgment.notification),
      ],
      'School-inquiry acknowledgment intent',
    );

    return { disposition: 'created', receipt: input.receipt };
  }

  async findApprovedSchoolByIdempotencyKey(input: {
    scope: SchoolSignupScope;
    operation: typeof APPROVED_SCHOOL_CONFIGURATION_OPERATION;
    idempotency_key: string;
  }): Promise<ApprovedSchoolRecord | null> {
    if (this.approvedSchoolIdempotencyLock) {
      throw sequenceError('An approved School transaction may lock only one idempotency key.');
    }
    await advisoryLock(
      this.db,
      [
        'approved-school-idempotency',
        input.scope.product,
        input.scope.runtime_tier,
        input.scope.verification_environment_id,
        input.idempotency_key,
      ].join(':'),
    );
    this.approvedSchoolIdempotencyLock = {
      scope: { ...input.scope },
      idempotencyKey: input.idempotency_key,
    };
    const durableReplay = await loadApprovedSchoolHistory(this.db, {
      scope: input.scope,
      idempotency_key: input.idempotency_key,
    });
    if (durableReplay) return durableReplay;
    return loadApprovedSchool(this.db, {
      scope: input.scope,
      where: 'idempotency_key',
      value: input.idempotency_key,
      forUpdate: false,
    });
  }

  async readApprovedSchoolForUpdate(input: {
    scope: SchoolSignupScope;
    operation: typeof APPROVED_SCHOOL_CONFIGURATION_OPERATION;
    approved_school_id: string;
  }): Promise<ApprovedSchoolRecord | null> {
    if (this.approvedSchoolAggregateLock) {
      throw sequenceError('An approved School transaction may lock only one aggregate.');
    }
    await advisoryLock(
      this.db,
      [
        'approved-school-aggregate',
        input.scope.product,
        input.scope.runtime_tier,
        input.scope.verification_environment_id,
        input.approved_school_id,
      ].join(':'),
    );
    this.approvedSchoolAggregateLock = {
      scope: { ...input.scope },
      approvedSchoolId: input.approved_school_id,
    };
    return loadApprovedSchool(this.db, {
      scope: input.scope,
      where: 'approved_school_id',
      value: input.approved_school_id,
      forUpdate: true,
    });
  }

  async commitApprovedSchoolConfiguration(input: {
    scope: SchoolSignupScope;
    operation: typeof APPROVED_SCHOOL_CONFIGURATION_OPERATION;
    configuration: ApprovedSchoolConfiguration;
  }): Promise<void> {
    if (input.scope.verification_environment_id === 'production_read_only') {
      throw new PostgresSchoolSignupRepositoryError(
        'read_only_environment',
        'Approved School configuration cannot write in production_read_only.',
      );
    }
    if (!sameScope(input.scope, input.configuration.request_binding.scope)) {
      throw invariant('The approved School configuration changed its runtime scope.');
    }
    this.assertApprovedSchoolLocks(input.configuration);
    const record = input.configuration;
    const values = approvedSchoolValues(record);
    const result =
      record.expected_prior_version === 0
        ? await this.db.query(
            `INSERT INTO onetime.approved_school_configuration_authority_v21
               (product_key, runtime_tier, verification_environment_id,
                approved_school_id, household_id, adult_account_manager_id,
                seat_allowance, price_minor_units, currency, billing_starts_at,
                terms_reference, immutable_contract_reference, authorization_reason,
                authorized_by_human_account_id, authorized_at, idempotency_key,
                canonical_request_hash, expected_prior_version, configuration_version,
                audit_ref, created_at, updated_at)
             VALUES
               ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
            values,
          )
        : await this.db.query(
            `UPDATE onetime.approved_school_configuration_authority_v21
                SET adult_account_manager_id = $6,
                    seat_allowance = $7,
                    price_minor_units = $8,
                    currency = $9,
                    billing_starts_at = $10,
                    terms_reference = $11,
                    authorization_reason = $13,
                    authorized_by_human_account_id = $14,
                    authorized_at = $15,
                    idempotency_key = $16,
                    canonical_request_hash = $17,
                    expected_prior_version = $18,
                    configuration_version = $19,
                    audit_ref = $20,
                    updated_at = $22
              WHERE product_key = $1
                AND runtime_tier = $2
                AND verification_environment_id = $3
                AND approved_school_id = $4
                AND household_id = $5
                AND immutable_contract_reference = $12
                AND configuration_version = $18`,
            values,
          );
    if (result.rowCount !== 1) {
      throw invariant('The approved School optimistic configuration write did not commit.');
    }
  }

  async readApprovedSchool(input: {
    scope: SchoolSignupScope;
    operation: typeof APPROVED_SCHOOL_CONFIGURATION_OPERATION;
    approved_school_id: string;
  }): Promise<ApprovedSchoolRecord | null> {
    return loadApprovedSchool(this.db, {
      scope: input.scope,
      where: 'approved_school_id',
      value: input.approved_school_id,
      forUpdate: false,
    });
  }

  private assertInquiryLock(binding: SchoolInquiryRequestBinding): void {
    const locked = this.inquiryLock;
    if (
      !locked ||
      locked.operation !== binding.operation ||
      locked.normalizedEmail !== binding.normalized_email ||
      !sameScope(locked.scope, binding.scope)
    ) {
      throw sequenceError(
        'The School-inquiry write was not preceded by its exact deduplication lock.',
      );
    }
  }

  private assertApprovedSchoolLocks(configuration: ApprovedSchoolConfiguration): void {
    const idempotency = this.approvedSchoolIdempotencyLock;
    const aggregate = this.approvedSchoolAggregateLock;
    if (
      !idempotency ||
      !aggregate ||
      idempotency.idempotencyKey !== configuration.request_binding.idempotency_key ||
      aggregate.approvedSchoolId !== configuration.approved_school_id ||
      !sameScope(idempotency.scope, configuration.request_binding.scope) ||
      !sameScope(aggregate.scope, configuration.request_binding.scope)
    ) {
      throw sequenceError(
        'The approved School write was not preceded by its exact idempotency and aggregate locks.',
      );
    }
  }
}

async function upsertSchoolInquiryCrmContact(
  db: SchoolSignupSqlClient,
  input: {
    accountKey: string;
    productKey: string;
    contactKey: string;
    displayName: string;
    schoolName: string;
    normalizedEmail: string;
    phone: string | null;
  },
): Promise<void> {
  const result = await db.query(
    `INSERT INTO onetime.contacts
       (contact_key, public_contact_id, account_key, product_key, display_name,
        family_school_classification, family_or_school, location_text, timezone,
        email_normalized, phone_normalized, reminder_preference,
        consent_policy_version, consent_recorded_at, suppression_state, source,
        lead_status, last_activity_at, created_at, updated_at)
     VALUES ($1, gen_random_uuid()::text, $2, $3, $4,
             'school', $5, 'Not provided', 'Not provided',
             $6, $7, 'none', NULL, NULL, 'active', 'one_time_school_inquiry',
             'new', now(), now(), now())
     ON CONFLICT (account_key, product_key, email_normalized)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       family_school_classification = 'school',
       family_or_school = EXCLUDED.family_or_school,
       last_activity_at = EXCLUDED.last_activity_at,
       updated_at = EXCLUDED.updated_at,
       version = onetime.contacts.version + 1,
       identity_version = onetime.contacts.identity_version + 1
     RETURNING contact_key`,
    [
      input.contactKey,
      input.accountKey,
      input.productKey,
      input.displayName,
      input.schoolName,
      input.normalizedEmail,
      input.phone,
    ],
  );
  if (result.rowCount !== 1) {
    throw invariant('School inquiry did not resolve exactly one CRM adult contact.');
  }
}

async function loadApprovedSchoolHistory(
  db: SchoolSignupSqlClient,
  input: { scope: SchoolSignupScope; idempotency_key: string },
): Promise<ApprovedSchoolRecord | null> {
  const result = await db.query(
    `SELECT history.product_key,
            history.runtime_tier,
            history.verification_environment_id,
            history.approved_school_id,
            history.household_id,
            history.adult_account_manager_id,
            history.seat_allowance,
            history.price_minor_units,
            history.currency,
            history.billing_starts_at,
            history.terms_reference,
            history.immutable_contract_reference,
            history.authorization_reason,
            history.authorized_by_human_account_id,
            history.authorized_at,
            history.idempotency_key,
            history.canonical_request_hash,
            history.expected_prior_version,
            history.configuration_version,
            history.audit_ref,
            authority.created_at,
            history.committed_at AS updated_at
       FROM onetime.approved_school_configuration_history_v21 AS history
       JOIN onetime.approved_school_configuration_authority_v21 AS authority
         ON authority.product_key = history.product_key
        AND authority.runtime_tier = history.runtime_tier
        AND authority.verification_environment_id = history.verification_environment_id
        AND authority.approved_school_id = history.approved_school_id
      WHERE history.product_key = $1
        AND history.runtime_tier = $2
        AND history.verification_environment_id = $3
        AND history.idempotency_key = $4`,
    [
      input.scope.product,
      input.scope.runtime_tier,
      input.scope.verification_environment_id,
      input.idempotency_key,
    ],
  );
  if (result.rowCount === 0) return null;
  if (result.rowCount !== 1) {
    throw invariant('An approved School replay key resolved to more than one committed version.');
  }
  const row = result.rows[0];
  if (!row) throw invariant('The approved School replay history row was missing.');
  return storedApprovedSchool(row);
}

async function loadApprovedSchool(
  db: SchoolSignupSqlClient,
  input: {
    scope: SchoolSignupScope;
    where: 'approved_school_id' | 'idempotency_key';
    value: string;
    forUpdate: boolean;
  },
): Promise<ApprovedSchoolRecord | null> {
  const result = await db.query(
    `SELECT product_key, runtime_tier, verification_environment_id,
            approved_school_id, household_id, adult_account_manager_id,
            seat_allowance, price_minor_units, currency, billing_starts_at,
            terms_reference, immutable_contract_reference, authorization_reason,
            authorized_by_human_account_id, authorized_at, idempotency_key,
            canonical_request_hash, expected_prior_version, configuration_version,
            audit_ref, created_at, updated_at
       FROM onetime.approved_school_configuration_authority_v21
      WHERE product_key = $1
        AND runtime_tier = $2
        AND verification_environment_id = $3
        AND ${input.where} = $4${input.forUpdate ? '\n      FOR UPDATE' : ''}`,
    [
      input.scope.product,
      input.scope.runtime_tier,
      input.scope.verification_environment_id,
      input.value,
    ],
  );
  if (result.rowCount === 0) return null;
  if (result.rowCount !== 1) {
    throw invariant('An approved School key resolved to more than one configuration.');
  }
  const row = result.rows[0];
  if (!row) throw invariant('The approved School row was missing.');
  return storedApprovedSchool(row);
}

function storedApprovedSchool(row: SqlRow): ApprovedSchoolRecord {
  const scope = storedScope({ ...row, product: row.product_key });
  return {
    request_binding: {
      scope,
      operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
      idempotency_key: requiredText(row.idempotency_key, 'idempotency_key'),
      canonical_request_hash: lowerSha256(row.canonical_request_hash, 'canonical_request_hash'),
    },
    approved_school_id: requiredText(row.approved_school_id, 'approved_school_id'),
    household_id: requiredText(row.household_id, 'household_id'),
    adult_account_manager_id: requiredText(
      row.adult_account_manager_id,
      'adult_account_manager_id',
    ),
    seat_allowance: positiveInteger(row.seat_allowance, 'seat_allowance'),
    price_minor_units: nonNegativeInteger(row.price_minor_units, 'price_minor_units'),
    currency: enumText(row.currency, ['USD']),
    billing_starts_at: storedTimestamp(row.billing_starts_at, 'billing_starts_at'),
    terms_reference: requiredText(row.terms_reference, 'terms_reference'),
    immutable_contract_reference: requiredText(
      row.immutable_contract_reference,
      'immutable_contract_reference',
    ),
    authorization_reason: requiredText(row.authorization_reason, 'authorization_reason'),
    authorized_by_human_account_id: requiredText(
      row.authorized_by_human_account_id,
      'authorized_by_human_account_id',
    ),
    authorized_at: storedTimestamp(row.authorized_at, 'authorized_at'),
    expected_prior_version: nonNegativeInteger(
      row.expected_prior_version,
      'expected_prior_version',
    ),
    configuration_version: positiveInteger(row.configuration_version, 'configuration_version'),
    audit_ref: requiredText(row.audit_ref, 'audit_ref'),
    created_at: storedTimestamp(row.created_at, 'created_at'),
    updated_at: storedTimestamp(row.updated_at, 'updated_at'),
  };
}

function approvedSchoolValues(configuration: ApprovedSchoolConfiguration): readonly unknown[] {
  return [
    configuration.request_binding.scope.product,
    configuration.request_binding.scope.runtime_tier,
    configuration.request_binding.scope.verification_environment_id,
    configuration.approved_school_id,
    configuration.household_id,
    configuration.adult_account_manager_id,
    configuration.seat_allowance,
    configuration.price_minor_units,
    configuration.currency,
    configuration.billing_starts_at,
    configuration.terms_reference,
    configuration.immutable_contract_reference,
    configuration.authorization_reason,
    configuration.authorized_by_human_account_id,
    configuration.authorized_at,
    configuration.request_binding.idempotency_key,
    configuration.request_binding.canonical_request_hash,
    configuration.expected_prior_version,
    configuration.configuration_version,
    configuration.audit_ref,
    configuration.created_at,
    configuration.updated_at,
  ];
}

async function loadInquiry(
  db: SchoolSignupSqlClient,
  input: {
    scope: SchoolSignupScope;
    operation: typeof SCHOOL_INQUIRY_OPERATION;
    normalized_email: string;
  },
): Promise<SchoolInquiryReceipt | null> {
  const result = await db.query(
    `SELECT inquiry.lead_id,
            inquiry.product,
            inquiry.runtime_tier,
            inquiry.verification_environment_id,
            inquiry.operation,
            inquiry.normalized_email,
            inquiry.canonical_request_digest,
            inquiry.school_name,
            inquiry.contact_first_name,
            inquiry.contact_last_name,
            inquiry.phone,
            inquiry.note,
            inquiry.adult_contact_kind,
            inquiry.sales_state,
            inquiry.acknowledgment_intent_id,
            inquiry.receipt_json,
            inquiry.product_account_created,
            inquiry.parent_login_created,
            inquiry.passwordless_claim_created,
            inquiry.household_created,
            inquiry.student_accounts_created,
            inquiry.subscription_created,
            inquiry.product_access_granted,
            inquiry.nurture_enrolled,
            inquiry.provider_identity_ref,
            acknowledgment.intent_id AS ack_intent_id,
            acknowledgment.normalized_email_hash,
            acknowledgment.kind AS acknowledgment_kind,
            acknowledgment.workflow_id,
            acknowledgment.template_id,
            acknowledgment.template_version,
            acknowledgment.sender_key,
            acknowledgment.rendered_subject,
            acknowledgment.content_digest,
            acknowledgment.delivery_state,
            acknowledgment.local_commit_required,
            acknowledgment.notification_json
       FROM onetime.school_inquiries_v21 AS inquiry
       JOIN onetime.school_inquiry_acknowledgments_v21 AS acknowledgment
         ON acknowledgment.lead_id = inquiry.lead_id
        AND acknowledgment.intent_id = inquiry.acknowledgment_intent_id
        AND acknowledgment.product = inquiry.product
        AND acknowledgment.runtime_tier = inquiry.runtime_tier
        AND acknowledgment.verification_environment_id =
            inquiry.verification_environment_id
        AND acknowledgment.normalized_email = inquiry.normalized_email
      WHERE inquiry.product = $1
        AND inquiry.runtime_tier = $2
        AND inquiry.verification_environment_id = $3
        AND inquiry.operation = $4
        AND inquiry.normalized_email = $5`,
    [
      input.scope.product,
      input.scope.runtime_tier,
      input.scope.verification_environment_id,
      input.operation,
      input.normalized_email,
    ],
  );
  if (result.rowCount === 0) return null;
  if (result.rowCount !== 1) {
    throw invariant('A School-inquiry key resolved to more than one durable receipt.');
  }
  const row = result.rows[0];
  if (!row) throw invariant('The School-inquiry row was missing.');
  return storedReceipt(row);
}

function storedReceipt(row: SqlRow): SchoolInquiryReceipt {
  const scope = storedScope(row);
  const operation = enumText(row.operation, [SCHOOL_INQUIRY_OPERATION]);
  const canonicalRequestDigest = lowerSha256(
    row.canonical_request_digest,
    'canonical_request_digest',
  );
  const normalizedEmail = requiredText(row.normalized_email, 'normalized_email');
  if (normalizedEmail !== normalizedEmail.trim().toLowerCase()) {
    throw invariant('The persisted School-inquiry email is not normalized.');
  }
  const binding: SchoolInquiryRequestBinding = {
    scope,
    operation,
    normalized_email: normalizedEmail,
    canonical_request_digest: canonicalRequestDigest,
  };

  if (
    row.adult_contact_kind !== 'adult' ||
    row.sales_state !== 'pending_manual_follow_up' ||
    row.product_account_created !== false ||
    row.parent_login_created !== false ||
    row.passwordless_claim_created !== false ||
    row.household_created !== false ||
    Number(row.student_accounts_created) !== 0 ||
    row.subscription_created !== false ||
    row.product_access_granted !== false ||
    row.nurture_enrolled !== false ||
    row.provider_identity_ref !== null
  ) {
    throw invariant('The persisted School inquiry contains a prohibited product effect.');
  }

  const notificationJson = jsonObject(row.notification_json, 'notification_json');
  const expectedNotificationKeys = [
    'body',
    'content_digest',
    'sender_key',
    'subject',
    'template_id',
    'template_version',
    'workflow_id',
  ];
  if (
    Object.keys(notificationJson).sort().join(',') !== expectedNotificationKeys.join(',') ||
    row.acknowledgment_kind !== 'school_inquiry_acknowledgment' ||
    row.workflow_id !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.workflow_id ||
    row.template_id !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_id ||
    row.template_version !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_version ||
    row.sender_key !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.sender_key ||
    row.rendered_subject !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.subject ||
    row.content_digest !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST ||
    row.delivery_state !== 'pending' ||
    row.local_commit_required !== true ||
    notificationJson.workflow_id !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.workflow_id ||
    notificationJson.template_id !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_id ||
    notificationJson.template_version !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_version ||
    notificationJson.sender_key !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.sender_key ||
    notificationJson.subject !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.subject ||
    notificationJson.body !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.body ||
    notificationJson.content_digest !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST
  ) {
    throw invariant('The persisted School acknowledgment changed its approved template binding.');
  }

  const leadId = requiredText(row.lead_id, 'lead_id');
  const intentId = requiredText(row.ack_intent_id, 'acknowledgment intent_id');
  if (row.acknowledgment_intent_id !== intentId || intentId !== `${leadId}:acknowledgment`) {
    throw invariant('The persisted School inquiry and acknowledgment IDs disagree.');
  }

  const receipt: SchoolInquiryReceipt = {
    request_binding: binding,
    lead: {
      lead_id: leadId,
      adult_contact_kind: 'adult',
      school_name: requiredText(row.school_name, 'school_name'),
      contact_first_name: requiredText(row.contact_first_name, 'contact_first_name'),
      contact_last_name: requiredText(row.contact_last_name, 'contact_last_name'),
      normalized_email: normalizedEmail,
      phone: optionalText(row.phone, 'phone'),
      note: optionalText(row.note, 'note'),
      sales_state: 'pending_manual_follow_up',
      product_account_created: false,
      parent_login_created: false,
      passwordless_claim_created: false,
      household_created: false,
      student_accounts_created: 0,
      subscription_created: false,
      product_access_granted: false,
    },
    acknowledgment: {
      intent_id: intentId,
      kind: 'school_inquiry_acknowledgment',
      request_binding: binding,
      normalized_email_hash: lowerSha256(row.normalized_email_hash, 'normalized_email_hash'),
      notification: {
        workflow_id: SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.workflow_id,
        template_id: SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_id,
        template_version: SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_version,
        sender_key: SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.sender_key,
        subject: SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.subject,
        body: SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.body,
        content_digest: SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
      },
      delivery_state: 'pending',
      local_commit_required: true,
    },
  };

  const storedReceiptJson = jsonObject(row.receipt_json, 'receipt_json');
  if (canonicalJson(storedReceiptJson) !== canonicalJson(receipt)) {
    throw invariant('The persisted School-inquiry receipt disagrees with its durable rows.');
  }
  return receipt;
}

function assertCreateInput(input: {
  request_binding: SchoolInquiryRequestBinding;
  request: CanonicalSchoolInquiry;
  receipt: SchoolInquiryReceipt;
}): void {
  const { request_binding: binding, request, receipt } = input;
  const acknowledgment = receipt.acknowledgment;
  const expectedIntentId = `${receipt.lead.lead_id}:acknowledgment`;
  if (
    !sameBinding(receipt.request_binding, binding) ||
    !sameBinding(acknowledgment.request_binding, binding) ||
    request.normalized_email !== binding.normalized_email ||
    receipt.lead.school_name !== request.school_name ||
    receipt.lead.contact_first_name !== request.contact_first_name ||
    receipt.lead.contact_last_name !== request.contact_last_name ||
    receipt.lead.normalized_email !== request.normalized_email ||
    receipt.lead.phone !== request.phone ||
    receipt.lead.note !== request.note ||
    receipt.lead.adult_contact_kind !== 'adult' ||
    receipt.lead.sales_state !== 'pending_manual_follow_up' ||
    receipt.lead.product_account_created ||
    receipt.lead.parent_login_created ||
    receipt.lead.passwordless_claim_created ||
    receipt.lead.household_created ||
    receipt.lead.student_accounts_created !== 0 ||
    receipt.lead.subscription_created ||
    receipt.lead.product_access_granted ||
    acknowledgment.intent_id !== expectedIntentId ||
    acknowledgment.kind !== 'school_inquiry_acknowledgment' ||
    acknowledgment.normalized_email_hash !== sha256(binding.normalized_email) ||
    acknowledgment.notification.workflow_id !==
      SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.workflow_id ||
    acknowledgment.notification.template_id !==
      SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_id ||
    acknowledgment.notification.template_version !==
      SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_version ||
    acknowledgment.notification.sender_key !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.sender_key ||
    acknowledgment.notification.subject !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.subject ||
    acknowledgment.notification.body !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.body ||
    acknowledgment.notification.content_digest !== SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST ||
    acknowledgment.delivery_state !== 'pending' ||
    acknowledgment.local_commit_required !== true
  ) {
    throw invariant('The School-inquiry receipt is not bound to the canonical request.');
  }
}

async function advisoryLock(db: SchoolSignupSqlClient, value: string): Promise<void> {
  const key = createHash('sha256').update(value, 'utf8').digest().readInt32BE(0);
  await db.query('SELECT pg_advisory_xact_lock($1)', [key]);
}

async function insertExactlyOne(
  db: SchoolSignupSqlClient,
  sql: string,
  values: readonly unknown[],
  aggregate: string,
): Promise<void> {
  const result = await db.query(sql, values);
  if (result.rowCount !== 1) {
    throw invariant(`The ${aggregate} insert did not affect exactly one row.`);
  }
}

function storedScope(row: SqlRow): SchoolSignupScope {
  const product = enumText(row.product, ['one_time_mishnayos']);
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
    (runtimeTier === 'isolated_staging' &&
      !['ci', 'provider_sandbox', 'persistent_staging'].includes(verificationEnvironmentId)) ||
    (runtimeTier === 'production' &&
      !['production_read_only', 'production_operator_canary', 'production_broad'].includes(
        verificationEnvironmentId,
      ))
  ) {
    throw invariant('The persisted School-signup runtime scope is invalid.');
  }
  return {
    product,
    runtime_tier: runtimeTier,
    verification_environment_id: verificationEnvironmentId,
  };
}

function sameBinding(left: SchoolInquiryRequestBinding, right: SchoolInquiryRequestBinding) {
  return (
    sameScope(left.scope, right.scope) &&
    left.operation === right.operation &&
    left.normalized_email === right.normalized_email &&
    left.canonical_request_digest === right.canonical_request_digest
  );
}

function sameScope(left: SchoolSignupScope, right: SchoolSignupScope) {
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

function optionalText(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredText(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw invariant(`The persisted ${field} is invalid.`);
  }
  return parsed;
}

function nonNegativeInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw invariant(`The persisted ${field} is invalid.`);
  }
  return parsed;
}

function storedTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw invariant(`The persisted ${field} is invalid.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw invariant(`The persisted ${field} is invalid.`);
  }
  return parsed.toISOString();
}

function enumText<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): Values[number] {
  const parsed = requiredText(value, 'enum value');
  if (!values.includes(parsed)) {
    throw invariant(`The persisted value ${parsed} is invalid.`);
  }
  return parsed as Values[number];
}

function lowerSha256(value: unknown, field: string): string {
  const parsed = requiredText(value, field);
  if (!/^[a-f0-9]{64}$/u.test(parsed)) {
    throw invariant(`The persisted ${field} is not a lowercase SHA-256 digest.`);
  }
  return parsed;
}

function jsonObject(value: unknown, field: string): SqlRow {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw invariant(`The persisted ${field} is malformed.`);
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw invariant(`The persisted ${field} is malformed.`);
  }
  return parsed as SqlRow;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as SqlRow)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function invariant(message: string): PostgresSchoolSignupRepositoryError {
  return new PostgresSchoolSignupRepositoryError('persistence_invariant', message);
}

function sequenceError(message: string): PostgresSchoolSignupRepositoryError {
  return new PostgresSchoolSignupRepositoryError('invalid_transaction_sequence', message);
}
