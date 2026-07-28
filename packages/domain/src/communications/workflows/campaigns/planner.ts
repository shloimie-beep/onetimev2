import { createHash } from 'node:crypto';

import type {
  CommunicationChannelPlan,
  CommunicationSubject,
  CommunicationSuppressionSnapshot,
} from '../../../../../contracts/src/communications/foundation/index.ts';
import { CommunicationFoundationError, planCommunicationChannels } from '../../foundation/index.ts';
import type { CampaignApprovalInput } from '../../copy/approval.ts';
import { canonicalContentDigest, evaluateCampaignApproval } from '../../copy/approval.ts';
import { SENDER_IDENTITIES } from '../../copy/catalog.ts';
import {
  buildOt16Notice,
  FORMER_MEMBER_REACTIVATION_STEP_ONE_COPY,
  FORMER_MEMBER_REACTIVATION_STEPS,
  type Ot16CheckpointDays,
  type Ot16Notice,
  PARENT_NEWSLETTER_COPY,
} from './messages.ts';

export interface CampaignAudienceCandidate {
  subject: CommunicationSubject;
  current_account_owner: boolean;
  newsletter_permission: boolean;
  marketing_permission: boolean;
  former_or_canceled: boolean;
  active_parent: boolean;
  verified_paid_access: boolean;
  explicitly_declined: boolean;
  custom_school_terms: boolean;
}

export type CampaignApprovalEvidence = Omit<CampaignApprovalInput, 'message' | 'sender'>;

export type CampaignLaunchDecision =
  | { state: 'blocked'; reasons: readonly string[]; content_digest: string }
  | {
      state: 'held_for_first_broad_send_approval';
      reasons: readonly ['first broad send requires explicit Rabbi or Admin approval'];
      content_digest: string;
    }
  | { state: 'ready'; reasons: readonly []; content_digest: string };

export type CampaignEmailPlan =
  | {
      state: 'student_prohibited';
      email_provider_calls_planned: 0;
      whatsapp_provider_calls: 0;
    }
  | {
      state: 'excluded';
      reasons: readonly string[];
      email_provider_calls_planned: 0;
      whatsapp_provider_calls: 0;
    }
  | {
      state: 'suppressed';
      reason: string;
      email_provider_calls_planned: 0;
      whatsapp_provider_calls: 0;
    }
  | {
      state: 'deliver_email';
      channel_plan: CommunicationChannelPlan;
      sender_key: 'rabbi_campaign';
      email_provider_calls_planned: 1;
      whatsapp_provider_calls: 0;
      whatsapp_disposition: 'channel_skipped_not_configured';
    };

export function planParentNewsletterLaunch(input: {
  candidate: CampaignAudienceCandidate;
  evidence: CampaignApprovalEvidence;
  first_broad_send_approved: boolean;
}): CampaignLaunchDecision {
  const audienceReasons = newsletterAudienceReasons(input.candidate);
  const approval = evaluateCampaignApproval({
    ...input.evidence,
    message: PARENT_NEWSLETTER_COPY,
    sender: SENDER_IDENTITIES.rabbi_campaign,
  });
  const reasons = [...audienceReasons, ...approval.reasons];
  if (reasons.length > 0) {
    return { state: 'blocked', reasons, content_digest: approval.contentDigest };
  }
  if (!input.first_broad_send_approved) {
    return {
      state: 'held_for_first_broad_send_approval',
      reasons: ['first broad send requires explicit Rabbi or Admin approval'],
      content_digest: approval.contentDigest,
    };
  }
  return { state: 'ready', reasons: [], content_digest: approval.contentDigest };
}

export function planFormerMemberReactivationLaunch(input: {
  candidate: CampaignAudienceCandidate;
  evidence: CampaignApprovalEvidence;
}): CampaignLaunchDecision {
  const audienceReasons = reactivationAudienceReasons(input.candidate);
  const approval = evaluateCampaignApproval({
    ...input.evidence,
    message: FORMER_MEMBER_REACTIVATION_STEP_ONE_COPY,
    sender: SENDER_IDENTITIES.rabbi_campaign,
  });
  const reasons = [...audienceReasons, ...approval.reasons];
  if (reasons.length > 0) {
    return { state: 'blocked', reasons, content_digest: approval.contentDigest };
  }
  return {
    state: 'ready',
    reasons: [],
    content_digest: compositeReactivationDigest(),
  };
}

export function planParentNewsletterDelivery(input: {
  operation_id: string;
  candidate: CampaignAudienceCandidate;
  suppression: CommunicationSuppressionSnapshot;
}): CampaignEmailPlan {
  return planApprovedCampaignEmail({
    ...input,
    audience_reasons: newsletterAudienceReasons(input.candidate),
  });
}

export function planFormerMemberReactivationDelivery(input: {
  operation_id: string;
  candidate: CampaignAudienceCandidate;
  suppression: CommunicationSuppressionSnapshot;
}): CampaignEmailPlan {
  return planApprovedCampaignEmail({
    ...input,
    audience_reasons: reactivationAudienceReasons(input.candidate),
  });
}

function planApprovedCampaignEmail(input: {
  operation_id: string;
  candidate: CampaignAudienceCandidate;
  suppression: CommunicationSuppressionSnapshot;
  audience_reasons: readonly string[];
}): CampaignEmailPlan {
  if (input.candidate.subject.kind === 'student') {
    return {
      state: 'student_prohibited',
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    };
  }
  if (input.audience_reasons.length > 0) {
    return {
      state: 'excluded',
      reasons: input.audience_reasons,
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    };
  }
  const channelPlan = planCommunicationChannels({
    operation_id: input.operation_id,
    subject: input.candidate.subject,
    purpose: 'marketing',
    reminder_preference: 'both',
    marketing_permission: input.candidate.marketing_permission,
    suppression: input.suppression,
  });
  if (channelPlan.email.disposition === 'suppressed') {
    return {
      state: 'suppressed',
      reason: channelPlan.email.reason,
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    };
  }
  return {
    state: 'deliver_email',
    channel_plan: channelPlan,
    sender_key: 'rabbi_campaign',
    email_provider_calls_planned: 1,
    whatsapp_provider_calls: 0,
    whatsapp_disposition: 'channel_skipped_not_configured',
  };
}

function newsletterAudienceReasons(candidate: CampaignAudienceCandidate): string[] {
  const reasons = adultOnlyReasons(candidate.subject);
  if (!candidate.current_account_owner) reasons.push('not a current account owner');
  if (!candidate.newsletter_permission) reasons.push('newsletter permission is absent');
  if (!candidate.marketing_permission) reasons.push('current marketing permission is absent');
  return reasons;
}

function reactivationAudienceReasons(candidate: CampaignAudienceCandidate): string[] {
  const reasons = adultOnlyReasons(candidate.subject);
  if (!candidate.former_or_canceled) reasons.push('not a former or canceled adult');
  if (!candidate.marketing_permission) reasons.push('current marketing permission is absent');
  if (candidate.active_parent) reasons.push('active Parents are excluded');
  if (candidate.custom_school_terms) reasons.push('School-classified adults are excluded');
  return reasons;
}

function adultOnlyReasons(subject: CommunicationSubject): string[] {
  return subject.kind === 'student' ? ['Student contact is forbidden'] : [];
}

function compositeReactivationDigest(): string {
  const canonical = JSON.stringify(
    FORMER_MEMBER_REACTIVATION_STEPS.map((step) => ({
      copy_id: step.copy_id,
      day: step.day,
      subject: step.subject,
    })),
  );
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export type Ot16ExitReason = 'verified_paid_access' | 'explicit_decline' | 'custom_school_terms';

export type Ot16CheckpointPlan =
  | {
      state: 'student_prohibited';
      email_provider_calls_planned: 0;
      whatsapp_provider_calls: 0;
    }
  | {
      state: 'exited';
      reason: Ot16ExitReason;
      email_provider_calls_planned: 0;
      whatsapp_provider_calls: 0;
    }
  | {
      state: 'suppressed';
      reason: string;
      email_provider_calls_planned: 0;
      whatsapp_provider_calls: 0;
    }
  | {
      state: 'duplicate';
      email_provider_calls_planned: 0;
      whatsapp_provider_calls: 0;
    }
  | {
      state: 'deliver_email';
      operation_id: string;
      adult_id: string;
      channel_plan: CommunicationChannelPlan;
      notice: Ot16Notice;
      email_provider_calls_planned: 1;
      whatsapp_provider_calls: 0;
      whatsapp_disposition: 'channel_skipped_not_configured';
    };

export function ot16OperationId(input: {
  adult_id: string;
  expiry_at: string;
  checkpoint_days: Ot16CheckpointDays;
}): string {
  return createHash('sha256')
    .update(`OT-16\0${input.adult_id}\0${input.expiry_at}\0${input.checkpoint_days}`, 'utf8')
    .digest('hex');
}

export function planOt16Checkpoint(input: {
  operation_id: string;
  checkpoint_days: Ot16CheckpointDays;
  expiry_at: string;
  candidate: CampaignAudienceCandidate;
  suppression: CommunicationSuppressionSnapshot;
  previously_reserved_operation_ids?: ReadonlySet<string>;
}): Ot16CheckpointPlan {
  if (input.candidate.subject.kind === 'student') {
    return {
      state: 'student_prohibited',
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    };
  }
  const exitReason = ot16ExitReason(input.candidate);
  if (exitReason) {
    return {
      state: 'exited',
      reason: exitReason,
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    };
  }
  if (input.previously_reserved_operation_ids?.has(input.operation_id)) {
    return {
      state: 'duplicate',
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    };
  }

  let channelPlan;
  try {
    channelPlan = planCommunicationChannels({
      operation_id: input.operation_id,
      subject: input.candidate.subject,
      purpose: 'marketing',
      reminder_preference: 'both',
      marketing_permission: input.candidate.marketing_permission,
      suppression: input.suppression,
    });
  } catch (error) {
    if (
      error instanceof CommunicationFoundationError &&
      error.code === 'student_contact_prohibited'
    ) {
      return {
        state: 'student_prohibited',
        email_provider_calls_planned: 0,
        whatsapp_provider_calls: 0,
      };
    }
    throw error;
  }
  if (channelPlan.email.disposition === 'suppressed') {
    return {
      state: 'suppressed',
      reason: channelPlan.email.reason,
      email_provider_calls_planned: 0,
      whatsapp_provider_calls: 0,
    };
  }
  return {
    state: 'deliver_email',
    operation_id: input.operation_id,
    adult_id: input.candidate.subject.adult_id,
    channel_plan: channelPlan,
    notice: buildOt16Notice({
      checkpoint_days: input.checkpoint_days,
      expiry_at: input.expiry_at,
    }),
    email_provider_calls_planned: 1,
    whatsapp_provider_calls: 0,
    whatsapp_disposition: 'channel_skipped_not_configured',
  };
}

function ot16ExitReason(candidate: CampaignAudienceCandidate): Ot16ExitReason | null {
  if (candidate.verified_paid_access) return 'verified_paid_access';
  if (candidate.explicitly_declined) return 'explicit_decline';
  if (candidate.custom_school_terms) return 'custom_school_terms';
  return null;
}

export function parentNewsletterContentDigest(): string {
  return canonicalContentDigest(PARENT_NEWSLETTER_COPY);
}
