import type {
  CommunicationFoundationRepository,
  ReminderPreference,
} from '../../../../contracts/src/communications/foundation/index.ts';
import { REMINDER_PREFERENCES } from '../../../../contracts/src/communications/foundation/index.ts';

type SqlRow = Record<string, unknown>;
type SqlResult<Row extends SqlRow = SqlRow> = { rows: Row[]; rowCount: number | null };

export interface CommunicationFoundationSqlClient {
  query<Row extends SqlRow = SqlRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
  release(): void;
}

export interface CommunicationFoundationSqlPool {
  connect(): Promise<CommunicationFoundationSqlClient>;
}

export function createPostgresCommunicationFoundationRepository(
  pool: CommunicationFoundationSqlPool,
): CommunicationFoundationRepository {
  return {
    async saveReminderPreference({ adult_id, preference, expected_version }) {
      assertPreference(preference);
      return one(
        pool,
        `INSERT INTO onetime.communication_reminder_preference
           (adult_id, preference, version)
         VALUES ($1,$2,$3)
         ON CONFLICT (adult_id) DO UPDATE SET
           preference = EXCLUDED.preference,
           version = EXCLUDED.version
         WHERE onetime.communication_reminder_preference.version = $4`,
        [adult_id, preference, expected_version + 1, expected_version],
      );
    },

    async persistDecision({ record, expected_version }) {
      return one(
        pool,
        `INSERT INTO onetime.communication_decision
           (operation_id, adult_id, purpose, plan, suppression_snapshot_id, status, version)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)
         ON CONFLICT (operation_id) DO UPDATE SET
           plan = EXCLUDED.plan,
           suppression_snapshot_id = EXCLUDED.suppression_snapshot_id,
           status = EXCLUDED.status,
           version = EXCLUDED.version
         WHERE onetime.communication_decision.version = $8`,
        [
          record.operation_id,
          record.adult_id,
          record.purpose,
          JSON.stringify(record.plan),
          record.suppression_snapshot_id,
          record.status,
          expected_version + 1,
          expected_version,
        ],
      );
    },

    async reserveEmailDelivery({ operation_id, suppression_snapshot_id }) {
      return one(
        pool,
        `INSERT INTO onetime.communication_delivery_dedupe
           (operation_id, channel, suppression_snapshot_id)
         VALUES ($1,'email',$2)
         ON CONFLICT (operation_id, channel) DO NOTHING`,
        [operation_id, suppression_snapshot_id],
      );
    },

    async completeDecision(input) {
      return one(
        pool,
        `UPDATE onetime.communication_decision
            SET status = $1,
                safe_provider_ref_hash = $2,
                safe_reason = $3,
                version = version + 1
          WHERE operation_id = $4
            AND version = $5`,
        [
          input.status,
          input.safe_provider_ref_hash,
          input.safe_reason,
          input.operation_id,
          input.expected_version,
        ],
      );
    },

    async persistWorkflowReadback({ readback, expected_version }) {
      return one(
        pool,
        `INSERT INTO onetime.communication_workflow_readback
           (workflow_key, readback, provider_read_at, version)
         VALUES ($1,$2::jsonb,$3,$4)
         ON CONFLICT (workflow_key) DO UPDATE SET
           readback = EXCLUDED.readback,
           provider_read_at = EXCLUDED.provider_read_at,
           version = EXCLUDED.version
         WHERE onetime.communication_workflow_readback.version = $5`,
        [
          readback.workflow_key,
          JSON.stringify(readback),
          readback.delivery.provider_read_at,
          expected_version + 1,
          expected_version,
        ],
      );
    },

    async persistGovernedRequest(request) {
      return one(
        pool,
        `INSERT INTO onetime.communication_workflow_request
           (request_id, workflow_key, requested_by_admin_id, action, requested_at,
            provider_readback_ref, audited, direct_provider_mutation)
         VALUES ($1,$2,$3,$4,$5,$6,true,false)
         ON CONFLICT (request_id) DO NOTHING`,
        [
          request.request_id,
          request.workflow_key,
          request.requested_by_admin_id,
          request.action,
          request.requested_at,
          request.provider_readback_ref,
        ],
      );
    },

    async persistWebsiteLeadPlan(plan) {
      return one(
        pool,
        `INSERT INTO onetime.communication_website_lead_plan
           (operation_id, adult_id, lead_kind, next_action, transcript_ref_hash, plan)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT (operation_id) DO NOTHING`,
        [
          plan.operation_id,
          plan.adult_id,
          plan.lead_kind,
          plan.next_action,
          plan.transcript_ref_hash,
          JSON.stringify(plan),
        ],
      );
    },
  };
}

function assertPreference(preference: ReminderPreference) {
  if (!REMINDER_PREFERENCES.includes(preference)) {
    throw new Error('invalid_reminder_preference');
  }
}

async function one(pool: CommunicationFoundationSqlPool, text: string, values: readonly unknown[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, values);
    return (result.rowCount ?? 0) === 1;
  } finally {
    client.release();
  }
}
