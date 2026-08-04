import { createHash } from 'node:crypto';

import {
  GOVERNED_CAMPAIGN_PROVIDER_BINDING,
  type GovernedCampaignAudienceDecision,
  type GovernedCampaignAudienceDecisionInput,
  type GovernedCampaignAudienceDecisionStoreProposal,
  type GovernedCampaignAudienceReason,
  type GovernedCampaignAudienceReasonCount,
  type GovernedCampaignProviderBinding,
  type GovernedCampaignRuntimeTier,
  type GovernedCampaignSanitizedSourceFacts,
  type GovernedCampaignSha256,
  type ReconcileGovernedCampaignAudienceRequest,
  type ReconcileGovernedCampaignAudienceResult,
} from './governed-campaign-decision-store.proposal.ts';

export type {
  GovernedCampaignAudienceDecision,
  GovernedCampaignAudienceDecisionInput,
  GovernedCampaignAudienceReason,
  GovernedCampaignAudienceReasonCount,
  GovernedCampaignProviderBinding,
  GovernedCampaignRuntimeTier,
  GovernedCampaignSanitizedSourceFacts,
  GovernedCampaignSha256,
  ReconcileGovernedCampaignAudienceRequest,
  ReconcileGovernedCampaignAudienceResult,
} from './governed-campaign-decision-store.proposal.ts';
export { GOVERNED_CAMPAIGN_PROVIDER_BINDING } from './governed-campaign-decision-store.proposal.ts';

export interface GovernedCampaignDecisionStoreSqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[]; rowCount?: number | null }>;
  release(): void;
}

export interface GovernedCampaignDecisionStoreSqlPool {
  connect(): Promise<GovernedCampaignDecisionStoreSqlClient>;
}

export type GovernedCampaignDecisionStoreErrorCode =
  | 'INVALID_REQUEST'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DECISION_VERSION_CONFLICT'
  | 'AFFECTED_ROWS_CEILING'
  | 'READBACK_MISMATCH'
  | 'TRANSACTION_FAILED_NO_RETRY';

export class GovernedCampaignDecisionStoreError extends Error {
  readonly code: GovernedCampaignDecisionStoreErrorCode;
  readonly originalCause?: unknown;

  constructor(
    code: GovernedCampaignDecisionStoreErrorCode,
    message: string,
    originalCause?: unknown,
  ) {
    super(message);
    this.name = 'GovernedCampaignDecisionStoreError';
    this.code = code;
    this.originalCause = originalCause;
  }
}

type RequestWithoutHash = Omit<ReconcileGovernedCampaignAudienceRequest, 'requestHash'>;

interface DecisionRow extends Record<string, unknown> {
  runtime_tier: string;
  verification_environment_id: string;
  account_key: string;
  product_key: string;
  campaign_key: string;
  provider_location_id: string;
  provider_campaign_id: string;
  provider_workflow_id: string;
  provider_launch_tag_id: string;
  decision_key: string;
  provider_contact_ref_hash: string;
  contact_key: string | null;
  decision: string;
  primary_reason: string;
  reason_codes: unknown;
  source_facts: unknown;
  snapshot_hash: string;
  source_observed_at: string | Date;
  decision_version: string | number;
  idempotency_key: string;
  request_hash: string;
  created_by_user_key: string;
  created_at: string | Date;
}

interface ReasonCountRow extends Record<string, unknown> {
  decision: string;
  primary_reason: string;
  rows: string | number;
}

interface HistoricalVersionRow extends Record<string, unknown> {
  provider_contact_ref_hash: string;
  max_decision_version: string | number;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const OPAQUE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const SOURCE_FACT_KEYS = [
  'activeOrCurrentSubscriberState',
  'adultEvidenceState',
  'consentState',
  'deliverabilityState',
  'identityMatchState',
  'providerSuppressionState',
  'schoolContactState',
  'sourceFactsHash',
  'sourceJoinCount',
  'studentOrMinorState',
] as const;
const AUDIENCE_REASONS = new Set<GovernedCampaignAudienceReason>([
  'eligible_inactive_adult',
  'inactive_adult_tisha_registrant',
  'inactive_adult_former_member',
  'inactive_adult_lead',
  'active_or_current_subscriber',
  'student_or_minor',
  'school_contact',
  'staff_or_test',
  'duplicate_contact',
  'missing_email',
  'invalid_email',
  'email_dnd_or_unsubscribed',
  'complaint',
  'hard_bounce',
  'provider_suppression',
  'ambiguous_identity',
  'unknown_consent',
]);
const AUDIENCE_DECISIONS = new Set<GovernedCampaignAudienceDecision>([
  'include',
  'exclude',
  'review',
]);

const DECISION_COLUMNS = `
  runtime_tier,
  verification_environment_id,
  account_key,
  product_key,
  campaign_key,
  provider_location_id,
  provider_campaign_id,
  provider_workflow_id,
  provider_launch_tag_id,
  decision_key,
  provider_contact_ref_hash,
  contact_key,
  decision,
  primary_reason,
  reason_codes,
  source_facts,
  snapshot_hash,
  source_observed_at,
  decision_version,
  idempotency_key,
  request_hash,
  created_by_user_key,
  created_at`;

export function createPostgresGovernedCampaignAudienceDecisionStore(
  pool: GovernedCampaignDecisionStoreSqlPool,
): GovernedCampaignAudienceDecisionStoreProposal {
  return {
    async reconcile(request) {
      validateRequest(request);
      return reconcileInTransaction(pool, request);
    },
  };
}

export function governedCampaignRequestHash(request: RequestWithoutHash): GovernedCampaignSha256 {
  return sha256(
    canonicalJson({
      runtimeTier: request.runtimeTier,
      verificationEnvironmentId: request.verificationEnvironmentId,
      accountKey: request.accountKey,
      productKey: request.productKey,
      campaignKey: request.campaignKey,
      binding: bindingProjection(request.binding),
      idempotencyKey: request.idempotencyKey,
      snapshotHash: request.snapshotHash,
      sourceObservedAt: normalizeTimestamp(request.sourceObservedAt),
      createdByUserKey: request.createdByUserKey,
      expectedDecisionRows: request.expectedDecisionRows,
      maximumAffectedRows: request.maximumAffectedRows,
      decisions: request.decisions.map(decisionProjection),
    }),
  );
}

export function governedCampaignProjectionHash(input: {
  runtimeTier: GovernedCampaignRuntimeTier;
  verificationEnvironmentId: string;
  accountKey: string;
  productKey: string;
  campaignKey: string;
  binding: GovernedCampaignProviderBinding;
  snapshotHash: GovernedCampaignSha256;
  requestHash: GovernedCampaignSha256;
  decisions: readonly GovernedCampaignAudienceDecisionInput[];
}): GovernedCampaignSha256 {
  return sha256(
    canonicalJson({
      runtimeTier: input.runtimeTier,
      verificationEnvironmentId: input.verificationEnvironmentId,
      accountKey: input.accountKey,
      productKey: input.productKey,
      campaignKey: input.campaignKey,
      binding: bindingProjection(input.binding),
      snapshotHash: input.snapshotHash,
      requestHash: input.requestHash,
      decisions: input.decisions.map(decisionProjection),
    }),
  );
}

export function governedCampaignDecisionKey(
  providerContactRefHash: GovernedCampaignSha256,
  decisionVersion: number,
) {
  return `governed-campaign:${providerContactRefHash}:v${decisionVersion}`;
}

export function governedCampaignAdvisoryLockIdentity(
  request: Pick<
    ReconcileGovernedCampaignAudienceRequest,
    | 'runtimeTier'
    | 'verificationEnvironmentId'
    | 'accountKey'
    | 'productKey'
    | 'campaignKey'
    | 'binding'
  >,
) {
  return [
    'governed-campaign-audience-decisions-v1',
    request.runtimeTier,
    request.verificationEnvironmentId,
    request.accountKey,
    request.productKey,
    request.campaignKey,
    request.binding.providerLocationId,
    request.binding.providerCampaignId,
    request.binding.providerWorkflowId,
    request.binding.providerLaunchTagId,
  ].join('\u001f');
}

async function reconcileInTransaction(
  pool: GovernedCampaignDecisionStoreSqlPool,
  request: ReconcileGovernedCampaignAudienceRequest,
): Promise<ReconcileGovernedCampaignAudienceResult> {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    transactionOpen = true;
    await client.query('SELECT pg_advisory_xact_lock($1)', [advisoryLockNumber(request)]);

    const currentRows = await readCurrentRows(client, request);
    const idempotencyRows = await readIdempotencyRows(client, request);

    if (idempotencyRows.length > 0) {
      assertExactReplay(request, currentRows, idempotencyRows);
      const readback = await verifyCurrentProjection(client, request, currentRows);
      await client.query('COMMIT');
      transactionOpen = false;
      return resultFor(request, readback, {
        replayed: true,
        insertedRows: 0,
        supersededRows: 0,
        affectedRows: 0,
        mutationStatements: 0,
      });
    }

    const historicalVersions = await readMaximumHistoricalVersions(client, request);
    validateNextVersions(request.decisions, historicalVersions);
    const insertedRows = request.decisions.length;
    const supersededRows = currentRows.length;
    const affectedRows = insertedRows + supersededRows;
    if (affectedRows > request.maximumAffectedRows) {
      fail(
        'AFFECTED_ROWS_CEILING',
        `planned ${affectedRows} affected rows exceeds maximumAffectedRows ${request.maximumAffectedRows}`,
      );
    }

    let mutationStatements = 0;
    if (supersededRows > 0) {
      const supersession = await client.query(
        `UPDATE onetime.governed_campaign_audience_decisions
            SET superseded_at = CURRENT_TIMESTAMP
          WHERE ${scopePredicate()}
            AND superseded_at IS NULL`,
        scopeValues(request),
      );
      mutationStatements += 1;
      if (Number(supersession.rowCount ?? 0) !== supersededRows) {
        fail('READBACK_MISMATCH', 'supersession row count changed under the exact-scope lock');
      }
    }

    if (insertedRows > 0) {
      const insertion = buildInsert(request);
      const inserted = await client.query(insertion.text, insertion.values);
      mutationStatements += 1;
      if (Number(inserted.rowCount ?? 0) !== insertedRows) {
        fail('READBACK_MISMATCH', 'insert row count did not match expectedDecisionRows');
      }
    }

    const finalRows = await readCurrentProjectionRows(client, request);
    const readback = await verifyCurrentProjection(client, request, finalRows);
    await client.query('COMMIT');
    transactionOpen = false;
    return resultFor(request, readback, {
      replayed: false,
      insertedRows,
      supersededRows,
      affectedRows,
      mutationStatements,
    });
  } catch (error) {
    let rollbackError: unknown;
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch (candidate) {
        rollbackError = candidate;
      }
    }
    if (error instanceof GovernedCampaignDecisionStoreError && rollbackError === undefined) {
      throw error;
    }
    throw new GovernedCampaignDecisionStoreError(
      'TRANSACTION_FAILED_NO_RETRY',
      rollbackError === undefined
        ? 'decision-store transaction failed and was rolled back; automatic retry is forbidden'
        : 'decision-store outcome is unknown because rollback also failed; automatic retry is forbidden',
      { transactionError: error, rollbackError },
    );
  } finally {
    client.release();
  }
}

function validateRequest(request: ReconcileGovernedCampaignAudienceRequest) {
  requireOpaqueKey(request.verificationEnvironmentId, 'verificationEnvironmentId');
  requireOpaqueKey(request.accountKey, 'accountKey');
  requireOpaqueKey(request.productKey, 'productKey');
  requireOpaqueKey(request.campaignKey, 'campaignKey');
  requireOpaqueKey(request.idempotencyKey, 'idempotencyKey');
  requireOpaqueKey(request.createdByUserKey, 'createdByUserKey');
  if (request.runtimeTier !== 'isolated_staging' && request.runtimeTier !== 'production') {
    invalid('runtimeTier is invalid');
  }
  if (!isExactBinding(request.binding)) invalid('provider binding is not the exact OT-15 binding');
  requireSha256(request.requestHash, 'requestHash');
  requireSha256(request.snapshotHash, 'snapshotHash');
  normalizeTimestamp(request.sourceObservedAt);
  if (!Number.isSafeInteger(request.expectedDecisionRows) || request.expectedDecisionRows <= 0) {
    invalid('expectedDecisionRows must be a positive safe integer');
  }
  if (!Number.isSafeInteger(request.maximumAffectedRows) || request.maximumAffectedRows <= 0) {
    invalid('maximumAffectedRows must be a positive safe integer');
  }
  if (request.decisions.length !== request.expectedDecisionRows) {
    invalid('expectedDecisionRows does not match decisions.length');
  }

  const decisionKeys = new Set<string>();
  const providerHashes = new Set<string>();
  let priorOrderKey = '';
  for (const decision of request.decisions) {
    requireOpaqueKey(decision.decisionKey, 'decisionKey');
    requireSha256(decision.providerContactRefHash, 'providerContactRefHash');
    if (decision.contactKey !== null) requireOpaqueKey(decision.contactKey, 'contactKey');
    if (!AUDIENCE_DECISIONS.has(decision.decision)) invalid('decision is not allowed');
    if (!AUDIENCE_REASONS.has(decision.primaryReason)) invalid('primaryReason is not allowed');
    if (!Number.isSafeInteger(decision.decisionVersion) || decision.decisionVersion <= 0) {
      invalid('decisionVersion must be a positive safe integer');
    }
    if (
      decision.decisionKey !==
      governedCampaignDecisionKey(decision.providerContactRefHash, decision.decisionVersion)
    ) {
      invalid('decisionKey must use the exact full protected-contact-hash and version form');
    }
    if (
      decision.reasonCodes.length === 0 ||
      !decision.reasonCodes.includes(decision.primaryReason)
    ) {
      invalid('reasonCodes must include primaryReason');
    }
    if (
      new Set(decision.reasonCodes).size !== decision.reasonCodes.length ||
      decision.reasonCodes.some((reason) => !AUDIENCE_REASONS.has(reason))
    ) {
      invalid('reasonCodes are invalid or duplicated');
    }
    validateSourceFacts(decision.sourceFacts);
    if (decisionKeys.has(decision.decisionKey)) invalid('decisionKey is duplicated');
    if (providerHashes.has(decision.providerContactRefHash)) {
      invalid('providerContactRefHash is duplicated');
    }
    decisionKeys.add(decision.decisionKey);
    providerHashes.add(decision.providerContactRefHash);
    const orderKey = `${decision.providerContactRefHash}\u001f${decision.decisionKey}`;
    if (priorOrderKey !== '' && orderKey <= priorOrderKey) {
      invalid('decisions must be in canonical provider-contact-hash and decision-key order');
    }
    priorOrderKey = orderKey;
  }

  const { requestHash, ...withoutHash } = request;
  const expectedHash = governedCampaignRequestHash(withoutHash);
  if (requestHash !== expectedHash) invalid('requestHash does not match canonical request');
}

function validateSourceFacts(facts: GovernedCampaignSanitizedSourceFacts) {
  if (typeof facts !== 'object' || facts === null || Array.isArray(facts)) {
    invalid('sourceFacts must be the exact sanitized object');
  }
  const keys = Object.keys(facts).sort();
  if (canonicalJson(keys) !== canonicalJson(SOURCE_FACT_KEYS)) {
    invalid('sourceFacts contains missing, arbitrary, private, or free-form fields');
  }
  requireEnum(
    facts.adultEvidenceState,
    ['proven', 'not_proven', 'conflicting'],
    'adultEvidenceState',
  );
  requireEnum(facts.studentOrMinorState, ['absent', 'present', 'unknown'], 'studentOrMinorState');
  requireEnum(facts.schoolContactState, ['absent', 'present', 'unknown'], 'schoolContactState');
  requireEnum(
    facts.activeOrCurrentSubscriberState,
    ['absent', 'present', 'unknown'],
    'activeOrCurrentSubscriberState',
  );
  requireEnum(facts.consentState, ['opted_in', 'opted_out', 'unknown'], 'consentState');
  requireEnum(
    facts.deliverabilityState,
    ['deliverable', 'invalid', 'missing', 'unknown'],
    'deliverabilityState',
  );
  requireEnum(
    facts.providerSuppressionState,
    ['active', 'suppressed', 'unknown'],
    'providerSuppressionState',
  );
  requireEnum(
    facts.identityMatchState,
    ['exact', 'duplicate', 'ambiguous', 'missing'],
    'identityMatchState',
  );
  if (!Number.isSafeInteger(facts.sourceJoinCount) || facts.sourceJoinCount < 0) {
    invalid('sourceJoinCount must be a non-negative safe integer');
  }
  requireSha256(facts.sourceFactsHash, 'sourceFactsHash');
}

function validateNextVersions(
  decisions: readonly GovernedCampaignAudienceDecisionInput[],
  historicalVersions: ReadonlyMap<string, number>,
) {
  for (const decision of decisions) {
    const expected = (historicalVersions.get(decision.providerContactRefHash) ?? 0) + 1;
    if (decision.decisionVersion !== expected) {
      fail(
        'DECISION_VERSION_CONFLICT',
        `decisionVersion for ${decision.providerContactRefHash} must be ${expected}`,
      );
    }
  }
}

function assertExactReplay(
  request: ReconcileGovernedCampaignAudienceRequest,
  currentRows: readonly DecisionRow[],
  idempotencyRows: readonly DecisionRow[],
) {
  if (
    idempotencyRows.length !== request.decisions.length ||
    currentRows.length !== request.decisions.length
  ) {
    fail('IDEMPOTENCY_CONFLICT', 'idempotency key exists with a different row count or history');
  }
  const expected = canonicalJson(request.decisions.map(decisionProjection));
  const idempotent = canonicalJson(idempotencyRows.map(rowDecisionProjection));
  const current = canonicalJson(currentRows.map(rowDecisionProjection));
  const hashesMatch = idempotencyRows.every(
    (row) =>
      row.request_hash === request.requestHash &&
      row.snapshot_hash === request.snapshotHash &&
      row.idempotency_key === request.idempotencyKey &&
      row.created_by_user_key === request.createdByUserKey,
  );
  if (!hashesMatch || expected !== idempotent || expected !== current) {
    fail('IDEMPOTENCY_CONFLICT', 'idempotency/request/snapshot/ordered-decision replay conflict');
  }
}

async function verifyCurrentProjection(
  client: GovernedCampaignDecisionStoreSqlClient,
  request: ReconcileGovernedCampaignAudienceRequest,
  rows: readonly DecisionRow[],
) {
  if (rows.length !== request.expectedDecisionRows) {
    fail('READBACK_MISMATCH', 'current projection row count mismatch');
  }
  const expectedDecisions = request.decisions.map(decisionProjection);
  const actualDecisions = rows.map(rowDecisionProjection);
  if (canonicalJson(actualDecisions) !== canonicalJson(expectedDecisions)) {
    fail('READBACK_MISMATCH', 'current projection ordered decisions mismatch');
  }
  if (
    rows.some(
      (row) =>
        row.request_hash !== request.requestHash ||
        row.snapshot_hash !== request.snapshotHash ||
        row.idempotency_key !== request.idempotencyKey ||
        row.created_by_user_key !== request.createdByUserKey,
    )
  ) {
    fail('READBACK_MISMATCH', 'current projection request/snapshot/idempotency mismatch');
  }

  const expectedReasonCounts = reasonCounts(request.decisions);
  const actualReasonCounts = await readReasonCounts(client, request);
  if (canonicalJson(actualReasonCounts) !== canonicalJson(expectedReasonCounts)) {
    fail('READBACK_MISMATCH', 'current projection reason-count readback mismatch');
  }

  const expectedHash = governedCampaignProjectionHash({
    ...scopeForHash(request),
    decisions: request.decisions,
  });
  const actualHash = governedCampaignProjectionHash({
    ...scopeForHash(request),
    decisions: rows.map(rowToDecisionInput),
  });
  if (actualHash !== expectedHash) {
    fail('READBACK_MISMATCH', 'current projection hash readback mismatch');
  }
  return {
    currentRows: rows.length,
    currentProjectionHash: actualHash,
    reasonCounts: actualReasonCounts,
  };
}

async function readCurrentRows(
  client: GovernedCampaignDecisionStoreSqlClient,
  request: ReconcileGovernedCampaignAudienceRequest,
) {
  const result = await client.query<DecisionRow>(
    `SELECT ${DECISION_COLUMNS}
       FROM onetime.governed_campaign_audience_decisions
      WHERE ${scopePredicate()}
        AND superseded_at IS NULL
      ORDER BY provider_contact_ref_hash, decision_key
      FOR UPDATE`,
    scopeValues(request),
  );
  return result.rows;
}

async function readMaximumHistoricalVersions(
  client: GovernedCampaignDecisionStoreSqlClient,
  request: ReconcileGovernedCampaignAudienceRequest,
) {
  const providerHashes = request.decisions.map((decision) => decision.providerContactRefHash);
  const placeholders = providerHashes.map((_, index) => `$${index + 10}`).join(', ');
  const result = await client.query<HistoricalVersionRow>(
    `SELECT provider_contact_ref_hash,
            max(decision_version)::text AS max_decision_version
       FROM onetime.governed_campaign_audience_decisions
      WHERE ${scopePredicate()}
        AND provider_contact_ref_hash IN (${placeholders})
      GROUP BY provider_contact_ref_hash
      ORDER BY provider_contact_ref_hash`,
    [...scopeValues(request), ...providerHashes],
  );
  return new Map(
    result.rows.map((row) => [row.provider_contact_ref_hash, Number(row.max_decision_version)]),
  );
}

async function readCurrentProjectionRows(
  client: GovernedCampaignDecisionStoreSqlClient,
  request: ReconcileGovernedCampaignAudienceRequest,
) {
  const result = await client.query<DecisionRow>(
    `SELECT ${DECISION_COLUMNS}
       FROM onetime.governed_campaign_audience_current
      WHERE ${scopePredicate()}
      ORDER BY provider_contact_ref_hash, decision_key`,
    scopeValues(request),
  );
  return result.rows;
}

async function readIdempotencyRows(
  client: GovernedCampaignDecisionStoreSqlClient,
  request: ReconcileGovernedCampaignAudienceRequest,
) {
  const result = await client.query<DecisionRow>(
    `SELECT ${DECISION_COLUMNS}
       FROM onetime.governed_campaign_audience_decisions
      WHERE ${scopePredicate()}
        AND idempotency_key = $10
      ORDER BY provider_contact_ref_hash, decision_key`,
    [...scopeValues(request), request.idempotencyKey],
  );
  return result.rows;
}

async function readReasonCounts(
  client: GovernedCampaignDecisionStoreSqlClient,
  request: ReconcileGovernedCampaignAudienceRequest,
) {
  const result = await client.query<ReasonCountRow>(
    `SELECT decision, primary_reason, count(*)::text AS rows
       FROM onetime.governed_campaign_audience_current
      WHERE ${scopePredicate()}
      GROUP BY decision, primary_reason
      ORDER BY decision, primary_reason`,
    scopeValues(request),
  );
  return result.rows.map((row) => ({
    decision: row.decision as GovernedCampaignAudienceDecision,
    primaryReason: row.primary_reason as GovernedCampaignAudienceReason,
    rows: Number(row.rows),
  }));
}

function buildInsert(request: ReconcileGovernedCampaignAudienceRequest) {
  const values: unknown[] = [];
  const tuples = request.decisions.map((decision) => {
    const tuple = [
      request.runtimeTier,
      request.verificationEnvironmentId,
      request.accountKey,
      request.productKey,
      request.campaignKey,
      request.binding.providerLocationId,
      request.binding.providerCampaignId,
      request.binding.providerWorkflowId,
      request.binding.providerLaunchTagId,
      decision.decisionKey,
      decision.providerContactRefHash,
      decision.contactKey,
      decision.decision,
      decision.primaryReason,
      JSON.stringify(decision.reasonCodes),
      JSON.stringify(decision.sourceFacts),
      request.snapshotHash,
      normalizeTimestamp(request.sourceObservedAt),
      decision.decisionVersion,
      request.idempotencyKey,
      request.requestHash,
      request.createdByUserKey,
    ];
    const start = values.length;
    values.push(...tuple);
    return `(${tuple
      .map((_, index) => {
        const placeholder = `$${start + index + 1}`;
        return index === 14 || index === 15 ? `${placeholder}::jsonb` : placeholder;
      })
      .join(', ')})`;
  });
  return {
    text: `INSERT INTO onetime.governed_campaign_audience_decisions (
      runtime_tier, verification_environment_id, account_key, product_key,
      campaign_key, provider_location_id, provider_campaign_id,
      provider_workflow_id, provider_launch_tag_id, decision_key,
      provider_contact_ref_hash, contact_key, decision, primary_reason,
      reason_codes, source_facts, snapshot_hash, source_observed_at,
      decision_version, idempotency_key, request_hash, created_by_user_key
    ) VALUES ${tuples.join(', ')}`,
    values,
  };
}

function resultFor(
  request: ReconcileGovernedCampaignAudienceRequest,
  readback: {
    currentRows: number;
    currentProjectionHash: GovernedCampaignSha256;
    reasonCounts: readonly GovernedCampaignAudienceReasonCount[];
  },
  effects: Pick<
    ReconcileGovernedCampaignAudienceResult,
    'replayed' | 'insertedRows' | 'supersededRows' | 'affectedRows' | 'mutationStatements'
  >,
): ReconcileGovernedCampaignAudienceResult {
  return {
    runtimeTier: request.runtimeTier,
    verificationEnvironmentId: request.verificationEnvironmentId,
    campaignKey: request.campaignKey,
    binding: request.binding,
    snapshotHash: request.snapshotHash,
    requestHash: request.requestHash,
    ...effects,
    ...readback,
    rawContactPiiIncluded: false,
    rawProviderContactIdentifiersIncluded: false,
    studentRecordsIncluded: false,
    contactEffects: 0,
    providerEffects: 0,
    sendEffects: 0,
  };
}

function scopePredicate() {
  return `runtime_tier = $1
    AND verification_environment_id = $2
    AND account_key = $3
    AND product_key = $4
    AND campaign_key = $5
    AND provider_location_id = $6
    AND provider_campaign_id = $7
    AND provider_workflow_id = $8
    AND provider_launch_tag_id = $9`;
}

function scopeValues(request: ReconcileGovernedCampaignAudienceRequest) {
  return [
    request.runtimeTier,
    request.verificationEnvironmentId,
    request.accountKey,
    request.productKey,
    request.campaignKey,
    request.binding.providerLocationId,
    request.binding.providerCampaignId,
    request.binding.providerWorkflowId,
    request.binding.providerLaunchTagId,
  ] as const;
}

function scopeForHash(request: ReconcileGovernedCampaignAudienceRequest) {
  return {
    runtimeTier: request.runtimeTier,
    verificationEnvironmentId: request.verificationEnvironmentId,
    accountKey: request.accountKey,
    productKey: request.productKey,
    campaignKey: request.campaignKey,
    binding: request.binding,
    snapshotHash: request.snapshotHash,
    requestHash: request.requestHash,
  };
}

function rowToDecisionInput(row: DecisionRow): GovernedCampaignAudienceDecisionInput {
  return {
    decisionKey: row.decision_key,
    providerContactRefHash: row.provider_contact_ref_hash as GovernedCampaignSha256,
    contactKey: row.contact_key,
    decision: row.decision as GovernedCampaignAudienceDecision,
    primaryReason: row.primary_reason as GovernedCampaignAudienceReason,
    reasonCodes: parseJson(row.reason_codes) as GovernedCampaignAudienceReason[],
    sourceFacts: parseJson(row.source_facts) as GovernedCampaignSanitizedSourceFacts,
    decisionVersion: Number(row.decision_version),
  };
}

function rowDecisionProjection(row: DecisionRow) {
  return decisionProjection(rowToDecisionInput(row));
}

function decisionProjection(decision: GovernedCampaignAudienceDecisionInput) {
  return {
    decisionKey: decision.decisionKey,
    providerContactRefHash: decision.providerContactRefHash,
    contactKey: decision.contactKey,
    decision: decision.decision,
    primaryReason: decision.primaryReason,
    reasonCodes: [...decision.reasonCodes],
    sourceFacts: { ...decision.sourceFacts },
    decisionVersion: decision.decisionVersion,
  };
}

function bindingProjection(binding: GovernedCampaignProviderBinding) {
  return {
    providerLocationId: binding.providerLocationId,
    providerCampaignId: binding.providerCampaignId,
    providerWorkflowId: binding.providerWorkflowId,
    providerLaunchTagId: binding.providerLaunchTagId,
  };
}

function reasonCounts(decisions: readonly GovernedCampaignAudienceDecisionInput[]) {
  const counts = new Map<string, GovernedCampaignAudienceReasonCount>();
  for (const decision of decisions) {
    const key = `${decision.decision}\u001f${decision.primaryReason}`;
    const current = counts.get(key);
    counts.set(key, {
      decision: decision.decision,
      primaryReason: decision.primaryReason,
      rows: (current?.rows ?? 0) + 1,
    });
  }
  return [...counts.values()].sort(
    (left, right) =>
      left.decision.localeCompare(right.decision) ||
      left.primaryReason.localeCompare(right.primaryReason),
  );
}

function isExactBinding(binding: GovernedCampaignProviderBinding) {
  return (
    binding.providerLocationId === GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLocationId &&
    binding.providerCampaignId === GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerCampaignId &&
    binding.providerWorkflowId === GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerWorkflowId &&
    binding.providerLaunchTagId === GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLaunchTagId
  );
}

function advisoryLockNumber(request: ReconcileGovernedCampaignAudienceRequest) {
  const prefix = createHash('sha256')
    .update(governedCampaignAdvisoryLockIdentity(request))
    .digest()
    .readInt32BE(0);
  return prefix;
}

function parseJson(value: unknown): unknown {
  if (typeof value === 'string') return JSON.parse(value);
  return value;
}

function normalizeTimestamp(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) invalid('sourceObservedAt must be an ISO timestamp');
  const normalized = parsed.toISOString();
  if (typeof value === 'string' && value !== normalized) {
    invalid('sourceObservedAt must be canonical UTC ISO-8601');
  }
  return normalized;
}

function requireOpaqueKey(value: string, field: string) {
  if (typeof value !== 'string' || !OPAQUE_KEY_PATTERN.test(value)) {
    invalid(`${field} must be an opaque non-PII key`);
  }
}

function requireSha256(value: string, field: string) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    invalid(`${field} must be a lowercase SHA-256 value`);
  }
}

function requireEnum(value: string, allowed: readonly string[], field: string) {
  if (!allowed.includes(value)) invalid(`${field} is outside the sanitized allowlist`);
}

function invalid(message: string): never {
  throw new GovernedCampaignDecisionStoreError('INVALID_REQUEST', message);
}

function fail(code: GovernedCampaignDecisionStoreErrorCode, message: string): never {
  throw new GovernedCampaignDecisionStoreError(code, message);
}

function sha256(value: string): GovernedCampaignSha256 {
  return createHash('sha256').update(value).digest('hex') as GovernedCampaignSha256;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) invalid('undefined is not canonical request data');
  return encoded;
}
