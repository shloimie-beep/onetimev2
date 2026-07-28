import { createHash } from 'node:crypto';

import type { CanonicalCopyMessage, SenderIdentity } from './catalog.ts';

export const CAMPAIGN_APPROVAL_SEMANTIC_VERSION = '1.0.0';

export type CampaignApprovalInput = Readonly<{
  message: CanonicalCopyMessage;
  sender: SenderIdentity;
  audienceCount: number;
  approvedAudienceCount: number;
  suppressedCountReadBack: boolean;
  audienceSampleReadBack: boolean;
  renderedWithSeedData: boolean;
  linksUseProductionOrigin: boolean;
  operatorSeedDelivered: boolean;
  unexpectedEffects: number;
  recipientKinds: readonly ('adult' | 'parent' | 'student')[];
  approvedContentDigest?: string;
  approvedAudienceDigest?: string;
  actualAudienceDigest: string;
  namedAdminApproval?: string;
  hardBounceRate?: number;
  complaintRate?: number;
  providerRejected?: boolean;
  providerAuthenticationFailed?: boolean;
  unrelatedEffectObserved?: boolean;
}>;

export type CampaignApprovalDecision = Readonly<{
  allowed: boolean;
  contentDigest: string;
  reasons: readonly string[];
}>;

export function canonicalContentDigest(message: CanonicalCopyMessage): string {
  const canonical = JSON.stringify({
    audience: message.audience,
    body: message.body,
    ctaLabel: message.ctaLabel ?? null,
    id: message.id,
    provider: message.provider,
    sender: message.sender,
    subject: message.subject,
    tokenBearing: message.tokenBearing,
    workflowId: message.workflowId,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** Returns every gate failure; callers must not dispatch when `allowed` is false. */
export function evaluateCampaignApproval(input: CampaignApprovalInput): CampaignApprovalDecision {
  const reasons: string[] = [];
  const contentDigest = canonicalContentDigest(input.message);

  if (!input.message.requiresApproval)
    reasons.push('message does not declare a campaign approval requirement');
  if (!input.namedAdminApproval?.trim()) reasons.push('missing named Admin approval');
  if (input.audienceCount < 1) reasons.push('audience count must be positive');
  if (input.audienceCount > input.approvedAudienceCount)
    reasons.push('audience count exceeds approved budget');
  if (!input.audienceSampleReadBack) reasons.push('audience sample was not read back');
  if (!input.suppressedCountReadBack) reasons.push('suppressed count was not read back');
  if (!input.renderedWithSeedData) reasons.push('message was not rendered with seed data');
  if (!input.linksUseProductionOrigin)
    reasons.push('links do not resolve to the production origin');
  if (!input.operatorSeedDelivered) reasons.push('operator-owned seed was not delivered');
  if (input.unexpectedEffects !== 0) reasons.push('unexpected effects are not zero');
  if (input.sender.key !== input.message.sender) reasons.push('wrong sender/reply-to identity');
  if (input.recipientKinds.includes('student')) reasons.push('Student contact is forbidden');
  if (input.approvedContentDigest !== contentDigest)
    reasons.push('content digest drift or missing approval');
  if (input.approvedAudienceDigest !== input.actualAudienceDigest)
    reasons.push('audience digest drift or missing approval');
  if ((input.hardBounceRate ?? 0) > 0.02) reasons.push('hard-bounce rate exceeds 2%');
  if ((input.complaintRate ?? 0) >= 0.001) reasons.push('complaint rate is at or above 0.1%');
  if (input.providerRejected) reasons.push('provider rejected the campaign');
  if (input.providerAuthenticationFailed) reasons.push('provider authentication failed');
  if (input.unrelatedEffectObserved) reasons.push('unrelated workflow effect observed');

  return { allowed: reasons.length === 0, contentDigest, reasons };
}
