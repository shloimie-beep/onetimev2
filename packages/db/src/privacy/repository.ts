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
           (request_id, kind, subject_json, requester_kind, requester_ref,
            requester_household_id, relationship_evidence, recent_password_session_id,
            state, visible_status, requested_categories, excluded_categories,
            legal_exception_codes, provider_cascades, dependent_review_required,
            dependent_review_completed, due_at, completed_at, terminal_reason_code,
            version, audit_refs)
           VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,
                   $15,$16,$17,$18,$19,$20,$21)
           ON CONFLICT (request_id) DO NOTHING`,
          requestValues(request),
        );
        return (result.rowCount ?? 0) === 1;
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
            WHERE request_id = $10 AND version = $11`,
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
           (grant_id, request_id, subject_binding_hash, token_hash,
            initiating_session_id, issued_at, expires_at, used_at, revoked_at, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (grant_id) DO NOTHING`,
          [
            grant.grant_id,
            grant.request_id,
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
            WHERE grant_id = $3 AND version = $4
              AND used_at IS NULL AND revoked_at IS NULL
              AND expires_at > $1`,
          [grant.used_at, grant.version, grant.grant_id, priorVersion],
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
