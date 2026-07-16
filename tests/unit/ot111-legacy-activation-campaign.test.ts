import { describe, expect, it, vi } from 'vitest';
import {
  approveLegacyActivationCampaign,
  createLegacyActivationCampaignPreview,
  createOps03ParentActivationLifecyclePort,
  formatLegacyActivationCampaignPreview,
  LegacyActivationCampaignApprovalError,
  queueLegacyActivationCampaignIntents,
} from '../../packages/domain/src/audience-reconciliation/activation-campaign.ts';
import {
  createLegacyAudienceDryRun,
  type LegacyAudienceExistingContact,
} from '../../packages/domain/src/audience-reconciliation/service.ts';
import type { LegacyAudienceInputRow } from '../../packages/contracts/src/audience-reconciliation/index.ts';

const scope = { accountKey: 'acct_ot111', productKey: 'prod_ot111' };
const now = new Date('2026-07-16T09:00:00.000Z');

describe('OT-111 legacy activation campaign controls', () => {
  it('builds counts-only immutable snapshots and excludes unsafe recipients', () => {
    const report = audienceReport();
    const preview = createLegacyActivationCampaignPreview({
      scope,
      report,
      request: previewRequest(report.batch_key, 'active_legacy_family_users'),
      now,
    });
    const formatted = formatLegacyActivationCampaignPreview(preview);

    expect(preview.production_side_effects).toBe(false);
    expect(preview.raw_recipient_list_included).toBe(false);
    expect(preview.message_body_included).toBe(false);
    expect(preview.counts.eligible_rows).toBe(1);
    expect(preview.counts.already_activated_excluded).toBe(1);
    expect(preview.counts.suppressed_excluded).toBe(1);
    expect(preview.counts.manual_review_excluded).toBe(1);
    expect(preview.counts.not_in_segment_excluded).toBe(2);
    expect(preview.recipient_row_keys).toHaveLength(1);
    expect(formatted).toContain('snapshot_hash:');
    expect(formatted).not.toContain('active@example.test');
    expect(formatted).not.toContain('052-555');
  });

  it('requires approval fields to match the exact immutable preview', () => {
    const report = audienceReport();
    const preview = createLegacyActivationCampaignPreview({
      scope,
      report,
      request: previewRequest(report.batch_key, 'active_legacy_family_users'),
      now,
    });
    const approval = approveLegacyActivationCampaign({
      preview,
      request: approvalRequest(preview, { canary_authorized: true }),
      now,
    });

    expect(approval).toMatchObject({
      status: 'approved',
      snapshot_hash: preview.snapshot_hash,
      canary_authorized: true,
      real_audience_authorized: false,
      production_side_effects: false,
    });

    expect(() =>
      approveLegacyActivationCampaign({
        preview,
        request: {
          ...approvalRequest(preview),
          approved_template_revision: 'changed-template-v2',
        },
        now,
      }),
    ).toThrow(LegacyActivationCampaignApprovalError);
  });

  it('blocks broad batch sends and only queues protected canary sink intents', async () => {
    const report = audienceReport();
    const preview = createLegacyActivationCampaignPreview({
      scope,
      report,
      request: previewRequest(report.batch_key, 'active_legacy_family_users'),
      now,
    });
    const approval = approveLegacyActivationCampaign({
      preview,
      request: approvalRequest(preview, { canary_authorized: true }),
      now,
    });
    const issueParentActivation = vi.fn(async () => ({
      delivery: {
        intent_key: 'ops03b_parent_activation_intent',
        external_send_performed: false as const,
        raw_token_included: false as const,
      },
      raw_token_included: false as const,
    }));

    const batch = await queueLegacyActivationCampaignIntents({
      preview,
      approval,
      request: {
        idempotency_key: 'queue-batch-001',
        campaign_key: preview.campaign_key,
        snapshot_hash: preview.snapshot_hash,
        mode: 'batch',
        requested_count: 25,
      },
      now,
      protectedCanaryDestination: 'canary@example.test',
      lifecyclePort: createOps03ParentActivationLifecyclePort(issueParentActivation),
    });
    expect(batch.status).toBe('blocked');
    expect(batch.blocked_reasons).toEqual(expect.arrayContaining(['real_audience_not_authorized']));
    expect(batch.external_send_performed).toBe(false);

    const canary = await queueLegacyActivationCampaignIntents({
      preview,
      approval,
      request: {
        idempotency_key: 'queue-canary-001',
        campaign_key: preview.campaign_key,
        snapshot_hash: preview.snapshot_hash,
        mode: 'canary',
        requested_count: 1,
        protected_canary_destination: 'canary@example.test',
        protected_canary_display_name: 'Protected Canary',
        lifecycle_subject: {
          household_key: 'household_canary',
          relationship_key: 'relationship_canary',
          relationship_label: 'Parent',
          authority: 'primary_guardian',
        },
      },
      now,
      protectedCanaryDestination: 'canary@example.test',
      lifecyclePort: createOps03ParentActivationLifecyclePort(issueParentActivation),
    });

    expect(canary).toMatchObject({
      status: 'queued',
      queued_count: 1,
      external_send_performed: false,
      raw_recipient_list_included: false,
      raw_token_included: false,
    });
    expect(canary.intents[0]).toMatchObject({
      delivery_state: 'queued',
      lifecycle_intent_ref: 'ops03b_parent_activation_intent',
      raw_destination_included: false,
      raw_token_included: false,
    });
    expect(issueParentActivation).toHaveBeenCalledTimes(1);
  });

  it('keeps WhatsApp disabled unless an explicit provider policy is supplied', async () => {
    const report = audienceReport();
    const preview = createLegacyActivationCampaignPreview({
      scope,
      report,
      request: {
        ...previewRequest(report.batch_key, 'active_legacy_family_users'),
        channel: 'whatsapp',
      },
      now,
    });
    const approval = approveLegacyActivationCampaign({
      preview,
      request: approvalRequest(preview, { canary_authorized: true }),
      now,
    });
    const result = await queueLegacyActivationCampaignIntents({
      preview,
      approval,
      request: {
        idempotency_key: 'queue-whatsapp-001',
        campaign_key: preview.campaign_key,
        snapshot_hash: preview.snapshot_hash,
        mode: 'canary',
        requested_count: 1,
        protected_canary_destination: 'canary@example.test',
      },
      now,
      protectedCanaryDestination: 'canary@example.test',
    });

    expect(preview.counts.whatsapp_disabled_excluded).toBe(3);
    expect(result.status).toBe('blocked');
    expect(result.blocked_reasons).toContain('whatsapp_disabled');
  });
});

function audienceReport() {
  return createLegacyAudienceDryRun({
    scope,
    request: {
      idempotency_key: 'ot111-audience-fixture',
      source: {
        kind: 'csv_normalized',
        source_label: 'unit-fixture',
        worksheet_label: 'unit',
      },
      rows: [
        row({
          source_row_number: 2,
          email: 'active@example.test',
          phone: '052-555-0100',
          active_legacy_user: true,
          legacy_system_state: 'present',
          lead_state: 'lead',
          consent_state: 'opted_in',
        }),
        row({
          source_row_number: 3,
          email: 'other@example.test',
          active_legacy_user: false,
          lead_state: 'lead',
          consent_state: 'opted_in',
        }),
        row({
          source_row_number: 4,
          email: 'school@example.test',
          audience_type: 'school',
          lead_state: 'lead',
          consent_state: 'opted_in',
        }),
        row({
          source_row_number: 5,
          email: 'activated@example.test',
          active_legacy_user: true,
          new_system_activated: true,
          consent_state: 'opted_in',
        }),
        row({
          source_row_number: 6,
          email: 'suppressed@example.test',
          active_legacy_user: true,
          consent_state: 'opted_out',
          suppression_state: 'suppressed',
        }),
        row({
          source_row_number: 7,
          display_name: 'Manual Review',
          active_legacy_user: true,
          consent_state: 'opted_in',
        }),
      ],
    },
    existingContacts: existingContacts(),
    now,
  });
}

function existingContacts(): LegacyAudienceExistingContact[] {
  return [
    {
      account_key: scope.accountKey,
      product_key: scope.productKey,
      contact_key: 'contact_active',
      public_contact_id: 'public_active',
      display_name: 'Active',
      email_normalized: 'active@example.test',
      phone_normalized: '+972525550100',
      archived_at: null,
      suppression_state: 'active',
      new_system_activated: false,
    },
  ];
}

function previewRequest(batchKey: string, segment: 'active_legacy_family_users') {
  return {
    idempotency_key: `preview-${segment}-001`,
    batch_key: batchKey,
    segment,
    channel: 'email' as const,
    template_revision: 'draft-day-one-activation-v1',
    batch_size: 25,
    schedule_not_before: '2026-07-17T09:00:00.000Z',
  };
}

function approvalRequest(
  preview: ReturnType<typeof createLegacyActivationCampaignPreview>,
  overrides: Partial<{
    canary_authorized: boolean;
    real_audience_authorized: boolean;
    approved_template_revision: string;
  }> = {},
) {
  return {
    idempotency_key: 'approval-ot111-001',
    campaign_key: preview.campaign_key,
    snapshot_hash: preview.snapshot_hash,
    approved_segment: preview.segment,
    approved_channel: preview.channel,
    approved_template_revision: preview.template_revision,
    approved_batch_size: preview.batch_size,
    approved_schedule_not_before: preview.schedule_not_before,
    operator_approval_statement:
      'I approve this exact synthetic OT-111 campaign snapshot for protected sink controls only.',
    ops03b_login_verified: true,
    real_audience_authorized: false,
    canary_authorized: false,
    ...overrides,
  };
}

function row(overrides: Partial<LegacyAudienceInputRow>): LegacyAudienceInputRow {
  return {
    source_row_number: 1,
    display_name: 'Campaign Person',
    email: '',
    phone: '',
    audience_type: 'family',
    legacy_system_state: 'unknown',
    active_legacy_user: false,
    new_system_activated: false,
    lead_state: 'unknown',
    consent_state: 'unknown',
    suppression_state: 'active',
    source_tags: [],
    ...overrides,
  };
}
