import { describe, expect, it } from 'vitest';

import type { CommunicationSuppressionSnapshot } from '../../../../../contracts/src/communications/foundation/index.ts';
import type { CampaignApprovalInput } from '../../copy/approval.ts';
import { canonicalContentDigest } from '../../copy/approval.ts';
import {
  FORMER_MEMBER_REACTIVATION_STEP_ONE_COPY,
  FORMER_MEMBER_REACTIVATION_STEPS,
  OT16_CHECKPOINT_DAYS,
  P30_CAMPAIGN_WORKFLOW_FRAGMENT,
  P30_CAMPAIGN_WORKFLOWS,
  PARENT_NEWSLETTER_COPY,
  ot16OperationId,
  planFormerMemberReactivationDelivery,
  planFormerMemberReactivationLaunch,
  planOt16Checkpoint,
  planParentNewsletterDelivery,
  planParentNewsletterLaunch,
  type CampaignAudienceCandidate,
  type ReactivationStepApproval,
} from './index.ts';

const h = (value: string) => value.repeat(64).slice(0, 64);
const expiryAt = '2026-09-13T19:24:00+03:00';

function suppression(
  overrides: Partial<CommunicationSuppressionSnapshot> = {},
): CommunicationSuppressionSnapshot {
  return {
    snapshot_id: 'suppression-1',
    adult_id: 'adult-1',
    captured_at: '2026-09-01T12:00:00Z',
    email_dnd: false,
    unsubscribed: false,
    complaint: false,
    hard_bounce: false,
    invalid_address: false,
    marketing_suppressed: false,
    optional_reminder_suppressed: false,
    evidence_digest: h('a'),
    ...overrides,
  };
}

function candidate(overrides: Partial<CampaignAudienceCandidate> = {}): CampaignAudienceCandidate {
  return {
    subject: { kind: 'adult', adult_id: 'adult-1', household_id: 'household-1' },
    current_account_owner: true,
    newsletter_permission: true,
    marketing_permission: true,
    former_or_canceled: true,
    active_parent: false,
    verified_paid_access: false,
    explicitly_declined: false,
    custom_school_terms: false,
    ...overrides,
  };
}

function approvalEvidence(
  message: typeof PARENT_NEWSLETTER_COPY | typeof FORMER_MEMBER_REACTIVATION_STEP_ONE_COPY,
  overrides: Partial<Omit<CampaignApprovalInput, 'message' | 'sender'>> = {},
): Omit<CampaignApprovalInput, 'message' | 'sender'> {
  const digest = canonicalContentDigest(message);
  return {
    audienceCount: 1,
    approvedAudienceCount: 1,
    suppressedCountReadBack: true,
    audienceSampleReadBack: true,
    renderedWithSeedData: true,
    linksUseProductionOrigin: true,
    operatorSeedDelivered: true,
    unexpectedEffects: 0,
    recipientKinds: ['parent'],
    approvedContentDigest: digest,
    approvedAudienceDigest: h('b'),
    actualAudienceDigest: h('b'),
    namedAdminApproval: 'Admin Shloimie',
    currentConsentVerified: true,
    hardBounceRate: 0,
    complaintRate: 0,
    providerRejected: false,
    providerAuthenticationFailed: false,
    unrelatedEffectObserved: false,
    ...overrides,
  };
}

function reactivationApproval(
  stepIndex: 0 | 1 | 2,
  overrides: Partial<ReactivationStepApproval> = {},
): ReactivationStepApproval {
  const step = FORMER_MEMBER_REACTIVATION_STEPS[stepIndex];
  return {
    copy_id: step.copy_id,
    approved_subject: step.subject,
    evidence: approvalEvidence(FORMER_MEMBER_REACTIVATION_STEP_ONE_COPY, {
      approvedContentDigest:
        stepIndex === 0
          ? canonicalContentDigest(FORMER_MEMBER_REACTIVATION_STEP_ONE_COPY)
          : h(`${stepIndex}`),
    }),
    ...overrides,
  };
}

function operationId(
  checkpointDays: (typeof OT16_CHECKPOINT_DAYS)[number],
  adultId = 'adult-1',
  expiry = expiryAt,
): string {
  return ot16OperationId({
    adult_id: adultId,
    expiry_at: expiry,
    checkpoint_days: checkpointDays,
  });
}

describe('P30 campaign workflows', () => {
  it('OTV2-GHL-134-AC01 configures the exact newsletter and holds its first broad send', () => {
    expect(P30_CAMPAIGN_WORKFLOW_FRAGMENT.contract_version).toBe('1.0.0');
    expect(
      P30_CAMPAIGN_WORKFLOWS.find((workflow) => workflow.workflow_key === 'OT-14'),
    ).toMatchObject({
      sender_key: 'rabbi_campaign',
      subject: 'adult_only',
      trigger: 'weekly Thursday at 12:00 household local time after explicit publication',
      email_required: true,
      whatsapp_state: 'dormant',
    });
    expect(PARENT_NEWSLETTER_COPY).toMatchObject({
      workflowId: 'OT-14',
      subject: 'This week in One Time Mishnayos',
      sender: 'rabbi_campaign',
      audience: 'parent_account_owner',
      launchTiming: 'weekly_household_local',
    });
    expect(
      planParentNewsletterLaunch({
        candidate: candidate(),
        evidence: approvalEvidence(PARENT_NEWSLETTER_COPY),
        first_broad_send_approved: false,
      }),
    ).toMatchObject({
      state: 'held_for_first_broad_send_approval',
      reasons: ['first broad send requires explicit Rabbi or Admin approval'],
    });
    expect(
      planParentNewsletterLaunch({
        candidate: candidate(),
        evidence: approvalEvidence(PARENT_NEWSLETTER_COPY),
        first_broad_send_approved: true,
      }),
    ).toMatchObject({ state: 'ready', reasons: [] });
    expect(
      planParentNewsletterDelivery({
        operation_id: h('n'),
        candidate: candidate(),
        suppression: suppression({ snapshot_id: 'send-time', unsubscribed: true }),
      }),
    ).toMatchObject({
      state: 'suppressed',
      reason: 'unsubscribed',
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    });
  });

  it('OTV2-GHL-135-AC01 admits only the exact former-member segment and approved three-step copy', () => {
    expect(FORMER_MEMBER_REACTIVATION_STEPS).toEqual([
      {
        day: 0,
        copy_id: 'ghl.former_member_reactivation.step_1.v1',
        subject: 'See what is new in One Time Mishnayos',
      },
      {
        day: 4,
        copy_id: 'ghl.former_member_reactivation.step_2.v1',
        subject: 'A separate Student portal for live class and recordings',
      },
      {
        day: 9,
        copy_id: 'ghl.former_member_reactivation.step_3.v1',
        subject: 'Come back free until September 13',
      },
    ]);
    expect(
      planFormerMemberReactivationLaunch({
        candidate: candidate(),
        step_approvals: [reactivationApproval(0)],
      }),
    ).toMatchObject({
      state: 'blocked',
      reasons: expect.arrayContaining([
        'missing exact content approval for ghl.former_member_reactivation.step_2.v1',
        'canonical copy is not registered: ghl.former_member_reactivation.step_2.v1',
        'missing exact content approval for ghl.former_member_reactivation.step_3.v1',
        'canonical copy is not registered: ghl.former_member_reactivation.step_3.v1',
      ]),
    });
    const forgedChangedApprovals = [
      reactivationApproval(0),
      reactivationApproval(1, { approved_subject: 'Changed day 4 subject' }),
      reactivationApproval(2, {
        evidence: approvalEvidence(FORMER_MEMBER_REACTIVATION_STEP_ONE_COPY, {
          approvedContentDigest: h('changed-step-3'),
        }),
      }),
    ];
    expect(
      planFormerMemberReactivationLaunch({
        candidate: candidate(),
        step_approvals: forgedChangedApprovals,
      }),
    ).toMatchObject({
      state: 'blocked',
      reasons: expect.arrayContaining([
        'approved subject drift for ghl.former_member_reactivation.step_2.v1',
        'canonical copy is not registered: ghl.former_member_reactivation.step_2.v1',
        'canonical copy is not registered: ghl.former_member_reactivation.step_3.v1',
      ]),
    });
    expect(
      planFormerMemberReactivationLaunch({
        candidate: candidate({ active_parent: true }),
        step_approvals: [reactivationApproval(0)],
      }),
    ).toMatchObject({
      state: 'blocked',
      reasons: expect.arrayContaining(['active Parents are excluded']),
    });
    expect(
      planFormerMemberReactivationLaunch({
        candidate: candidate({ custom_school_terms: true }),
        step_approvals: [reactivationApproval(0)],
      }),
    ).toMatchObject({
      state: 'blocked',
      reasons: expect.arrayContaining(['School-classified adults are excluded']),
    });
    expect(
      planFormerMemberReactivationDelivery({
        operation_id: h('r'),
        candidate: candidate(),
        suppression: suppression({ snapshot_id: 'send-time', email_dnd: true }),
        step_approvals: [reactivationApproval(0)],
      }),
    ).toMatchObject({
      state: 'excluded',
      reasons: expect.arrayContaining([
        'canonical copy is not registered: ghl.former_member_reactivation.step_2.v1',
        'canonical copy is not registered: ghl.former_member_reactivation.step_3.v1',
      ]),
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    });
  });

  it('OTV2-GHL-225-SCHEDULE plans exactly five deduplicated email checkpoints with truthful dormant WhatsApp', () => {
    const expectedSchedule = [
      '2026-08-30T16:24:00.000Z',
      '2026-09-06T16:24:00.000Z',
      '2026-09-10T16:24:00.000Z',
      '2026-09-12T16:24:00.000Z',
      '2026-09-13T16:24:00.000Z',
    ];
    for (const [index, checkpointDays] of OT16_CHECKPOINT_DAYS.entries()) {
      const checkpointOperationId = operationId(checkpointDays);
      const plan = planOt16Checkpoint({
        operation_id: checkpointOperationId,
        checkpoint_days: checkpointDays,
        expiry_at: expiryAt,
        candidate: candidate(),
        suppression: suppression(),
      });
      expect(plan).toMatchObject({
        state: 'deliver_email',
        operation_id: checkpointOperationId,
        email_provider_calls_planned: 1,
        whatsapp_provider_calls: 0,
        whatsapp_disposition: 'channel_skipped_not_configured',
        notice: {
          checkpoint_days: checkpointDays,
          scheduled_at: expectedSchedule[index],
          expiry_at: expiryAt,
          price_amount: 67,
          price_currency: 'USD',
          automatic_charge_without_checkout: false,
          cta_label: 'Complete Checkout',
        },
      });
      if (plan.state !== 'deliver_email') throw new Error('expected deliver_email');
      expect(plan.notice.body).toContain('$67 USD/month');
      expect(plan.notice.body).toContain(expiryAt);
      expect(plan.notice.body).toContain(
        'No automatic charge will occur without completed Checkout',
      );
      expect(
        planOt16Checkpoint({
          operation_id: checkpointOperationId,
          checkpoint_days: checkpointDays,
          expiry_at: expiryAt,
          candidate: candidate(),
          suppression: suppression(),
          previously_reserved_operation_ids: new Set([checkpointOperationId]),
        }),
      ).toEqual({
        state: 'duplicate',
        email_provider_calls_planned: 0,
        whatsapp_provider_calls: 0,
      });
    }
    expect(
      planOt16Checkpoint({
        operation_id: operationId(7),
        checkpoint_days: 14,
        expiry_at: expiryAt,
        candidate: candidate(),
        suppression: suppression(),
      }),
    ).toEqual({
      state: 'invalid_operation_id',
      reason: 'operation_id_mismatch',
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    });
    expect(
      planOt16Checkpoint({
        operation_id: operationId(14, 'adult-2'),
        checkpoint_days: 14,
        expiry_at: expiryAt,
        candidate: candidate(),
        suppression: suppression(),
      }),
    ).toEqual({
      state: 'invalid_operation_id',
      reason: 'operation_id_mismatch',
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    });
    expect(
      planOt16Checkpoint({
        operation_id: operationId(14),
        checkpoint_days: 14,
        expiry_at: '2026-09-13T19:24:01+03:00',
        candidate: candidate(),
        suppression: suppression(),
      }),
    ).toEqual({
      state: 'invalid_operation_id',
      reason: 'operation_id_mismatch',
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    });
  });

  it('OTV2-GHL-225-PAID-EXIT exits after verified paid access before every later effect', () => {
    const plan = planOt16Checkpoint({
      operation_id: operationId(7),
      checkpoint_days: 7,
      expiry_at: expiryAt,
      candidate: candidate({ verified_paid_access: true }),
      suppression: suppression(),
    });
    expect(plan).toEqual({
      state: 'exited',
      reason: 'verified_paid_access',
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    });
  });

  it('OTV2-GHL-225-SCHOOL-EXIT excludes custom School terms before Family conversion contact', () => {
    const plan = planOt16Checkpoint({
      operation_id: operationId(14),
      checkpoint_days: 14,
      expiry_at: expiryAt,
      candidate: candidate({ custom_school_terms: true }),
      suppression: suppression(),
    });
    expect(plan).toEqual({
      state: 'exited',
      reason: 'custom_school_terms',
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    });
  });

  it('OTV2-GHL-225-SUPPRESSION rechecks every send-time suppression and creates no effect', () => {
    const suppressions: readonly Partial<CommunicationSuppressionSnapshot>[] = [
      { unsubscribed: true },
      { email_dnd: true },
      { complaint: true },
      { hard_bounce: true },
      { invalid_address: true },
      { marketing_suppressed: true },
    ];
    for (const override of suppressions) {
      expect(
        planOt16Checkpoint({
          operation_id: operationId(3),
          checkpoint_days: 3,
          expiry_at: expiryAt,
          candidate: candidate(),
          suppression: suppression(override),
        }),
      ).toMatchObject({
        state: 'suppressed',
        email_provider_calls_planned: 0,
        whatsapp_provider_calls: 0,
      });
    }
  });
});
