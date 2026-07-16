import type {
  Ops04ActionType,
  Ops04ApplyReceipt,
  Ops04DryRunReport,
  Ops04NoSendDiff,
  Ops04RowOutcome,
} from '../../../contracts/src/ops04/index.ts';
import {
  ops04ApplyReceiptSchema,
  ops04DryRunReportSchema,
  ops04NoSendDiffSchema,
} from '../../../contracts/src/ops04/index.ts';
import type { DbPool, Queryable } from '../index.ts';
import { inTransaction } from '../index.ts';
import { createHash } from 'node:crypto';

export type Ops04RepositoryActor = {
  accountKey: string;
  productKey: string;
  userKey: string;
};

export type Ops04RecordResult = {
  batch_key: string;
  dry_run_hash: string;
  replayed: boolean;
};

export type Ops04ApplyResult = {
  batch_key: string;
  replayed: boolean;
  action_status_counts: Record<string, number>;
  no_send_diff: Ops04NoSendDiff;
};

export type Ops04RollbackResult = {
  batch_key: string;
  replayed: boolean;
  rolled_back_actions: number;
  no_send_diff: Ops04NoSendDiff;
};

export class Ops04BatchConflictError extends Error {
  constructor() {
    super('OPS-04 batch identity already exists with a different dry-run hash.');
  }
}

export class Ops04BatchNotFoundError extends Error {
  constructor() {
    super('OPS-04 batch was not found.');
  }
}

export class Ops04ReceiptMismatchError extends Error {
  constructor(message = 'OPS-04 apply receipt does not match the dry-run report.') {
    super(message);
  }
}

export function createPostgresOps04Repository(pool: DbPool) {
  return {
    async recordDryRun(input: {
      actor: Ops04RepositoryActor;
      report: Ops04DryRunReport;
    }): Promise<Ops04RecordResult> {
      const report = ops04DryRunReportSchema.parse(input.report);
      return inTransaction(pool, async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(81227004)');
        const existing = await findExistingBatch(client, input.actor, report);
        if (existing) {
          if (existing.dry_run_hash !== report.dry_run_hash) throw new Ops04BatchConflictError();
          await insertAudit(client, input.actor, report.batch_key, 'dry_run_replayed', {
            dry_run_hash: report.dry_run_hash,
            no_contact_mutation: true,
            no_send_mutation: true,
          });
          return {
            batch_key: report.batch_key,
            dry_run_hash: report.dry_run_hash,
            replayed: true,
          };
        }

        for (const sourceFile of report.source_files) {
          await client.query(
            `INSERT INTO onetime.ops04_source_files
             (file_id, account_key, product_key, adapter_family, adapter_version, file_sha256,
              byte_size, safe_path_fingerprint, workbook_sheets, normalized_headers,
              physical_row_count, blank_row_count, error_row_count, classification_status,
              snapshot_semantics, timestamp_policy, consent_suppression_metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16,$17::jsonb)
             ON CONFLICT (file_id) DO NOTHING`,
            [
              sourceFile.file_id,
              input.actor.accountKey,
              input.actor.productKey,
              sourceFile.adapter_family,
              sourceFile.adapter_version,
              sourceFile.file_sha256,
              sourceFile.byte_size,
              sourceFile.safe_path_fingerprint,
              JSON.stringify(sourceFile.workbook_sheets),
              JSON.stringify(sourceFile.normalized_headers),
              sourceFile.physical_row_count,
              sourceFile.blank_row_count,
              sourceFile.error_row_count,
              sourceFile.classification_status,
              sourceFile.snapshot_semantics,
              sourceFile.timestamp_policy,
              JSON.stringify(sourceFile.consent_suppression_metadata),
            ],
          );
        }

        await client.query(
          `INSERT INTO onetime.ops04_batches
           (batch_key, account_key, product_key, manifest_sha256, mapping_sha256,
            database_snapshot_key, dry_run_hash, state, mode, row_count, action_count,
            production_import_authorized, campaign_send_authorized, approval_status,
            dry_run_report, reconciliation_totals, created_by_user_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'dry_run',$9,$10,false,false,'absent',$11::jsonb,$12::jsonb,$13)`,
          [
            report.batch_key,
            input.actor.accountKey,
            input.actor.productKey,
            report.manifest_sha256,
            report.mapping_sha256,
            report.database_snapshot_key,
            report.dry_run_hash,
            report.rows.some((row) => row.quarantine_reasons.length > 0)
              ? 'review_required'
              : 'previewed',
            report.rows.length,
            report.rows.reduce((count, row) => count + row.planned_actions.length, 0),
            JSON.stringify(report),
            JSON.stringify(report.totals),
            input.actor.userKey,
          ],
        );

        for (const row of report.rows) await insertRowLedger(client, input.actor, report, row);
        await insertTotals(client, input.actor, report);
        await insertAudit(client, input.actor, report.batch_key, 'dry_run_recorded', {
          dry_run_hash: report.dry_run_hash,
          manifest_sha256: report.manifest_sha256,
          row_count: report.rows.length,
          no_contact_mutation: true,
          no_send_mutation: true,
        });
        return { batch_key: report.batch_key, dry_run_hash: report.dry_run_hash, replayed: false };
      });
    },

    async applySyntheticBatch(input: {
      actor: Ops04RepositoryActor;
      report: Ops04DryRunReport;
      receipt: Ops04ApplyReceipt;
      now?: Date;
    }): Promise<Ops04ApplyResult> {
      const report = ops04DryRunReportSchema.parse(input.report);
      const receipt = ops04ApplyReceiptSchema.parse(input.receipt);
      validateReceipt(report, receipt, input.now ?? new Date('2026-07-16T00:10:00.000Z'));
      return inTransaction(pool, async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(81227004)');
        const batch = await requireBatch(client, input.actor, report.batch_key);
        if (['applied', 'verified', 'rolled_back'].includes(String(batch.state))) {
          const statusCounts = await actionStatusCounts(client, input.actor, report.batch_key);
          return {
            batch_key: report.batch_key,
            replayed: true,
            action_status_counts: statusCounts,
            no_send_diff: await noSendDiff(client),
          };
        }

        await client.query(
          `UPDATE onetime.ops04_action_ledger
              SET status = CASE
                    WHEN action_type = 'quarantine_manual_review' THEN 'quarantined'
                    WHEN action_type = 'reject_insufficient_identity' THEN 'quarantined'
                    WHEN action_type = 'no_op_unchanged' THEN 'no_op'
                    ELSE 'committed'
                  END,
                  attempt_count = attempt_count + 1,
                  actor_user_key = $4,
                  committed_at = now()
            WHERE account_key = $1
              AND product_key = $2
              AND batch_key = $3
              AND status = 'planned'`,
          [input.actor.accountKey, input.actor.productKey, report.batch_key, input.actor.userKey],
        );
        await client.query(
          `UPDATE onetime.ops04_batches
              SET state = 'applied',
                  mode = $4,
                  approval_status = 'valid_synthetic',
                  updated_at = now()
            WHERE account_key = $1
              AND product_key = $2
              AND batch_key = $3`,
          [input.actor.accountKey, input.actor.productKey, report.batch_key, receipt.mode],
        );
        await insertAudit(client, input.actor, report.batch_key, 'synthetic_apply_recorded', {
          dry_run_hash: report.dry_run_hash,
          receipt_actor: receipt.actor,
          no_contact_mutation: true,
          no_send_mutation: true,
        });
        return {
          batch_key: report.batch_key,
          replayed: false,
          action_status_counts: await actionStatusCounts(client, input.actor, report.batch_key),
          no_send_diff: await noSendDiff(client),
        };
      });
    },

    async replaySyntheticBatch(input: {
      actor: Ops04RepositoryActor;
      report: Ops04DryRunReport;
      receipt: Ops04ApplyReceipt;
      now?: Date;
    }): Promise<Ops04ApplyResult> {
      const report = ops04DryRunReportSchema.parse(input.report);
      const receipt = ops04ApplyReceiptSchema.parse(input.receipt);
      validateReceipt(report, receipt, input.now ?? new Date('2026-07-16T00:10:00.000Z'));
      return inTransaction(pool, async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(81227004)');
        await requireBatch(client, input.actor, report.batch_key);
        return {
          batch_key: report.batch_key,
          replayed: true,
          action_status_counts: await actionStatusCounts(client, input.actor, report.batch_key),
          no_send_diff: await noSendDiff(client),
        };
      });
    },

    async verifyBatch(actor: Ops04RepositoryActor, batchKey: string): Promise<Ops04ApplyResult> {
      return inTransaction(pool, async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(81227004)');
        await requireBatch(client, actor, batchKey);
        await client.query(
          `UPDATE onetime.ops04_action_ledger
              SET status = 'verified',
                  verified_at = now()
            WHERE account_key = $1
              AND product_key = $2
              AND batch_key = $3
              AND status = 'committed'`,
          [actor.accountKey, actor.productKey, batchKey],
        );
        const diff = await noSendDiff(client);
        if (diff.zero_diff) {
          await client.query(
            `UPDATE onetime.ops04_batches
                SET state = 'verified',
                    updated_at = now()
              WHERE account_key = $1
                AND product_key = $2
                AND batch_key = $3
                AND state <> 'rolled_back'`,
            [actor.accountKey, actor.productKey, batchKey],
          );
        }
        await insertAudit(client, actor, batchKey, 'synthetic_verify_recorded', {
          no_send_diff: diff,
        });
        return {
          batch_key: batchKey,
          replayed: false,
          action_status_counts: await actionStatusCounts(client, actor, batchKey),
          no_send_diff: diff,
        };
      });
    },

    async rollbackBatch(input: {
      actor: Ops04RepositoryActor;
      batchKey: string;
      idempotencyKey: string;
      reason: string;
    }): Promise<Ops04RollbackResult> {
      return inTransaction(pool, async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(81227004)');
        const batch = await requireBatch(client, input.actor, input.batchKey);
        if (String(batch.state) === 'rolled_back') {
          return {
            batch_key: input.batchKey,
            replayed: true,
            rolled_back_actions: 0,
            no_send_diff: await noSendDiff(client),
          };
        }
        const rows = await client.query(
          `UPDATE onetime.ops04_action_ledger
              SET status = 'rolled_back',
                  rolled_back_at = now()
            WHERE account_key = $1
              AND product_key = $2
              AND batch_key = $3
              AND status IN ('committed', 'verified', 'no_op')
            RETURNING action_key`,
          [input.actor.accountKey, input.actor.productKey, input.batchKey],
        );
        for (const row of rows.rows) {
          const actionKey = String(row.action_key);
          await client.query(
            `INSERT INTO onetime.ops04_rollback_events
             (rollback_event_key, batch_key, action_key, account_key, product_key, result, reason_code, metadata)
             VALUES ($1,$2,$3,$4,$5,'reversed','synthetic_rollback',$6::jsonb)
             ON CONFLICT DO NOTHING`,
            [
              stableKey('ops04_rollback', [input.batchKey, input.idempotencyKey, actionKey]),
              input.batchKey,
              actionKey,
              input.actor.accountKey,
              input.actor.productKey,
              JSON.stringify({ reason: input.reason, contact_mutation_reversed: false }),
            ],
          );
        }
        await client.query(
          `UPDATE onetime.ops04_batches
              SET state = 'rolled_back',
                  updated_at = now()
            WHERE account_key = $1
              AND product_key = $2
              AND batch_key = $3`,
          [input.actor.accountKey, input.actor.productKey, input.batchKey],
        );
        await insertAudit(client, input.actor, input.batchKey, 'synthetic_rollback_recorded', {
          idempotency_key: input.idempotencyKey,
          rolled_back_actions: rows.rowCount ?? rows.rows.length,
          no_contact_delete: true,
          no_send_mutation: true,
        });
        return {
          batch_key: input.batchKey,
          replayed: false,
          rolled_back_actions: rows.rowCount ?? rows.rows.length,
          no_send_diff: await noSendDiff(client),
        };
      });
    },

    async totals(actor: Ops04RepositoryActor, batchKey: string) {
      const result = await pool.query(
        `SELECT totals
           FROM onetime.ops04_reconciliation_totals
          WHERE account_key = $1
            AND product_key = $2
            AND batch_key = $3
          ORDER BY created_at DESC
          LIMIT 1`,
        [actor.accountKey, actor.productKey, batchKey],
      );
      return result.rows[0]?.totals ?? null;
    },
  };
}

async function findExistingBatch(
  client: Queryable,
  actor: Ops04RepositoryActor,
  report: Ops04DryRunReport,
) {
  const existing = await client.query(
    `SELECT batch_key, dry_run_hash, state
       FROM onetime.ops04_batches
      WHERE account_key = $1
        AND product_key = $2
        AND (
          batch_key = $3
          OR (
            manifest_sha256 = $4
            AND mapping_sha256 = $5
            AND database_snapshot_key = $6
          )
        )
      LIMIT 1`,
    [
      actor.accountKey,
      actor.productKey,
      report.batch_key,
      report.manifest_sha256,
      report.mapping_sha256,
      report.database_snapshot_key,
    ],
  );
  return existing.rows[0] as { batch_key: string; dry_run_hash: string; state: string } | undefined;
}

async function insertRowLedger(
  client: Queryable,
  actor: Ops04RepositoryActor,
  report: Ops04DryRunReport,
  row: Ops04RowOutcome,
) {
  const sourceFile = report.source_files[0];
  await client.query(
    `INSERT INTO onetime.ops04_source_row_versions
     (row_version_key, batch_key, account_key, product_key, file_id, source_row_key,
      source_row_number, source_sheet_label, row_hmac, row_version_sha256,
      occurrence_count, old_external_ids, normalized_facts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,$11::jsonb,$12::jsonb)
     ON CONFLICT DO NOTHING`,
    [
      row.row_version_key,
      report.batch_key,
      actor.accountKey,
      actor.productKey,
      sourceFile?.file_id ?? null,
      stableKey('ops04_source_row', [
        report.batch_key,
        String(row.source_row_number),
        row.row_version_sha256,
      ]),
      row.source_row_number,
      row.source_sheet,
      row.row_hmac,
      row.row_version_sha256,
      JSON.stringify(row.old_external_id_hmacs),
      JSON.stringify({
        independent_facts: row.independent_facts,
        phone_status: row.normalized_phone_status,
        primary_disposition: row.primary_disposition,
        tag_keys: row.tag_keys,
      }),
    ],
  );
  await insertExternalIdentities(client, actor, row);
  await insertContactPoints(client, actor, row);
  await client.query(
    `INSERT INTO onetime.ops04_match_decisions
     (decision_key, batch_key, row_version_key, account_key, product_key, primary_disposition,
      matched_contact_key, candidate_contact_keys, quarantine_reasons, independent_facts,
      channel_snapshots, sends_allowed, candidate_set_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,false,$12)
     ON CONFLICT DO NOTHING`,
    [
      row.decision_key,
      report.batch_key,
      row.row_version_key,
      actor.accountKey,
      actor.productKey,
      row.primary_disposition,
      row.matched_contact_key,
      JSON.stringify(row.candidate_contact_keys),
      JSON.stringify(row.quarantine_reasons),
      JSON.stringify(row.independent_facts),
      JSON.stringify(row.channel_snapshots),
      sha256(canonicalJson(row.candidate_contact_keys)),
    ],
  );
  for (const actionType of row.planned_actions) {
    await insertAction(client, actor, report.batch_key, row, actionType);
  }
  if (row.planned_actions.includes('add_tag_assignment')) {
    const actionKey = actionKeyFor(report.batch_key, row, 'add_tag_assignment');
    for (const tagKey of row.tag_keys) {
      await client.query(
        `INSERT INTO onetime.ops04_tag_assignments
         (assignment_key, batch_key, action_key, account_key, product_key, contact_key, tag_key, provenance)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT DO NOTHING`,
        [
          stableKey('ops04_tag', [report.batch_key, row.row_version_key, tagKey]),
          report.batch_key,
          actionKey,
          actor.accountKey,
          actor.productKey,
          row.matched_contact_key,
          tagKey,
          JSON.stringify({ source_row_version_key: row.row_version_key, sends_allowed: false }),
        ],
      );
    }
  }
}

async function insertExternalIdentities(
  client: Queryable,
  actor: Ops04RepositoryActor,
  row: Ops04RowOutcome,
) {
  for (const externalIdHmac of row.old_external_id_hmacs) {
    await client.query(
      `INSERT INTO onetime.ops04_external_identities
       (identity_key, account_key, product_key, contact_key, object_type, external_id_text,
        source_row_version_key, status)
       VALUES ($1,$2,$3,$4,'legacy_external_id_hmac',$5,$6,$7)
       ON CONFLICT DO NOTHING`,
      [
        stableKey('ops04_external', [actor.accountKey, actor.productKey, externalIdHmac]),
        actor.accountKey,
        actor.productKey,
        row.matched_contact_key,
        externalIdHmac,
        row.row_version_key,
        row.matched_contact_key ? 'linked' : 'observed',
      ],
    );
  }
}

async function insertContactPoints(
  client: Queryable,
  actor: Ops04RepositoryActor,
  row: Ops04RowOutcome,
) {
  const points: Array<{ type: 'email' | 'phone'; hmac: string; state: string }> = [];
  if (row.email_hmac) points.push({ type: 'email', hmac: row.email_hmac, state: 'valid' });
  if (row.phone_hmac) {
    points.push({ type: 'phone', hmac: row.phone_hmac, state: row.normalized_phone_status });
  }
  for (const point of points) {
    const pointKey = stableKey('ops04_point', [
      actor.accountKey,
      actor.productKey,
      point.type,
      point.hmac,
    ]);
    await client.query(
      `INSERT INTO onetime.ops04_contact_points
       (contact_point_key, account_key, product_key, point_type, point_hmac,
        normalized_state, ownership_state, source_row_version_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT DO NOTHING`,
      [
        pointKey,
        actor.accountKey,
        actor.productKey,
        point.type,
        point.hmac,
        point.state,
        row.quarantine_reasons.some((reason) => reason.includes('shared'))
          ? 'shared_unresolved'
          : 'exclusive_declared',
        row.row_version_key,
      ],
    );
    await client.query(
      `INSERT INTO onetime.ops04_contact_point_owners
       (owner_key, account_key, product_key, contact_point_key, contact_key, owner_role,
        ownership_state, source_row_version_key)
       VALUES ($1,$2,$3,$4,$5,'unknown',$6,$7)
       ON CONFLICT DO NOTHING`,
      [
        stableKey('ops04_point_owner', [
          pointKey,
          row.row_version_key,
          row.matched_contact_key ?? 'unmatched',
        ]),
        actor.accountKey,
        actor.productKey,
        pointKey,
        row.matched_contact_key,
        row.quarantine_reasons.some((reason) => reason.includes('shared'))
          ? 'shared_unresolved'
          : 'exclusive_declared',
        row.row_version_key,
      ],
    );
  }
  await insertChannelState(client, actor, row, row.channel_snapshots.email, row.email_hmac);
  await insertChannelState(client, actor, row, row.channel_snapshots.whatsapp, row.phone_hmac);
}

async function insertChannelState(
  client: Queryable,
  actor: Ops04RepositoryActor,
  row: Ops04RowOutcome,
  snapshot: Ops04RowOutcome['channel_snapshots']['email'],
  pointHmac: string | null,
) {
  const pointKey = pointHmac
    ? stableKey('ops04_point', [
        actor.accountKey,
        actor.productKey,
        snapshot.channel === 'email' ? 'email' : 'phone',
        pointHmac,
      ])
    : null;
  await client.query(
    `INSERT INTO onetime.ops04_channel_state_events
     (channel_state_event_key, account_key, product_key, contact_key, contact_point_key,
      channel, consent_state, suppression_state, reason_code, source_authority,
      source_row_version_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10)
     ON CONFLICT DO NOTHING`,
    [
      stableKey('ops04_channel', [row.row_version_key, snapshot.channel]),
      actor.accountKey,
      actor.productKey,
      row.matched_contact_key,
      pointKey,
      snapshot.channel,
      snapshot.consent_state,
      snapshot.suppression_state,
      snapshot.reason,
      row.row_version_key,
    ],
  );
}

async function insertAction(
  client: Queryable,
  actor: Ops04RepositoryActor,
  batchKey: string,
  row: Ops04RowOutcome,
  actionType: Ops04ActionType,
) {
  const actionKey = actionKeyFor(batchKey, row, actionType);
  await client.query(
    `INSERT INTO onetime.ops04_action_ledger
     (action_key, batch_key, row_version_key, decision_key, account_key, product_key,
      action_type, target_table, target_key, owned_fields, before_state, after_state, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,'planned')
     ON CONFLICT DO NOTHING`,
    [
      actionKey,
      batchKey,
      row.row_version_key,
      row.decision_key,
      actor.accountKey,
      actor.productKey,
      actionType,
      targetTableFor(actionType),
      stableKey('ops04_target', [batchKey, row.row_version_key, actionType]),
      JSON.stringify(ownedFieldsFor(actionType)),
      JSON.stringify({}),
      JSON.stringify({
        dry_run_only: true,
        sends_allowed: false,
        primary_disposition: row.primary_disposition,
      }),
    ],
  );
}

async function insertTotals(
  client: Queryable,
  actor: Ops04RepositoryActor,
  report: Ops04DryRunReport,
) {
  await client.query(
    `INSERT INTO onetime.ops04_reconciliation_totals
     (totals_key, batch_key, account_key, product_key, totals, equations_balanced)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6)
     ON CONFLICT DO NOTHING`,
    [
      stableKey('ops04_totals', [report.batch_key, report.dry_run_hash]),
      report.batch_key,
      actor.accountKey,
      actor.productKey,
      JSON.stringify(report.totals),
      report.totals.equations_balanced,
    ],
  );
}

async function insertAudit(
  client: Queryable,
  actor: Ops04RepositoryActor,
  batchKey: string,
  eventType: string,
  metadata: Record<string, unknown>,
) {
  const eventHash = sha256(canonicalJson({ actor, batchKey, eventType, metadata }));
  await client.query(
    `INSERT INTO onetime.ops04_audit_events
     (audit_event_key, batch_key, account_key, product_key, actor_user_key, event_type,
      event_hash, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT DO NOTHING`,
    [
      stableKey('ops04_audit', [batchKey, eventType, eventHash]),
      batchKey,
      actor.accountKey,
      actor.productKey,
      actor.userKey,
      eventType,
      eventHash,
      JSON.stringify(metadata),
    ],
  );
}

async function requireBatch(client: Queryable, actor: Ops04RepositoryActor, batchKey: string) {
  const result = await client.query(
    `SELECT batch_key, state, dry_run_hash
       FROM onetime.ops04_batches
      WHERE account_key = $1
        AND product_key = $2
        AND batch_key = $3
      LIMIT 1`,
    [actor.accountKey, actor.productKey, batchKey],
  );
  const batch = result.rows[0] as
    { batch_key: string; state: string; dry_run_hash: string } | undefined;
  if (!batch) throw new Ops04BatchNotFoundError();
  return batch;
}

async function actionStatusCounts(
  client: Queryable,
  actor: Ops04RepositoryActor,
  batchKey: string,
) {
  const result = await client.query(
    `SELECT status, count(*)::int AS count
       FROM onetime.ops04_action_ledger
      WHERE account_key = $1
        AND product_key = $2
        AND batch_key = $3
      GROUP BY status
      ORDER BY status`,
    [actor.accountKey, actor.productKey, batchKey],
  );
  const counts: Record<string, number> = {};
  for (const row of result.rows) counts[String(row.status)] = Number(row.count);
  return counts;
}

async function noSendDiff(client: Queryable): Promise<Ops04NoSendDiff> {
  const diff = {
    outbox_events: await countTable(client, 'outbox_events'),
    whatsapp_outbox_messages: await countTable(client, 'whatsapp_outbox_messages'),
    delivery_provider_events: await countTable(client, 'whatsapp_delivery_events'),
    account_invitations: await countTable(client, 'account_activation_requests'),
    access_grants: await countTable(client, 'portal_student_access_operations'),
    payment_records: await countTable(client, 'billing_events'),
  };
  return ops04NoSendDiffSchema.parse({
    ...diff,
    zero_diff: Object.values(diff).every((count) => count === 0),
  });
}

async function countTable(client: Queryable, tableName: string) {
  try {
    const exists = await client.query(
      `SELECT count(*)::int AS count
         FROM information_schema.tables
        WHERE table_schema = 'onetime'
          AND table_name = $1`,
      [tableName],
    );
    if (Number(exists.rows[0]?.count ?? 0) === 0) return 0;
    const quoted = tableName.replace(/"/g, '""');
    const result = await client.query(`SELECT count(*)::int AS count FROM onetime."${quoted}"`);
    return Number(result.rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

function validateReceipt(report: Ops04DryRunReport, receipt: Ops04ApplyReceipt, now: Date) {
  const fields: Array<
    keyof Pick<
      Ops04ApplyReceipt,
      'batch_key' | 'manifest_sha256' | 'mapping_sha256' | 'database_snapshot_key' | 'dry_run_hash'
    >
  > = ['batch_key', 'manifest_sha256', 'mapping_sha256', 'database_snapshot_key', 'dry_run_hash'];
  for (const field of fields) {
    if (receipt[field] !== report[field]) throw new Ops04ReceiptMismatchError();
  }
  if (!['synthetic_rehearsal', 'staging_rehearsal'].includes(receipt.mode)) {
    throw new Ops04ReceiptMismatchError('OPS-04 production apply is not implemented.');
  }
  if (new Date(receipt.expires_at).getTime() < now.getTime()) {
    throw new Ops04ReceiptMismatchError('OPS-04 apply receipt is expired.');
  }
  if (!receipt.import_approval_does_not_authorize_send) {
    throw new Ops04ReceiptMismatchError('OPS-04 receipt must preserve the no-send boundary.');
  }
}

function actionKeyFor(batchKey: string, row: Ops04RowOutcome, actionType: Ops04ActionType) {
  return stableKey('ops04_action', [batchKey, row.row_version_key, actionType]);
}

function targetTableFor(actionType: Ops04ActionType) {
  const mapping: Record<Ops04ActionType, string> = {
    create_contact: 'ops04_action_ledger_only',
    link_external_identity: 'ops04_external_identities',
    append_legacy_membership_event: 'ops04_legacy_membership_events',
    append_lead_event: 'ops04_action_ledger_only',
    add_contact_point: 'ops04_contact_points',
    add_contact_point_owner: 'ops04_contact_point_owners',
    append_channel_state_event: 'ops04_channel_state_events',
    add_relationship: 'ops04_action_ledger_only',
    add_tag_assignment: 'ops04_tag_assignments',
    link_source_provenance: 'ops04_source_row_versions',
    set_migration_projection: 'ops04_match_decisions',
    no_op_unchanged: 'ops04_action_ledger_only',
    quarantine_manual_review: 'ops04_match_decisions',
    reject_insufficient_identity: 'ops04_match_decisions',
  };
  return mapping[actionType];
}

function ownedFieldsFor(actionType: Ops04ActionType) {
  if (actionType === 'create_contact') return ['none_rehearsal_only'];
  if (actionType === 'set_migration_projection') return ['primary_disposition', 'sends_allowed'];
  if (actionType === 'append_channel_state_event') return ['consent_state', 'suppression_state'];
  return ['provenance'];
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortCanonical(value));
}

function sortCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortCanonical(nested)]),
    );
  }
  return value;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function stableKey(prefix: string, parts: string[]) {
  return `${prefix}_${sha256(parts.join('\0')).slice(0, 24)}`;
}
