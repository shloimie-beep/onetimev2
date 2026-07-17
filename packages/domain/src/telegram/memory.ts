import type {
  BotActionRequest,
  BotAuditEvent,
  BotAuditSink,
  BotCapability,
  BotCommandResult,
  BotInboxItem,
  BotInboxRepository,
  BotRateLimiter,
  BotReply,
  BotTransportAdapter,
  CanonicalOneTimeActor,
  ConfirmationRecord,
  ConfirmationRepository,
  ConsumerLeaseRepository,
  IdentityMappingRepository,
  OneTimeBotApplicationAdapter,
  SensitivePayloadRef,
  TelegramIdentityMapping,
} from '../../../contracts/src/telegram/types.ts';
import { stableDigest } from './crypto.ts';

export class MemoryIdentityMappingRepository implements IdentityMappingRepository {
  private readonly mappings = new Map<string, TelegramIdentityMapping>();

  async findActiveMapping(input: Parameters<IdentityMappingRepository['findActiveMapping']>[0]) {
    const mapping = this.mappings.get(key(input.botKey, input.environment, input.providerUserRef));
    return mapping?.status === 'active' ? mapping : null;
  }

  async upsertProtectedMapping(mapping: TelegramIdentityMapping) {
    this.mappings.set(key(mapping.botKey, mapping.environment, mapping.providerUserRef), mapping);
  }

  async revoke(mappingKey: string, _reason: string) {
    for (const [mapKey, mapping] of this.mappings) {
      if (mapping.mappingKey === mappingKey) {
        this.mappings.set(mapKey, { ...mapping, status: 'revoked' });
      }
    }
  }
}

export class MemoryInboxRepository implements BotInboxRepository {
  private readonly items = new Map<string, StoredInbox>();
  private readonly byUpdate = new Map<string, string>();

  async enqueue(
    update: { botKey: string; updateId: string; environment: string },
    payloadRef: SensitivePayloadRef,
  ) {
    const updateKey = key(update.botKey, update.environment, update.updateId);
    const existing = this.byUpdate.get(updateKey);
    if (existing) return { duplicate: true, inboxKey: existing };
    const inboxKey = `inbox_${stableDigest([updateKey]).slice(0, 32)}`;
    this.byUpdate.set(updateKey, inboxKey);
    this.items.set(inboxKey, {
      inboxKey,
      botKey: update.botKey,
      environment: update.environment,
      updateId: update.updateId,
      payloadRef,
      attempts: 0,
      leaseGeneration: 0,
      status: 'queued',
      nextAttemptAt: 0,
      createdAt: Date.now(),
    });
    return { duplicate: false, inboxKey };
  }

  async claimNext(now: Date, ownerId: string, leaseMs: number): Promise<BotInboxItem | null> {
    const nowMs = now.getTime();
    const candidates = [...this.items.values()]
      .filter((item) => {
        if (item.status === 'queued' || item.status === 'retry') return item.nextAttemptAt <= nowMs;
        return (
          item.status === 'leased' &&
          item.leaseExpiresAt !== undefined &&
          item.leaseExpiresAt <= nowMs
        );
      })
      .sort((left, right) => left.createdAt - right.createdAt);
    const item = candidates[0];
    if (!item) return null;
    item.status = 'leased';
    item.leaseOwner = ownerId;
    item.leaseGeneration += 1;
    item.leaseExpiresAt = nowMs + leaseMs;
    return {
      inboxKey: item.inboxKey,
      botKey: item.botKey as never,
      environment: item.environment as never,
      updateId: item.updateId,
      payloadRef: item.payloadRef,
      attempts: item.attempts,
      leaseGeneration: item.leaseGeneration,
    };
  }

  async complete(inboxKey: string, leaseGeneration: number) {
    return this.transition(inboxKey, leaseGeneration, 'completed');
  }

  async retry(inboxKey: string, leaseGeneration: number, nextAttemptAt: Date, reasonCode: string) {
    const item = this.items.get(inboxKey);
    if (!item || item.leaseGeneration !== leaseGeneration) return false;
    item.status = 'retry';
    item.attempts += 1;
    item.lastReason = reasonCode;
    item.nextAttemptAt = nextAttemptAt.getTime();
    delete item.leaseExpiresAt;
    return true;
  }

  async deadLetter(inboxKey: string, leaseGeneration: number, reasonCode: string) {
    const item = this.items.get(inboxKey);
    if (!item || item.leaseGeneration !== leaseGeneration) return false;
    item.status = 'dead_letter';
    item.lastReason = reasonCode;
    delete item.leaseExpiresAt;
    return true;
  }

  state(inboxKey: string) {
    return this.items.get(inboxKey);
  }

  private transition(inboxKey: string, leaseGeneration: number, status: StoredInbox['status']) {
    const item = this.items.get(inboxKey);
    if (!item || item.leaseGeneration !== leaseGeneration) return false;
    item.status = status;
    delete item.leaseExpiresAt;
    return true;
  }
}

export class MemoryConfirmationRepository implements ConfirmationRepository {
  private readonly records = new Map<string, ConfirmationRecord>();

  async create(record: ConfirmationRecord) {
    this.records.set(record.confirmationKey, record);
  }

  async get(confirmationKey: string) {
    return this.records.get(confirmationKey) ?? null;
  }

  async consume(confirmationKey: string, now: Date) {
    const record = this.records.get(confirmationKey);
    if (!record) return 'missing';
    if (record.consumedAt) return 'already_consumed';
    if (record.cancelledAt) return 'already_consumed';
    if (new Date(record.expiresAt).getTime() <= now.getTime()) return 'expired';
    this.records.set(confirmationKey, { ...record, consumedAt: now.toISOString() });
    return 'consumed';
  }

  async cancel(confirmationKey: string, now: Date) {
    const record = this.records.get(confirmationKey);
    if (!record) return 'missing';
    if (record.consumedAt || record.cancelledAt) return 'already_consumed';
    if (new Date(record.expiresAt).getTime() <= now.getTime()) return 'expired';
    this.records.set(confirmationKey, { ...record, cancelledAt: now.toISOString() });
    return 'cancelled';
  }

  async recordResult(confirmationKey: string, result: BotCommandResult, _now: Date) {
    const record = this.records.get(confirmationKey);
    if (record) this.records.set(confirmationKey, { ...record, result });
  }
}

export class MemoryConsumerLeaseRepository implements ConsumerLeaseRepository {
  private readonly leases = new Map<string, MemoryLease>();

  async acquire(input: Parameters<ConsumerLeaseRepository['acquire']>[0]) {
    const leaseKey = key(input.botKey, input.environment, input.tokenFingerprint);
    const existing = this.leases.get(leaseKey);
    if (existing && existing.active && existing.expiresAt > input.now.getTime()) {
      return { acquired: false as const, reason: 'already_owned' as const };
    }
    const generation = (existing?.generation ?? 0) + 1;
    this.leases.set(leaseKey, {
      ownerId: input.ownerId,
      generation,
      expiresAt: input.now.getTime() + input.leaseMs,
      active: true,
    });
    return { acquired: true as const, generation };
  }

  async heartbeat(ownerId: string, generation: number, leaseMs: number, now: Date) {
    for (const lease of this.leases.values()) {
      if (lease.ownerId === ownerId && lease.generation === generation && lease.active) {
        lease.expiresAt = now.getTime() + leaseMs;
        return true;
      }
    }
    return false;
  }

  async release(ownerId: string, generation: number) {
    for (const lease of this.leases.values()) {
      if (lease.ownerId === ownerId && lease.generation === generation) lease.active = false;
    }
  }
}

export class MemoryAuditSink implements BotAuditSink {
  readonly events: BotAuditEvent[] = [];

  async record(event: BotAuditEvent) {
    this.events.push(event);
  }
}

export class MemoryRateLimiter implements BotRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxHits = 10,
    private readonly windowMs = 60_000,
  ) {}

  async check(input: Parameters<BotRateLimiter['check']>[0]) {
    const bucket = key(
      input.botKey,
      input.environment,
      input.actorUserKey ?? 'anonymous',
      input.chatRef ?? 'no-chat',
      input.capability ?? 'any',
    );
    const cutoff = input.now.getTime() - this.windowMs;
    const hits = (this.hits.get(bucket) ?? []).filter((hit) => hit >= cutoff);
    if (hits.length >= this.maxHits) return { allowed: false as const, retryAfterSeconds: 60 };
    hits.push(input.now.getTime());
    this.hits.set(bucket, hits);
    return { allowed: true as const };
  }
}

export class MockBotTransportAdapter implements BotTransportAdapter {
  readonly mode = 'mock' as const;
  readonly replies: BotReply[] = [];

  async sendReply(reply: BotReply) {
    this.replies.push(reply);
  }
}

export class FixtureOneTimeBotApplicationAdapter implements OneTimeBotApplicationAdapter {
  readonly adapterId = 'fixture-onetime-bot-adapter';
  readonly writes = new Map<string, BotCommandResult>();
  readonly events = new Map<string, unknown>();
  private readonly actor: CanonicalOneTimeActor;
  private readonly capabilities: BotCapability[];

  constructor(actor: CanonicalOneTimeActor, capabilities?: BotCapability[]) {
    this.actor = actor;
    this.capabilities = capabilities ?? [...actor.capabilities];
  }

  supportedCapabilities() {
    return this.capabilities;
  }

  async resolveActor() {
    return this.actor;
  }

  async readAction(_actor: CanonicalOneTimeActor, request: BotActionRequest) {
    switch (request.capability) {
      case 'gateway.status.read':
        return 'One Time Telegram runtime: sink/mock safe. Writes require confirmation.';
      case 'app.link.open':
        return `One Time app link for ${String(request.args.kind ?? 'app')}: /app/${String(request.args.kind ?? 'dashboard')}/${String(request.args.ref ?? '')}. Use authenticated web access for private details.`;
      case 'crm.lead.list':
        return 'Leads: 2 scoped leads. Raw phone and email are not shown in Telegram.';
      case 'crm.signup.recent':
        return 'Recent signups: signup_fixture_1 new family lead, contact details redacted.';
      case 'crm.lead.read':
      case 'crm.contact.read_redacted':
        return `Redacted contact ${String(request.args.ref ?? 'ref')}: name fragment only, status new.`;
      case 'crm.lead_tag.list':
        return `Tags for lead ${String(request.args.ref ?? 'ref')}: interested, morning-class.`;
      case 'class.schedule.read':
        return 'Upcoming classes: 2 scheduled. Protected class links are not shown in Telegram.';
      case 'class.status.read':
        return `Class ${String(request.args.ref ?? 'ref')}: scheduled and provider access remains protected.`;
      case 'class.question.list':
        return 'Questions: question_fixture_1 new redacted excerpt only.';
      case 'class.question.read_redacted':
        return `Question ${String(request.args.ref ?? 'ref')}: new; redacted excerpt only.`;
      case 'content.pipeline.read':
        return 'Content pipeline: 3 drafts, 1 needs Rabbi review. No prompts or transcripts exposed.';
      case 'content.item.read':
        return `Content item ${String(request.args.ref ?? 'ref')}: sanitized processing state ready_for_review.`;
      case 'content.knowledge.read':
        return `Content readiness ${String(request.args.ref ?? 'ref')}: transcript ready, knowledge pending review.`;
      case 'task.list':
        return `Tasks: showing scoped ${String(request.args.filter ?? 'open')} tasks only.`;
      case 'task.read':
        return `Task ${String(request.args.ref ?? 'ref')}: open at revision 1.`;
      case 'support.ticket.list':
        return 'Support tickets: 1 open subscriber ticket, redacted subject only.';
      case 'support.ticket.read_redacted':
        return `Ticket ${String(request.args.ref ?? 'ref')}: redacted summary, no full body/contact.`;
      case 'support.ticket.decision_needed':
        return 'Decision-needed support tickets: 1 pending operator decision.';
      case 'social.draft.list':
        return 'Social drafts: draft_fixture_1 review_needed. Use web route for edits.';
      case 'social.draft.read':
        return `Social draft ${String(request.args.ref ?? 'ref')}: review_needed, no Buffer publish from Telegram.`;
      case 'social.draft.approval_link':
        return `Approval link for ${String(request.args.ref ?? 'ref')}: /app/social-publishing?intent=approve.`;
      case 'delivery.status.read':
        return `Delivery status ${String(request.args.ref ?? 'summary')}: scoped sink/provider state only; destinations and payloads are redacted.`;
      case 'telegram.audit.read_recent':
        return `Recent gateway audit: ${Number(request.args.count ?? 10)} sanitized entries available.`;
      default:
        return 'That One Time read action is not enabled here.';
    }
  }

  async previewAction(_actor: CanonicalOneTimeActor, request: BotActionRequest) {
    return `Preview ${request.capability}: ${previewSummary(request)}. No write has been made.`;
  }

  async executeAction(
    _actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ) {
    const existing = this.writes.get(input.idempotencyKey);
    if (existing) return { ...existing, status: 'already_completed' as const };
    const eventIds = eventIdsFor(input.request, input.idempotencyKey);
    const result: BotCommandResult = {
      status: 'completed',
      publicMessage: `Completed ${input.request.capability}: ${previewSummary(input.request)}`,
      idempotencyKey: input.idempotencyKey,
      eventIds,
    };
    this.writes.set(input.idempotencyKey, result);
    for (const id of eventIds) this.events.set(id, { id, capability: input.request.capability });
    return result;
  }
}

type StoredInbox = {
  inboxKey: string;
  botKey: string;
  environment: string;
  updateId: string;
  payloadRef: SensitivePayloadRef;
  attempts: number;
  leaseGeneration: number;
  status: 'queued' | 'leased' | 'retry' | 'completed' | 'dead_letter';
  nextAttemptAt: number;
  createdAt: number;
  leaseOwner?: string;
  leaseExpiresAt?: number;
  lastReason?: string;
};

type MemoryLease = {
  ownerId: string;
  generation: number;
  expiresAt: number;
  active: boolean;
};

function key(...parts: Array<string | number>) {
  return parts.join('\u001f');
}

function previewSummary(request: BotActionRequest) {
  if (request.capability === 'task.create') return String(request.args.title ?? 'new task');
  if (request.capability === 'task.update') {
    return `${String(request.args.task_ref ?? 'task')} -> ${String(request.args.status ?? 'updated')}`;
  }
  if (request.capability === 'class.question.resolve') {
    return `${String(request.args.question_ref ?? 'question')} -> ${String(request.args.status ?? 'answered')}`;
  }
  if (request.capability === 'delivery.retry') {
    return `approved retry for ${String(request.args.delivery_ref ?? 'delivery')}`;
  }
  if (request.capability === 'support.ticket.assign_self') {
    return `${String(request.args.ticket_ref ?? 'ticket')} assigned to self`;
  }
  if (request.capability === 'crm.lead_tag.add' || request.capability === 'crm.lead_tag.remove') {
    return `${String(request.args.lead_ref ?? 'lead')} tag ${String(request.args.tag ?? 'tag')}`;
  }
  return JSON.stringify(request.args);
}

function eventIdsFor(request: BotActionRequest, idempotencyKey: string) {
  if (request.capability === 'task.create') {
    return [`evt_task_created_${stableDigest([idempotencyKey]).slice(0, 16)}`];
  }
  if (request.capability === 'task.update') {
    return [`evt_task_updated_${stableDigest([idempotencyKey]).slice(0, 16)}`];
  }
  if (request.capability === 'crm.lead.create') {
    return [`evt_lead_created_${stableDigest([idempotencyKey]).slice(0, 16)}`];
  }
  if (request.capability === 'class.question.select') {
    return [`evt_question_selected_${stableDigest([idempotencyKey]).slice(0, 16)}`];
  }
  if (request.capability === 'class.question.resolve') {
    return [`evt_question_resolved_${stableDigest([idempotencyKey]).slice(0, 16)}`];
  }
  if (request.capability === 'delivery.retry') {
    return [`evt_delivery_retry_${stableDigest([idempotencyKey]).slice(0, 16)}`];
  }
  return [];
}
