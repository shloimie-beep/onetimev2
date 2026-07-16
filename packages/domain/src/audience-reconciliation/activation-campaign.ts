import { createHash } from 'node:crypto';
import {
  legacyActivationCampaignApprovalRequestSchema,
  legacyActivationCampaignPreviewRequestSchema,
  legacyActivationCampaignQueueRequestSchema,
  type LegacyActivationCampaignApproval,
  type LegacyActivationCampaignApprovalRequest,
  type LegacyActivationBlockReason,
  type LegacyActivationCampaignChannel,
  type LegacyActivationCampaignPreview,
  type LegacyActivationCampaignPreviewRequest,
  type LegacyActivationCampaignQueueResult,
  type LegacyActivationCampaignSegment,
  type LegacyActivationCampaignSendIntent,
  type LegacyActivationLifecycleSubject,
  type LegacyActivationTemplateKind,
  type LegacyAudienceDryRunReport,
  type LegacyAudienceRowOutcome,
} from '../../../contracts/src/audience-reconciliation/index.ts';
import { stableKey } from '../lead/normalize.ts';
import type { LegacyAudienceActorScope } from './service.ts';

const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

export class LegacyActivationCampaignApprovalError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type LegacyActivationLifecyclePort = {
  issueParentActivation(input: {
    idempotencyKey: string;
    email: string;
    displayName: string;
    campaignKey: string;
    templateRevision: string;
    lifecycleSubject: LegacyActivationLifecycleSubject;
    now: Date;
  }): Promise<{
    lifecycle_intent_ref: string | null;
    raw_token_included: false;
    external_send_performed: false;
  }>;
};

export type Ops03ParentActivationIssuer = (input: {
  payload: {
    idempotency_key: string;
    email: string;
    display_name: string;
    household_key: string;
    relationship_key: string;
    relationship_label: string;
    authority: 'primary_guardian' | 'guardian';
  };
  now: Date;
}) => Promise<{
  delivery?: { intent_key?: string; external_send_performed: false; raw_token_included: false };
  raw_token_included: false;
}>;

export function createOps03ParentActivationLifecyclePort(
  issueParentActivation: Ops03ParentActivationIssuer,
): LegacyActivationLifecyclePort {
  return {
    async issueParentActivation(input) {
      const issued = await issueParentActivation({
        payload: {
          idempotency_key: input.idempotencyKey,
          email: input.email,
          display_name: input.displayName,
          household_key: input.lifecycleSubject.household_key,
          relationship_key: input.lifecycleSubject.relationship_key,
          relationship_label: input.lifecycleSubject.relationship_label,
          authority: input.lifecycleSubject.authority,
        },
        now: input.now,
      });
      return {
        lifecycle_intent_ref: issued.delivery?.intent_key ?? null,
        raw_token_included: false,
        external_send_performed: false,
      };
    },
  };
}

export function createLegacyActivationCampaignPreview(input: {
  scope: LegacyAudienceActorScope;
  report: LegacyAudienceDryRunReport;
  request: LegacyActivationCampaignPreviewRequest;
  now?: Date;
  whatsappEnabled?: boolean;
}): LegacyActivationCampaignPreview {
  const request = legacyActivationCampaignPreviewRequestSchema.parse(input.request);
  const now = input.now ?? new Date();
  const whatsappEnabled = input.whatsappEnabled === true;
  const counts = {
    snapshot_rows: input.report.row_outcomes.length,
    eligible_rows: 0,
    active_legacy_family_users: 0,
    other_family_leads: 0,
    school_leads: 0,
    already_activated_excluded: 0,
    manual_review_excluded: 0,
    duplicate_excluded: 0,
    suppressed_excluded: 0,
    invalid_destination_excluded: 0,
    whatsapp_disabled_excluded: 0,
    not_in_segment_excluded: 0,
  };
  const eligibleRows: LegacyAudienceRowOutcome[] = [];
  for (const row of input.report.row_outcomes) {
    const exclusion = exclusionReason(row, request.segment, request.channel, whatsappEnabled);
    if (exclusion) {
      counts[exclusion] += 1;
      continue;
    }
    counts.eligible_rows += 1;
    counts[request.segment] += 1;
    eligibleRows.push(row);
  }

  const recipientRowKeys = eligibleRows.map((row) => row.row_key).sort();
  const snapshotExpiresAt = new Date(now.getTime() + SNAPSHOT_TTL_MS);
  const snapshotHash = sha256(
    canonicalJson({
      account_key: input.scope.accountKey,
      product_key: input.scope.productKey,
      batch_key: input.report.batch_key,
      source_request_hash: input.report.request_hash,
      segment: request.segment,
      channel: request.channel,
      template_revision: request.template_revision,
      batch_size: request.batch_size,
      schedule_not_before: request.schedule_not_before ?? null,
      counts,
      recipient_row_keys: recipientRowKeys,
    }),
  );
  return {
    campaign_key: stableKey('legacy_activation_campaign', [
      input.scope.accountKey,
      input.scope.productKey,
      input.report.batch_key,
      request.idempotency_key,
      snapshotHash,
    ]),
    batch_key: input.report.batch_key,
    source_request_hash: input.report.request_hash,
    source_digest: input.report.source_digest,
    source_generated_at: input.report.generated_at,
    segment: request.segment,
    channel: request.channel,
    template_revision: request.template_revision,
    template_kind: templateKindForSegment(request.segment),
    schedule_not_before: request.schedule_not_before ?? null,
    batch_size: request.batch_size,
    snapshot_hash: snapshotHash,
    snapshot_expires_at: snapshotExpiresAt.toISOString(),
    counts,
    sample_row_refs: recipientRowKeys.slice(0, 5),
    recipient_row_keys: recipientRowKeys,
    status: 'previewed',
    created_at: now.toISOString(),
    raw_recipient_list_included: false,
    message_body_included: false,
    production_side_effects: false,
  };
}

export function approveLegacyActivationCampaign(input: {
  preview: LegacyActivationCampaignPreview;
  request: LegacyActivationCampaignApprovalRequest;
  now?: Date;
}): LegacyActivationCampaignApproval {
  const request = legacyActivationCampaignApprovalRequestSchema.parse(input.request);
  assertApprovalMatchesPreview(input.preview, request);
  const approvedAt = (input.now ?? new Date()).toISOString();
  return {
    campaign_key: input.preview.campaign_key,
    snapshot_hash: input.preview.snapshot_hash,
    approval_fingerprint: sha256(
      canonicalJson({
        campaign_key: input.preview.campaign_key,
        snapshot_hash: input.preview.snapshot_hash,
        approved_segment: request.approved_segment,
        approved_channel: request.approved_channel,
        approved_template_revision: request.approved_template_revision,
        approved_batch_size: request.approved_batch_size,
        approved_schedule_not_before: request.approved_schedule_not_before,
        statement_hash: sha256(request.operator_approval_statement),
        ops03b_login_verified: request.ops03b_login_verified,
        real_audience_authorized: request.real_audience_authorized,
        canary_authorized: request.canary_authorized,
      }),
    ),
    approved_at: approvedAt,
    status: 'approved',
    ops03b_login_verified: request.ops03b_login_verified,
    real_audience_authorized: request.real_audience_authorized,
    canary_authorized: request.canary_authorized,
    production_side_effects: false,
  };
}

export async function queueLegacyActivationCampaignIntents(input: {
  preview: LegacyActivationCampaignPreview;
  approval: LegacyActivationCampaignApproval | null;
  request: unknown;
  now?: Date;
  protectedCanaryDestination?: string | undefined;
  whatsappEnabled?: boolean;
  lifecyclePort?: LegacyActivationLifecyclePort | undefined;
}): Promise<LegacyActivationCampaignQueueResult> {
  const request = legacyActivationCampaignQueueRequestSchema.parse(input.request);
  const now = input.now ?? new Date();
  const blockedReasons = queueBlockReasons({
    preview: input.preview,
    approval: input.approval,
    request,
    now,
    protectedCanaryDestination: input.protectedCanaryDestination,
    whatsappEnabled: input.whatsappEnabled === true,
  });
  if (blockedReasons.length) {
    return queueResult(input.preview, request.mode, request.requested_count, blockedReasons, []);
  }

  if (request.mode === 'batch') {
    return queueResult(
      input.preview,
      request.mode,
      request.requested_count,
      ['recipient_destination_ingest_required'],
      [],
    );
  }

  const destination = request.protected_canary_destination?.trim().toLowerCase();
  if (!destination) {
    return queueResult(
      input.preview,
      request.mode,
      request.requested_count,
      ['protected_canary_not_authorized'],
      [],
    );
  }

  const lifecycleIntentRef =
    input.preview.template_kind === 'activation_migration' &&
    request.lifecycle_subject &&
    input.lifecyclePort
      ? (
          await input.lifecyclePort.issueParentActivation({
            idempotencyKey: stableKey('legacy_activation_canary_lifecycle', [
              input.preview.campaign_key,
              request.idempotency_key,
            ]),
            email: destination,
            displayName: request.protected_canary_display_name ?? 'One Time Canary',
            campaignKey: input.preview.campaign_key,
            templateRevision: input.preview.template_revision,
            lifecycleSubject: request.lifecycle_subject,
            now,
          })
        ).lifecycle_intent_ref
      : null;

  const identityRef = stableKey('legacy_activation_canary', [
    input.preview.campaign_key,
    destination,
  ]);
  const intent: LegacyActivationCampaignSendIntent = {
    intent_key: stableKey('legacy_activation_intent', [
      input.preview.campaign_key,
      identityRef,
      input.preview.channel,
      input.preview.template_revision,
    ]),
    campaign_key: input.preview.campaign_key,
    identity_ref: identityRef,
    channel: input.preview.channel,
    template_revision: input.preview.template_revision,
    delivery_state: 'queued',
    destination_ref: sha256(destination),
    lifecycle_intent_ref: lifecycleIntentRef,
    raw_destination_included: false,
    raw_token_included: false,
    external_send_performed: false,
  };
  return queueResult(input.preview, request.mode, request.requested_count, [], [intent]);
}

export function formatLegacyActivationCampaignPreview(preview: LegacyActivationCampaignPreview) {
  return [
    'OT-111 legacy activation campaign preview',
    `campaign_key: ${preview.campaign_key}`,
    `batch_key: ${preview.batch_key}`,
    `segment: ${preview.segment}`,
    `channel: ${preview.channel}`,
    `template_revision: ${preview.template_revision}`,
    `snapshot_hash: ${preview.snapshot_hash}`,
    `eligible_rows: ${preview.counts.eligible_rows}`,
    `active_legacy_family_users: ${preview.counts.active_legacy_family_users}`,
    `other_family_leads: ${preview.counts.other_family_leads}`,
    `school_leads: ${preview.counts.school_leads}`,
    `already_activated_excluded: ${preview.counts.already_activated_excluded}`,
    `manual_review_excluded: ${preview.counts.manual_review_excluded}`,
    `suppressed_excluded: ${preview.counts.suppressed_excluded}`,
    `invalid_destination_excluded: ${preview.counts.invalid_destination_excluded}`,
    `whatsapp_disabled_excluded: ${preview.counts.whatsapp_disabled_excluded}`,
    'raw_recipient_list_included: false',
    'message_body_included: false',
    'production_side_effects: false',
    '',
  ].join('\n');
}

function exclusionReason(
  row: LegacyAudienceRowOutcome,
  segment: LegacyActivationCampaignSegment,
  channel: LegacyActivationCampaignChannel,
  whatsappEnabled: boolean,
): Exclude<
  keyof LegacyActivationCampaignPreview['counts'],
  'snapshot_rows' | 'eligible_rows'
> | null {
  if (row.new_system_activated) return 'already_activated_excluded';
  if (row.disposition === 'duplicate_input') return 'duplicate_excluded';
  if (row.disposition === 'manual_review') return 'manual_review_excluded';
  if (row.segment_codes.includes('do_not_contact') || !row.communication_eligible) {
    return 'suppressed_excluded';
  }
  if (channel === 'whatsapp' && !whatsappEnabled) return 'whatsapp_disabled_excluded';
  if (channel === 'email' && !row.has_email) return 'invalid_destination_excluded';
  if (channel === 'whatsapp' && !row.has_phone) return 'invalid_destination_excluded';
  if (!matchesCampaignSegment(row, segment)) return 'not_in_segment_excluded';
  return null;
}

function matchesCampaignSegment(
  row: LegacyAudienceRowOutcome,
  segment: LegacyActivationCampaignSegment,
) {
  if (segment === 'active_legacy_family_users') {
    return row.audience_type === 'family' && row.active_legacy_user;
  }
  if (segment === 'other_family_leads') {
    return row.audience_type === 'family' && !row.active_legacy_user && row.lead_state === 'lead';
  }
  return row.audience_type === 'school' && row.lead_state !== 'not_lead';
}

function templateKindForSegment(
  segment: LegacyActivationCampaignSegment,
): LegacyActivationTemplateKind {
  if (segment === 'active_legacy_family_users') return 'activation_migration';
  if (segment === 'other_family_leads') return 'launch_signup';
  return 'school_follow_up';
}

function assertApprovalMatchesPreview(
  preview: LegacyActivationCampaignPreview,
  request: LegacyActivationCampaignApprovalRequest,
) {
  if (
    request.campaign_key !== preview.campaign_key ||
    request.snapshot_hash !== preview.snapshot_hash ||
    request.approved_segment !== preview.segment ||
    request.approved_channel !== preview.channel ||
    request.approved_template_revision !== preview.template_revision ||
    request.approved_batch_size !== preview.batch_size ||
    request.approved_schedule_not_before !== preview.schedule_not_before
  ) {
    throw new LegacyActivationCampaignApprovalError(
      'Campaign approval must exactly match the immutable preview snapshot.',
    );
  }
}

function queueBlockReasons(input: {
  preview: LegacyActivationCampaignPreview;
  approval: LegacyActivationCampaignApproval | null;
  request: ReturnType<typeof legacyActivationCampaignQueueRequestSchema.parse>;
  now: Date;
  protectedCanaryDestination?: string | undefined;
  whatsappEnabled: boolean;
}): LegacyActivationBlockReason[] {
  const reasons = new Set<LegacyActivationBlockReason>();
  if (!input.approval) reasons.add('not_approved');
  if (input.request.snapshot_hash !== input.preview.snapshot_hash) reasons.add('snapshot_mismatch');
  if (new Date(input.preview.snapshot_expires_at) <= input.now) reasons.add('snapshot_stale');
  if (input.preview.channel === 'whatsapp' && !input.whatsappEnabled)
    reasons.add('whatsapp_disabled');
  if (input.request.mode === 'batch' && !input.approval?.real_audience_authorized) {
    reasons.add('real_audience_not_authorized');
  }
  if (input.request.mode === 'canary') {
    const expected = input.protectedCanaryDestination?.trim().toLowerCase();
    const actual = input.request.protected_canary_destination?.trim().toLowerCase();
    if (!input.approval?.canary_authorized || !actual || !expected) {
      reasons.add('protected_canary_not_authorized');
    } else if (actual !== expected) {
      reasons.add('protected_canary_destination_mismatch');
    }
  }
  return Array.from(reasons).sort();
}

function queueResult(
  preview: LegacyActivationCampaignPreview,
  mode: 'canary' | 'batch',
  requestedCount: number,
  blockedReasons: LegacyActivationBlockReason[],
  intents: LegacyActivationCampaignSendIntent[],
): LegacyActivationCampaignQueueResult {
  return {
    campaign_key: preview.campaign_key,
    status: blockedReasons.length ? 'blocked' : 'queued',
    mode,
    requested_count: requestedCount,
    queued_count: intents.length,
    blocked_reasons: blockedReasons,
    intents,
    provider_acceptance_is_delivery: false,
    external_send_performed: false,
    raw_recipient_list_included: false,
    raw_token_included: false,
  };
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortForHash(value));
}

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForHash(entry)]),
    );
  }
  return value;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
