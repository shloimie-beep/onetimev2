import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ot86bApprovedForSocialEventSchema,
  ot86bBufferPublishCommandSchema,
  ot86bBufferReadinessSchema,
  ot86bSocialDraftRevisionSchema,
  ot86bSocialPlatformSchema,
  ot86bSocialWorkflowStateSchema,
  type Ot86bApprovedForSocialEvent,
  type Ot86bBufferPublishCommand,
  type Ot86bBufferReadiness,
  type Ot86bDestinationCapability,
  type Ot86bSocialDraftListItem,
  type Ot86bSocialDraftRevision,
  type Ot86bSocialPlatform,
  type Ot86bSocialWorkflowState,
} from '../../../contracts/src/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import {
  canonicalJson,
  signOt86Manifest,
  stableOt86Key,
  type Ot86SigningSecret,
} from '../content/pipeline.ts';

export class Ot86bSocialPublishingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
  }
}

export type Ot86bSocialEventReceiptResult = {
  status: 200 | 202 | 400 | 401 | 409 | 422 | 503;
  code:
    | 'accepted'
    | 'duplicate'
    | 'bad_request'
    | 'unauthorized'
    | 'conflict'
    | 'unprocessable'
    | 'storage_unavailable';
  message: string;
  receipt_state?: 'queued' | 'duplicate' | 'quarantined' | 'conflict';
};

export type Ot86bBufferAdapter = {
  readiness(): Promise<Ot86bBufferReadiness>;
  listDestinations(): Promise<Ot86bDestinationCapability[]>;
  reconcile(command: Ot86bBufferPublishCommand): Promise<Ot86bProviderResult>;
  createScheduledPost(
    command: Ot86bBufferPublishCommand,
    draft: Ot86bSocialDraftRevision,
  ): Promise<Ot86bProviderResult>;
  updateScheduledPost?(
    command: Ot86bBufferPublishCommand,
    draft: Ot86bSocialDraftRevision,
  ): Promise<Ot86bProviderResult>;
  cancelScheduledPost?(providerPostId: string): Promise<Ot86bProviderResult>;
  deletePublishedPost?(providerPostId: string): Promise<Ot86bProviderResult>;
  getPost?(providerPostId: string): Promise<Ot86bProviderResult>;
};

export type Ot86bProviderResult = {
  status: 'exists' | 'created' | 'updated' | 'cancelled' | 'deleted' | 'not_found' | 'failed';
  provider_post_id?: string | null;
  provider_update_id?: string | null;
  sanitized_code: string;
  response_sha256?: string | null;
  supports_delete?: boolean;
};

type ReceiveSocialEventInput = {
  pool: DbPool;
  rawBody: Buffer | string;
  headers: {
    contentType?: string | null;
    keyId?: string | null;
    timestamp?: string | null;
    deliveryId?: string | null;
    signature?: string | null;
  };
  secrets: Ot86SigningSecret[];
  now?: Date;
};

type ApprovalDestinationInput = {
  provider: 'buffer';
  organization_id: string;
  destination_id: string;
  platform: Ot86bSocialPlatform;
  capability_version: string;
  timezone: string;
  label?: string;
  supports_update?: boolean;
  supports_delete?: boolean;
  max_text_length?: number;
  media_required?: boolean;
};

type ApproveInput = {
  pool: DbPool;
  draftId: string;
  revisionId: string;
  approvedByActorId: string;
  destinations: ApprovalDestinationInput[];
  scheduledFor: Date;
  timezone: string;
  policyVersion: string;
  correlationId: string;
  now?: Date;
};

export const OT86B_ALLOWED_TRANSITIONS: Record<
  Ot86bSocialWorkflowState,
  Ot86bSocialWorkflowState[]
> = {
  draft_generated: ['review_needed'],
  review_needed: ['approved', 'cancelled', 'draft_generated'],
  approved: ['scheduled', 'review_needed', 'cancelled'],
  scheduled: ['publishing', 'review_needed', 'correction_needed', 'cancelled'],
  publishing: ['published', 'failed', 'correction_needed'],
  published: ['correction_needed', 'retraction_requested'],
  failed: ['review_needed', 'scheduled', 'correction_needed', 'cancelled'],
  correction_needed: ['draft_generated', 'retraction_requested', 'cancelled'],
  retraction_requested: ['retracted', 'retraction_manual_required', 'failed'],
  retraction_manual_required: ['retracted'],
  retracted: [],
  cancelled: [],
};

const RENDERER_VERSION: Record<Ot86bSocialPlatform, string> = {
  linkedin: 'ot86-linkedin-v1',
  facebook: 'ot86-facebook-v1',
  instagram: 'ot86-instagram-v1',
  x: 'ot86-x-v1',
};

const PLATFORM_LIMITS: Record<Ot86bSocialPlatform, number> = {
  linkedin: 3000,
  facebook: 3000,
  instagram: 2200,
  x: 280,
};

export async function receiveOt86bSocialEvent(
  input: ReceiveSocialEventInput,
): Promise<Ot86bSocialEventReceiptResult> {
  const rawBody = Buffer.isBuffer(input.rawBody)
    ? input.rawBody
    : Buffer.from(input.rawBody, 'utf8');
  const now = input.now ?? new Date();
  const headerError = validateSocialHeaders(input.headers);
  if (headerError) return headerError;
  const headers = normalizeSocialHeaders(input.headers);
  const secret = input.secrets.find((candidate) => candidate.keyId === headers.keyId);
  if (!secret || !isFreshTimestamp(headers.timestamp, now)) {
    return { status: 401, code: 'unauthorized', message: 'Social event signature rejected.' };
  }
  if (!verifySignature(secret.secret, headers.timestamp, rawBody, headers.signature)) {
    return { status: 401, code: 'unauthorized', message: 'Social event signature rejected.' };
  }

  let event: Ot86bApprovedForSocialEvent;
  try {
    event = ot86bApprovedForSocialEventSchema.parse(JSON.parse(rawBody.toString('utf8')));
    if (event.event_id.toLowerCase() !== headers.deliveryId.toLowerCase()) {
      return {
        status: 400,
        code: 'bad_request',
        message: 'Delivery id does not match social event id.',
      };
    }
    if (!validateOt86bSocialEventChecksum(event)) {
      return { status: 422, code: 'unprocessable', message: 'Social event checksum mismatch.' };
    }
    assertSocialEventPrivacy(event);
  } catch {
    return {
      status: 422,
      code: 'unprocessable',
      message: 'Social event failed schema, checksum, or privacy validation.',
      receipt_state: 'quarantined',
    };
  }

  const rawBodySha = sha256(rawBody);
  try {
    return await inTransaction(input.pool, async (client) => {
      const existing = await client.query(
        `SELECT raw_body_sha256, processing_state
           FROM onetime.ot86b_social_event_inbox
          WHERE event_id = $1 OR idempotency_key = $2
             OR (tenant_id = $3 AND content_id = $4 AND version_id = $5 AND sequence = $6)
          LIMIT 1`,
        [
          event.event_id,
          event.idempotency_key,
          event.tenant_id,
          event.content_id,
          event.version_id,
          event.sequence,
        ],
      );
      if (existing.rowCount) {
        if (String(existing.rows[0]?.raw_body_sha256) === rawBodySha) {
          return {
            status: 200,
            code: 'duplicate',
            message: 'Identical social event already recorded.',
            receipt_state: 'duplicate',
          } satisfies Ot86bSocialEventReceiptResult;
        }
        await recordSocialAudit(client, {
          tenantId: event.tenant_id,
          action: 'social_event_replay_conflict',
          reasonCode: 'changed_replay_bytes',
          actorId: 'ot86b-social-consumer',
          actorType: 'service',
          correlationId: event.event_id,
          now,
          metadata: { event_id: event.event_id },
        });
        return {
          status: 409,
          code: 'conflict',
          message: 'Social event identifier was reused with different bytes.',
          receipt_state: 'conflict',
        } satisfies Ot86bSocialEventReceiptResult;
      }
      await client.query(
        `INSERT INTO onetime.ot86b_social_event_inbox
           (event_id, idempotency_key, origin, event_type, schema_version, tenant_id,
            content_id, version_id, sequence, key_id, raw_body_sha256, payload_sha256,
            raw_event, validation_status, processing_state, received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,'accepted','queued',$14)`,
        [
          event.event_id,
          event.idempotency_key,
          event.origin,
          event.event_type,
          event.schema_version,
          event.tenant_id,
          event.content_id,
          event.version_id,
          event.sequence,
          headers.keyId,
          rawBodySha,
          event.payload_sha256,
          rawBody.toString('utf8'),
          now,
        ],
      );
      await recordSocialAudit(client, {
        tenantId: event.tenant_id,
        action: 'social_event_accepted',
        reasonCode: 'authenticated_schema_valid',
        actorId: 'ot86b-social-consumer',
        actorType: 'service',
        correlationId: event.event_id,
        now,
        metadata: { event_id: event.event_id },
      });
      return {
        status: 202,
        code: 'accepted',
        message: 'Social event recorded for asynchronous draft generation.',
        receipt_state: 'queued',
      } satisfies Ot86bSocialEventReceiptResult;
    });
  } catch {
    return {
      status: 503,
      code: 'storage_unavailable',
      message: 'Social inbox storage is unavailable.',
    };
  }
}

export async function dispatchNextOt86bSocialEvent(input: { pool: DbPool; now?: Date }) {
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const queued = await client.query(
      `SELECT *
         FROM onetime.ot86b_social_event_inbox
        WHERE processing_state = 'queued'
        ORDER BY received_at ASC, id ASC
        LIMIT 1`,
    );
    if (!queued.rowCount) return { dispatched: false as const, reason: 'empty_queue' as const };
    const receipt = queued.rows[0] as Record<string, unknown>;
    const event = ot86bApprovedForSocialEventSchema.parse(parseJsonValue(receipt.raw_event));
    const sourceId = stableOt86Key('social_source', [event.tenant_id, event.event_id]);
    const jobId = stableOt86Key('social_draft_job', [sourceId, event.version_id]);
    await client.query(
      `INSERT INTO onetime.ot86b_social_sources
         (source_id, event_id, tenant_id, content_id, version_id, sequence, canonical_title,
          canonical_url, summary, approved_excerpts_json, media_json, privacy_json,
          payload_sha256, source_state, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,'accepted',$14,$14)
       ON CONFLICT (event_id) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
      [
        sourceId,
        event.event_id,
        event.tenant_id,
        event.content_id,
        event.version_id,
        event.sequence,
        event.content.canonical_title,
        event.content.canonical_url,
        event.content.summary,
        JSON.stringify(event.content.approved_excerpts),
        JSON.stringify(event.content.media),
        JSON.stringify(event.privacy),
        event.payload_sha256,
        now,
      ],
    );
    await client.query(
      `INSERT INTO onetime.ot86b_social_draft_jobs
         (job_id, source_id, tenant_id, job_state, idempotency_key, created_at, updated_at)
       VALUES ($1,$2,$3,'pending',$4,$5,$5)
       ON CONFLICT (job_id) DO NOTHING`,
      [jobId, sourceId, event.tenant_id, stableOt86Key('job_idem', [jobId]), now],
    );
    await client.query(
      `UPDATE onetime.ot86b_social_event_inbox
          SET processing_state = 'draft_job_created',
              applied_at = $2
        WHERE event_id = $1`,
      [event.event_id, now],
    );
    await recordSocialAudit(client, {
      tenantId: event.tenant_id,
      action: 'draft_job_created',
      reasonCode: 'event_dispatched_without_buffer',
      actorId: 'ot86b-social-consumer',
      actorType: 'service',
      correlationId: event.event_id,
      now,
      metadata: { source_id: sourceId, job_id: jobId },
    });
    return { dispatched: true as const, source_id: sourceId, job_id: jobId };
  });
}

export async function generateNextOt86bDraftJob(input: { pool: DbPool; now?: Date }) {
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const jobs = await client.query(
      `SELECT jobs.job_id, sources.*
         FROM onetime.ot86b_social_draft_jobs AS jobs
         JOIN onetime.ot86b_social_sources AS sources ON sources.source_id = jobs.source_id
        WHERE jobs.job_state = 'pending'
        ORDER BY jobs.created_at ASC, jobs.id ASC
        LIMIT 1`,
    );
    if (!jobs.rowCount) return { generated: false as const, reason: 'empty_queue' as const };
    const row = jobs.rows[0] as Record<string, unknown>;
    const source = sourceFromRow(row);
    await client.query(
      `UPDATE onetime.ot86b_social_draft_jobs
          SET job_state = 'running',
              updated_at = $2
        WHERE job_id = $1`,
      [String(row.job_id), now],
    );
    const revisions: Ot86bSocialDraftRevision[] = [];
    for (const platform of ot86bSocialPlatformSchema.options) {
      const draftId = stableOt86Key('social_draft', [source.source_id, platform]);
      const revision = renderSocialDraft(source, platform, now);
      await client.query(
        `INSERT INTO onetime.ot86b_social_drafts
           (draft_id, source_id, tenant_id, content_id, version_id, platform,
            workflow_state, current_revision_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'review_needed',$7,$8,$8)
         ON CONFLICT (source_id, platform) DO UPDATE SET
           workflow_state = 'review_needed',
           current_revision_id = EXCLUDED.current_revision_id,
           updated_at = EXCLUDED.updated_at`,
        [
          draftId,
          source.source_id,
          source.tenant_id,
          source.content_id,
          source.version_id,
          platform,
          revision.revision_id,
          now,
        ],
      );
      await insertDraftRevision(client, revision, null);
      revisions.push(revision);
    }
    await client.query(
      `UPDATE onetime.ot86b_social_draft_jobs
          SET job_state = 'completed',
              updated_at = $2
        WHERE job_id = $1`,
      [String(row.job_id), now],
    );
    await recordSocialAudit(client, {
      tenantId: source.tenant_id,
      action: 'draft_generated',
      reasonCode: 'platform_renderers_completed',
      actorId: 'ot86b-draft-generator',
      actorType: 'service',
      correlationId: source.event_id,
      now,
      metadata: { count: revisions.length },
    });
    return { generated: true as const, revisions };
  });
}

export async function editOt86bDraftRevision(input: {
  pool: DbPool;
  draftId: string;
  actorId: string;
  text: string;
  hashtags?: string[];
  correlationId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const current = await getCurrentRevision(client, input.draftId);
    const nextRevision = withOt86bSocialDraftRevisionChecksum({
      ...current,
      revision_id: stableOt86Key('social_revision', [input.draftId, input.text, now.toISOString()]),
      supersedes_revision_id: current.revision_id,
      text: escapePreviewText(input.text),
      hashtags: input.hashtags ?? current.hashtags,
      created_at: now.toISOString(),
    });
    await insertDraftRevision(client, nextRevision, input.actorId);
    await invalidateApprovalForDraft(client, input.draftId, 'revision_changed', now);
    await client.query(
      `UPDATE onetime.ot86b_social_drafts
          SET current_revision_id = $2,
              workflow_state = 'review_needed',
              updated_at = $3
        WHERE draft_id = $1`,
      [input.draftId, nextRevision.revision_id, now],
    );
    await recordSocialAudit(client, {
      tenantId: nextRevision.tenant_id,
      draftId: input.draftId,
      revisionId: nextRevision.revision_id,
      action: 'draft_edited_approval_invalidated',
      reasonCode: 'revision_changed',
      actorId: input.actorId,
      actorType: 'operator',
      correlationId: input.correlationId,
      now,
      metadata: { supersedes_revision_id: current.revision_id },
    });
    return nextRevision;
  });
}

export async function approveAndScheduleOt86bDraft(input: ApproveInput) {
  const now = input.now ?? new Date();
  if (input.destinations.length < 1) {
    throw new Ot86bSocialPublishingError(
      'DESTINATION_REQUIRED',
      'Select at least one destination.',
    );
  }
  if (input.scheduledFor.getTime() <= now.getTime()) {
    throw new Ot86bSocialPublishingError(
      'FUTURE_SCHEDULE_REQUIRED',
      'Scheduled time must be in the future.',
    );
  }
  return inTransaction(input.pool, async (client) => {
    const revision = await getCurrentRevision(client, input.draftId);
    if (revision.revision_id !== input.revisionId) {
      throw new Ot86bSocialPublishingError(
        'REVISION_NOT_CURRENT',
        'Only the current draft revision can be approved.',
        409,
      );
    }
    assertNoPrivacyFlags(revision.privacy);
    const approvalId = stableOt86Key('social_approval', [
      input.draftId,
      revision.revision_sha256,
      input.approvedByActorId,
      input.scheduledFor.toISOString(),
    ]);
    const orderedMedia = revision.media.map((media) => media.sha256);
    const destinationSnapshot = input.destinations.map((destination) => ({
      provider: destination.provider,
      organization_id: destination.organization_id,
      destination_id: destination.destination_id,
      platform: destination.platform,
      capability_version: destination.capability_version,
      timezone: destination.timezone,
    }));
    await client.query(
      `INSERT INTO onetime.ot86b_social_approvals
         (approval_id, tenant_id, draft_id, revision_id, approved_by_actor_id, approved_at,
          policy_version, approved_revision_sha256, ordered_media_sha256_json,
          destination_snapshot_json, scheduled_for, timezone, privacy_json, approval_state,
          created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13::jsonb,'active',$6)
       ON CONFLICT (approval_id) DO NOTHING`,
      [
        approvalId,
        revision.tenant_id,
        input.draftId,
        revision.revision_id,
        input.approvedByActorId,
        now,
        input.policyVersion,
        revision.revision_sha256,
        JSON.stringify(orderedMedia),
        JSON.stringify(destinationSnapshot),
        input.scheduledFor,
        input.timezone,
        JSON.stringify(revision.privacy),
      ],
    );
    const commands: Ot86bBufferPublishCommand[] = [];
    for (const destination of input.destinations) {
      if (destination.platform !== revision.platform) {
        throw new Ot86bSocialPublishingError(
          'DESTINATION_PLATFORM_MISMATCH',
          'Destination platform must match the approved draft platform.',
          422,
        );
      }
      const command = commandForDestination({
        revision,
        approvalId,
        approvedByActorId: input.approvedByActorId,
        approvedAt: now,
        policyVersion: input.policyVersion,
        destination,
        scheduledFor: input.scheduledFor,
        timezone: input.timezone,
        correlationId: input.correlationId,
      });
      commands.push(command);
      await client.query(
        `INSERT INTO onetime.ot86b_social_destination_bindings
           (binding_id, tenant_id, draft_id, approval_id, provider, organization_id,
            destination_id, platform, capability_version, timezone, binding_state, created_at)
         VALUES ($1,$2,$3,$4,'buffer',$5,$6,$7,$8,$9,'active',$10)
         ON CONFLICT (approval_id, destination_id) DO NOTHING`,
        [
          stableOt86Key('destination_binding', [approvalId, destination.destination_id]),
          revision.tenant_id,
          input.draftId,
          approvalId,
          destination.organization_id,
          destination.destination_id,
          destination.platform,
          destination.capability_version,
          destination.timezone,
          now,
        ],
      );
      await client.query(
        `INSERT INTO onetime.ot86b_social_publish_commands
           (command_id, idempotency_key, tenant_id, draft_id, revision_id, revision_sha256,
            approval_id, provider, organization_id, destination_id, platform, capability_version,
            scheduled_for, timezone, command_json, command_state, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'buffer',$8,$9,$10,$11,$12,$13,$14::jsonb,'scheduled',$15,$15)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          command.command_id,
          command.idempotency_key,
          command.tenant_id,
          command.draft_id,
          command.revision_id,
          command.revision_sha256,
          approvalId,
          destination.organization_id,
          destination.destination_id,
          destination.platform,
          destination.capability_version,
          input.scheduledFor,
          input.timezone,
          JSON.stringify(command),
          now,
        ],
      );
    }
    await transitionDraft(client, input.draftId, 'approved', 'human_approved_exact_revision', now);
    await transitionDraft(client, input.draftId, 'scheduled', 'human_approved_scheduled', now);
    await recordSocialAudit(client, {
      tenantId: revision.tenant_id,
      draftId: input.draftId,
      revisionId: revision.revision_id,
      action: 'approval_scheduled',
      reasonCode: 'human_approved_exact_revision',
      actorId: input.approvedByActorId,
      actorType: 'operator',
      correlationId: input.correlationId,
      now,
      metadata: { approval_id: approvalId, destinations: input.destinations.length },
    });
    return { approval_id: approvalId, commands };
  });
}

export async function runOt86bSchedulerOnce(input: {
  pool: DbPool;
  adapter: Ot86bBufferAdapter;
  now?: Date;
  leaseOwner?: string;
  batchSize?: number;
}) {
  const now = input.now ?? new Date();
  const batchSize = Math.min(Math.max(input.batchSize ?? 100, 1), 100);
  const readiness = await input.adapter.readiness();
  const commands = await input.pool.query(
    `SELECT *
       FROM onetime.ot86b_social_publish_commands
      WHERE command_state = 'scheduled'
        AND scheduled_for <= $1
      ORDER BY scheduled_for ASC, id ASC
      LIMIT ${batchSize}`,
    [now],
  );
  let providerWrites = 0;
  let published = 0;
  for (const row of commands.rows as Record<string, unknown>[]) {
    const command = ot86bBufferPublishCommandSchema.parse(parseJsonValue(row.command_json));
    const revision = await revisionById(input.pool, command.draft_id, command.revision_id);
    if (!isExecutable(command, revision, readiness)) {
      await markCommandFailed(input.pool, command.command_id, 'local_gate_failed', now);
      continue;
    }
    await input.pool.query(
      `UPDATE onetime.ot86b_social_publish_commands
          SET command_state = 'publishing',
              lease_owner = $2,
              lease_expires_at = $3,
              attempts = attempts + 1,
              updated_at = $3
        WHERE command_id = $1 AND command_state = 'scheduled'`,
      [command.command_id, input.leaseOwner ?? 'ot86b-scheduler', now],
    );
    const reconciled = await input.adapter.reconcile(command);
    if (reconciled.status === 'exists') {
      await markCommandPublished(input.pool, command, reconciled, now, 'reconciled_existing');
      published += 1;
      continue;
    }
    const created = await input.adapter.createScheduledPost(command, revision);
    providerWrites += 1;
    if (created.status === 'created' || created.status === 'exists') {
      await markCommandPublished(input.pool, command, created, now, 'provider_create_confirmed');
      published += 1;
    } else {
      await markCommandFailed(input.pool, command.command_id, created.sanitized_code, now);
    }
  }
  return { inspected: commands.rowCount ?? 0, provider_writes: providerWrites, published };
}

export async function requestOt86bRetraction(input: {
  pool: DbPool;
  adapter: Ot86bBufferAdapter;
  commandId: string;
  actorId: string;
  correlationId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const result = await input.pool.query(
    `SELECT *
       FROM onetime.ot86b_social_publish_commands
      WHERE command_id = $1
      LIMIT 1`,
    [input.commandId],
  );
  if (!result.rowCount) {
    throw new Ot86bSocialPublishingError(
      'COMMAND_NOT_FOUND',
      'Publish command was not found.',
      404,
    );
  }
  const row = result.rows[0] as Record<string, unknown>;
  const providerPostId = asNullableString(row.provider_post_id);
  await input.pool.query(
    `UPDATE onetime.ot86b_social_publish_commands
        SET command_state = 'retraction_requested',
            updated_at = $2
      WHERE command_id = $1`,
    [input.commandId, now],
  );
  if (!providerPostId || !input.adapter.deletePublishedPost) {
    await markRetractionManual(input.pool, input.commandId, 'delete_not_supported', now);
    return { state: 'retraction_manual_required' as const };
  }
  const deleted = await input.adapter.deletePublishedPost(providerPostId);
  if (deleted.status === 'deleted') {
    await input.pool.query(
      `UPDATE onetime.ot86b_social_publish_commands
          SET command_state = 'retracted',
              sanitized_error_code = NULL,
              updated_at = $2
        WHERE command_id = $1`,
      [input.commandId, now],
    );
    return { state: 'retracted' as const };
  }
  await markRetractionManual(input.pool, input.commandId, deleted.sanitized_code, now);
  return { state: 'retraction_manual_required' as const };
}

export async function listOt86bSocialDrafts(input: {
  pool: DbPool;
  tenantId: string;
  limit?: number;
  state?: Ot86bSocialWorkflowState;
}): Promise<Ot86bSocialDraftListItem[]> {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 50);
  const params: unknown[] = [input.tenantId, limit];
  const stateSql = input.state ? 'AND workflow_state = $3' : '';
  if (input.state) params.push(input.state);
  const result = await input.pool.query(
    `SELECT draft_id, source_id, tenant_id, content_id, version_id, platform, workflow_state,
            current_revision_id, updated_at
       FROM onetime.ot86b_social_drafts
      WHERE tenant_id = $1
        ${stateSql}
      ORDER BY updated_at DESC, draft_id ASC
      LIMIT $2`,
    params,
  );
  return result.rows.map((row) => ({
    draft_id: String(row.draft_id),
    source_id: String(row.source_id),
    tenant_id: String(row.tenant_id),
    content_id: String(row.content_id),
    version_id: String(row.version_id),
    platform: ot86bSocialPlatformSchema.parse(row.platform),
    workflow_state: ot86bSocialWorkflowStateSchema.parse(row.workflow_state),
    current_revision_id: asNullableString(row.current_revision_id),
    updated_at: asDate(row.updated_at).toISOString(),
  }));
}

export function inspectOt86bBufferReadinessFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Ot86bBufferReadiness {
  const missing: string[] = [];
  if (!env.BUFFER_ACCESS_TOKEN) missing.push('access_token');
  if (!env.BUFFER_ORGANIZATION_ID) missing.push('organization_id');
  if (!env.BUFFER_DESTINATION_IDS) missing.push('destination_ids');
  if (missing.length > 0) {
    return ot86bBufferReadinessSchema.parse({
      provider: 'buffer',
      state: 'unconfigured',
      missing_capability_classes: missing,
      destinations: [],
      can_schedule: false,
      safe_reason_code: 'buffer_configuration_missing',
    });
  }
  const destinationIds = env.BUFFER_DESTINATION_IDS ?? '';
  const destinations = destinationIds
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((destinationId, index) => destinationCapabilityFromConfig(env, destinationId, index));
  if (destinations.length < 1) {
    return ot86bBufferReadinessSchema.parse({
      provider: 'buffer',
      state: 'destinations_missing',
      missing_capability_classes: ['usable_destination_ids'],
      destinations: [],
      can_schedule: false,
      safe_reason_code: 'buffer_destinations_missing',
    });
  }
  return ot86bBufferReadinessSchema.parse({
    provider: 'buffer',
    state: 'degraded',
    missing_capability_classes: ['live_buffer_account_readback'],
    destinations,
    can_schedule: false,
    safe_reason_code: 'live_read_only_canary_required',
  });
}

export function createUnconfiguredBufferAdapter(
  readiness: Ot86bBufferReadiness = inspectOt86bBufferReadinessFromEnv(),
): Ot86bBufferAdapter {
  return {
    readiness: async () => readiness,
    listDestinations: async () => readiness.destinations,
    reconcile: async () => ({
      status: 'failed',
      sanitized_code: readiness.safe_reason_code,
    }),
    createScheduledPost: async () => ({
      status: 'failed',
      sanitized_code: readiness.safe_reason_code,
    }),
  };
}

export function sanitizeOt86bProviderError(error: unknown) {
  return String(error instanceof Error ? error.message : error)
    .replaceAll(/[A-Za-z0-9_-]{24,}/g, '[redacted-token]')
    .replaceAll(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted-token]')
    .replaceAll(/(access_token|buffer_token|client_secret)=([^&\s]+)/gi, '$1=[redacted-token]');
}

export function validateOt86bSocialEventChecksum(event: Ot86bApprovedForSocialEvent) {
  const withoutHash: Omit<Ot86bApprovedForSocialEvent, 'payload_sha256'> = { ...event };
  delete (withoutHash as Partial<Ot86bApprovedForSocialEvent>).payload_sha256;
  return sha256(canonicalJson(withoutHash)) === event.payload_sha256;
}

export function validateOt86bDraftRevisionChecksum(revision: Ot86bSocialDraftRevision) {
  const withoutHash: Omit<Ot86bSocialDraftRevision, 'revision_sha256'> = { ...revision };
  delete (withoutHash as Partial<Ot86bSocialDraftRevision>).revision_sha256;
  return sha256(canonicalJson(withoutHash)) === revision.revision_sha256;
}

export function withOt86bSocialDraftRevisionChecksum(
  revision: Omit<Ot86bSocialDraftRevision, 'revision_sha256'>,
): Ot86bSocialDraftRevision {
  const withoutHash: Partial<Ot86bSocialDraftRevision> = { ...revision };
  delete withoutHash.revision_sha256;
  return ot86bSocialDraftRevisionSchema.parse({
    ...withoutHash,
    revision_sha256: sha256(canonicalJson(withoutHash)),
  });
}

export function validateOt86bPublishCommand(command: Ot86bBufferPublishCommand) {
  const parsed = ot86bBufferPublishCommandSchema.parse(command);
  if (parsed.approval.approved_revision_sha256 !== parsed.revision_sha256) {
    throw new Ot86bSocialPublishingError(
      'REVISION_APPROVAL_MISMATCH',
      'Publish command approval does not match the selected revision.',
      422,
    );
  }
  assertNoPrivacyFlags(parsed.privacy);
  return parsed;
}

function commandForDestination(input: {
  revision: Ot86bSocialDraftRevision;
  approvalId: string;
  approvedByActorId: string;
  approvedAt: Date;
  policyVersion: string;
  destination: ApprovalDestinationInput;
  scheduledFor: Date;
  timezone: string;
  correlationId: string;
}): Ot86bBufferPublishCommand {
  const command = {
    schema_version: 1 as const,
    command_id: uuidFromStableParts([
      input.revision.draft_id,
      input.revision.revision_id,
      input.destination.destination_id,
      input.scheduledFor.toISOString(),
    ]),
    idempotency_key: stableOt86Key('buffer_command', [
      input.revision.draft_id,
      input.revision.revision_id,
      input.destination.destination_id,
      input.scheduledFor.toISOString(),
    ]),
    tenant_id: input.revision.tenant_id,
    draft_id: input.revision.draft_id,
    revision_id: input.revision.revision_id,
    revision_sha256: input.revision.revision_sha256,
    approval: {
      approval_id: input.approvalId,
      approved_by_actor_id: input.approvedByActorId,
      approved_at: input.approvedAt.toISOString(),
      policy_version: input.policyVersion,
      approved_revision_sha256: input.revision.revision_sha256,
    },
    destination: {
      provider: 'buffer' as const,
      organization_id: input.destination.organization_id,
      destination_id: input.destination.destination_id,
      platform: input.destination.platform,
      capability_version: input.destination.capability_version,
    },
    scheduled_for: input.scheduledFor.toISOString(),
    timezone: input.timezone,
    privacy: input.revision.privacy,
    audit_correlation_id: input.correlationId,
    created_at: input.approvedAt.toISOString(),
  };
  return validateOt86bPublishCommand(command);
}

function renderSocialDraft(
  source: SocialSource,
  platform: Ot86bSocialPlatform,
  now: Date,
): Ot86bSocialDraftRevision {
  const limit = PLATFORM_LIMITS[platform];
  const excerpt = source.approved_excerpts[0];
  const baseText = escapePreviewText(
    `${source.canonical_title}\n\n${source.summary}\n\n${excerpt?.text ?? ''}`,
  ).trim();
  const platformText =
    baseText.length > limit
      ? `${baseText.slice(0, Math.max(0, limit - 3)).trimEnd()}...`
      : baseText;
  const draftId = stableOt86Key('social_draft', [source.source_id, platform]);
  return withOt86bSocialDraftRevisionChecksum({
    schema_version: 1,
    draft_id: draftId,
    revision_id: stableOt86Key('social_revision', [draftId, RENDERER_VERSION[platform]]),
    source_event_id: source.event_id,
    tenant_id: source.tenant_id,
    content_id: source.content_id,
    version_id: source.version_id,
    platform,
    renderer_version: RENDERER_VERSION[platform],
    text: platformText,
    hashtags: ['#ClassLearning'],
    media: source.media.map((media) => ({
      asset_id: media.asset_id,
      uri: media.uri,
      mime_type: media.mime_type,
      sha256: media.sha256,
      subject_classification: media.subject_classification,
      privacy: { ...media.privacy, scan_status: 'passed' as const },
    })),
    source_excerpt_ids: source.approved_excerpts.map((item) => item.excerpt_id),
    privacy: {
      contains_learner_name: false,
      contains_learner_voice: false,
      contains_learner_face: false,
      contains_learner_question: false,
      contains_private_data: false,
      scan_status: 'passed',
    },
    created_at: now.toISOString(),
  });
}

function sourceFromRow(row: Record<string, unknown>): SocialSource {
  return {
    source_id: String(row.source_id),
    event_id: String(row.event_id),
    tenant_id: String(row.tenant_id),
    content_id: String(row.content_id),
    version_id: String(row.version_id),
    canonical_title: String(row.canonical_title),
    canonical_url: String(row.canonical_url),
    summary: String(row.summary),
    approved_excerpts: asArray(row.approved_excerpts_json).map(asExcerpt),
    media: asArray(row.media_json).map(asMedia),
    privacy: asRecord(row.privacy_json),
    payload_sha256: String(row.payload_sha256),
  };
}

type SocialSource = {
  source_id: string;
  event_id: string;
  tenant_id: string;
  content_id: string;
  version_id: string;
  canonical_title: string;
  canonical_url: string;
  summary: string;
  approved_excerpts: Array<{
    excerpt_id: string;
    section_id: string;
    text: string;
    deep_link: string;
    text_sha256: string;
  }>;
  media: Array<{
    asset_id: string;
    uri: string;
    mime_type: string;
    sha256: string;
    subject_classification: 'no_people' | 'rabbi_only' | 'graphics_only';
    privacy: {
      contains_learner_name: false;
      contains_learner_voice: false;
      contains_learner_face: false;
      contains_learner_question: false;
      contains_private_data: false;
    };
  }>;
  privacy: Record<string, unknown>;
  payload_sha256: string;
};

async function insertDraftRevision(
  client: Queryable,
  revision: Ot86bSocialDraftRevision,
  actorId: string | null,
) {
  if (!validateOt86bDraftRevisionChecksum(revision)) {
    throw new Ot86bSocialPublishingError('REVISION_CHECKSUM_MISMATCH', 'Draft checksum mismatch.');
  }
  await client.query(
    `INSERT INTO onetime.ot86b_social_draft_revisions
       (draft_id, revision_id, supersedes_revision_id, source_event_id, tenant_id,
        content_id, version_id, platform, renderer_version, text, hashtags_json,
        media_json, source_excerpt_ids_json, privacy_json, warnings_json, revision_sha256,
        created_by_actor_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,
       $14::jsonb,'[]'::jsonb,$15,$16,$17)
     ON CONFLICT (revision_id) DO NOTHING`,
    [
      revision.draft_id,
      revision.revision_id,
      revision.supersedes_revision_id ?? null,
      revision.source_event_id,
      revision.tenant_id,
      revision.content_id,
      revision.version_id,
      revision.platform,
      revision.renderer_version,
      revision.text,
      JSON.stringify(revision.hashtags),
      JSON.stringify(revision.media),
      JSON.stringify(revision.source_excerpt_ids),
      JSON.stringify(revision.privacy),
      revision.revision_sha256,
      actorId,
      new Date(revision.created_at),
    ],
  );
}

async function getCurrentRevision(
  client: Queryable,
  draftId: string,
): Promise<Ot86bSocialDraftRevision> {
  const result = await client.query(
    `SELECT revisions.*
       FROM onetime.ot86b_social_drafts AS drafts
       JOIN onetime.ot86b_social_draft_revisions AS revisions
         ON revisions.revision_id = drafts.current_revision_id
      WHERE drafts.draft_id = $1
      LIMIT 1`,
    [draftId],
  );
  if (!result.rowCount) {
    throw new Ot86bSocialPublishingError('DRAFT_NOT_FOUND', 'Draft was not found.', 404);
  }
  return revisionFromRow(result.rows[0] as Record<string, unknown>);
}

async function revisionById(
  pool: DbPool,
  draftId: string,
  revisionId: string,
): Promise<Ot86bSocialDraftRevision> {
  const result = await pool.query(
    `SELECT *
       FROM onetime.ot86b_social_draft_revisions
      WHERE draft_id = $1 AND revision_id = $2
      LIMIT 1`,
    [draftId, revisionId],
  );
  if (!result.rowCount) {
    throw new Ot86bSocialPublishingError('REVISION_NOT_FOUND', 'Revision was not found.', 404);
  }
  return revisionFromRow(result.rows[0] as Record<string, unknown>);
}

function revisionFromRow(row: Record<string, unknown>): Ot86bSocialDraftRevision {
  return ot86bSocialDraftRevisionSchema.parse({
    schema_version: 1,
    draft_id: row.draft_id,
    revision_id: row.revision_id,
    supersedes_revision_id: row.supersedes_revision_id ?? undefined,
    source_event_id: row.source_event_id,
    tenant_id: row.tenant_id,
    content_id: row.content_id,
    version_id: row.version_id,
    platform: row.platform,
    renderer_version: row.renderer_version,
    text: row.text,
    hashtags: asArray(row.hashtags_json),
    media: asArray(row.media_json),
    source_excerpt_ids: asArray(row.source_excerpt_ids_json),
    privacy: asRecord(row.privacy_json),
    revision_sha256: row.revision_sha256,
    created_at: asDate(row.created_at).toISOString(),
  });
}

async function invalidateApprovalForDraft(
  client: Queryable,
  draftId: string,
  reasonCode: string,
  now: Date,
) {
  await client.query(
    `UPDATE onetime.ot86b_social_approvals
        SET approval_state = 'invalidated',
            invalidated_reason_code = $2
      WHERE draft_id = $1 AND approval_state = 'active'`,
    [draftId, reasonCode],
  );
  await client.query(
    `UPDATE onetime.ot86b_social_publish_commands
        SET command_state = 'cancelled',
            sanitized_error_code = $2,
            updated_at = $3
      WHERE draft_id = $1 AND command_state IN ('scheduled', 'failed')`,
    [draftId, reasonCode, now],
  );
}

async function transitionDraft(
  client: Queryable,
  draftId: string,
  nextState: Ot86bSocialWorkflowState,
  reasonCode: string,
  now: Date,
) {
  const current = await client.query(
    `SELECT workflow_state
       FROM onetime.ot86b_social_drafts
      WHERE draft_id = $1
      LIMIT 1`,
    [draftId],
  );
  if (!current.rowCount) {
    throw new Ot86bSocialPublishingError('DRAFT_NOT_FOUND', 'Draft was not found.', 404);
  }
  const previous = ot86bSocialWorkflowStateSchema.parse(current.rows[0]?.workflow_state);
  if (!OT86B_ALLOWED_TRANSITIONS[previous].includes(nextState)) {
    throw new Ot86bSocialPublishingError(
      'INVALID_SOCIAL_TRANSITION',
      `Cannot transition social draft from ${previous} to ${nextState}.`,
      409,
    );
  }
  await client.query(
    `UPDATE onetime.ot86b_social_drafts
        SET workflow_state = $2,
            updated_at = $3
      WHERE draft_id = $1`,
    [draftId, nextState, now],
  );
  void reasonCode;
}

function isExecutable(
  command: Ot86bBufferPublishCommand,
  revision: Ot86bSocialDraftRevision,
  readiness: Ot86bBufferReadiness,
) {
  const destination = readiness.destinations.find(
    (candidate) =>
      candidate.destination_id === command.destination.destination_id &&
      candidate.capability_version === command.destination.capability_version,
  );
  return (
    Boolean(destination) &&
    readiness.state === 'ready' &&
    command.revision_sha256 === revision.revision_sha256 &&
    command.approval.approved_revision_sha256 === revision.revision_sha256 &&
    command.destination.platform === revision.platform &&
    destination?.platform === revision.platform &&
    revision.text.length <= (destination?.max_text_length ?? 0) &&
    (!destination?.media_required || revision.media.length > 0) &&
    !hasPrivacyFlags(command.privacy) &&
    !hasPrivacyFlags(revision.privacy)
  );
}

async function markCommandPublished(
  pool: DbPool,
  command: Ot86bBufferPublishCommand,
  result: Ot86bProviderResult,
  now: Date,
  reasonCode: string,
) {
  await pool.query(
    `UPDATE onetime.ot86b_social_publish_commands
        SET command_state = 'published',
            provider_post_id = $2,
            provider_update_id = $3,
            sanitized_error_code = NULL,
            updated_at = $4
      WHERE command_id = $1`,
    [command.command_id, result.provider_post_id ?? null, result.provider_update_id ?? null, now],
  );
  await pool.query(
    `UPDATE onetime.ot86b_social_drafts
        SET workflow_state = 'published',
            updated_at = $2
      WHERE draft_id = $1`,
    [command.draft_id, now],
  );
  await pool.query(
    `INSERT INTO onetime.ot86b_social_provider_attempts
       (attempt_id, command_id, tenant_id, provider, operation, attempt_number,
        provider_post_id, provider_update_id, response_status, sanitized_code,
        response_sha256, created_at)
     VALUES ($1,$2,$3,'buffer','create_or_reconcile',1,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (attempt_id) DO NOTHING`,
    [
      stableOt86Key('provider_attempt', [command.command_id, reasonCode]),
      command.command_id,
      command.tenant_id,
      result.provider_post_id ?? null,
      result.provider_update_id ?? null,
      result.status,
      result.sanitized_code,
      result.response_sha256 ?? null,
      now,
    ],
  );
}

async function markCommandFailed(pool: DbPool, commandId: string, reasonCode: string, now: Date) {
  await pool.query(
    `UPDATE onetime.ot86b_social_publish_commands
        SET command_state = 'failed',
            sanitized_error_code = $2,
            updated_at = $3
      WHERE command_id = $1`,
    [commandId, reasonCode, now],
  );
}

async function markRetractionManual(
  pool: DbPool,
  commandId: string,
  reasonCode: string,
  now: Date,
) {
  await pool.query(
    `UPDATE onetime.ot86b_social_publish_commands
        SET command_state = 'retraction_manual_required',
            sanitized_error_code = $2,
            updated_at = $3
      WHERE command_id = $1`,
    [commandId, reasonCode, now],
  );
}

function validateSocialHeaders(
  headers: ReceiveSocialEventInput['headers'],
): Ot86bSocialEventReceiptResult | null {
  const normalized = normalizeSocialHeaders(headers);
  if (
    normalized.contentType !== 'application/json' ||
    !normalized.keyId ||
    !/^\d+$/.test(normalized.timestamp) ||
    !/^[0-9a-f-]{36}$/i.test(normalized.deliveryId) ||
    !/^v1=[a-f0-9]{64}$/.test(normalized.signature)
  ) {
    return {
      status: 400,
      code: 'bad_request',
      message: 'Required OT86B social event headers are missing or malformed.',
    };
  }
  return null;
}

function normalizeSocialHeaders(headers: ReceiveSocialEventInput['headers']) {
  return {
    contentType:
      String(headers.contentType ?? '')
        .split(';')[0]
        ?.trim()
        .toLowerCase() ?? '',
    keyId: headers.keyId ?? '',
    timestamp: headers.timestamp ?? '',
    deliveryId: headers.deliveryId ?? '',
    signature: headers.signature ?? '',
  };
}

function verifySignature(secret: string, timestamp: string, rawBody: Buffer, signature: string) {
  const expected = signOt86Manifest({ keyId: 'unused', secret, timestamp, rawBody });
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(signature, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function isFreshTimestamp(value: string, now: Date) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return false;
  return Math.abs(now.getTime() / 1000 - seconds) <= 300;
}

function assertSocialEventPrivacy(event: Ot86bApprovedForSocialEvent) {
  if (hasPrivacyFlags(event.privacy)) {
    throw new Ot86bSocialPublishingError(
      'SOCIAL_PRIVACY_REJECTED',
      'Social events with learner/private-data flags are rejected.',
      422,
    );
  }
  for (const media of event.content.media) {
    if (hasPrivacyFlags(media.privacy)) {
      throw new Ot86bSocialPublishingError(
        'SOCIAL_MEDIA_PRIVACY_REJECTED',
        'Social media with learner/private-data flags is rejected.',
        422,
      );
    }
    if (!['no_people', 'rabbi_only', 'graphics_only'].includes(media.subject_classification)) {
      throw new Ot86bSocialPublishingError(
        'SOCIAL_MEDIA_CLASSIFICATION_REJECTED',
        'Unsupported media subject classification.',
        422,
      );
    }
  }
}

function assertNoPrivacyFlags(privacy: Record<string, unknown>) {
  if (hasPrivacyFlags(privacy)) {
    throw new Ot86bSocialPublishingError(
      'SOCIAL_PRIVACY_REJECTED',
      'Learner/private-data flags block social publishing.',
      422,
    );
  }
}

function hasPrivacyFlags(privacy: Record<string, unknown>) {
  return (
    privacy.contains_learner_name === true ||
    privacy.contains_learner_voice === true ||
    privacy.contains_learner_face === true ||
    privacy.contains_learner_question === true ||
    privacy.contains_private_data === true ||
    privacy.scan_status === 'failed'
  );
}

function destinationCapabilityFromConfig(
  env: NodeJS.ProcessEnv,
  destinationId: string,
  index: number,
): Ot86bDestinationCapability {
  const platform =
    ot86bSocialPlatformSchema.options[index % ot86bSocialPlatformSchema.options.length] ??
    'linkedin';
  return {
    provider: 'buffer',
    organization_id: String(env.BUFFER_ORGANIZATION_ID),
    destination_id: destinationId,
    label: `Configured ${platform}`,
    platform,
    timezone: 'Asia/Jerusalem',
    capability_version: 'buffer-config-v1',
    supports_update: false,
    supports_delete: false,
    max_text_length: PLATFORM_LIMITS[platform],
    media_required: platform === 'instagram',
  };
}

function escapePreviewText(value: string) {
  return value
    .replaceAll(/<script[\s\S]*?<\/script>/gi, '[removed script]')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function uuidFromStableParts(parts: string[]) {
  const hex = sha256(parts.join('\0'));
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(
    17,
    20,
  )}-${hex.slice(20, 32)}`;
}

async function recordSocialAudit(
  client: Queryable,
  input: {
    tenantId: string;
    draftId?: string | null;
    revisionId?: string | null;
    commandId?: string | null;
    actorId: string;
    actorType: string;
    action: string;
    previousState?: string | null;
    nextState?: string | null;
    reasonCode: string;
    correlationId: string;
    causationId?: string | null;
    authorizationDecisionId?: string | null;
    metadata?: Record<string, unknown>;
    now: Date;
  },
) {
  await client.query(
    `INSERT INTO onetime.ot86b_social_audit_events
       (audit_id, tenant_id, draft_id, revision_id, command_id, actor_id, actor_type,
        action, previous_state, next_state, reason_code, correlation_id, causation_id,
        authorization_decision_id, safe_metadata_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)
     ON CONFLICT (audit_id) DO NOTHING`,
    [
      stableOt86Key('social_audit', [
        input.tenantId,
        input.action,
        input.correlationId,
        input.now.toISOString(),
      ]),
      input.tenantId,
      input.draftId ?? null,
      input.revisionId ?? null,
      input.commandId ?? null,
      input.actorId,
      input.actorType,
      input.action,
      input.previousState ?? null,
      input.nextState ?? null,
      input.reasonCode,
      input.correlationId,
      input.causationId ?? null,
      input.authorizationDecisionId ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.now,
    ],
  );
}

function asExcerpt(value: unknown): SocialSource['approved_excerpts'][number] {
  const record = asRecord(value);
  return {
    excerpt_id: String(record.excerpt_id ?? ''),
    section_id: String(record.section_id ?? ''),
    text: String(record.text ?? ''),
    deep_link: String(record.deep_link ?? ''),
    text_sha256: String(record.text_sha256 ?? ''),
  };
}

function asMedia(value: unknown): SocialSource['media'][number] {
  const record = asRecord(value);
  const privacy = asRecord(record.privacy);
  return {
    asset_id: String(record.asset_id ?? ''),
    uri: String(record.uri ?? ''),
    mime_type: String(record.mime_type ?? ''),
    sha256: String(record.sha256 ?? ''),
    subject_classification:
      record.subject_classification === 'no_people' ||
      record.subject_classification === 'rabbi_only' ||
      record.subject_classification === 'graphics_only'
        ? record.subject_classification
        : 'graphics_only',
    privacy: {
      contains_learner_name: privacy.contains_learner_name === false ? false : false,
      contains_learner_voice: privacy.contains_learner_voice === false ? false : false,
      contains_learner_face: privacy.contains_learner_face === false ? false : false,
      contains_learner_question: privacy.contains_learner_question === false ? false : false,
      contains_private_data: privacy.contains_private_data === false ? false : false,
    },
  };
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return JSON.parse(value) as unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  return new Date(String(value));
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
