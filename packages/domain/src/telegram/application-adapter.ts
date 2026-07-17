import { createHash } from 'node:crypto';
import type { ActionGatewayEventV1 } from '../../../contracts/src/action-gateway/events.ts';
import { assertActionGatewayEventV1 } from '../../../contracts/src/action-gateway/events.ts';
import type { AppConfig } from '../../../config/src/index.ts';
import type {
  BotActionRequest,
  BotCapability,
  BotCommandResult,
  CanonicalOneTimeActor,
  OneTimeBotApplicationAdapter,
  TelegramIdentityMapping,
} from '../../../contracts/src/telegram/types.ts';
import { inTransaction, type DbPool } from '../../../db/src/index.ts';
import { getClassOccurrenceDetail, listClassOccurrences } from '../classes/service.ts';
import { getContentItemDetail, listContentLibrary } from '../content/service.ts';
import { getContactDetail, listContacts } from '../crm/service.ts';
import { listOt86bSocialDrafts } from '../social/publishing.ts';
import { stableDigest } from './crypto.ts';

const baseCapabilities: BotCapability[] = [
  'gateway.help',
  'gateway.status.read',
  'gateway.identity.read_self',
  'gateway.scope.read',
  'crm.lead.list',
  'crm.lead.read',
  'crm.signup.recent',
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
  'content.knowledge.read',
  'content.item.retry',
  'task.list',
  'task.read',
  'task.create',
  'task.update',
  'support.ticket.list',
  'support.ticket.read_redacted',
  'support.ticket.decision_needed',
  'support.ticket.assign_self',
  'support.ticket.status.update',
  'class.question.list',
  'class.question.read_redacted',
  'class.question.select',
  'class.question.resolve',
  'social.draft.list',
  'social.draft.read',
  'social.draft.approval_link',
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
          query: {
            search: stringArg(request, 'filter'),
            lead_status: leadStatusArg(request),
            cursor: stringArg(request, 'cursor') || undefined,
            limit: 5,
          },
        });
        if (!list.contacts.length) return 'Leads: no scoped matches.';
        const lines = list.contacts.map(
          (contact) =>
            `${contact.contact_id}: ${safeContactDisplay(contact.display_name)} (${contact.lead_status}); assigned ${contact.assigned_team_member ?? 'unassigned'}; last ${contact.last_activity_at}`,
        );
        if (list.next_cursor) lines.push(`Next page: /leads page ${list.next_cursor}`);
        lines.push('Email and phone are redacted in Telegram.');
        return lines.join('\n');
      }
      case 'crm.signup.recent':
        return this.recentSignups(actor);
      case 'crm.lead.read':
      case 'crm.contact.read_redacted': {
        const contact = await getContactDetail({
          pool: this.pool,
          config: scopedConfig,
          contactId: stringArg(request, 'ref'),
        });
        if (!contact) return 'No scoped contact was found.';
        return [
          `Contact ${contact.contact_id}: ${safeContactDisplay(contact.display_name)}`,
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
      case 'class.question.list':
        return this.listQuestions(actor, stringArg(request, 'filter'));
      case 'class.question.read_redacted':
        return this.readQuestion(actor, stringArg(request, 'ref'));
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
        return [
          `Content ${item.item_key}: ${item.lifecycle_state}; provider state is sanitized.`,
          `Latest revision: ${item.latest_revision_number || 'none'}.`,
          `Transcript/knowledge: ${contentReadiness(item)}.`,
        ].join('\n');
      }
      case 'content.knowledge.read':
        return this.contentKnowledgeReadiness(actor, stringArg(request, 'ref'));
      case 'crm.lead_tag.list':
        return this.listLeadTags(actor, stringArg(request, 'ref'));
      case 'task.list':
        return this.listTasks(actor, stringArg(request, 'filter'));
      case 'task.read':
        return this.readTask(actor, stringArg(request, 'ref'));
      case 'support.ticket.list':
        return this.listSupportTickets(actor, stringArg(request, 'filter'));
      case 'support.ticket.read_redacted':
        return this.readSupportTicket(actor, stringArg(request, 'ref'));
      case 'support.ticket.decision_needed':
        return this.listSupportTickets(actor, 'decision-needed');
      case 'social.draft.list':
        return this.listSocialDrafts(actor, stringArg(request, 'filter'));
      case 'social.draft.read':
        return this.readSocialDraft(actor, stringArg(request, 'ref'));
      case 'social.draft.approval_link':
        return this.socialApprovalLink(actor, stringArg(request, 'ref'));
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
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    if (input.request.capability === 'crm.lead_tag.add') {
      return this.updateLeadTag(actor, input, 'add');
    }
    if (input.request.capability === 'crm.lead_tag.remove') {
      return this.updateLeadTag(actor, input, 'remove');
    }
    if (input.request.capability === 'class.status.update') {
      return this.updateClassStatus(actor, input);
    }
    if (input.request.capability === 'content.item.retry') {
      return this.requestContentRetry(actor, input);
    }
    if (input.request.capability === 'task.create') {
      return this.createTask(actor, input);
    }
    if (input.request.capability === 'task.update') {
      return this.updateTask(actor, input);
    }
    if (input.request.capability === 'support.ticket.assign_self') {
      return this.assignSupportTicket(actor, input);
    }
    if (input.request.capability === 'support.ticket.status.update') {
      return this.updateSupportTicketStatus(actor, input);
    }
    if (input.request.capability === 'class.question.select') {
      return this.selectQuestion(actor, input);
    }
    if (input.request.capability === 'class.question.resolve') {
      return this.resolveQuestion(actor, input);
    }
    if (input.request.capability === 'crm.lead.create') {
      return {
        status: 'feature_unavailable',
        publicMessage:
          'Lead creation from Telegram V1 requires the authenticated CRM route. Open /app/crm to create the contact with full validation.',
        idempotencyKey: input.idempotencyKey,
      };
    }
    return {
      status: 'feature_unavailable',
      publicMessage: `${input.request.capability} is not enabled through a real One Time application service yet. No write was made.`,
      idempotencyKey: input.idempotencyKey,
    };
  }

  private async recentSignups(actor: CanonicalOneTimeActor) {
    const result = await this.pool.query(
      `SELECT leads.signup_key, leads.status, leads.classification, leads.created_at,
              contacts.public_contact_id, contacts.display_name, contacts.lead_status
         FROM onetime.signup_leads AS leads
         JOIN onetime.contacts AS contacts
           ON contacts.contact_key = leads.contact_key
        WHERE leads.account_key = $1
          AND leads.product_key = $2
        ORDER BY leads.created_at DESC, leads.signup_key DESC
        LIMIT 8`,
      [actor.accountKey, actor.productKey],
    );
    if (!result.rows.length) return 'Recent signups: no scoped signup records.';
    return [
      ...result.rows.map(
        (row) =>
          `${String(row.signup_key)}: ${String(row.status)} ${String(row.classification)} lead ${String(row.public_contact_id)} (${safeContactDisplay(String(row.display_name))}) at ${toIso(row.created_at)}`,
      ),
      'Email and phone are redacted in Telegram.',
    ].join('\n');
  }

  private async listLeadTags(actor: CanonicalOneTimeActor, contactRef: string) {
    const contact = await this.resolveContactKey(actor, contactRef);
    if (!contact) return 'No scoped contact was found.';
    const result = await this.pool.query(
      `SELECT tags.display_name
         FROM onetime.crm_contact_tags AS assignments
         JOIN onetime.crm_tags AS tags
           ON tags.account_key = assignments.account_key
          AND tags.product_key = assignments.product_key
          AND tags.tag_key = assignments.tag_key
        WHERE assignments.account_key = $1
          AND assignments.product_key = $2
          AND assignments.contact_key = $3
          AND assignments.removed_at IS NULL
          AND tags.archived_at IS NULL
        ORDER BY tags.display_name ASC
        LIMIT 12`,
      [actor.accountKey, actor.productKey, contact.contactKey],
    );
    if (!result.rows.length) return `Tags for ${contact.publicContactId}: none.`;
    return `Tags for ${contact.publicContactId}: ${result.rows.map((row) => String(row.display_name)).join(', ')}.`;
  }

  private async listTasks(actor: CanonicalOneTimeActor, filter: string) {
    const normalized = filter.trim();
    const params: unknown[] = [actor.accountKey, actor.productKey];
    const predicates = [
      'tasks.account_key = $1',
      'tasks.product_key = $2',
      "tasks.status IN ('open','in_progress')",
    ];
    if (normalized && normalized !== 'open') {
      params.push(`%${normalized.toLowerCase()}%`);
      predicates.push(
        `(lower(tasks.title) LIKE $${params.length} OR lower(contacts.display_name) LIKE $${params.length} OR tasks.task_key = $${params.length})`,
      );
    }
    const result = await this.pool.query(
      `SELECT tasks.task_key, tasks.title, tasks.status, tasks.due_at, tasks.version,
              contacts.public_contact_id, contacts.display_name
         FROM onetime.crm_tasks AS tasks
         JOIN onetime.contacts AS contacts ON contacts.contact_key = tasks.contact_key
        WHERE ${predicates.join(' AND ')}
        ORDER BY tasks.due_at ASC, tasks.task_key ASC
        LIMIT 8`,
      params,
    );
    if (!result.rows.length) return 'Tasks: no scoped open tasks.';
    return result.rows
      .map(
        (row) =>
          `${String(row.task_key)} v${Number(row.version)}: ${safeText(String(row.title), 72)} (${String(row.status)}) for ${String(row.public_contact_id)}; due ${toIso(row.due_at)}`,
      )
      .join('\n');
  }

  private async readTask(actor: CanonicalOneTimeActor, taskRef: string) {
    const result = await this.pool.query(
      `SELECT tasks.task_key, tasks.title, tasks.detail, tasks.status, tasks.due_at,
              tasks.version, tasks.created_at, contacts.public_contact_id, contacts.display_name
         FROM onetime.crm_tasks AS tasks
         JOIN onetime.contacts AS contacts ON contacts.contact_key = tasks.contact_key
        WHERE tasks.account_key = $1
          AND tasks.product_key = $2
          AND tasks.task_key = $3
        LIMIT 1`,
      [actor.accountKey, actor.productKey, taskRef],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return 'No scoped task was found.';
    return [
      `Task ${String(row.task_key)} v${Number(row.version)}: ${String(row.status)}`,
      `Contact: ${String(row.public_contact_id)} (${safeContactDisplay(String(row.display_name))})`,
      `Due: ${toIso(row.due_at)}`,
      `Title: ${safeText(String(row.title), 120)}`,
    ].join('\n');
  }

  private async listSupportTickets(actor: CanonicalOneTimeActor, filter: string) {
    const normalized = filter.trim();
    const params: unknown[] = [actor.accountKey, actor.productKey];
    const predicates = ['account_key = $1', 'product_key = $2'];
    if (normalized === 'decision-needed') {
      predicates.push("status IN ('triage','pending_operator','waiting_customer')");
    } else if (normalized) {
      params.push(`%${normalized.toLowerCase()}%`);
      predicates.push(
        `(lower(public_summary) LIKE $${params.length} OR lower(status) = lower($${params.length}) OR source_ticket_id = $${params.length} OR receipt_id = $${params.length})`,
      );
    }
    const result = await this.pool.query(
      `SELECT source_ticket_id, receipt_id, status, public_summary, status_version,
              delivery_state, updated_at
         FROM onetime.support_status_projection
        WHERE ${predicates.join(' AND ')}
        ORDER BY updated_at DESC, source_ticket_id DESC
        LIMIT 8`,
      params,
    );
    if (!result.rows.length) return 'Support tickets: no scoped matches.';
    return result.rows
      .map(
        (row) =>
          `${String(row.source_ticket_id)} v${Number(row.status_version)}: ${String(row.status)} (${String(row.delivery_state)}) - ${safeText(String(row.public_summary), 90)}`,
      )
      .join('\n');
  }

  private async readSupportTicket(actor: CanonicalOneTimeActor, ticketRef: string) {
    const result = await this.pool.query(
      `SELECT source_ticket_id, receipt_id, status, public_summary, status_version,
              delivery_state, bna_ticket_ref, updated_at
         FROM onetime.support_status_projection
        WHERE account_key = $1
          AND product_key = $2
          AND (source_ticket_id = $3 OR receipt_id = $3)
        LIMIT 1`,
      [actor.accountKey, actor.productKey, ticketRef],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return 'No scoped support ticket was found.';
    return [
      `Ticket ${String(row.source_ticket_id)} v${Number(row.status_version)}: ${String(row.status)}`,
      `Delivery: ${String(row.delivery_state)}`,
      `Summary: ${safeText(String(row.public_summary), 160)}`,
      'Full subscriber messages and contact details are not shown in Telegram.',
    ].join('\n');
  }

  private async listSocialDrafts(actor: CanonicalOneTimeActor, filter: string) {
    const state = socialState(filter);
    const drafts = await listOt86bSocialDrafts({
      pool: this.pool,
      tenantId: actor.accountKey,
      limit: 8,
      ...(state ? { state } : {}),
    });
    if (!drafts.length) return 'Social drafts: no scoped drafts.';
    return drafts
      .map(
        (draft) =>
          `${draft.draft_id}: ${draft.platform} ${draft.workflow_state}; content ${draft.content_id}; updated ${draft.updated_at}`,
      )
      .join('\n');
  }

  private async readSocialDraft(actor: CanonicalOneTimeActor, draftRef: string) {
    const result = await this.pool.query(
      `SELECT drafts.draft_id, drafts.platform, drafts.workflow_state, drafts.content_id,
              drafts.version_id, drafts.current_revision_id, drafts.updated_at,
              revisions.revision_sha256, length(revisions.text)::int AS text_length,
              approvals.approval_state, approvals.scheduled_for
         FROM onetime.ot86b_social_drafts AS drafts
         LEFT JOIN onetime.ot86b_social_draft_revisions AS revisions
           ON revisions.revision_id = drafts.current_revision_id
         LEFT JOIN onetime.ot86b_social_approvals AS approvals
           ON approvals.draft_id = drafts.draft_id
          AND approvals.approval_state = 'active'
        WHERE drafts.tenant_id = $1
          AND drafts.draft_id = $2
        LIMIT 1`,
      [actor.accountKey, draftRef],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return 'No scoped social draft was found.';
    return [
      `Social draft ${String(row.draft_id)}: ${String(row.platform)} ${String(row.workflow_state)}`,
      `Content: ${String(row.content_id)} / ${String(row.version_id)}`,
      `Current revision: ${String(row.current_revision_id ?? 'none')} (${Number(row.text_length ?? 0)} chars)`,
      `Approval: ${String(row.approval_state ?? 'none')}${row.scheduled_for ? ` for ${toIso(row.scheduled_for)}` : ''}`,
      `Approval/edit link: ${secureWebLink(this.config, `/app/social-publishing?draft=${encodeURIComponent(String(row.draft_id))}`)}`,
      'Telegram does not edit prompts or publish Buffer posts.',
    ].join('\n');
  }

  private socialApprovalLink(actor: CanonicalOneTimeActor, draftRef: string) {
    void actor;
    return [
      `Approval request link: ${secureWebLink(this.config, `/app/social-publishing?draft=${encodeURIComponent(draftRef)}&intent=approve`)}`,
      'Use the authenticated web route with recent email assurance to edit, approve, schedule, or publish.',
      'Telegram will not publish Buffer posts directly.',
    ].join('\n');
  }

  private async contentKnowledgeReadiness(actor: CanonicalOneTimeActor, itemRef: string) {
    const scopedConfig = {
      ...this.config,
      accountKey: actor.accountKey,
      productKey: actor.productKey,
    };
    const item = await getContentItemDetail({
      pool: this.pool,
      config: scopedConfig,
      itemKey: itemRef,
    });
    if (!item) return 'No scoped content item was found.';
    return [
      `Content readiness ${item.item_key}: ${item.lifecycle_state}`,
      `Transcript: ${contentReadiness(item)}`,
      `Knowledge base: ${item.published_revision_key ? 'published-safe' : 'not published'}`,
      'Raw transcripts, provider URLs, and private learner data are not shown in Telegram.',
    ].join('\n');
  }

  private async updateLeadTag(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
    operation: 'add' | 'remove',
  ): Promise<BotCommandResult> {
    const contactRef = stringArg(input.request, 'lead_ref');
    const tagName = safeText(stringArg(input.request, 'tag'), 80).trim();
    if (!contactRef || !tagName) {
      return unsupported(
        input.idempotencyKey,
        'Lead tag changes require a lead reference and tag.',
      );
    }
    const normalized = normalizeTag(tagName);
    const contact = await this.resolveContactKey(actor, contactRef);
    if (!contact) return denied(input.idempotencyKey, 'No scoped contact was found.');
    const tagKey = `crm_tag_${stableDigest([actor.accountKey, actor.productKey, normalized]).slice(0, 32)}`;
    const assignmentKey = `crm_tag_assignment_${stableDigest([contact.contactKey, tagKey]).slice(0, 32)}`;
    await inTransaction(this.pool, async (client) => {
      if (operation === 'add') {
        await client.query(
          `INSERT INTO onetime.crm_tags
             (tag_key, account_key, product_key, display_name, normalized_name,
              created_by_user_key, updated_by_user_key)
           VALUES ($1,$2,$3,$4,$5,$6,$6)
           ON CONFLICT (account_key, product_key, normalized_name)
           WHERE archived_at IS NULL
           DO UPDATE SET updated_at = now(), updated_by_user_key = EXCLUDED.updated_by_user_key`,
          [tagKey, actor.accountKey, actor.productKey, tagName, normalized, actor.userKey],
        );
        await client.query(
          `INSERT INTO onetime.crm_contact_tags
             (assignment_key, account_key, product_key, contact_key, tag_key, assigned_by_user_key)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (account_key, product_key, contact_key, tag_key)
           WHERE removed_at IS NULL
           DO NOTHING`,
          [
            assignmentKey,
            actor.accountKey,
            actor.productKey,
            contact.contactKey,
            tagKey,
            actor.userKey,
          ],
        );
      } else {
        await client.query(
          `UPDATE onetime.crm_contact_tags
              SET removed_at = COALESCE(removed_at, now()),
                  removed_by_user_key = $5,
                  remove_reason = 'telegram_admin'
            WHERE account_key = $1
              AND product_key = $2
              AND contact_key = $3
              AND tag_key IN (
                SELECT tag_key FROM onetime.crm_tags
                 WHERE account_key = $1 AND product_key = $2 AND normalized_name = $4
              )
              AND removed_at IS NULL`,
          [actor.accountKey, actor.productKey, contact.contactKey, normalized, actor.userKey],
        );
      }
      await this.insertTelegramCommandExecution(
        client,
        actor,
        input,
        operation === 'add' ? 'completed' : 'completed',
      );
    });
    return {
      status: 'completed',
      publicMessage: `Tag ${operation === 'add' ? 'added to' : 'removed from'} ${contact.publicContactId}.`,
      idempotencyKey: input.idempotencyKey,
      resultRef: contact.publicContactId,
    };
  }

  private async updateClassStatus(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    const classRef = stringArg(input.request, 'class_ref');
    const status = stringArg(input.request, 'status');
    if (!['scheduled', 'live', 'completed', 'cancelled'].includes(status)) {
      return unsupported(
        input.idempotencyKey,
        'Class status must be scheduled, live, completed, or cancelled.',
      );
    }
    const result = await this.pool.query(
      `UPDATE onetime.class_occurrences
          SET occurrence_state = $4,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND occurrence_key = $3
        RETURNING occurrence_key, occurrence_state`,
      [actor.accountKey, actor.productKey, classRef, status],
    );
    if (!result.rowCount) return denied(input.idempotencyKey, 'No scoped class was found.');
    return {
      status: 'completed',
      publicMessage: `Class ${classRef} is now ${status}. Protected provider URLs were not exposed.`,
      idempotencyKey: input.idempotencyKey,
      resultRef: classRef,
    };
  }

  private async requestContentRetry(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    const contentRef = stringArg(input.request, 'content_ref');
    const result = await inTransaction(this.pool, async (client) => {
      const item = await client.query(
        `SELECT content_item_key, lifecycle_state, latest_revision_key
           FROM onetime.content_items
          WHERE account_key = $1
            AND product_key = $2
            AND content_item_key = $3
          FOR UPDATE`,
        [actor.accountKey, actor.productKey, contentRef],
      );
      const row = item.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      await client.query(
        `INSERT INTO onetime.content_audit_events
           (audit_key, account_key, product_key, content_item_key, revision_key,
            actor_user_key, action_type, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,'content_retry_requested',$7::jsonb)
         ON CONFLICT (audit_key) DO NOTHING`,
        [
          `content_audit_${stableDigest([contentRef, input.idempotencyKey]).slice(0, 32)}`,
          actor.accountKey,
          actor.productKey,
          contentRef,
          row.latest_revision_key ?? null,
          actor.userKey,
          JSON.stringify({ transport: 'telegram', provider_action_state: 'sink' }),
        ],
      );
      if (row.lifecycle_state === 'failed') {
        await client.query(
          `UPDATE onetime.content_items
              SET lifecycle_state = 'processing',
                  updated_at = now()
            WHERE account_key = $1
              AND product_key = $2
              AND content_item_key = $3`,
          [actor.accountKey, actor.productKey, contentRef],
        );
      }
      return row;
    });
    if (!result) return denied(input.idempotencyKey, 'No scoped content item was found.');
    return {
      status: 'completed',
      publicMessage: `Retry requested for content ${contentRef}. Provider execution remains sink/off unless configured outside Telegram.`,
      idempotencyKey: input.idempotencyKey,
      resultRef: contentRef,
    };
  }

  private async createTask(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    const title = safeText(stringArg(input.request, 'title'), 160).trim();
    const contactRef =
      stringArg(input.request, 'contact_ref') || stringArg(input.request, 'lead_ref');
    if (!title) return unsupported(input.idempotencyKey, 'Task create requires a title.');
    if (!contactRef) {
      return unsupported(
        input.idempotencyKey,
        'Task create requires a scoped contact reference in SQL mode. Use /task-create <contact-ref> | <title>.',
      );
    }
    const contact = await this.resolveContactKey(actor, contactRef);
    if (!contact) return denied(input.idempotencyKey, 'No scoped contact was found for that task.');
    const dueAt = dueAtArg(input.request) ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    const taskKey = `task_${stableDigest([actor.accountKey, actor.productKey, input.idempotencyKey]).slice(0, 32)}`;
    const eventId = stableUuid(['task.created', taskKey, input.idempotencyKey]);
    await inTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO onetime.crm_tasks
           (task_key, account_key, product_key, contact_key, title, status, owner_user_key,
            due_at, created_by_user_key, updated_by_user_key)
         VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$6,$6)
         ON CONFLICT (task_key) DO NOTHING`,
        [
          taskKey,
          actor.accountKey,
          actor.productKey,
          contact.contactKey,
          title,
          actor.userKey,
          dueAt,
        ],
      );
      const event = taskEvent('task.created', {
        taskKey,
        actor,
        idempotencyKey: input.idempotencyKey,
        title,
        status: 'open',
        revision: 1,
        dueAt,
        time: new Date().toISOString(),
      });
      await enqueueActionGatewayEvent(client, event, actor);
      await this.insertTelegramCommandExecution(client, actor, input, 'completed');
    });
    return {
      status: 'completed',
      publicMessage: `Task ${taskKey} created for ${contact.publicContactId}.`,
      idempotencyKey: input.idempotencyKey,
      eventIds: [eventId],
      resultRef: taskKey,
    };
  }

  private async updateTask(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    const taskRef = stringArg(input.request, 'task_ref');
    const status = stringArg(input.request, 'status');
    if (!['open', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return unsupported(
        input.idempotencyKey,
        'Task status must be open, in_progress, completed, or cancelled.',
      );
    }
    const version = numberArg(input.request, 'version');
    const eventId = stableUuid(['task.updated', taskRef, input.idempotencyKey]);
    const result = await inTransaction(this.pool, async (client) => {
      const existingEvent = await client.query(
        `SELECT event_id
           FROM onetime.action_gateway_event_outbox
          WHERE account_key = $1 AND product_key = $2
            AND event_type = 'task.updated' AND idempotency_key = $3
          LIMIT 1`,
        [
          actor.accountKey,
          actor.productKey,
          stableDigest(['task.updated', taskRef, input.idempotencyKey]),
        ],
      );
      if (existingEvent.rowCount) return { replay: true as const };
      const current = await client.query(
        `SELECT task_key, title, status, due_at, version
           FROM onetime.crm_tasks
          WHERE account_key = $1
            AND product_key = $2
            AND task_key = $3
          FOR UPDATE`,
        [actor.accountKey, actor.productKey, taskRef],
      );
      const row = current.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      if (version !== undefined && Number(row.version) !== version) {
        return { stale: Number(row.version) };
      }
      const updated = await client.query(
        `UPDATE onetime.crm_tasks
            SET status = $4,
                updated_by_user_key = $5,
                updated_at = now(),
                completed_at = CASE WHEN $4 = 'completed' THEN now() ELSE completed_at END,
                cancelled_at = CASE WHEN $4 = 'cancelled' THEN now() ELSE cancelled_at END,
                version = version + 1
          WHERE account_key = $1 AND product_key = $2 AND task_key = $3
          RETURNING task_key, title, status, due_at, version`,
        [actor.accountKey, actor.productKey, taskRef, status, actor.userKey],
      );
      const next = updated.rows[0] as Record<string, unknown>;
      const event = taskEvent('task.updated', {
        taskKey: taskRef,
        actor,
        idempotencyKey: input.idempotencyKey,
        title: String(next.title),
        status,
        revision: Number(next.version),
        dueAt: asDate(next.due_at),
        time: new Date().toISOString(),
      });
      await enqueueActionGatewayEvent(client, event, actor);
      await this.insertTelegramCommandExecution(client, actor, input, 'completed');
      return { replay: false as const, version: Number(next.version) };
    });
    if (!result) return denied(input.idempotencyKey, 'No scoped task was found.');
    if ('stale' in result) {
      return {
        status: 'stale',
        publicMessage: `Task changed first. Current version is ${result.stale}.`,
        idempotencyKey: input.idempotencyKey,
      };
    }
    return {
      status: result.replay ? 'already_completed' : 'completed',
      publicMessage: result.replay
        ? `Task ${taskRef} update was already applied.`
        : `Task ${taskRef} updated to ${status}.`,
      idempotencyKey: input.idempotencyKey,
      eventIds: [eventId],
      resultRef: taskRef,
    };
  }

  private async assignSupportTicket(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    const ticketRef = stringArg(input.request, 'ticket_ref');
    return this.updateSupportProjection(
      actor,
      input,
      ticketRef,
      'in_progress',
      'Assigned to the current One Time admin in Telegram.',
    );
  }

  private async updateSupportTicketStatus(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    const ticketRef = stringArg(input.request, 'ticket_ref');
    const status = stringArg(input.request, 'status');
    if (
      ![
        'new',
        'triage',
        'pending_operator',
        'waiting_customer',
        'in_progress',
        'resolved',
        'closed',
        'rejected',
      ].includes(status)
    ) {
      return unsupported(input.idempotencyKey, 'Unsupported support ticket status.');
    }
    return this.updateSupportProjection(
      actor,
      input,
      ticketRef,
      status,
      `Status changed to ${status} from Telegram.`,
    );
  }

  private async updateSupportProjection(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
    ticketRef: string,
    status: string,
    summary: string,
  ): Promise<BotCommandResult> {
    const result = await this.pool.query(
      `UPDATE onetime.support_status_projection
          SET status = $4,
              public_summary = $5,
              status_version = status_version + 1,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND (source_ticket_id = $3 OR receipt_id = $3)
        RETURNING source_ticket_id, status_version`,
      [actor.accountKey, actor.productKey, ticketRef, status, summary],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return denied(input.idempotencyKey, 'No scoped support ticket was found.');
    await this.pool.query(
      `INSERT INTO onetime.support_audit_events
         (audit_key, account_key, product_key, source_ticket_id, actor_user_key, event_type, metadata)
       VALUES ($1,$2,$3,$4,$5,'telegram_support_status_update',$6::jsonb)
       ON CONFLICT (audit_key) DO NOTHING`,
      [
        `support_audit_${stableDigest([ticketRef, input.idempotencyKey]).slice(0, 32)}`,
        actor.accountKey,
        actor.productKey,
        String(row.source_ticket_id),
        actor.userKey,
        JSON.stringify({ status, transport: 'telegram' }),
      ],
    );
    return {
      status: 'completed',
      publicMessage: `Support ticket ${String(row.source_ticket_id)} updated to ${status} at version ${Number(row.status_version)}.`,
      idempotencyKey: input.idempotencyKey,
      resultRef: String(row.source_ticket_id),
    };
  }

  private async resolveContactKey(actor: CanonicalOneTimeActor, contactRef: string) {
    if (!contactRef) return null;
    const result = await this.pool.query(
      `SELECT contact_key, public_contact_id, display_name
         FROM onetime.contacts
        WHERE account_key = $1
          AND product_key = $2
          AND (contact_key = $3 OR public_contact_id = $3)
          AND archived_at IS NULL
        LIMIT 1`,
      [actor.accountKey, actor.productKey, contactRef],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      contactKey: String(row.contact_key),
      publicContactId: String(row.public_contact_id),
      displayName: String(row.display_name),
    };
  }

  private async insertTelegramCommandExecution(
    client: { query: DbPool['query'] },
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
    status: 'completed' | 'failed',
  ) {
    await client.query(
      `INSERT INTO onetime.telegram_command_executions
         (execution_key, bot_key, environment, account_key, product_key, actor_user_key,
          capability, idempotency_key, action_digest, status, terminal_disposition, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
       ON CONFLICT (bot_key, environment, account_key, product_key, actor_user_key, idempotency_key)
       DO NOTHING`,
      [
        `tg_exec_${stableDigest([actor.userKey, input.idempotencyKey]).slice(0, 32)}`,
        this.config.oneTimeTelegramBotKey,
        this.config.oneTimeTelegramEnvironment,
        actor.accountKey,
        actor.productKey,
        actor.userKey,
        input.request.capability,
        input.idempotencyKey,
        stableDigest([input.request.capability, safeArgs(input.request.args)]),
        status,
        status,
      ],
    );
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

  private async listQuestions(actor: CanonicalOneTimeActor, filter: string) {
    const normalized = filter.trim();
    const result = await this.pool.query(
      `SELECT question_key, occurrence_key, status, excerpt_redacted, submitted_at
         FROM onetime.classroom_student_questions
        WHERE account_key = $1
          AND product_key = $2
          AND (
            $3 = ''
            OR question_key = $3
            OR occurrence_key = $3
            OR status = $3
          )
        ORDER BY submitted_at DESC, question_key DESC
        LIMIT 10`,
      [actor.accountKey, actor.productKey, normalized],
    );
    if (!result.rows.length) return 'Questions: no scoped redacted questions.';
    return result.rows
      .map(
        (row) =>
          `${String(row.question_key)}: ${String(row.status)} for ${String(row.occurrence_key)} at ${toIso(row.submitted_at)} — ${String(row.excerpt_redacted)}`,
      )
      .join('\n');
  }

  private async readQuestion(actor: CanonicalOneTimeActor, questionRef: string) {
    const result = await this.pool.query(
      `SELECT question_key, occurrence_key, status, excerpt_redacted, submitted_at,
              selected_at, selection_revision
         FROM onetime.classroom_student_questions
        WHERE account_key = $1
          AND product_key = $2
          AND question_key = $3
        LIMIT 1`,
      [actor.accountKey, actor.productKey, questionRef],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return 'No scoped redacted question was found.';
    return [
      `Question ${String(row.question_key)}: ${String(row.status)}`,
      `Class: ${String(row.occurrence_key)}`,
      `Submitted: ${toIso(row.submitted_at)}`,
      `Revision: ${Number(row.selection_revision ?? 0)}`,
      `Redacted excerpt: ${String(row.excerpt_redacted)}`,
    ].join('\n');
  }

  private async selectQuestion(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      return {
        status: 'denied',
        publicMessage: 'Only authorized One Time owner/admin identities can moderate questions.',
        idempotencyKey: input.idempotencyKey,
      };
    }
    const questionRef = stringArg(input.request, 'question_ref');
    if (!questionRef) {
      return {
        status: 'unsupported',
        publicMessage: 'Question selection requires an opaque question reference.',
        idempotencyKey: input.idempotencyKey,
      };
    }

    return inTransaction(this.pool, async (client) => {
      const existing = await client.query(
        `SELECT questions.*
           FROM onetime.classroom_question_moderation_actions AS actions
           JOIN onetime.classroom_student_questions AS questions
             ON questions.question_key = actions.question_key
          WHERE actions.account_key = $1
            AND actions.product_key = $2
            AND actions.question_key = $3
            AND actions.action_type = 'feature_next'
            AND actions.idempotency_key = $4
          LIMIT 1`,
        [actor.accountKey, actor.productKey, questionRef, input.idempotencyKey],
      );
      const existingRow = existing.rows[0] as Record<string, unknown> | undefined;
      if (existingRow) {
        const eventId = selectedQuestionEventId(existingRow, input.idempotencyKey);
        return {
          status: 'already_completed',
          publicMessage: `Question ${questionRef} is already featured. No duplicate Zoom action was made.`,
          idempotencyKey: input.idempotencyKey,
          eventIds: [eventId],
          resultRef: questionRef,
        };
      }

      const locked = await client.query(
        `SELECT *
           FROM onetime.classroom_student_questions
          WHERE account_key = $1
            AND product_key = $2
            AND question_key = $3
          FOR UPDATE`,
        [actor.accountKey, actor.productKey, questionRef],
      );
      const row = locked.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        return {
          status: 'denied',
          publicMessage: 'No scoped redacted question was found.',
          idempotencyKey: input.idempotencyKey,
        };
      }

      const updated = await client.query(
        `UPDATE onetime.classroom_student_questions
            SET status = 'featured',
                selected_at = COALESCE(selected_at, now()),
                selected_by_user_ref = $4,
                selection_revision = selection_revision + 1
          WHERE account_key = $1
            AND product_key = $2
            AND question_key = $3
          RETURNING *`,
        [actor.accountKey, actor.productKey, questionRef, actor.userKey],
      );
      const question = updated.rows[0] as Record<string, unknown>;
      await client.query(
        `INSERT INTO onetime.classroom_question_moderation_actions
           (moderation_action_key, account_key, product_key, question_key, occurrence_key,
            action_type, actor_user_ref, actor_role, idempotency_key, result_json)
         VALUES ($1,$2,$3,$4,$5,'feature_next',$6,$7,$8,$9::jsonb)
         ON CONFLICT (account_key, product_key, question_key, action_type, idempotency_key)
         DO NOTHING`,
        [
          `classroom_question_action_${stableDigest([questionRef, 'feature_next', input.idempotencyKey]).slice(0, 32)}`,
          actor.accountKey,
          actor.productKey,
          questionRef,
          String(question.occurrence_key),
          actor.userKey,
          actor.role,
          input.idempotencyKey,
          JSON.stringify({ status: 'featured', provider_action_state: 'disabled' }),
        ],
      );

      const event = selectedQuestionEvent(question, actor, input.idempotencyKey);
      await enqueueActionGatewayEvent(client, event, actor);
      await client.query(
        `INSERT INTO onetime.classroom_audit_events
           (audit_key, account_key, product_key, actor_user_ref, actor_role, household_key,
            learner_key, occurrence_key, event_type, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'question_featured',$9::jsonb)`,
        [
          `classroom_audit_${stableDigest([questionRef, input.idempotencyKey, 'telegram']).slice(0, 32)}`,
          actor.accountKey,
          actor.productKey,
          actor.userKey,
          actor.role,
          String(question.household_key),
          String(question.learner_key),
          String(question.occurrence_key),
          JSON.stringify({ provider_action_state: 'disabled', transport: 'telegram' }),
        ],
      );

      return {
        status: 'completed',
        publicMessage: `Question ${questionRef} is featured for the Rabbi queue. Zoom participant controls remain manual.`,
        idempotencyKey: input.idempotencyKey,
        eventIds: [event.id],
        resultRef: questionRef,
      };
    });
  }

  private async resolveQuestion(
    actor: CanonicalOneTimeActor,
    input: { request: BotActionRequest; idempotencyKey: string },
  ): Promise<BotCommandResult> {
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      return denied(
        input.idempotencyKey,
        'Only authorized One Time owner/admin identities can resolve questions.',
      );
    }
    const questionRef = stringArg(input.request, 'question_ref');
    const nextStatus = stringArg(input.request, 'status');
    if (!['answered', 'dismissed'].includes(nextStatus)) {
      return unsupported(
        input.idempotencyKey,
        'Question resolve status must be answered or dismissed.',
      );
    }
    const actionType = nextStatus === 'answered' ? 'mark_answered' : 'dismiss';
    return inTransaction(this.pool, async (client) => {
      const existing = await client.query(
        `SELECT 1
           FROM onetime.classroom_question_moderation_actions
          WHERE account_key = $1
            AND product_key = $2
            AND question_key = $3
            AND action_type = $4
            AND idempotency_key = $5
          LIMIT 1`,
        [actor.accountKey, actor.productKey, questionRef, actionType, input.idempotencyKey],
      );
      if (existing.rowCount) {
        return {
          status: 'already_completed' as const,
          publicMessage: `Question ${questionRef} was already marked ${nextStatus}.`,
          idempotencyKey: input.idempotencyKey,
          resultRef: questionRef,
        };
      }
      const updated = await client.query(
        `UPDATE onetime.classroom_student_questions
            SET status = $4,
                selection_revision = selection_revision + 1
          WHERE account_key = $1
            AND product_key = $2
            AND question_key = $3
          RETURNING question_key, occurrence_key, household_key, learner_key, selection_revision`,
        [actor.accountKey, actor.productKey, questionRef, nextStatus],
      );
      const question = updated.rows[0] as Record<string, unknown> | undefined;
      if (!question) {
        return denied(input.idempotencyKey, 'No scoped redacted question was found.');
      }
      await client.query(
        `INSERT INTO onetime.classroom_question_moderation_actions
           (moderation_action_key, account_key, product_key, question_key, occurrence_key,
            action_type, actor_user_ref, actor_role, idempotency_key, result_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
         ON CONFLICT (account_key, product_key, question_key, action_type, idempotency_key)
         DO NOTHING`,
        [
          `classroom_question_action_${stableDigest([questionRef, actionType, input.idempotencyKey]).slice(0, 32)}`,
          actor.accountKey,
          actor.productKey,
          questionRef,
          String(question.occurrence_key),
          actionType,
          actor.userKey,
          actor.role,
          input.idempotencyKey,
          JSON.stringify({ status: nextStatus, transport: 'telegram' }),
        ],
      );
      await client.query(
        `INSERT INTO onetime.classroom_audit_events
           (audit_key, account_key, product_key, actor_user_ref, actor_role, household_key,
            learner_key, occurrence_key, event_type, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'question_resolved',$9::jsonb)
         ON CONFLICT (audit_key) DO NOTHING`,
        [
          `classroom_audit_${stableDigest([questionRef, nextStatus, input.idempotencyKey]).slice(0, 32)}`,
          actor.accountKey,
          actor.productKey,
          actor.userKey,
          actor.role,
          String(question.household_key),
          String(question.learner_key),
          String(question.occurrence_key),
          JSON.stringify({ status: nextStatus, transport: 'telegram' }),
        ],
      );
      return {
        status: 'completed' as const,
        publicMessage: `Question ${questionRef} marked ${nextStatus}.`,
        idempotencyKey: input.idempotencyKey,
        resultRef: questionRef,
      };
    });
  }
}

function stringArg(request: BotActionRequest, key: string) {
  const value = request.args[key];
  return typeof value === 'string' ? value : '';
}

function numberArg(request: BotActionRequest, key: string) {
  const value = request.args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function leadStatusArg(request: BotActionRequest) {
  const value = stringArg(request, 'status');
  const allowed = ['new', 'in_review', 'contacted', 'scheduled', 'closed', 'archived'] as const;
  return allowed.find((status) => status === value);
}

function dueAtArg(request: BotActionRequest) {
  const value = stringArg(request, 'due_at');
  if (!value) return null;
  const dueAt = new Date(value);
  return Number.isNaN(dueAt.getTime()) ? null : dueAt;
}

function safeArgs(args: Record<string, unknown>) {
  return JSON.stringify(args)
    .replace(/[^\w\s.:@/-]/g, '')
    .slice(0, 240);
}

function safeText(value: string, maxLength: number) {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function safeContactDisplay(value: string) {
  const safe = safeText(value, 48);
  return safe.length <= 2 ? 'redacted contact' : safe;
}

function normalizeTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function socialState(value: string) {
  const normalized = value.trim();
  const allowed = [
    'draft_generated',
    'review_needed',
    'approved',
    'scheduled',
    'publishing',
    'published',
    'failed',
    'correction_needed',
    'retraction_requested',
    'retracted',
    'retraction_manual_required',
    'cancelled',
  ] as const;
  return allowed.find((state) => state === normalized);
}

function contentReadiness(item: { lifecycle_state: string; latest_revision_number: number }) {
  if (item.latest_revision_number < 1) return 'no transcript revision';
  if (item.lifecycle_state === 'published') return 'published and searchable when entitled';
  if (item.lifecycle_state === 'review_needed') return 'transcript ready for Rabbi review';
  if (item.lifecycle_state === 'failed') return 'retry available';
  return `state ${item.lifecycle_state}`;
}

function secureWebLink(config: AppConfig, path: string) {
  const base = config.publicBaseUrl.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function unsupported(idempotencyKey: string, publicMessage: string): BotCommandResult {
  return { status: 'unsupported', publicMessage, idempotencyKey };
}

function denied(idempotencyKey: string, publicMessage: string): BotCommandResult {
  return { status: 'denied', publicMessage, idempotencyKey };
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error('Database returned an invalid date.');
  return date;
}

function taskEvent(
  type: 'task.created' | 'task.updated',
  input: {
    taskKey: string;
    actor: CanonicalOneTimeActor;
    idempotencyKey: string;
    title: string;
    status: string;
    revision: number;
    dueAt: Date;
    time: string;
  },
): ActionGatewayEventV1 {
  const idempotencyKey = stableDigest([type, input.taskKey, input.idempotencyKey]);
  const data =
    type === 'task.created'
      ? {
          task_id: input.taskKey,
          created_at: input.time,
          status: input.status,
          revision: input.revision,
          assignee_principal_id: String(input.actor.userKey),
          due_at: input.dueAt.toISOString(),
          title_redacted: safeText(input.title, 96),
        }
      : {
          task_id: input.taskKey,
          updated_at: input.time,
          revision: input.revision,
          changed_fields: ['status'],
          status: input.status,
          assignee_principal_id: String(input.actor.userKey),
          due_at: input.dueAt.toISOString(),
          title_redacted: safeText(input.title, 96),
        };
  const event: ActionGatewayEventV1 = {
    specversion: '1.0',
    id: stableUuid([type, input.taskKey, input.idempotencyKey]),
    type,
    source: 'onetime://tasks',
    subject: `tasks/${input.taskKey}`,
    time: input.time,
    datacontenttype: 'application/json',
    schema_version: 1,
    scope: { account_id: input.actor.accountKey, product_id: input.actor.productKey },
    actor: {
      kind: 'user',
      principal_id: String(input.actor.userKey),
      role: input.actor.role === 'owner' ? 'one_time_owner' : 'one_time_admin',
      transport: 'telegram',
    },
    correlation_id: `task_corr_${stableDigest([input.taskKey]).slice(0, 24)}`,
    causation_id: null,
    idempotency_key: idempotencyKey,
    trace_id: `task_trace_${stableDigest([String(input.actor.userKey), input.taskKey]).slice(0, 24)}`,
    data,
  };
  assertActionGatewayEventV1(event);
  return event;
}

function selectedQuestionEvent(
  question: Record<string, unknown>,
  actor: CanonicalOneTimeActor,
  idempotencyKey: string,
): ActionGatewayEventV1 {
  const selectedAt = toIso(question.selected_at);
  const event: ActionGatewayEventV1 = {
    specversion: '1.0',
    id: selectedQuestionEventId(question, idempotencyKey),
    type: 'class.question.selected',
    source: 'onetime://classroom/questions',
    subject: `classes/${String(question.occurrence_key)}/questions/${String(question.question_key)}`,
    time: selectedAt,
    datacontenttype: 'application/json',
    schema_version: 1,
    scope: { account_id: actor.accountKey, product_id: actor.productKey },
    actor: {
      kind: 'user',
      principal_id: String(actor.userKey),
      role: actor.role === 'owner' ? 'one_time_owner' : 'one_time_admin',
      transport: 'telegram',
    },
    correlation_id: `question_corr_${stableDigest([String(question.question_key)]).slice(0, 24)}`,
    causation_id: null,
    idempotency_key: stableDigest([
      'class.question.selected',
      String(question.question_key),
      idempotencyKey,
    ]),
    trace_id: `question_trace_${stableDigest([String(actor.userKey), String(question.question_key)]).slice(0, 24)}`,
    data: {
      question_id: String(question.question_key),
      class_id: String(question.occurrence_key),
      selected_at: selectedAt,
      selected_by_principal_id: String(actor.userKey),
      selection_revision: Number(question.selection_revision ?? 0),
      status: 'selected',
      reason_code: 'INSTRUCTOR_QUEUE',
    },
  };
  assertActionGatewayEventV1(event);
  return event;
}

function selectedQuestionEventId(question: Record<string, unknown>, idempotencyKey: string) {
  return stableUuid(['class.question.selected', String(question.question_key), idempotencyKey]);
}

async function enqueueActionGatewayEvent(
  client: { query: DbPool['query'] },
  event: ActionGatewayEventV1,
  actor: CanonicalOneTimeActor,
) {
  await client.query(
    `INSERT INTO onetime.action_gateway_event_outbox
       (event_id, event_type, source, subject, account_key, product_key, actor_principal_id,
        actor_role, transport, correlation_id, causation_id, idempotency_key, event_json,
        event_digest)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'telegram',$9,$10,$11,$12::jsonb,$13)
     ON CONFLICT (account_key, product_key, event_type, idempotency_key)
     DO NOTHING`,
    [
      event.id,
      event.type,
      event.source,
      event.subject,
      actor.accountKey,
      actor.productKey,
      actor.userKey,
      actor.role,
      event.correlation_id,
      event.causation_id ?? null,
      event.idempotency_key,
      JSON.stringify(event),
      sha256(JSON.stringify(event)),
    ],
  );
}

function stableUuid(parts: Array<string | number | boolean | null | undefined>) {
  const hex = stableDigest(parts);
  const variant = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
