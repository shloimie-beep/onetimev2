import type { AppConfig } from '../../../config/src/index.ts';
import type {
  BotActionRequest,
  BotCapability,
  BotCommandResult,
  CanonicalOneTimeActor,
  OneTimeBotApplicationAdapter,
  TelegramIdentityMapping,
} from '../../../contracts/src/telegram/types.ts';
import type { DbPool } from '../../../db/src/index.ts';
import { getClassOccurrenceDetail, listClassOccurrences } from '../classes/service.ts';
import { getContentItemDetail, listContentLibrary } from '../content/service.ts';
import { getContactDetail, listContacts } from '../crm/service.ts';

const baseCapabilities: BotCapability[] = [
  'gateway.help',
  'gateway.identity.read_self',
  'gateway.scope.read',
  'crm.lead.list',
  'crm.lead.read',
  'crm.lead.create',
  'crm.contact.read_redacted',
  'crm.lead_tag.list',
  'crm.lead_tag.add',
  'crm.lead_tag.remove',
  'class.schedule.read',
  'class.status.read',
  'class.status.update',
  'content.pipeline.read',
  'content.item.read',
  'content.item.retry',
  'task.list',
  'task.read',
  'task.create',
  'task.update',
  'support.ticket.list',
  'support.ticket.read_redacted',
  'support.ticket.assign_self',
  'support.ticket.status.update',
  'telegram.audit.read_recent',
];

export function createOneTimeTelegramApplicationAdapter(input: {
  pool: DbPool;
  config: AppConfig;
}): OneTimeBotApplicationAdapter {
  return new SqlBackedOneTimeTelegramApplicationAdapter(input.pool, input.config);
}

class SqlBackedOneTimeTelegramApplicationAdapter implements OneTimeBotApplicationAdapter {
  readonly adapterId = 'sql-backed-onetime-telegram-adapter';

  constructor(
    private readonly pool: DbPool,
    private readonly config: AppConfig,
  ) {}

  supportedCapabilities() {
    return baseCapabilities;
  }

  async resolveActor(input: { mapping: TelegramIdentityMapping }) {
    const result = await this.pool.query(
      `SELECT user_key, display_name, role, status, security_version
         FROM onetime.account_users
        WHERE account_key = $1
          AND product_key = $2
          AND user_key = $3
        LIMIT 1`,
      [input.mapping.accountKey, input.mapping.productKey, input.mapping.canonicalUserKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    const role = String(row.role);
    if (role !== 'owner' && role !== 'admin' && role !== 'crm_agent' && role !== 'viewer') {
      return null;
    }
    return {
      userKey: String(row.user_key) as never,
      displayLabel: String(row.display_name),
      accountKey: input.mapping.accountKey,
      productKey: input.mapping.productKey,
      membershipKey: input.mapping.membershipKey,
      membershipStatus: 'active',
      userStatus: String(row.status) === 'active' ? 'active' : 'disabled',
      role,
      securityVersion: Number(row.security_version),
      capabilities:
        role === 'owner'
          ? baseCapabilities
          : baseCapabilities.filter((capability) => capability !== 'telegram.audit.read_recent'),
    } satisfies CanonicalOneTimeActor;
  }

  async readAction(actor: CanonicalOneTimeActor, request: BotActionRequest) {
    const scopedConfig = {
      ...this.config,
      accountKey: actor.accountKey,
      productKey: actor.productKey,
    };
    switch (request.capability) {
      case 'crm.lead.list': {
        const list = await listContacts({
          pool: this.pool,
          config: scopedConfig,
          query: { search: stringArg(request, 'filter'), limit: 5 },
        });
        if (!list.contacts.length) return 'Leads: no scoped matches.';
        return list.contacts
          .map(
            (contact) => `${contact.contact_id}: ${contact.display_name} (${contact.lead_status})`,
          )
          .join('\n');
      }
      case 'crm.lead.read':
      case 'crm.contact.read_redacted': {
        const contact = await getContactDetail({
          pool: this.pool,
          config: scopedConfig,
          contactId: stringArg(request, 'ref'),
        });
        if (!contact) return 'No scoped contact was found.';
        return [
          `Contact ${contact.contact_id}: ${contact.display_name}`,
          `Status: ${contact.lead_status}`,
          `Assigned: ${contact.assigned_team_member ?? 'unassigned'}`,
          'Email/phone are redacted in Telegram.',
        ].join('\n');
      }
      case 'class.schedule.read': {
        const occurrences = await listClassOccurrences({
          pool: this.pool,
          config: scopedConfig,
          limit: 5,
        });
        if (!occurrences.length) return 'Classes: no scoped class occurrences found.';
        return occurrences
          .map(
            (occurrence) =>
              `${occurrence.occurrence_key}: ${occurrence.status} at ${occurrence.starts_at}`,
          )
          .join('\n');
      }
      case 'class.status.read': {
        const occurrence = await getClassOccurrenceDetail({
          pool: this.pool,
          config: scopedConfig,
          occurrenceKey: stringArg(request, 'ref'),
        });
        if (!occurrence) return 'No scoped class was found.';
        return `Class ${occurrence.occurrence_key}: ${occurrence.status}; provider ${occurrence.readiness.provider_status}.`;
      }
      case 'content.pipeline.read': {
        const items = await listContentLibrary({
          pool: this.pool,
          config: scopedConfig,
          query: { limit: 5 },
        });
        if (!items.length) return 'Content pipeline: no scoped items found.';
        return items
          .map((item) => `${item.item_key}: ${item.lifecycle_state} (${item.item_type})`)
          .join('\n');
      }
      case 'content.item.read': {
        const item = await getContentItemDetail({
          pool: this.pool,
          config: scopedConfig,
          itemKey: stringArg(request, 'ref'),
        });
        if (!item) return 'No scoped content item was found.';
        return `Content ${item.item_key}: ${item.lifecycle_state}; provider state is sanitized.`;
      }
      case 'crm.lead_tag.list':
      case 'task.list':
      case 'task.read':
      case 'support.ticket.list':
      case 'support.ticket.read_redacted':
        return 'That One Time service is not enabled yet. No data was changed.';
      case 'telegram.audit.read_recent':
        return this.recentAudit(actor, Number(request.args.count ?? 10));
      default:
        return 'That One Time read action is not enabled yet.';
    }
  }

  async previewAction(actor: CanonicalOneTimeActor, request: BotActionRequest) {
    return [
      `Preview ${request.capability}`,
      `Actor: ${actor.displayLabel}`,
      `Scope: ${actor.accountKey}/${actor.productKey}`,
      `Args: ${safeArgs(request.args)}`,
      'No write has been made.',
    ].join('\n');
  }

  async executeAction(
    _actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    return {
      status: 'feature_unavailable',
      publicMessage: `${input.request.capability} is not enabled through a real One Time application service yet. No write was made.`,
      idempotencyKey: input.idempotencyKey,
    };
  }

  private async recentAudit(actor: CanonicalOneTimeActor, count: number) {
    const result = await this.pool.query(
      `SELECT capability, outcome, reason, created_at
         FROM onetime.telegram_operation_audit
        WHERE account_key = $1
          AND product_key = $2
        ORDER BY created_at DESC
        LIMIT $3`,
      [actor.accountKey, actor.productKey, Math.min(25, Math.max(1, count))],
    );
    if (!result.rows.length) return 'Recent gateway audit: no scoped entries.';
    return result.rows
      .map(
        (row) =>
          `${toIso(row.created_at)} ${String(row.capability ?? 'gateway')} ${String(row.outcome)}${row.reason ? ` (${String(row.reason)})` : ''}`,
      )
      .join('\n');
  }
}

function stringArg(request: BotActionRequest, key: string) {
  const value = request.args[key];
  return typeof value === 'string' ? value : '';
}

function safeArgs(args: Record<string, unknown>) {
  return JSON.stringify(args)
    .replace(/[^\w\s.:@/-]/g, '')
    .slice(0, 240);
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}
