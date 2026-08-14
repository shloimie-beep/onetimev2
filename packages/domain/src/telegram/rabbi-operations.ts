import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type {
  RabbiCommunicationActor,
  RabbiDiagnosticCapability,
  RabbiIssueCategory,
  RabbiReadRequest,
  RabbiRedactedSubjectRef,
  RabbiRiskClass,
} from '../../../contracts/src/telegram/rabbi-communications.ts';
import {
  asBotKey,
  type BotActionRequest,
  type CanonicalOneTimeActor,
} from '../../../contracts/src/telegram/types.ts';
import { inTransaction, type DbPool, type Queryable } from '../../../db/src/index.ts';
import { TelegramSqlConsumerLeaseRepository } from '../../../db/src/telegram/repositories.ts';
import { createOneTimeTelegramApplicationAdapter } from './application-adapter.ts';

const AGENT_ROW_LEASE_MS = 30_000;
const AGENT_BASE_BACKOFF_MS = 1_000;

export type RabbiTaskEnvelope = {
  schemaVersion: 1;
  entity: 'support_incident' | 'agent_task';
  subject: RabbiRedactedSubjectRef;
  issueCategory: RabbiIssueCategory;
  diagnosticCapability: RabbiDiagnosticCapability | null;
  riskClass: RabbiRiskClass;
  idempotencyKey: string;
  assignedTo: 'local_agent' | null;
  sourceTaskRef: string | null;
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

type ClaimedAgentTask = {
  task_key: string;
  account_key: string;
  product_key: string;
  created_by_user_key: string;
  idempotency_key: string;
  request_digest: string;
  detail: string;
  attempts: number;
  max_attempts: number;
  lease_generation: number;
};

type RevalidatedExecution = {
  actor: CanonicalOneTimeActor;
  botKey: string;
  environment: string;
  chatRefHash: string;
};

class BoundedAgentError extends Error {
  constructor(
    readonly code: string,
    readonly terminal: boolean,
  ) {
    super(code);
  }
}

/**
 * Exposes only redacted One Time read models and source-observed runtime state.
 * It never calls Telegram, a customer transport, a provider, or a deployment API.
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
      if (request.capability === 'operation.class.status') {
        return readCurrentClassStatus(input.pool, actor);
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
          listApplicationLoginIssues(input.pool, actor),
          listLocalSupportIncidents(input.pool, actor, 'login_access'),
        ]);
        return [application, local].filter(Boolean).join('\n');
      }
      const action = operationAction(request);
      return (
        adapter.readAction?.(applicationActor(actor, adapter.supportedCapabilities()), action) ??
        'This operation is unavailable.'
      );
    },
  };
}

/**
 * A separately started, single-consumer queue for typed read-only diagnostics.
 * It accepts no executable text and mounts no Telegram/provider transport.
 */
export class RabbiLocalAgentTaskDispatcher {
  private readonly adapter: ReturnType<typeof createOneTimeTelegramApplicationAdapter>;
  private readonly leases: TelegramSqlConsumerLeaseRepository;
  private readonly ownerId: string;
  private readonly rowLeaseMs: number;
  private readonly baseBackoffMs: number;
  private running = false;
  private stopping = false;
  private timer: NodeJS.Timeout | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  private leaseGeneration: number | null = null;
  private lastLoopErrorCode: string | null = null;

  constructor(
    private readonly pool: DbPool,
    private readonly config: AppConfig,
    options: {
      ownerId?: string;
      rowLeaseMs?: number;
      baseBackoffMs?: number;
    } = {},
  ) {
    this.adapter = createOneTimeTelegramApplicationAdapter({ pool, config });
    this.leases = new TelegramSqlConsumerLeaseRepository(pool);
    this.ownerId = options.ownerId ?? `rabbi-local-agent-${process.pid}`;
    this.rowLeaseMs = options.rowLeaseMs ?? AGENT_ROW_LEASE_MS;
    this.baseBackoffMs = options.baseBackoffMs ?? AGENT_BASE_BACKOFF_MS;
  }

  async acquireConsumerLease(now = new Date()) {
    if (!localAgentSourceReady(this.config)) {
      throw new Error('RABBI_LOCAL_AGENT_SOURCE_NOT_READY');
    }
    if (this.leaseGeneration !== null) return this.leaseGeneration;
    await assertLocalAgentDatabaseReady(this.pool, this.config);
    const tokenFingerprint = localAgentTokenFingerprint(this.config);
    const acquired = await this.leases.acquire({
      botKey: asBotKey(this.config.oneTimeRabbiTelegramBotKey),
      environment: this.config.oneTimeTelegramEnvironment,
      tokenFingerprint,
      ownerId: this.ownerId,
      leaseMs: AGENT_ROW_LEASE_MS,
      now,
    });
    if (!acquired.acquired) throw new Error('RABBI_LOCAL_AGENT_CONSUMER_ALREADY_OWNED');
    this.leaseGeneration = acquired.generation;
    return acquired.generation;
  }

  async runOneShot(now = new Date()) {
    await this.acquireConsumerLease(now);
    try {
      return await this.runOnce(now);
    } finally {
      await this.stop();
    }
  }

  async runOnce(now = new Date()) {
    if (this.leaseGeneration === null) {
      return { status: 'consumer_off' as const };
    }
    const activeLease = await this.pool.query(
      `SELECT 1
         FROM onetime.telegram_consumer_leases
        WHERE bot_key = $1
          AND environment = $2
          AND token_fingerprint_hash = $3
          AND owner_id = $4
          AND generation = $5
          AND active = true
          AND expires_at > $6
        LIMIT 1`,
      [
        this.config.oneTimeRabbiTelegramBotKey,
        this.config.oneTimeTelegramEnvironment,
        localAgentTokenFingerprint(this.config),
        this.ownerId,
        this.leaseGeneration,
        now.toISOString(),
      ],
    );
    if (!activeLease.rowCount) {
      this.stopScheduling();
      this.leaseGeneration = null;
      return { status: 'consumer_lost' as const };
    }
    if (this.running) return { status: 'already_running' as const };
    this.running = true;
    let item: ClaimedAgentTask | null = null;
    let execution: RevalidatedExecution | null = null;
    let envelope: RabbiTaskEnvelope | null = null;
    try {
      item = await claimNextAgentTask(this.pool, this.ownerId, this.rowLeaseMs, now);
      if (!item) return { status: 'none' as const };
      envelope = parseRabbiTaskEnvelope(item.detail);
      if (
        !envelope ||
        envelope.entity !== 'agent_task' ||
        envelope.assignedTo !== 'local_agent' ||
        envelope.idempotencyKey !== item.idempotency_key ||
        !envelope.diagnosticCapability ||
        !rabbiReadOnlyDiagnosticAllowlist.includes(envelope.diagnosticCapability)
      ) {
        throw new BoundedAgentError('RABBI_AGENT_CONTRACT_INVALID', true);
      }
      execution = await revalidateAgentExecution(this.pool, this.config, item);
      if (!(await isScopedRabbiSubject(this.pool, execution.actor, envelope.subject))) {
        throw new BoundedAgentError('RABBI_AGENT_SUBJECT_OUT_OF_SCOPE', true);
      }
      const rawResult = await runAllowlistedDiagnostic(
        this.pool,
        this.adapter,
        execution.actor,
        envelope,
      );
      const completedEnvelope: RabbiTaskEnvelope = {
        ...envelope,
        resultSummary: sanitizePublicResult(rawResult),
      };
      const completed = await completeAgentTask(
        this.pool,
        item,
        completedEnvelope,
        execution,
        this.ownerId,
        now,
      );
      return completed
        ? { status: 'completed' as const, taskKey: item.task_key }
        : { status: 'lease_lost' as const, taskKey: item.task_key };
    } catch (error) {
      if (!item) throw error;
      const disposition = await failAgentTask(
        this.pool,
        item,
        envelope,
        this.ownerId,
        this.baseBackoffMs,
        error,
        now,
      );
      return { status: disposition, taskKey: item.task_key };
    } finally {
      this.running = false;
    }
  }

  async start(intervalMs = 250) {
    if (this.timer || this.heartbeat) throw new Error('RABBI_LOCAL_AGENT_ALREADY_STARTED');
    await this.acquireConsumerLease();
    this.stopping = false;
    const tick = async () => {
      if (this.stopping) return;
      try {
        await this.runOnce();
        this.lastLoopErrorCode = null;
      } catch (error) {
        this.lastLoopErrorCode = safeErrorCode(error);
      } finally {
        if (!this.stopping) this.timer = setTimeout(tick, intervalMs);
      }
    };
    this.timer = setTimeout(tick, 0);
    this.heartbeat = setInterval(
      () => {
        if (this.leaseGeneration === null || this.stopping) return;
        const generation = this.leaseGeneration;
        void this.leases
          .heartbeat(this.ownerId, generation, AGENT_ROW_LEASE_MS, new Date())
          .then((renewed) => {
            if (!renewed) this.stopScheduling();
          })
          .catch(() => this.stopScheduling());
      },
      Math.floor(AGENT_ROW_LEASE_MS / 3),
    );
  }

  async stop() {
    this.stopScheduling();
    while (this.running) await new Promise((resolve) => setTimeout(resolve, 5));
    if (this.leaseGeneration !== null) {
      await this.leases.release(this.ownerId, this.leaseGeneration);
    }
    this.leaseGeneration = null;
  }

  loopState() {
    return {
      consumerLeaseActive: this.leaseGeneration !== null,
      running: this.running,
      lastErrorCode: this.lastLoopErrorCode,
    };
  }

  private stopScheduling() {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.timer = null;
    this.heartbeat = null;
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
      parsed.idempotencyKey.length < 1 ||
      parsed.idempotencyKey.length > 128 ||
      (parsed.diagnosticCapability !== null &&
        !rabbiReadOnlyDiagnosticAllowlist.includes(
          parsed.diagnosticCapability as RabbiDiagnosticCapability,
        )) ||
      (parsed.assignedTo !== null && parsed.assignedTo !== 'local_agent') ||
      (parsed.sourceTaskRef !== undefined &&
        parsed.sourceTaskRef !== null &&
        (!safeRef(parsed.sourceTaskRef) || !parsed.sourceTaskRef.startsWith('rabbi_support_'))) ||
      (parsed.branchPrRef !== null &&
        (typeof parsed.branchPrRef !== 'string' || !safeBranchPrRef(parsed.branchPrRef))) ||
      typeof parsed.resultSummary !== 'string' ||
      parsed.resultSummary.length > 1_000 ||
      !Array.isArray(parsed.notes) ||
      parsed.notes.length > 10 ||
      parsed.notes.some((note) => typeof note !== 'string' || note.length > 500)
    ) {
      return null;
    }
    return { ...parsed, sourceTaskRef: parsed.sourceTaskRef ?? null } as RabbiTaskEnvelope;
  } catch {
    return null;
  }
}

export async function isScopedRabbiSubject(
  pool: Pick<DbPool, 'query'>,
  actor: Pick<CanonicalOneTimeActor, 'accountKey' | 'productKey'>,
  subject: RabbiRedactedSubjectRef,
) {
  if (!safeRef(subject.ref)) return false;
  if (subject.kind === 'student') {
    const result = await pool.query(
      `SELECT 1
         FROM onetime.portal_learners
        WHERE account_key = $1
          AND product_key = $2
          AND learner_key = $3
          AND learner_status <> 'archived'
       UNION ALL
       SELECT 1
         FROM onetime.v21_student_profiles
        WHERE product_key = $2
          AND student_id = $3
          AND state = 'active'
       LIMIT 1`,
      [actor.accountKey, actor.productKey, subject.ref],
    );
    return Boolean(result.rowCount);
  }
  if (subject.kind === 'parent') {
    const result = await pool.query(
      `SELECT 1
         FROM onetime.portal_guardian_relationships
        WHERE account_key = $1
          AND product_key = $2
          AND guardian_user_ref = $3
          AND status = 'active'
       UNION ALL
       SELECT 1
         FROM onetime.v21_human_accounts AS account
         JOIN onetime.v21_human_account_role_memberships AS membership
           ON membership.human_account_id = account.human_account_id
          AND membership.product_key = account.product_key
          AND membership.runtime_tier = account.runtime_tier
          AND membership.verification_environment_id = account.verification_environment_id
        WHERE account.product_key = $2
          AND account.human_account_id = $3
          AND account.state = 'active'
          AND membership.role = 'parent'
          AND membership.revoked_at IS NULL
       LIMIT 1`,
      [actor.accountKey, actor.productKey, subject.ref],
    );
    return Boolean(result.rowCount);
  }
  const result = await pool.query(
    `SELECT 1
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND status = 'active'
     UNION ALL
     SELECT 1
       FROM onetime.v21_human_accounts
      WHERE product_key = $2
        AND human_account_id = $3
        AND state = 'active'
     LIMIT 1`,
    [actor.accountKey, actor.productKey, subject.ref],
  );
  return Boolean(result.rowCount);
}

async function claimNextAgentTask(
  pool: DbPool,
  ownerId: string,
  leaseMs: number,
  now: Date,
): Promise<ClaimedAgentTask | null> {
  return inTransaction(pool, async (client) => {
    const row = await selectClaimableAgentTask(client, now);
    if (!row) return null;
    const generation = Number(row.lease_generation) + 1;
    const claimed = await client.query(
      `UPDATE onetime.rabbi_internal_tasks
          SET status = 'in_progress',
              attempts = attempts + 1,
              lease_owner = $2,
              lease_generation = $3,
              lease_expires_at = $4,
              last_error_code = NULL,
              version = version + 1,
              updated_at = $5
        WHERE task_key = $1
          AND lease_generation = $6
          AND attempts < max_attempts
          AND (
            (status = 'queued' AND next_attempt_at <= $5)
            OR (status = 'in_progress' AND lease_expires_at <= $5)
          )
      RETURNING task_key, account_key, product_key, created_by_user_key,
                idempotency_key, request_digest, detail, attempts, max_attempts,
                lease_generation`,
      [
        String(row.task_key),
        ownerId,
        generation,
        new Date(now.getTime() + leaseMs).toISOString(),
        now.toISOString(),
        Number(row.lease_generation),
      ],
    );
    return (claimed.rows[0] as ClaimedAgentTask | undefined) ?? null;
  });
}

async function selectClaimableAgentTask(client: Queryable, now: Date) {
  const sql = `SELECT task_key, lease_generation
                 FROM onetime.rabbi_internal_tasks
                WHERE task_key LIKE 'rabbi_agent_%'
                  AND attempts < max_attempts
                  AND (
                    (status = 'queued' AND next_attempt_at <= $1)
                    OR (status = 'in_progress' AND lease_expires_at <= $1)
                  )
                ORDER BY created_at, task_key
                LIMIT 1
                FOR UPDATE SKIP LOCKED`;
  try {
    const result = await client.query(sql, [now.toISOString()]);
    return result.rows[0] ?? null;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('skip locked')) {
      const fallback = await client.query(sql.replace(' FOR UPDATE SKIP LOCKED', ''), [
        now.toISOString(),
      ]);
      return fallback.rows[0] ?? null;
    }
    throw error;
  }
}

async function revalidateAgentExecution(
  pool: DbPool,
  config: AppConfig,
  item: ClaimedAgentTask,
): Promise<RevalidatedExecution> {
  const result = await pool.query(
    `SELECT confirmation.bot_key, confirmation.environment, confirmation.chat_ref_hash,
            confirmation.actor_user_key, confirmation.account_key, confirmation.product_key,
            mapping.membership_key, account.display_name, account.role,
            account.status AS user_status, account.security_version
       FROM onetime.rabbi_action_confirmations AS confirmation
       JOIN onetime.telegram_identity_mappings AS mapping
         ON mapping.mapping_key = confirmation.mapping_key
        AND mapping.bot_key = confirmation.bot_key
        AND mapping.environment = confirmation.environment
        AND mapping.canonical_user_key = confirmation.actor_user_key
        AND mapping.account_key = confirmation.account_key
        AND mapping.product_key = confirmation.product_key
        AND mapping.provider_user_ref_hash = confirmation.provider_user_ref_hash
        AND mapping.chat_ref_hash = confirmation.chat_ref_hash
        AND mapping.mapping_version = confirmation.mapping_version
        AND mapping.security_version = confirmation.security_version
        AND mapping.status = 'active'
       JOIN onetime.account_users AS account
         ON account.user_key = confirmation.actor_user_key
        AND account.account_key = confirmation.account_key
        AND account.product_key = confirmation.product_key
        AND account.security_version = confirmation.security_version
        AND account.status = 'active'
        AND account.role IN ('owner', 'admin')
       JOIN onetime.telegram_bot_registry AS registry
         ON registry.bot_key = confirmation.bot_key
        AND registry.environment = confirmation.environment
        AND registry.account_key = confirmation.account_key
        AND registry.product_key = confirmation.product_key
        AND registry.status = 'active'
        AND registry.token_fingerprint_hash = $7
      WHERE confirmation.idempotency_key = $1
        AND confirmation.actor_user_key = $2
        AND confirmation.account_key = $3
        AND confirmation.product_key = $4
        AND confirmation.action_digest = $5
        AND confirmation.bot_key = $6
        AND confirmation.environment = $8
        AND confirmation.capability IN ('internal_task.create', 'internal_task.update')
        AND confirmation.consumed_at IS NOT NULL
        AND confirmation.cancelled_at IS NULL
      LIMIT 1`,
    [
      item.idempotency_key,
      item.created_by_user_key,
      item.account_key,
      item.product_key,
      item.request_digest,
      config.oneTimeRabbiTelegramBotKey,
      config.oneTimeRabbiTelegramTokenFingerprintHash ?? '__missing__',
      config.oneTimeTelegramEnvironment,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new BoundedAgentError('RABBI_AGENT_AUTHORIZATION_INVALID', true);
  return {
    actor: {
      userKey: String(row.actor_user_key) as never,
      displayLabel: String(row.display_name),
      accountKey: String(row.account_key),
      productKey: String(row.product_key),
      membershipKey: String(row.membership_key),
      membershipStatus: 'active',
      userStatus: 'active',
      role: String(row.role) as 'owner' | 'admin',
      securityVersion: Number(row.security_version),
      capabilities: createOneTimeTelegramApplicationAdapter({
        pool,
        config,
      }).supportedCapabilities(),
    },
    botKey: String(row.bot_key),
    environment: String(row.environment),
    chatRefHash: String(row.chat_ref_hash),
  };
}

async function runAllowlistedDiagnostic(
  pool: DbPool,
  adapter: ReturnType<typeof createOneTimeTelegramApplicationAdapter>,
  actor: CanonicalOneTimeActor,
  envelope: RabbiTaskEnvelope,
) {
  switch (envelope.diagnosticCapability) {
    case 'login_access_summary':
      return readSubjectLoginAccessSummary(pool, actor, envelope.subject);
    case 'class_readiness_summary':
      return readCurrentClassStatus(pool, actor);
    case 'content_processing_summary':
      return (
        adapter.readAction?.(actor, deterministicRead('content.pipeline.read', {})) ??
        'Content processing status is unavailable.'
      );
    case 'vimeo_processing_summary':
      return (
        adapter.readAction?.(
          actor,
          deterministicRead('content.pipeline.read', { filter: 'vimeo' }),
        ) ?? 'Vimeo processing status is unavailable.'
      );
    case 'support_incident_summary':
      return readSubjectSupportSummary(pool, actor, envelope.subject);
    case null:
      throw new BoundedAgentError('RABBI_DIAGNOSTIC_NOT_ALLOWLISTED', true);
  }
}

async function completeAgentTask(
  pool: DbPool,
  item: ClaimedAgentTask,
  envelope: RabbiTaskEnvelope,
  execution: RevalidatedExecution,
  ownerId: string,
  now: Date,
) {
  return inTransaction(pool, async (client) => {
    const updated = await client.query(
      `UPDATE onetime.rabbi_internal_tasks
          SET detail = $4,
              status = 'completed',
              completed_at = $5,
              lease_owner = NULL,
              lease_expires_at = NULL,
              last_error_code = NULL,
              updated_by_user_key = $6,
              updated_at = $5,
              version = version + 1
        WHERE task_key = $1
          AND lease_owner = $2
          AND lease_generation = $3
          AND status = 'in_progress'`,
      [
        item.task_key,
        ownerId,
        item.lease_generation,
        serializeRabbiTaskEnvelope(envelope),
        now.toISOString(),
        execution.actor.userKey,
      ],
    );
    if (!updated.rowCount) return false;

    if (envelope.sourceTaskRef) {
      const source = await client.query(
        `SELECT detail, version, status
           FROM onetime.rabbi_internal_tasks
          WHERE task_key = $1
            AND account_key = $2
            AND product_key = $3
            AND task_key LIKE 'rabbi_support_%'
          LIMIT 1`,
        [envelope.sourceTaskRef, item.account_key, item.product_key],
      );
      const sourceEnvelope = source.rows[0]
        ? parseRabbiTaskEnvelope(String(source.rows[0].detail))
        : null;
      if (
        sourceEnvelope?.entity === 'support_incident' &&
        String(source.rows[0]?.status) === 'in_progress' &&
        sourceEnvelope.diagnosticCapability === envelope.diagnosticCapability
      ) {
        const next: RabbiTaskEnvelope = {
          ...sourceEnvelope,
          assignedTo: 'local_agent',
          diagnosticCapability: envelope.diagnosticCapability,
          resultSummary: envelope.resultSummary,
        };
        await client.query(
          `UPDATE onetime.rabbi_internal_tasks
              SET detail = $4,
                  updated_by_user_key = $5,
                  updated_at = $6,
                  version = version + 1
            WHERE task_key = $1
              AND account_key = $2
              AND product_key = $3
              AND version = $7`,
          [
            envelope.sourceTaskRef,
            item.account_key,
            item.product_key,
            serializeRabbiTaskEnvelope(next),
            execution.actor.userKey,
            now.toISOString(),
            Number(source.rows[0]?.version),
          ],
        );
      }
    }

    const correlationKey = `rabbi_agent_result_${item.task_key}`;
    const responseText = [
      `Local-agent diagnostic completed: ${item.task_key}`,
      envelope.resultSummary,
      'Read-only result. No provider, customer message, merge, deployment, or database mutation outside the durable task/result records occurred.',
    ].join('\n');
    const payload = JSON.stringify({
      text: responseText,
      buttons: [],
      correlation_key: correlationKey,
    });
    await client.query(
      `INSERT INTO onetime.telegram_response_outbox
       (response_key, bot_key, environment, bot_installation_id, chat_ref_hash,
        correlation_key, payload, payload_digest, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$9)
       ON CONFLICT (response_key) DO NOTHING`,
      [
        `tg_response_${digest(`${execution.botKey}:${execution.environment}:${correlationKey}`).slice(0, 32)}`,
        execution.botKey,
        execution.environment,
        `${execution.botKey}:${execution.environment}`,
        execution.chatRefHash,
        correlationKey,
        payload,
        digest(payload),
        now.toISOString(),
      ],
    );
    await client.query(
      `INSERT INTO onetime.telegram_operation_audit
       (event_key, bot_key, environment, account_key, product_key, actor_user_key,
        capability, correlation_key, outcome, reason, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'internal_task.update',$7,'completed',NULL,$8::jsonb,$9)
       ON CONFLICT (event_key) DO NOTHING`,
      [
        `tg_audit_${digest(`${item.task_key}:completed`).slice(0, 32)}`,
        execution.botKey,
        execution.environment,
        item.account_key,
        item.product_key,
        execution.actor.userKey,
        correlationKey,
        JSON.stringify({
          task_ref: item.task_key,
          diagnostic: envelope.diagnosticCapability,
          redacted_result_enqueued: true,
          provider_delivery_mounted: false,
        }),
        now.toISOString(),
      ],
    );
    return true;
  });
}

async function failAgentTask(
  pool: DbPool,
  item: ClaimedAgentTask,
  envelope: RabbiTaskEnvelope | null,
  ownerId: string,
  baseBackoffMs: number,
  error: unknown,
  now: Date,
) {
  const bounded = error instanceof BoundedAgentError ? error : null;
  const terminal = bounded?.terminal === true || item.attempts >= item.max_attempts;
  const status = bounded?.terminal ? 'blocked' : terminal ? 'dead_letter' : 'queued';
  const publicSummary = bounded?.terminal
    ? 'The queued diagnostic was blocked because its authorization, scope, or typed contract no longer matched.'
    : terminal
      ? 'The allowlisted read-only diagnostic reached its retry limit and was dead-lettered.'
      : 'The allowlisted read-only diagnostic will retry after a bounded delay.';
  const next = envelope ? { ...envelope, resultSummary: publicSummary } : null;
  const code = bounded?.code ?? safeErrorCode(error);
  const updated = await pool.query(
    `UPDATE onetime.rabbi_internal_tasks
        SET detail = COALESCE($4, detail),
            status = $5,
            next_attempt_at = $6,
            lease_owner = NULL,
            lease_expires_at = NULL,
            last_error_code = $7,
            dead_lettered_at = CASE WHEN $5 = 'dead_letter' THEN $8 ELSE NULL END,
            updated_at = $8,
            version = version + 1
      WHERE task_key = $1
        AND lease_owner = $2
        AND lease_generation = $3
        AND status = 'in_progress'`,
    [
      item.task_key,
      ownerId,
      item.lease_generation,
      next ? serializeRabbiTaskEnvelope(next) : null,
      status,
      new Date(now.getTime() + baseBackoffMs * 2 ** Math.max(0, item.attempts - 1)).toISOString(),
      code,
      now.toISOString(),
    ],
  );
  if (!updated.rowCount) return 'lease_lost' as const;
  return status as 'queued' | 'blocked' | 'dead_letter';
}

function operationAction(
  request: Exclude<
    Extract<RabbiReadRequest, { capability: `operation.${string}` }>,
    {
      capability:
        | 'operation.readiness'
        | 'operation.class.status'
        | 'operation.support.list'
        | 'operation.login_issues.list';
    }
  >,
): BotActionRequest {
  switch (request.capability) {
    case 'operation.content.status':
      return deterministicRead('content.pipeline.read', {});
    case 'operation.vimeo.status':
      return deterministicRead('content.pipeline.read', { filter: 'vimeo' });
    case 'operation.support.read':
      return deterministicRead('support.ticket.read_redacted', { ref: request.incidentKey });
  }
}

function deterministicRead(
  capability:
    'content.pipeline.read' | 'support.ticket.decision_needed' | 'support.ticket.read_redacted',
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

async function listApplicationLoginIssues(pool: DbPool, actor: RabbiCommunicationActor) {
  const result = await pool.query(
    `SELECT submission.source_ticket_id AS issue_ref,
            COALESCE(projection.status, lower(submission.delivery_state)) AS issue_status,
            submission.actor_role AS subject_role,
            submission.created_at
       FROM onetime.support_submissions AS submission
       LEFT JOIN onetime.support_status_projection AS projection
         ON projection.source_ticket_id = submission.source_ticket_id
      WHERE submission.account_key = $1
        AND submission.product_key = $2
        AND submission.category = 'access_login'
     UNION ALL
     SELECT ticket.ticket_id AS issue_ref,
            ticket.status AS issue_status,
            ticket.requester_role AS subject_role,
            ticket.created_at
       FROM onetime.support_tickets_v21 AS ticket
      WHERE ticket.product = $2
        AND ticket.conversation_kind = 'technical_support'
        AND ticket.category = 'access'
      ORDER BY created_at DESC, issue_ref
      LIMIT 10`,
    [actor.accountKey, actor.productKey],
  );
  if (!result.rowCount) return 'Application login issues: none.';
  return [
    'Application login issues:',
    ...result.rows.map(
      (row) =>
        `${String(row.issue_ref)} · ${String(row.subject_role)} · ${String(row.issue_status)}`,
    ),
  ].join('\n');
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
        item.envelope !== null && (!category || item.envelope.issueCategory === category),
    );
  if (!rows.length) {
    return category ? 'Local login incidents: none.' : 'Local support incidents: none.';
  }
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

async function readSubjectLoginAccessSummary(
  pool: DbPool,
  actor: CanonicalOneTimeActor,
  subject: RabbiRedactedSubjectRef,
) {
  if (subject.kind === 'student') {
    const legacy = await pool.query(
      `SELECT learner.learner_status, access.status AS access_status,
              access.credential_status,
              CASE WHEN access.rate_limited_until > now() THEN true ELSE false END AS rate_limited
         FROM onetime.portal_learners AS learner
         LEFT JOIN onetime.portal_student_access_state AS access
           ON access.account_key = learner.account_key
          AND access.product_key = learner.product_key
          AND access.learner_key = learner.learner_key
        WHERE learner.account_key = $1
          AND learner.product_key = $2
          AND learner.learner_key = $3
        ORDER BY access.updated_at DESC
        LIMIT 1`,
      [actor.accountKey, actor.productKey, subject.ref],
    );
    if (legacy.rows[0]) {
      const row = legacy.rows[0];
      return [
        `Login-access diagnostic for student:${subject.ref}`,
        `Learner state: ${String(row.learner_status)}.`,
        `Access state: ${String(row.access_status ?? 'not_configured')}.`,
        `Credential state: ${String(row.credential_status ?? 'not_configured')}.`,
        `Rate limited: ${row.rate_limited ? 'yes' : 'no'}.`,
        'No username, password, PIN, token, email, or private Student data included.',
      ].join('\n');
    }
    const canonical = await pool.query(
      `SELECT state, credential_state
         FROM onetime.v21_student_profiles
        WHERE product_key = $1
          AND student_id = $2
        LIMIT 1`,
      [actor.productKey, subject.ref],
    );
    const row = canonical.rows[0];
    return row
      ? [
          `Login-access diagnostic for student:${subject.ref}`,
          `Profile state: ${String(row.state)}.`,
          `Credential state: ${String(row.credential_state)}.`,
          'No username, password, PIN, token, email, or private Student data included.',
        ].join('\n')
      : 'The selected scoped Student has no current login-access projection.';
  }

  const legacy = await pool.query(
    `SELECT status, role, security_version
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
      LIMIT 1`,
    [actor.accountKey, actor.productKey, subject.ref],
  );
  if (legacy.rows[0]) {
    const row = legacy.rows[0];
    return [
      `Login-access diagnostic for ${subject.kind}:${subject.ref}`,
      `Account state: ${String(row.status)}.`,
      `Role: ${String(row.role)}.`,
      `Security revision: ${Number(row.security_version)}.`,
      'No email, password, reset link, token, or credential material included.',
    ].join('\n');
  }
  const canonical = await pool.query(
    `SELECT account.state, credential.credential_state,
            string_agg(membership.role, ',' ORDER BY membership.role) AS roles
       FROM onetime.v21_human_accounts AS account
       LEFT JOIN onetime.v21_adult_credentials AS credential
         ON credential.human_account_id = account.human_account_id
       LEFT JOIN onetime.v21_human_account_role_memberships AS membership
         ON membership.human_account_id = account.human_account_id
        AND membership.revoked_at IS NULL
      WHERE account.product_key = $1
        AND account.human_account_id = $2
      GROUP BY account.state, credential.credential_state
      LIMIT 1`,
    [actor.productKey, subject.ref],
  );
  const row = canonical.rows[0];
  return row
    ? [
        `Login-access diagnostic for ${subject.kind}:${subject.ref}`,
        `Account state: ${String(row.state)}.`,
        `Credential state: ${String(row.credential_state ?? 'not_configured')}.`,
        `Roles: ${String(row.roles ?? 'none')}.`,
        'No email, password, reset link, token, or credential material included.',
      ].join('\n')
    : 'The selected scoped adult account has no current login-access projection.';
}

async function readSubjectSupportSummary(
  pool: DbPool,
  actor: CanonicalOneTimeActor,
  subject: RabbiRedactedSubjectRef,
) {
  const [legacy, canonical, local] = await Promise.all([
    pool.query(
      `SELECT submission.source_ticket_id AS issue_ref,
              COALESCE(projection.status, lower(submission.delivery_state)) AS issue_status
         FROM onetime.support_submissions AS submission
         LEFT JOIN onetime.support_status_projection AS projection
           ON projection.source_ticket_id = submission.source_ticket_id
        WHERE submission.account_key = $1
          AND submission.product_key = $2
          AND submission.actor_user_key = $3
        ORDER BY submission.created_at DESC
        LIMIT 5`,
      [actor.accountKey, actor.productKey, subject.ref],
    ),
    pool.query(
      `SELECT ticket_id AS issue_ref, status AS issue_status
         FROM onetime.support_tickets_v21
        WHERE product = $1
          AND (requester_identity_id = $2 OR student_id = $2)
        ORDER BY updated_at DESC
        LIMIT 5`,
      [actor.productKey, subject.ref],
    ),
    pool.query(
      `SELECT task_key, status, detail
         FROM onetime.rabbi_internal_tasks
        WHERE account_key = $1
          AND product_key = $2
          AND task_key LIKE 'rabbi_support_%'
        ORDER BY updated_at DESC
        LIMIT 20`,
      [actor.accountKey, actor.productKey],
    ),
  ]);
  const localRows = local.rows.filter((row) => {
    const envelope = parseRabbiTaskEnvelope(String(row.detail));
    return envelope?.subject.kind === subject.kind && envelope.subject.ref === subject.ref;
  });
  const rows = [...legacy.rows, ...canonical.rows, ...localRows].slice(0, 10);
  if (!rows.length) return `Support diagnostic for ${subject.kind}:${subject.ref}: no incidents.`;
  return [
    `Support diagnostic for ${subject.kind}:${subject.ref}:`,
    ...rows.map(
      (row) =>
        `${String(row.issue_ref ?? row.task_key)} · ${String(row.issue_status ?? row.status)}`,
    ),
    'Ticket bodies and private identity data are withheld.',
  ].join('\n');
}

export async function readCurrentClassStatus(
  pool: Pick<DbPool, 'query'>,
  actor: Pick<CanonicalOneTimeActor, 'accountKey' | 'productKey'>,
  now = new Date(),
) {
  const result = await pool.query(
    `SELECT occurrence_key, starts_at, join_opens_at, join_closes_at,
            occurrence_state, access_state,
            production_basic_live_confirmed_at,
            production_basic_live_expires_at,
            CASE
              WHEN production_basic_live_confirmed_at <= $3
               AND production_basic_live_expires_at > $3 THEN 0
              WHEN occurrence_state = 'live' AND join_closes_at > $3 THEN 1
              ELSE 2
            END AS status_rank
       FROM onetime.class_occurrences
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_state <> 'canceled'
        AND (
          (
            production_basic_live_confirmed_at <= $3
            AND production_basic_live_expires_at > $3
          )
          OR join_closes_at > $3
        )
      ORDER BY status_rank, starts_at, occurrence_key
      LIMIT 1`,
    [actor.accountKey, actor.productKey, now.toISOString()],
  );
  const row = result.rows[0];
  if (!row) return 'Class status: not live. No current or next scoped class is scheduled.';
  const live = Number(row.status_rank) === 0;
  const currentWindow = Number(row.status_rank) === 1;
  return [
    `Class status: ${live ? 'LIVE NOW' : 'not live'}.`,
    `${live ? 'Current' : currentWindow ? 'Current scheduled window' : 'Next'} class: ${String(row.occurrence_key)}.`,
    `Scheduled start: ${new Date(String(row.starts_at)).toISOString()}.`,
    `Protected classroom access: ${String(row.access_state)}.`,
    `Host live receipt: ${row.production_basic_live_confirmed_at ? 'confirmed' : 'not confirmed'}.`,
    'No private meeting link or provider identifier is included.',
  ].join('\n');
}

async function operationalReadiness(pool: DbPool, config: AppConfig) {
  const localFingerprint = config.oneTimeRabbiTelegramTokenFingerprintHash
    ? localAgentTokenFingerprint(config)
    : '__missing__';
  const [registry, mappings, leases, inbox, outbox, deadLetters, agentTasks] = await Promise.all([
    pool.query(
      `SELECT status, token_fingerprint_hash
         FROM onetime.telegram_bot_registry
        WHERE bot_key = $1 AND environment = $2
        LIMIT 1`,
      [config.oneTimeRabbiTelegramBotKey, config.oneTimeTelegramEnvironment],
    ),
    pool.query(
      `SELECT count(*)::int AS active_count
         FROM onetime.telegram_identity_mappings AS mapping
         JOIN onetime.account_users AS account
           ON account.user_key = mapping.canonical_user_key
          AND account.account_key = mapping.account_key
          AND account.product_key = mapping.product_key
        WHERE mapping.bot_key = $1
          AND mapping.environment = $2
          AND mapping.status = 'active'
          AND mapping.chat_ref_hash IS NOT NULL
          AND account.status = 'active'
          AND account.role IN ('owner', 'admin')
          AND account.security_version = mapping.security_version`,
      [config.oneTimeRabbiTelegramBotKey, config.oneTimeTelegramEnvironment],
    ),
    pool.query(
      `SELECT
         sum(CASE WHEN token_fingerprint_hash = $3 THEN 1 ELSE 0 END)::int AS command_count,
         sum(CASE WHEN token_fingerprint_hash = $4 THEN 1 ELSE 0 END)::int AS local_agent_count
         FROM onetime.telegram_consumer_leases
        WHERE bot_key = $1
          AND environment = $2
          AND active = true
          AND expires_at > now()`,
      [
        config.oneTimeRabbiTelegramBotKey,
        config.oneTimeTelegramEnvironment,
        config.oneTimeRabbiTelegramTokenFingerprintHash ?? '__missing__',
        localFingerprint,
      ],
    ),
    pool.query(
      `SELECT status, count(*)::int AS count
         FROM onetime.telegram_update_inbox
        WHERE bot_key = $1 AND environment = $2
        GROUP BY status`,
      [config.oneTimeRabbiTelegramBotKey, config.oneTimeTelegramEnvironment],
    ),
    pool.query(
      `SELECT status, count(*)::int AS count
         FROM onetime.telegram_response_outbox
        WHERE bot_key = $1 AND environment = $2
        GROUP BY status`,
      [config.oneTimeRabbiTelegramBotKey, config.oneTimeTelegramEnvironment],
    ),
    pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.telegram_dead_letters
        WHERE bot_key = $1 AND environment = $2`,
      [config.oneTimeRabbiTelegramBotKey, config.oneTimeTelegramEnvironment],
    ),
    pool.query(
      `SELECT status, count(*)::int AS count,
              sum(CASE WHEN status = 'in_progress' AND lease_expires_at <= now() THEN 1 ELSE 0 END)::int AS expired
         FROM onetime.rabbi_internal_tasks
        WHERE task_key LIKE 'rabbi_agent_%'
        GROUP BY status`,
    ),
  ]);
  const registryRow = registry.rows[0];
  const registryStatus = registryRow ? String(registryRow.status) : 'missing';
  const fingerprintMatches = Boolean(
    registryRow &&
    config.oneTimeRabbiTelegramTokenFingerprintHash &&
    String(registryRow.token_fingerprint_hash) === config.oneTimeRabbiTelegramTokenFingerprintHash,
  );
  const inboxStates = rowsToCounts(inbox.rows);
  const outboxStates = rowsToCounts(outbox.rows);
  const taskStates = rowsToCounts(agentTasks.rows);
  const transport = config.oneTimeTelegramWebhookEnabled
    ? 'webhook attested'
    : config.oneTimeTelegramLocalPollingEnabled
      ? 'local polling attested'
      : 'inactive';
  const payloadFingerprint = config.oneTimeRabbiTelegramPayloadKey
    ? digest(config.oneTimeRabbiTelegramPayloadKey).slice(0, 12)
    : 'missing';
  const expiredTasks = agentTasks.rows.reduce((sum, row) => sum + Number(row.expired ?? 0), 0);
  return [
    'Rabbi Telegram readiness (source-observed; no provider activation claimed):',
    `Runtime attested enabled: ${config.oneTimeRabbiTelegramEnabled ? 'yes' : 'no'}.`,
    `Token configured attestation: ${config.oneTimeRabbiTelegramTokenConfigured ? 'yes' : 'no'}.`,
    `Registry: ${registryStatus} · token fingerprint matches: ${fingerprintMatches ? 'yes' : 'no'}.`,
    `Mapped active owner/Admin private chats: ${Number(mappings.rows[0]?.active_count ?? 0)}.`,
    `Webhook secret present: ${config.oneTimeTelegramWebhookSecretConfigured ? 'yes' : 'no'}.`,
    `Payload-key fingerprint: ${payloadFingerprint}.`,
    `Transport topology: ${transport}.`,
    `Command consumer active leases: ${Number(leases.rows[0]?.command_count ?? 0)}.`,
    `Local-agent consumer active leases: ${Number(leases.rows[0]?.local_agent_count ?? 0)}.`,
    `Inbox: queued=${inboxStates.queued ?? 0} retry=${inboxStates.retry ?? 0} leased=${inboxStates.leased ?? 0} dead_letter=${inboxStates.dead_letter ?? 0}.`,
    `Local-agent tasks: queued=${taskStates.queued ?? 0} in_progress=${taskStates.in_progress ?? 0} blocked=${taskStates.blocked ?? 0} dead_letter=${taskStates.dead_letter ?? 0} expired_leases=${expiredTasks}.`,
    `Response outbox: queued=${outboxStates.queued ?? 0} retry=${outboxStates.retry ?? 0} leased=${outboxStates.leased ?? 0} dead_letter=${outboxStates.dead_letter ?? 0}.`,
    `Telegram dead-letter rows: ${Number(deadLetters.rows[0]?.count ?? 0)}.`,
    'Redacted result return: durable response-outbox enqueue only; provider delivery worker mounted: no.',
    'Customer delivery authorized: no.',
  ].join('\n');
}

function rowsToCounts(rows: Record<string, unknown>[]) {
  return Object.fromEntries(rows.map((row) => [String(row.status), Number(row.count)]));
}

function localAgentSourceReady(config: AppConfig) {
  return Boolean(
    config.oneTimeRabbiTelegramEnabled &&
    config.oneTimeRabbiTelegramTokenConfigured &&
    config.oneTimeRabbiTelegramOwnerMappingConfigured &&
    config.oneTimeRabbiTelegramSingleConsumerGate &&
    config.oneTimeRabbiTelegramTokenFingerprintHash &&
    config.oneTimeRabbiTelegramPayloadKey,
  );
}

async function assertLocalAgentDatabaseReady(pool: DbPool, config: AppConfig) {
  const result = await pool.query(
    `SELECT registry.bot_key
       FROM onetime.telegram_bot_registry AS registry
       JOIN onetime.telegram_identity_mappings AS mapping
         ON mapping.bot_key = registry.bot_key
        AND mapping.environment = registry.environment
        AND mapping.status = 'active'
        AND mapping.chat_ref_hash IS NOT NULL
       JOIN onetime.account_users AS account
         ON account.user_key = mapping.canonical_user_key
        AND account.account_key = mapping.account_key
        AND account.product_key = mapping.product_key
        AND account.status = 'active'
        AND account.role IN ('owner', 'admin')
        AND account.security_version = mapping.security_version
      WHERE registry.bot_key = $1
        AND registry.environment = $2
        AND registry.status = 'active'
        AND registry.token_fingerprint_hash = $3
      LIMIT 1`,
    [
      config.oneTimeRabbiTelegramBotKey,
      config.oneTimeTelegramEnvironment,
      config.oneTimeRabbiTelegramTokenFingerprintHash,
    ],
  );
  if (!result.rowCount) throw new Error('RABBI_LOCAL_AGENT_DATABASE_NOT_READY');
}

function localAgentTokenFingerprint(config: AppConfig) {
  const fingerprint = config.oneTimeRabbiTelegramTokenFingerprintHash;
  if (!fingerprint) throw new Error('RABBI_LOCAL_AGENT_TOKEN_FINGERPRINT_UNCONFIGURED');
  return digest(`${fingerprint}:bounded-local-agent`);
}

function sanitizePublicResult(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, '[link withheld]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email withheld]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number withheld]')
    .replace(
      /\b(?:password|passcode|pin|token|secret|credential|provider|meeting)[ _-]?(?:id|ref|key|url)?\s*[:=]\s*\S+/gi,
      '[sensitive value withheld]',
    )
    .replace(/\b[a-f0-9]{32,}\b/gi, '[digest withheld]')
    .slice(0, 1_000);
}

function safeErrorCode(error: unknown) {
  const message = error instanceof Error ? `${error.name}:${error.message}` : 'unknown';
  return `rabbi_agent_${digest(message).slice(0, 20)}`;
}

function safeRef(value: string) {
  return /^[a-z][a-z0-9_-]{0,119}$/i.test(value) && !/^\d+$/u.test(value);
}

function safeBranchPrRef(value: string) {
  return /^(?:none|pr#[1-9]\d{0,7}|branch:[a-z0-9][a-z0-9._/-]{0,119})$/i.test(value);
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
