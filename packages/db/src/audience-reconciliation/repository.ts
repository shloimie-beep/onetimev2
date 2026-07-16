import { createHash, randomUUID } from 'node:crypto';
import type {
  LegacyActivationCampaignApproval,
  LegacyActivationCampaignControlRequest,
  LegacyActivationCampaignControlResult,
  LegacyActivationCampaignPreview,
  LegacyActivationCampaignQueueResult,
  LegacyActivationCampaignStatus,
  LegacyAudienceDryRunReport,
  LegacyAudienceInputRow,
  LegacyAudienceRollbackRequest,
} from '../../../contracts/src/audience-reconciliation/index.ts';
import type { DbPool, Queryable } from '../index.ts';
import { inTransaction } from '../index.ts';

export type LegacyAudienceRepositoryActor = {
  accountKey: string;
  productKey: string;
  userKey: string;
};

export type LegacyAudienceContactRecord = {
  account_key: string;
  product_key: string;
  contact_key: string;
  public_contact_id: string | null;
  display_name: string;
  email_normalized: string | null;
  phone_normalized: string | null;
  archived_at: Date | string | null;
  suppression_state: string | null;
  new_system_activated: boolean;
};

export type RecordDryRunResult = {
  report: LegacyAudienceDryRunReport;
  replayed: boolean;
};

export type RollbackRecordResult = {
  rollback_key: string;
  batch_key: string;
  status: 'recorded' | 'reviewed' | 'closed';
  replayed: boolean;
};

export class LegacyAudienceIdempotencyConflictError extends Error {
  constructor() {
    super('Legacy audience request used an idempotency key with a different payload.');
  }
}

export class LegacyAudienceBatchNotFoundError extends Error {
  constructor() {
    super('Legacy audience batch was not found.');
  }
}

export class LegacyActivationCampaignNotFoundError extends Error {
  constructor() {
    super('Legacy activation campaign was not found.');
  }
}

export type LegacyActivationCampaignRecord = {
  preview: LegacyActivationCampaignPreview;
  approval: LegacyActivationCampaignApproval | null;
  status: LegacyActivationCampaignStatus;
};

export function createPostgresLegacyAudienceRepository(pool: DbPool) {
  return {
    async findContactsByIdentities(
      actor: LegacyAudienceRepositoryActor,
      identities: { emails: string[]; phones: string[] },
    ): Promise<LegacyAudienceContactRecord[]> {
      const clauses: string[] = [];
      const params: unknown[] = [actor.accountKey, actor.productKey];
      addInClause(clauses, params, 'contacts.email_normalized', identities.emails);
      addInClause(clauses, params, 'contacts.phone_normalized', identities.phones);
      if (!clauses.length) return [];
      const result = await pool.query(
        `SELECT contacts.account_key, contacts.product_key, contacts.contact_key,
                contacts.public_contact_id, contacts.display_name, contacts.email_normalized,
                contacts.phone_normalized, contacts.archived_at, contacts.suppression_state,
                activated_user.user_key IS NOT NULL AS new_system_activated
           FROM onetime.contacts AS contacts
           LEFT JOIN onetime.account_users AS activated_user
             ON activated_user.account_key = contacts.account_key
            AND activated_user.product_key = contacts.product_key
            AND activated_user.email_normalized = contacts.email_normalized
            AND activated_user.status = 'active'
          WHERE contacts.account_key = $1
            AND contacts.product_key = $2
            AND (${clauses.join(' OR ')})`,
        params,
      );
      return result.rows.map(rowToContact);
    },

    async recordDryRun(input: {
      actor: LegacyAudienceRepositoryActor;
      idempotencyKey: string;
      report: LegacyAudienceDryRunReport;
    }): Promise<RecordDryRunResult> {
      return inTransaction(pool, async (client) => {
        const existing = await client.query(
          `SELECT request_hash, dry_run_report
             FROM onetime.legacy_audience_import_batches
            WHERE account_key = $1
              AND product_key = $2
              AND idempotency_key = $3
            LIMIT 1`,
          [input.actor.accountKey, input.actor.productKey, input.idempotencyKey],
        );
        if (existing.rowCount) {
          if (existing.rows[0].request_hash !== input.report.request_hash) {
            throw new LegacyAudienceIdempotencyConflictError();
          }
          await insertAudit(client, input.actor, {
            batchKey: input.report.batch_key,
            eventType: 'dry_run_replayed',
            metadata: { request_hash: input.report.request_hash, no_contact_mutation: true },
          });
          return {
            report: existing.rows[0].dry_run_report as LegacyAudienceDryRunReport,
            replayed: true,
          };
        }

        await client.query(
          `INSERT INTO onetime.legacy_audience_import_batches
           (batch_key, account_key, product_key, source_kind, source_label, source_digest,
            idempotency_key, request_hash, row_count, dry_run_report, created_by_user_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
          [
            input.report.batch_key,
            input.actor.accountKey,
            input.actor.productKey,
            input.report.source.kind,
            input.report.source.source_label,
            input.report.source_digest,
            input.idempotencyKey,
            input.report.request_hash,
            input.report.summary.total_rows,
            JSON.stringify(input.report),
            input.actor.userKey,
          ],
        );

        for (const row of input.report.row_outcomes) {
          await client.query(
            `INSERT INTO onetime.legacy_audience_import_rows
             (row_key, batch_key, account_key, product_key, source_row_number, source_sheet_label,
              row_fingerprint, identity_fingerprint, has_email, has_phone, audience_type,
              legacy_system_state, active_legacy_user, new_system_activated, lead_state, consent_state,
              suppression_state, disposition, reason_codes, segment_codes, matched_contact_key)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21)`,
            [
              row.row_key,
              input.report.batch_key,
              input.actor.accountKey,
              input.actor.productKey,
              row.row_number,
              row.source_sheet,
              row.row_fingerprint,
              row.identity_fingerprint,
              row.has_email,
              row.has_phone,
              row.audience_type,
              row.legacy_system_state,
              row.active_legacy_user,
              row.new_system_activated,
              row.lead_state,
              row.consent_state,
              row.suppression_state,
              row.disposition,
              JSON.stringify(row.reasons),
              JSON.stringify(row.segment_codes),
              row.matched_contact_key,
            ],
          );
          await insertCandidates(client, input.actor, input.report.batch_key, row);
          for (const segmentCode of row.segment_codes) {
            await client.query(
              `INSERT INTO onetime.legacy_audience_segment_snapshots
               (snapshot_key, batch_key, row_key, account_key, product_key, contact_key,
                segment_code, communication_eligible, consent_state, suppression_state, reason_code)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
              [
                stableKey('legacy_segment', [row.row_key, segmentCode]),
                input.report.batch_key,
                row.row_key,
                input.actor.accountKey,
                input.actor.productKey,
                row.matched_contact_key,
                segmentCode,
                row.communication_eligible,
                row.consent_state,
                row.suppression_state,
                row.reasons[0] ?? 'new_identity',
              ],
            );
          }
        }

        await insertAudit(client, input.actor, {
          batchKey: input.report.batch_key,
          eventType: 'dry_run_recorded',
          metadata: {
            request_hash: input.report.request_hash,
            source_digest: input.report.source_digest,
            total_rows: input.report.summary.total_rows,
            no_contact_mutation: true,
          },
        });
        return { report: input.report, replayed: false };
      });
    },

    async getBatchReport(
      actor: LegacyAudienceRepositoryActor,
      batchKey: string,
    ): Promise<LegacyAudienceDryRunReport | null> {
      const result = await pool.query(
        `SELECT dry_run_report
           FROM onetime.legacy_audience_import_batches
          WHERE account_key = $1
            AND product_key = $2
            AND batch_key = $3
          LIMIT 1`,
        [actor.accountKey, actor.productKey, batchKey],
      );
      return (result.rows[0]?.dry_run_report as LegacyAudienceDryRunReport | undefined) ?? null;
    },

    async recordRollbackRequest(
      actor: LegacyAudienceRepositoryActor,
      request: LegacyAudienceRollbackRequest,
    ): Promise<RollbackRecordResult> {
      return inTransaction(pool, async (client) => {
        const batch = await client.query(
          `SELECT batch_key
             FROM onetime.legacy_audience_import_batches
            WHERE account_key = $1
              AND product_key = $2
              AND batch_key = $3
            LIMIT 1`,
          [actor.accountKey, actor.productKey, request.batch_key],
        );
        if (!batch.rowCount) throw new LegacyAudienceBatchNotFoundError();

        const rollbackKey = stableKey('legacy_rollback', [
          actor.accountKey,
          actor.productKey,
          request.batch_key,
          request.idempotency_key,
        ]);
        const existing = await client.query(
          `SELECT rollback_key, status
             FROM onetime.legacy_audience_rollback_records
            WHERE account_key = $1
              AND product_key = $2
              AND batch_key = $3
              AND idempotency_key = $4
            LIMIT 1`,
          [actor.accountKey, actor.productKey, request.batch_key, request.idempotency_key],
        );
        if (existing.rowCount) {
          return {
            rollback_key: String(existing.rows[0].rollback_key),
            batch_key: request.batch_key,
            status: existing.rows[0].status as RollbackRecordResult['status'],
            replayed: true,
          };
        }
        await client.query(
          `INSERT INTO onetime.legacy_audience_rollback_records
           (rollback_key, batch_key, account_key, product_key, requested_by_user_key,
            idempotency_key, reason, affected_record_counts)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
          [
            rollbackKey,
            request.batch_key,
            actor.accountKey,
            actor.productKey,
            actor.userKey,
            request.idempotency_key,
            request.reason,
            JSON.stringify({ contacts_deleted: 0, contacts_updated: 0, sends_cancelled: 0 }),
          ],
        );
        await insertAudit(client, actor, {
          batchKey: request.batch_key,
          eventType: 'rollback_recorded',
          metadata: { rollback_key: rollbackKey, destructive_contact_deletion: false },
        });
        return {
          rollback_key: rollbackKey,
          batch_key: request.batch_key,
          status: 'recorded',
          replayed: false,
        };
      });
    },

    async recordCampaignPreview(input: {
      actor: LegacyAudienceRepositoryActor;
      idempotencyKey: string;
      preview: LegacyActivationCampaignPreview;
    }): Promise<{ preview: LegacyActivationCampaignPreview; replayed: boolean }> {
      return inTransaction(pool, async (client) => {
        const batch = await client.query(
          `SELECT batch_key
             FROM onetime.legacy_audience_import_batches
            WHERE account_key = $1
              AND product_key = $2
              AND batch_key = $3
            LIMIT 1`,
          [input.actor.accountKey, input.actor.productKey, input.preview.batch_key],
        );
        if (!batch.rowCount) throw new LegacyAudienceBatchNotFoundError();

        const existing = await client.query(
          `SELECT snapshot_hash, snapshot_payload
             FROM onetime.legacy_activation_campaigns
            WHERE account_key = $1
              AND product_key = $2
              AND idempotency_key = $3
            LIMIT 1`,
          [input.actor.accountKey, input.actor.productKey, input.idempotencyKey],
        );
        if (existing.rowCount) {
          if (existing.rows[0].snapshot_hash !== input.preview.snapshot_hash) {
            throw new LegacyAudienceIdempotencyConflictError();
          }
          await insertCampaignAudit(client, input.actor, {
            campaignKey: input.preview.campaign_key,
            batchKey: input.preview.batch_key,
            eventType: 'preview_replayed',
            metadata: { snapshot_hash: input.preview.snapshot_hash },
          });
          return {
            preview: existing.rows[0].snapshot_payload as LegacyActivationCampaignPreview,
            replayed: true,
          };
        }

        await client.query(
          `INSERT INTO onetime.legacy_activation_campaigns
           (campaign_key, account_key, product_key, batch_key, segment_code, channel,
            template_kind, template_revision, batch_size, schedule_not_before, status,
            snapshot_hash, source_request_hash, source_digest, snapshot_expires_at,
            snapshot_counts, snapshot_payload, idempotency_key, created_by_user_key,
            created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'previewed',$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18,$19,$19)`,
          [
            input.preview.campaign_key,
            input.actor.accountKey,
            input.actor.productKey,
            input.preview.batch_key,
            input.preview.segment,
            input.preview.channel,
            input.preview.template_kind,
            input.preview.template_revision,
            input.preview.batch_size,
            input.preview.schedule_not_before,
            input.preview.snapshot_hash,
            input.preview.source_request_hash,
            input.preview.source_digest,
            input.preview.snapshot_expires_at,
            JSON.stringify(input.preview.counts),
            JSON.stringify(input.preview),
            input.idempotencyKey,
            input.actor.userKey,
            input.preview.created_at,
          ],
        );
        await insertCampaignAudit(client, input.actor, {
          campaignKey: input.preview.campaign_key,
          batchKey: input.preview.batch_key,
          eventType: 'preview_recorded',
          metadata: {
            snapshot_hash: input.preview.snapshot_hash,
            eligible_rows: input.preview.counts.eligible_rows,
            raw_recipient_list_included: false,
            production_side_effects: false,
          },
        });
        return { preview: input.preview, replayed: false };
      });
    },

    async getCampaignRecord(
      actor: LegacyAudienceRepositoryActor,
      campaignKey: string,
    ): Promise<LegacyActivationCampaignRecord | null> {
      const result = await pool.query(
        `SELECT status, snapshot_payload, approval_metadata
           FROM onetime.legacy_activation_campaigns
          WHERE account_key = $1
            AND product_key = $2
            AND campaign_key = $3
          LIMIT 1`,
        [actor.accountKey, actor.productKey, campaignKey],
      );
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      const approvalMetadata = asRecord(row.approval_metadata);
      return {
        preview: row.snapshot_payload as LegacyActivationCampaignPreview,
        approval:
          (approvalMetadata.approval as LegacyActivationCampaignApproval | undefined) ?? null,
        status: String(row.status) as LegacyActivationCampaignStatus,
      };
    },

    async approveCampaign(input: {
      actor: LegacyAudienceRepositoryActor;
      idempotencyKey: string;
      approval: LegacyActivationCampaignApproval;
    }): Promise<{ approval: LegacyActivationCampaignApproval; replayed: boolean }> {
      return inTransaction(pool, async (client) => {
        const existing = await client.query(
          `SELECT approval_idempotency_key, approval_fingerprint, approval_metadata
             FROM onetime.legacy_activation_campaigns
            WHERE account_key = $1
              AND product_key = $2
              AND campaign_key = $3
              AND snapshot_hash = $4
            LIMIT 1
            FOR UPDATE`,
          [
            input.actor.accountKey,
            input.actor.productKey,
            input.approval.campaign_key,
            input.approval.snapshot_hash,
          ],
        );
        if (!existing.rowCount) throw new LegacyActivationCampaignNotFoundError();
        const current = existing.rows[0];
        if (current.approval_idempotency_key) {
          if (
            current.approval_idempotency_key !== input.idempotencyKey ||
            current.approval_fingerprint !== input.approval.approval_fingerprint
          ) {
            throw new LegacyAudienceIdempotencyConflictError();
          }
          await insertCampaignAudit(client, input.actor, {
            campaignKey: input.approval.campaign_key,
            batchKey: null,
            eventType: 'approval_replayed',
            metadata: { approval_fingerprint: input.approval.approval_fingerprint },
          });
          const metadata = asRecord(current.approval_metadata);
          return {
            approval:
              (metadata.approval as LegacyActivationCampaignApproval | undefined) ?? input.approval,
            replayed: true,
          };
        }
        await client.query(
          `UPDATE onetime.legacy_activation_campaigns
              SET status = 'approved',
                  approval_idempotency_key = $5,
                  approval_fingerprint = $6,
                  approved_by_user_key = $7,
                  approved_at = $8,
                  approval_metadata = $9::jsonb,
                  updated_at = $8
            WHERE account_key = $1
              AND product_key = $2
              AND campaign_key = $3
              AND snapshot_hash = $4`,
          [
            input.actor.accountKey,
            input.actor.productKey,
            input.approval.campaign_key,
            input.approval.snapshot_hash,
            input.idempotencyKey,
            input.approval.approval_fingerprint,
            input.actor.userKey,
            input.approval.approved_at,
            JSON.stringify({ approval: input.approval }),
          ],
        );
        await insertCampaignAudit(client, input.actor, {
          campaignKey: input.approval.campaign_key,
          batchKey: null,
          eventType: 'approval_recorded',
          metadata: {
            approval_fingerprint: input.approval.approval_fingerprint,
            real_audience_authorized: input.approval.real_audience_authorized,
            canary_authorized: input.approval.canary_authorized,
          },
        });
        return { approval: input.approval, replayed: false };
      });
    },

    async recordCampaignSendIntents(input: {
      actor: LegacyAudienceRepositoryActor;
      idempotencyKey: string;
      result: LegacyActivationCampaignQueueResult;
    }): Promise<{ result: LegacyActivationCampaignQueueResult; replayed: boolean }> {
      return inTransaction(pool, async (client) => {
        const campaign = await client.query(
          `SELECT campaign_key, batch_key
             FROM onetime.legacy_activation_campaigns
            WHERE account_key = $1
              AND product_key = $2
              AND campaign_key = $3
            LIMIT 1
            FOR UPDATE`,
          [input.actor.accountKey, input.actor.productKey, input.result.campaign_key],
        );
        if (!campaign.rowCount) throw new LegacyActivationCampaignNotFoundError();

        if (input.result.status === 'blocked') {
          await client.query(
            `UPDATE onetime.legacy_activation_campaigns
                SET status = 'blocked',
                    updated_at = now()
              WHERE account_key = $1
                AND product_key = $2
                AND campaign_key = $3`,
            [input.actor.accountKey, input.actor.productKey, input.result.campaign_key],
          );
          await insertCampaignAudit(client, input.actor, {
            campaignKey: input.result.campaign_key,
            batchKey: String(campaign.rows[0].batch_key),
            eventType: 'send_intents_blocked',
            metadata: {
              idempotency_key: input.idempotencyKey,
              blocked_reasons: input.result.blocked_reasons,
              external_send_performed: false,
            },
          });
          return { result: input.result, replayed: false };
        }

        let inserted = 0;
        for (const intent of input.result.intents) {
          const write = await client.query(
            `INSERT INTO onetime.legacy_activation_campaign_intents
             (intent_key, campaign_key, account_key, product_key, identity_ref, channel,
              template_revision, delivery_state, destination_ref, lifecycle_intent_ref,
              idempotency_key, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
             ON CONFLICT (campaign_key, identity_ref, channel, template_revision) DO NOTHING`,
            [
              intent.intent_key,
              intent.campaign_key,
              input.actor.accountKey,
              input.actor.productKey,
              intent.identity_ref,
              intent.channel,
              intent.template_revision,
              intent.delivery_state,
              intent.destination_ref,
              intent.lifecycle_intent_ref,
              input.idempotencyKey,
              JSON.stringify({
                raw_destination_included: false,
                raw_token_included: false,
                external_send_performed: false,
              }),
            ],
          );
          inserted += write.rowCount ?? 0;
        }
        await client.query(
          `UPDATE onetime.legacy_activation_campaigns
              SET status = 'running',
                  updated_at = now()
            WHERE account_key = $1
              AND product_key = $2
              AND campaign_key = $3`,
          [input.actor.accountKey, input.actor.productKey, input.result.campaign_key],
        );
        await insertCampaignAudit(client, input.actor, {
          campaignKey: input.result.campaign_key,
          batchKey: String(campaign.rows[0].batch_key),
          eventType: 'send_intents_recorded',
          metadata: {
            idempotency_key: input.idempotencyKey,
            queued_count: inserted,
            mode: input.result.mode,
            external_send_performed: false,
          },
        });
        return {
          result: { ...input.result, queued_count: inserted },
          replayed: inserted === 0 && input.result.intents.length > 0,
        };
      });
    },

    async recordCampaignControl(input: {
      actor: LegacyAudienceRepositoryActor;
      campaignKey: string;
      request: LegacyActivationCampaignControlRequest;
    }): Promise<LegacyActivationCampaignControlResult> {
      return inTransaction(pool, async (client) => {
        const replay = await client.query(
          `SELECT metadata
             FROM onetime.legacy_activation_campaign_audit_events
            WHERE account_key = $1
              AND product_key = $2
              AND campaign_key = $3
              AND event_type = $4
              AND metadata->>'idempotency_key' = $5
            LIMIT 1`,
          [
            input.actor.accountKey,
            input.actor.productKey,
            input.campaignKey,
            campaignControlEventType(input.request.action),
            input.request.idempotency_key,
          ],
        );
        if (replay.rowCount) {
          return {
            campaign_key: input.campaignKey,
            action: input.request.action,
            status: controlStatus(input.request.action),
            replayed: true,
            production_side_effects: false,
          };
        }
        const updated = await client.query(
          `UPDATE onetime.legacy_activation_campaigns
              SET status = $4,
                  updated_at = now()
            WHERE account_key = $1
              AND product_key = $2
              AND campaign_key = $3
            RETURNING status, batch_key`,
          [
            input.actor.accountKey,
            input.actor.productKey,
            input.campaignKey,
            controlStatus(input.request.action),
          ],
        );
        if (!updated.rowCount) throw new LegacyActivationCampaignNotFoundError();
        await insertCampaignAudit(client, input.actor, {
          campaignKey: input.campaignKey,
          batchKey: String(updated.rows[0].batch_key),
          eventType: campaignControlEventType(input.request.action),
          metadata: {
            idempotency_key: input.request.idempotency_key,
            reason: input.request.reason,
            external_send_performed: false,
          },
        });
        return {
          campaign_key: input.campaignKey,
          action: input.request.action,
          status: updated.rows[0].status as LegacyActivationCampaignStatus,
          replayed: false,
          production_side_effects: false,
        };
      });
    },
  };
}

export function collectIdentityFilters(rows: LegacyAudienceInputRow[]) {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const row of rows) {
    if (row.email.trim()) emails.add(row.email.trim().toLowerCase());
    const phone = normalizePhone(row.phone);
    if (phone) phones.add(phone);
  }
  return { emails: Array.from(emails), phones: Array.from(phones) };
}

async function insertCandidates(
  client: Queryable,
  actor: LegacyAudienceRepositoryActor,
  batchKey: string,
  row: LegacyAudienceDryRunReport['row_outcomes'][number],
) {
  const contactKeys = row.candidate_contact_keys.length ? row.candidate_contact_keys : [null];
  for (const contactKey of contactKeys) {
    const reason = row.reasons[0] ?? 'new_identity';
    await client.query(
      `INSERT INTO onetime.legacy_audience_match_candidates
       (candidate_key, batch_key, row_key, account_key, product_key, contact_key,
        match_kind, reason_code, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        stableKey('legacy_candidate', [row.row_key, contactKey ?? 'none', reason]),
        batchKey,
        row.row_key,
        actor.accountKey,
        actor.productKey,
        contactKey,
        matchKindFor(row),
        reason,
        confidenceFor(row),
      ],
    );
  }
}

async function insertAudit(
  client: Queryable,
  actor: LegacyAudienceRepositoryActor,
  input: {
    batchKey: string;
    eventType: 'dry_run_recorded' | 'dry_run_replayed' | 'rollback_recorded';
    metadata: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO onetime.legacy_audience_audit_events
     (event_key, account_key, product_key, batch_key, actor_user_key, event_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      stableKey('legacy_audit', [input.batchKey, input.eventType, actor.userKey, randomUUID()]),
      actor.accountKey,
      actor.productKey,
      input.batchKey,
      actor.userKey,
      input.eventType,
      JSON.stringify(input.metadata),
    ],
  );
}

async function insertCampaignAudit(
  client: Queryable,
  actor: LegacyAudienceRepositoryActor,
  input: {
    campaignKey: string;
    batchKey: string | null;
    eventType:
      | 'preview_recorded'
      | 'preview_replayed'
      | 'approval_recorded'
      | 'approval_replayed'
      | 'send_intents_recorded'
      | 'send_intents_blocked'
      | 'paused'
      | 'resumed'
      | 'cancelled';
    metadata: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO onetime.legacy_activation_campaign_audit_events
     (event_key, account_key, product_key, campaign_key, batch_key, actor_user_key, event_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [
      stableKey('legacy_activation_audit', [
        input.campaignKey,
        input.eventType,
        actor.userKey,
        randomUUID(),
      ]),
      actor.accountKey,
      actor.productKey,
      input.campaignKey,
      input.batchKey,
      actor.userKey,
      input.eventType,
      JSON.stringify(input.metadata),
    ],
  );
}

function campaignControlEventType(action: LegacyActivationCampaignControlRequest['action']) {
  if (action === 'pause') return 'paused';
  if (action === 'resume') return 'resumed';
  return 'cancelled';
}

function controlStatus(
  action: LegacyActivationCampaignControlRequest['action'],
): LegacyActivationCampaignStatus {
  if (action === 'pause') return 'paused';
  if (action === 'resume') return 'running';
  return 'cancelled';
}

function addInClause(clauses: string[], params: unknown[], column: string, values: string[]) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (!unique.length) return;
  const placeholders = unique.map((value) => {
    params.push(value);
    return `$${params.length}`;
  });
  clauses.push(`${column} IN (${placeholders.join(',')})`);
}

function rowToContact(row: Record<string, unknown>): LegacyAudienceContactRecord {
  return {
    account_key: String(row.account_key),
    product_key: String(row.product_key),
    contact_key: String(row.contact_key),
    public_contact_id: row.public_contact_id ? String(row.public_contact_id) : null,
    display_name: String(row.display_name),
    email_normalized: row.email_normalized ? String(row.email_normalized) : null,
    phone_normalized: row.phone_normalized ? String(row.phone_normalized) : null,
    archived_at: (row.archived_at as Date | string | null | undefined) ?? null,
    suppression_state: row.suppression_state ? String(row.suppression_state) : null,
    new_system_activated: row.new_system_activated === true || row.new_system_activated === 'true',
  };
}

function matchKindFor(row: LegacyAudienceDryRunReport['row_outcomes'][number]) {
  if (row.reasons.includes('matched_by_email_and_phone')) return 'email_and_phone';
  if (row.reasons.includes('matched_by_email')) return 'email';
  if (row.reasons.includes('matched_by_phone')) return 'phone';
  if (row.reasons.includes('ambiguous_match') || row.reasons.includes('conflicting_identity')) {
    return 'conflict';
  }
  return 'none';
}

function confidenceFor(row: LegacyAudienceDryRunReport['row_outcomes'][number]) {
  if (row.reasons.includes('matched_by_email_and_phone')) return 100;
  if (row.reasons.includes('matched_by_email') || row.reasons.includes('matched_by_phone')) {
    return 90;
  }
  return 0;
}

function normalizePhone(phone: string | undefined) {
  const digits = phone?.replace(/\D+/g, '') ?? '';
  if (!digits) return null;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

function stableKey(prefix: string, parts: string[]) {
  const hash = createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 24);
  return `${prefix}_${hash}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
