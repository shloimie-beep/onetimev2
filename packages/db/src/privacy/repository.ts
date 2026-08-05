import type {
  ConsentEvent,
  DataRightsRequest,
  ExportDownloadGrant,
  RecordingParticipantSnapshot,
  RetentionWorkItem,
} from '../../../contracts/src/privacy/index.ts';

type SqlRow = Record<string, unknown>;
type SqlResult<Row extends SqlRow = SqlRow> = { rows: Row[]; rowCount: number | null };

export interface PrivacySqlClient {
  query<Row extends SqlRow = SqlRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
  release(): void;
}

export interface PrivacySqlPool {
  connect(): Promise<PrivacySqlClient>;
}

export function createPostgresPrivacyRepository(pool: PrivacySqlPool) {
  return {
    async listConsentEvents(studentId: string): Promise<readonly ConsentEvent[]> {
      return execute(pool, async (client) => {
        const result = await client.query(
          `SELECT *
             FROM onetime.privacy_consent_event
            WHERE student_id = $1
            ORDER BY occurred_at, consent_event_id`,
          [studentId],
        );
        return result.rows.map(mapConsentEvent);
      });
    },

    async appendConsentEvent(event: ConsentEvent): Promise<boolean> {
      return execute(pool, async (client) => {
        const result = await client.query(
          `INSERT INTO onetime.privacy_consent_event
           (consent_event_id, idempotency_key, canonical_request_hash, actor_kind,
            actor_account_or_credential_id, actor_adult_id, household_id, student_id,
            relationship, parent_authority_attested, scope, choice, policy_versions,
            occurred_at, request_correlation_id, network_evidence_digest,
            supersedes_consent_event_id, reason_code)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            event.consent_event_id,
            event.idempotency_key,
            event.canonical_request_hash,
            event.actor_kind,
            event.actor_account_or_credential_id,
            event.actor_adult_id,
            event.household_id,
            event.student_id,
            event.relationship,
            event.parent_authority_attested,
            event.scope,
            event.choice,
            JSON.stringify(event.policy_versions),
            event.occurred_at,
            event.request_correlation_id,
            event.network_evidence_digest,
            event.supersedes_consent_event_id,
            event.reason_code,
          ],
        );
        return (result.rowCount ?? 0) === 1;
      });
    },

    async appendRecordingSnapshot(snapshot: RecordingParticipantSnapshot): Promise<boolean> {
      return execute(pool, async (client) => {
        const result = await client.query(
          `INSERT INTO onetime.recording_participant_snapshot
           (snapshot_id, occurrence_id, student_id, household_id, relationship,
            snapshot_json, created_at, audit_ref)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
           ON CONFLICT (occurrence_id, student_id) DO NOTHING`,
          [
            snapshot.snapshot_id,
            snapshot.occurrence_id,
            snapshot.student_id,
            snapshot.household_id,
            snapshot.relationship,
            JSON.stringify(snapshot),
            snapshot.created_at,
            snapshot.audit_ref,
          ],
        );
        return (result.rowCount ?? 0) === 1;
      });
    },

    async createDataRightsRequest(request: DataRightsRequest): Promise<boolean> {
      return execute(pool, async (client) => {
        const result = await client.query(
          `INSERT INTO onetime.data_rights_request
           (request_id, product, runtime_tier, verification_environment_id,
            kind, subject_json, requester_kind, requester_ref,
            requester_household_id, relationship_evidence, recent_password_session_id,
            state, visible_status, requested_categories, excluded_categories,
            legal_exception_codes, provider_cascades, dependent_review_required,
            dependent_review_completed, due_at, completed_at, terminal_reason_code,
            version, audit_refs)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                   $17::jsonb,$18,$19,$20,$21,$22,$23,$24)
           ON CONFLICT (request_id) DO NOTHING`,
          requestValues(request),
        );
        return (result.rowCount ?? 0) === 1;
      });
    },

    async loadDataRightsRequest(input: {
      request_id: string;
      product: string;
      runtime_tier: string;
      verification_environment_id: string;
    }): Promise<DataRightsRequest | null> {
      return execute(pool, async (client) => {
        const result = await client.query(
          `SELECT *
             FROM onetime.data_rights_request
            WHERE request_id = $1
              AND product = $2
              AND runtime_tier = $3
              AND verification_environment_id = $4`,
          [input.request_id, input.product, input.runtime_tier, input.verification_environment_id],
        );
        return result.rows[0] ? mapDataRightsRequest(result.rows[0]) : null;
      });
    },

    async listDataRightsRequests(input: {
      requester_ref: string;
      requester_household_id: string;
      product: string;
      runtime_tier: string;
      verification_environment_id: string;
    }): Promise<readonly DataRightsRequest[]> {
      return execute(pool, async (client) => {
        const result = await client.query(
          `SELECT *
             FROM onetime.data_rights_request
            WHERE requester_ref = $1
              AND requester_household_id = $2
              AND product = $3
              AND runtime_tier = $4
              AND verification_environment_id = $5
            ORDER BY due_at DESC, request_id DESC
            LIMIT 100`,
          [
            input.requester_ref,
            input.requester_household_id,
            input.product,
            input.runtime_tier,
            input.verification_environment_id,
          ],
        );
        return result.rows.map(mapDataRightsRequest);
      });
    },

    async persistDataRightsTransition(
      priorVersion: number,
      request: DataRightsRequest,
    ): Promise<boolean> {
      return execute(pool, async (client) => {
        const result = await client.query(
          `UPDATE onetime.data_rights_request
              SET state = $1, visible_status = $2, legal_exception_codes = $3,
                  provider_cascades = $4::jsonb, dependent_review_completed = $5,
                  completed_at = $6, terminal_reason_code = $7, version = $8,
                  audit_refs = $9
            WHERE request_id = $10
              AND product = $11
              AND runtime_tier = $12
              AND verification_environment_id = $13
              AND version = $14`,
          [
            request.state,
            request.visible_status,
            request.legal_exception_codes,
            JSON.stringify(request.provider_cascades),
            request.dependent_review_completed,
            request.completed_at,
            request.terminal_reason_code,
            request.version,
            request.audit_refs,
            request.request_id,
            request.product,
            request.runtime_tier,
            request.verification_environment_id,
            priorVersion,
          ],
        );
        return (result.rowCount ?? 0) === 1;
      });
    },

    async createDownloadGrant(grant: ExportDownloadGrant): Promise<boolean> {
      return execute(pool, async (client) => {
        const result = await client.query(
          `INSERT INTO onetime.export_download_grant
           (grant_id, request_id, product, runtime_tier, verification_environment_id,
            subject_binding_hash, token_hash,
            initiating_session_id, issued_at, expires_at, used_at, revoked_at, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (grant_id) DO NOTHING`,
          [
            grant.grant_id,
            grant.request_id,
            grant.product,
            grant.runtime_tier,
            grant.verification_environment_id,
            grant.subject_binding_hash,
            grant.token_hash,
            grant.initiating_session_id,
            grant.issued_at,
            grant.expires_at,
            grant.used_at,
            grant.revoked_at,
            grant.version,
          ],
        );
        return (result.rowCount ?? 0) === 1;
      });
    },

    async consumeDownloadGrant(priorVersion: number, grant: ExportDownloadGrant): Promise<boolean> {
      return execute(pool, async (client) => {
        const result = await client.query(
          `UPDATE onetime.export_download_grant
              SET used_at = $1, version = $2
            WHERE grant_id = $3
              AND product = $4
              AND runtime_tier = $5
              AND verification_environment_id = $6
              AND version = $7
              AND used_at IS NULL AND revoked_at IS NULL
              AND expires_at > $1`,
          [
            grant.used_at,
            grant.version,
            grant.grant_id,
            grant.product,
            grant.runtime_tier,
            grant.verification_environment_id,
            priorVersion,
          ],
        );
        return (result.rowCount ?? 0) === 1;
      });
    },

    async claimDue(input: {
      scope: {
        product: string;
        runtime_tier: string;
        verification_environment_id: string;
      };
      now: Date;
      limit: number;
    }): Promise<readonly RetentionWorkItem[]> {
      return execute(pool, async (client) => {
        const result = await client.query(
          `SELECT *
             FROM onetime.privacy_retention_work
            WHERE product = $1 AND runtime_tier = $2 AND verification_environment_id = $3
              AND state = 'due' AND due_at <= $4
            ORDER BY due_at, work_id
            LIMIT $5`,
          [
            input.scope.product,
            input.scope.runtime_tier,
            input.scope.verification_environment_id,
            input.now.toISOString(),
            input.limit,
          ],
        );
        return result.rows.map(mapRetentionWork);
      });
    },

    async persistPlan(input: {
      prior: RetentionWorkItem;
      next: RetentionWorkItem;
      purge_record: { record_digest: string };
    }): Promise<boolean> {
      return execute(pool, async (client) => {
        const result = await client.query(
          `UPDATE onetime.privacy_retention_work
              SET state = $1, version = $2, purge_record_digest = $3
            WHERE work_id = $4 AND version = $5 AND state = 'due'`,
          [
            input.next.state,
            input.next.version,
            input.purge_record.record_digest,
            input.prior.work_id,
            input.prior.version,
          ],
        );
        return (result.rowCount ?? 0) === 1;
      });
    },
  };
}

async function execute<T>(
  pool: PrivacySqlPool,
  run: (client: PrivacySqlClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await run(client);
  } finally {
    client.release();
  }
}

function requestValues(request: DataRightsRequest): readonly unknown[] {
  return [
    request.request_id,
    request.product,
    request.runtime_tier,
    request.verification_environment_id,
    request.kind,
    JSON.stringify(request.subject),
    request.requester_kind,
    request.requester_ref,
    request.requester_household_id,
    request.relationship_evidence,
    request.recent_password_session_id,
    request.state,
    request.visible_status,
    request.requested_categories,
    request.excluded_categories,
    request.legal_exception_codes,
    JSON.stringify(request.provider_cascades),
    request.dependent_review_required,
    request.dependent_review_completed,
    request.due_at,
    request.completed_at,
    request.terminal_reason_code,
    request.version,
    request.audit_refs,
  ];
}

function mapConsentEvent(row: SqlRow): ConsentEvent {
  return {
    consent_event_id: String(row.consent_event_id),
    idempotency_key: String(row.idempotency_key),
    canonical_request_hash: String(row.canonical_request_hash),
    actor_kind: String(row.actor_kind) as ConsentEvent['actor_kind'],
    actor_account_or_credential_id: String(row.actor_account_or_credential_id),
    actor_adult_id: String(row.actor_adult_id),
    household_id: String(row.household_id),
    student_id: String(row.student_id),
    relationship: String(row.relationship) as ConsentEvent['relationship'],
    parent_authority_attested: row.parent_authority_attested === true,
    scope: String(row.scope) as ConsentEvent['scope'],
    choice: String(row.choice) as ConsentEvent['choice'],
    policy_versions: row.policy_versions as ConsentEvent['policy_versions'],
    occurred_at: iso(row.occurred_at),
    request_correlation_id: String(row.request_correlation_id),
    network_evidence_digest: String(row.network_evidence_digest),
    supersedes_consent_event_id:
      row.supersedes_consent_event_id === null ? null : String(row.supersedes_consent_event_id),
    reason_code: String(row.reason_code),
  };
}

function mapDataRightsRequest(row: SqlRow): DataRightsRequest {
  return {
    request_id: String(row.request_id),
    product: String(row.product) as DataRightsRequest['product'],
    runtime_tier: String(row.runtime_tier) as DataRightsRequest['runtime_tier'],
    verification_environment_id: String(
      row.verification_environment_id,
    ) as DataRightsRequest['verification_environment_id'],
    kind: String(row.kind) as DataRightsRequest['kind'],
    subject: row.subject_json as DataRightsRequest['subject'],
    requester_kind: String(row.requester_kind) as DataRightsRequest['requester_kind'],
    requester_ref: String(row.requester_ref),
    requester_household_id:
      row.requester_household_id === null ? null : String(row.requester_household_id),
    relationship_evidence:
      row.relationship_evidence === null
        ? null
        : (String(row.relationship_evidence) as DataRightsRequest['relationship_evidence']),
    recent_password_session_id: String(row.recent_password_session_id),
    state: String(row.state) as DataRightsRequest['state'],
    visible_status:
      row.visible_status === null
        ? null
        : (String(row.visible_status) as DataRightsRequest['visible_status']),
    requested_categories: stringArray(row.requested_categories),
    excluded_categories: stringArray(row.excluded_categories),
    legal_exception_codes: stringArray(row.legal_exception_codes),
    provider_cascades: Array.isArray(row.provider_cascades)
      ? (row.provider_cascades as DataRightsRequest['provider_cascades'])
      : [],
    dependent_review_required: row.dependent_review_required === true,
    dependent_review_completed: row.dependent_review_completed === true,
    due_at: iso(row.due_at),
    completed_at: row.completed_at === null ? null : iso(row.completed_at),
    terminal_reason_code:
      row.terminal_reason_code === null ? null : String(row.terminal_reason_code),
    version: Number(row.version),
    audit_refs: stringArray(row.audit_refs),
  };
}

function mapRetentionWork(row: SqlRow): RetentionWorkItem {
  return {
    work_id: String(row.work_id),
    request_id: String(row.request_id),
    subject_binding_hash: String(row.subject_binding_hash),
    category: String(row.category),
    due_at: iso(row.due_at),
    legal_hold_codes: stringArray(row.legal_hold_codes),
    provider_outbox_intents: Array.isArray(row.provider_outbox_intents)
      ? (row.provider_outbox_intents as RetentionWorkItem['provider_outbox_intents'])
      : [],
    state: String(row.state) as RetentionWorkItem['state'],
    version: Number(row.version),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
