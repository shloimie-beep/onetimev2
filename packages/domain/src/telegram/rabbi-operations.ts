import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type {
  RabbiCommunicationActor,
  RabbiDiagnosticCapability,
  RabbiReadRequest,
  RabbiRedactedSubjectRef,
  RabbiRiskClass,
  RabbiIssueCategory,
} from '../../../contracts/src/telegram/rabbi-communications.ts';
import type {
  BotActionRequest,
  CanonicalOneTimeActor,
} from '../../../contracts/src/telegram/types.ts';
import type { DbPool } from '../../../db/src/index.ts';
import { createOneTimeTelegramApplicationAdapter } from './application-adapter.ts';

export type RabbiTaskEnvelope = {
  schemaVersion: 1;
  entity: 'support_incident' | 'agent_task';
  subject: RabbiRedactedSubjectRef;
  issueCategory: RabbiIssueCategory;
  diagnosticCapability: RabbiDiagnosticCapability | null;
  riskClass: RabbiRiskClass;
  idempotencyKey: string;
  assignedTo: 'local_agent' | null;
  branchPrRef: string | null;
  resultSummary: string;
  notes: string[];
};

export const rabbiReadOnlyDiagnosticAllowlist = [
  'login_access_summary',
  'class_readiness_summary',
  'content_processing_summary',
  'vimeo_processing_summary',
  'support_incident_summary',
] as const satisfies readonly RabbiDiagnosticCapability[];

export type RabbiTelegramOperationsReader = {
  read(
    actor: RabbiCommunicationActor,
    request: Extract<RabbiReadRequest, { capability: `operation.${string}` }>,
  ): Promise<string>;
};

/**
 * Exposes only redacted read models and aggregate runtime state. It never calls a
 * provider, sends a notification, returns a secret, or accepts executable text.
 */
export function createRabbiTelegramOperationsReader(input: {
  pool: DbPool;
  config: AppConfig;
}): RabbiTelegramOperationsReader {
  const adapter = createOneTimeTelegramApplicationAdapter(input);
  return {
    async read(actor, request) {
      if (request.capability === 'operation.readiness') {
        return operationalReadiness(input.pool, input.config);
      }
      if (request.capability === 'operation.support.list') {
        const [application, local] = await Promise.all([
          adapter.readAction?.(
            applicationActor(actor, adapter.supportedCapabilities()),
            deterministicRead('support.ticket.decision_needed', {}),
          ) ?? 'Application support status is unavailable.',
          listLocalSupportIncidents(input.pool, actor),
        ]);
        return [application, local].filter(Boolean).join('\n');
      }
      if (request.capability === 'operation.support.read') {
        const local = await readLocalSupportIncident(input.pool, actor, request.incidentKey);
        if (local) return local;
      }
      if (request.capability === 'operation.login_issues.list') {
        const [application, local] = await Promise.all([
          adapter.readAction?.(
            applicationActor(actor, adapter.supportedCapabilities()),
            deterministicRead('support.ticket.decision_needed', { filter: 'login_access' }),
          ) ?? 'Application login-issue status is unavailable.',
          listLocalSupportIncidents(input.pool, actor, 'login_access'),
        ]);
        return [application, local].filter(Boolean).join('\n');
      }
      const action = operationAction(request);
      return (
        adapter.readAction?.(
          applicationActor(actor, adapter.supportedCapabilities()),
          action,
        ) ?? 'This operation is unavailable.'
      );
    },
  };
}

export class RabbiLocalAgentTaskDispatcher {
  private readonly adapter: ReturnType<typeof createOneTimeTelegramApplicationAdapter>;

  constructor(
    private readonly pool: DbPool,
    config: AppConfig,
  ) {
    this.adapter = createOneTimeTelegramApplicationAdapter({ pool, config });
  }

  /**
   * Claims exactly one typed task and invokes one fixed read-only adapter action.
   * There is no shell, SQL text, provider command, deployment, or free-form tool route.
   */
  async runOnce(now = new Date()) {
    const claimed = await this.pool.query(
      `UPDATE onetime.rabbi_internal_tasks
          SET status = 'in_progress',
              version = version + 1,
              updated_at = $1
        WHERE id = (
          SELECT id
            FROM onetime.rabbi_internal_tasks
           WHERE task_key LIKE 'rabbi_agent_%'
             AND status = 'queued'
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
        )
      RETURNING task_key, account_key, product_key, created_by_user_key, detail, version`,
      [now.toISOString()],
    );
    const row = claimed.rows[0];
    if (!row) return { status: 'none' as const };

    const envelope = parseRabbiTaskEnvelope(String(row.detail));
    if (
      !envelope ||
      envelope.entity !== 'agent_task' ||
      !envelope.diagnosticCapability ||
      !rabbiReadOnlyDiagnosticAllowlist.includes(envelope.diagnosticCapability)
    ) {
      await this.blockTask(String(row.task_key), Number(row.version), envelope, now);
      return { status: 'blocked' as const, taskKey: String(row.task_key) };
    }

    try {
      const result = await this.adapter.readAction?.(
        {
          userKey: String(row.created_by_user_key) as never,
          displayLabel: 'Rabbi Telegram local agent',
          accountKey: String(row.account_key),
          productKey: String(row.product_key),
          membershipKey: 'rabbi_telegram_local_agent',
          membershipStatus: 'active',
          userStatus: 'active',
          role: 'admin',
          securityVersion: 1,
          capabilities: this.adapter.supportedCapabilities(),
        },
        diagnosticAction(envelope),
      );
      const completed: RabbiTaskEnvelope = {
        ...envelope,
        resultSummary: sanitizePublicResult(result ?? 'No redacted diagnostic result was returned.'),
      };
      const updated = await this.pool.query(
        `UPDATE onetime.rabbi_internal_tasks
            SET detail = $3,
                status = 'completed',
                completed_at = $4,
                updated_at = $4,
                version = version + 1
          WHERE task_key = $1
            AND version = $2
            AND status = 'in_progress'`,
        [String(row.task_key), Number(row.version), serializeRabbiTaskEnvelope(completed), now.toISOString()],
      );
      return updated.rowCount
        ? { status: 'completed' as const, taskKey: String(row.task_key) }
        : { status: 'blocked' as const, taskKey: String(row.task_key) };
    } catch {
      await this.blockTask(String(row.task_key), Number(row.version), envelope, now);
      return { status: 'blocked' as const, taskKey: String(row.task_key) };
    }
  }

  private async blockTask(
    taskKey: string,
    version: number,
    envelope: RabbiTaskEnvelope | null,
    now: Date,
  ) {
    const blocked = envelope
      ? { ...envelope, resultSummary: 'The allowlisted read-only diagnostic could not complete.' }
      : null;
    await this.pool.query(
      `UPDATE onetime.rabbi_internal_tasks
          SET detail = COALESCE($3, detail),
              status = 'blocked',
              updated_at = $4,
              version = version + 1
        WHERE task_key = $1
          AND version = $2
          AND status = 'in_progress'`,
      [taskKey, version, blocked ? serializeRabbiTaskEnvelope(blocked) : null, now.toISOString()],
    );
  }
}

export function serializeRabbiTaskEnvelope(value: RabbiTaskEnvelope) {
  return JSON.stringify(value);
}

export function parseRabbiTaskEnvelope(value: string): RabbiTaskEnvelope | null {
  try {
    const parsed = JSON.parse(value) as Partial<RabbiTaskEnvelope>;
    if (
      parsed.schemaVersion !== 1 ||
      !['support_incident', 'agent_task'].includes(parsed.entity ?? '') ||
      !parsed.subject ||
      !['parent', 'student', 'account'].includes(parsed.subject.kind) ||
      !safeRef(parsed.subject.ref) ||
      !['login_access', 'support_incident', 'class_readiness', 'content_processing'].includes(
        parsed.issueCategory ?? '',
      ) ||
      !['R0', 'R1'].includes(parsed.riskClass ?? '') ||
      typeof parsed.idempotencyKey !== 'string' ||
      !Array.isArray(parsed.notes)
    ) {
      return null;
    }
    return parsed as RabbiTaskEnvelope;
  } catch {
    return null;
  }
}

function operationAction(
  request: Exclude<
    Extract<RabbiReadRequest, { capability: `operation.${string}` }>,
    { capability: 'operation.readiness' | 'operation.support.list' | 'operation.login_issues.list' }
  >,
): BotActionRequest {
  switch (request.capability) {
    case 'operation.class.status':
      return deterministicRead('class.status.read', {});
    case 'operation.content.status':
      return deterministicRead('content.pipeline.read', {});
    case 'operation.vimeo.status':
      return deterministicRead('content.pipeline.read', { filter: 'vimeo' });
    case 'operation.support.read':
      return deterministicRead('support.ticket.read_redacted', { ref: request.incidentKey });
  }
}

function diagnosticAction(envelope: RabbiTaskEnvelope): BotActionRequest {
  switch (envelope.diagnosticCapability) {
    case 'login_access_summary':
      return deterministicRead('support.ticket.decision_needed', { filter: 'login_access' });
    case 'class_readiness_summary':
      return deterministicRead('class.status.read', {});
    case 'content_processing_summary':
      return deterministicRead('content.pipeline.read', {});
    case 'vimeo_processing_summary':
      return deterministicRead('content.pipeline.read', { filter: 'vimeo' });
    case 'support_incident_summary':
      return deterministicRead('support.ticket.decision_needed', {});
    case null:
      throw new Error('RABBI_DIAGNOSTIC_NOT_ALLOWLISTED');
  }
}

function deterministicRead(
  capability:
    | 'class.status.read'
    | 'content.pipeline.read'
    | 'support.ticket.decision_needed'
    | 'support.ticket.read_redacted',
  args: BotActionRequest['args'],
): BotActionRequest {
  return {
    capability,
    args,
    source: 'deterministic',
    confirmationMode: 'none',
    riskClass: 'R0',
  };
}

function applicationActor(
  actor: RabbiCommunicationActor,
  capabilities: CanonicalOneTimeActor['capabilities'],
): CanonicalOneTimeActor {
  return {
    ...actor,
    membershipKey: 'rabbi_telegram_private_chat',
    membershipStatus: 'active',
    userStatus: 'active',
    capabilities,
  };
}

async function listLocalSupportIncidents(
  pool: DbPool,
  actor: RabbiCommunicationActor,
  category?: RabbiIssueCategory,
) {
  const result = await pool.query(
    `SELECT task_key, status, priority, detail, updated_at
       FROM onetime.rabbi_internal_tasks
      WHERE account_key = $1
        AND product_key = $2
        AND task_key LIKE 'rabbi_support_%'
      ORDER BY updated_at DESC
      LIMIT 10`,
    [actor.accountKey, actor.productKey],
  );
  const rows = result.rows
    .map((row) => ({ row, envelope: parseRabbiTaskEnvelope(String(row.detail)) }))
    .filter(
      (item): item is { row: Record<string, unknown>; envelope: RabbiTaskEnvelope } =>
        Boolean(item.envelope) && (!category || item.envelope.issueCategory === category),
    );
  if (!rows.length) return category ? 'Local login incidents: none.' : 'Local support incidents: none.';
  return [
    category ? 'Local login incidents:' : 'Local support incidents:',
    ...rows.map(
      ({ row, envelope }) =>
        `${String(row.task_key)} · ${envelope.issueCategory} · ${envelope.subject.kind}:${envelope.subject.ref} · ${String(row.status)} · ${String(row.priority)}`,
    ),
  ].join('\n');
}

async function readLocalSupportIncident(
  pool: DbPool,
  actor: RabbiCommunicationActor,
  incidentKey: string,
) {
  const result = await pool.query(
    `SELECT task_key, status, priority, detail, created_by_user_key, created_at, updated_at
       FROM onetime.rabbi_internal_tasks
      WHERE account_key = $1
        AND product_key = $2
        AND task_key = $3
        AND task_key LIKE 'rabbi_support_%'
      LIMIT 1`,
    [actor.accountKey, actor.productKey, incidentKey],
  );
  const row = result.rows[0];
  const envelope = row ? parseRabbiTaskEnvelope(String(row.detail)) : null;
  if (!row || !envelope) return null;
  return [
    `Support incident: ${String(row.task_key)}`,
    `Subject: ${envelope.subject.kind}:${envelope.subject.ref}`,
    `Category: ${envelope.issueCategory}`,
    `Status: ${String(row.status)} · Priority: ${String(row.priority)} · Risk: ${envelope.riskClass}`,
    `Assigned: ${envelope.assignedTo ?? 'unassigned'}`,
    `Created: ${new Date(String(row.created_at)).toISOString()} by ${String(row.created_by_user_key)}`,
    `Updated: ${new Date(String(row.updated_at)).toISOString()}`,
    `Notes: ${envelope.notes.length}`,
    envelope.resultSummary ? `Result: ${envelope.resultSummary}` : 'Result: pending',
  ].join('\n');
}

async function operationalReadiness(pool: DbPool, config: AppConfig) {
  const [lease, inbox, outbox, deadLetters] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS active_count
         FROM onetime.telegram_consumer_leases
        WHERE bot_key = $1 AND environment = $2 AND active = true AND expires_at > now()`,
      [config.oneTimeRabbiTelegramBotKey, config.oneTimeTelegramEnvironment],
    ),
    pool.query(
      `SELECT status, count(*)::int AS count
         FROM onetime.telegram_update_inbox
        WHERE bot_key = $1 AND environment = $2
        GROUP BY status`,
      [config.oneTimeRabbiTelegramBotKey, config.oneTimeTelegramEnvironment],
    ),
    pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.telegram_response_outbox
        WHERE bot_key = $1 AND environment = $2`,
      [config.oneTimeRabbiTelegramBotKey, config.oneTimeTelegramEnvironment],
    ),
    pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.telegram_dead_letters
        WHERE bot_key = $1 AND environment = $2`,
      [config.oneTimeRabbiTelegramBotKey, config.oneTimeTelegramEnvironment],
    ),
  ]);
  const inboxStates = Object.fromEntries(
    inbox.rows.map((row) => [String(row.status), Number(row.count)]),
  );
  const transport = config.oneTimeTelegramWebhookEnabled
    ? 'webhook'
    : config.oneTimeTelegramLocalPollingEnabled
      ? 'local_polling'
      : 'inactive';
  const payloadFingerprint = config.oneTimeRabbiTelegramPayloadKey
    ? createHash('sha256').update(config.oneTimeRabbiTelegramPayloadKey).digest('hex').slice(0, 12)
    : 'missing';
  return [
    'Rabbi Telegram readiness (presence/status only):',
    `Identity configured: ${config.oneTimeRabbiTelegramOwnerMappingConfigured ? 'yes' : 'no'}`,
    `Token configured: ${config.oneTimeRabbiTelegramTokenConfigured ? 'yes' : 'no'}`,
    `Owner/admin private-chat allowlist: ${config.oneTimeRabbiTelegramOwnerMappingConfigured ? 'configured' : 'missing'}`,
    `Webhook secret present: ${config.oneTimeTelegramWebhookSecretConfigured ? 'yes' : 'no'}`,
    `Payload-key fingerprint: ${payloadFingerprint}`,
    `Single-consumer gate: ${config.oneTimeRabbiTelegramSingleConsumerGate ? 'on' : 'off'} · active leases: ${Number(lease.rows[0]?.active_count ?? 0)}`,
    `Worker: ${config.oneTimeRabbiTelegramEnabled ? 'enabled' : 'disabled'} · transport: ${transport}`,
    `Inbox: queued=${inboxStates.queued ?? 0} retry=${inboxStates.retry ?? 0} leased=${inboxStates.leased ?? 0} dead_letter=${inboxStates.dead_letter ?? 0}`,
    `Response outbox rows: ${Number(outbox.rows[0]?.count ?? 0)} · dead-letter rows: ${Number(deadLetters.rows[0]?.count ?? 0)}`,
    'Customer delivery authorized: no',
  ].join('\n');
}

function sanitizePublicResult(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, '[link withheld]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email withheld]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number withheld]')
    .slice(0, 1_000);
}

function safeRef(value: string) {
  return /^[a-z][a-z0-9_-]{0,119}$/i.test(value) && !/^\d+$/u.test(value);
}
