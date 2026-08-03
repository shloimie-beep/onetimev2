import {
  CANONICAL_COPY_CATALOG,
  type CanonicalCopyMessage,
  type CopyCtaDestination,
  type SenderKey,
} from '../../../../packages/domain/src/communications/copy/catalog.ts';
import { canonicalContentDigest } from '../../../../packages/domain/src/communications/copy/approval.ts';

export const GHL_COPY_FRAGMENT_VERSION = '1.2.0';

export type GhlCopyFragment = Readonly<{
  id: string;
  workflowId: string;
  sender: Exclude<SenderKey, 'security_resend'>;
  subject: string;
  preheader?: string;
  body: string;
  ctaLabel?: string;
  ctaDestination?: CopyCtaDestination;
  audience: 'parent_account_owner' | 'former_adult';
  requiresExactAdminApproval: boolean;
  requiresCurrentConsent: boolean;
  launchTiming: 'event' | 'approval_launch' | 'weekly_household_local';
  daysAfterApprovalLaunch?: number;
  requiredVariables: readonly string[];
  contentDigest: string;
  adultOnly: true;
  tokenBearing: false;
}>;

function asGhlFragment(message: CanonicalCopyMessage): GhlCopyFragment {
  if (message.provider !== 'ghl') throw new Error(`Expected a GHL message, received ${message.id}`);
  if (message.sender === 'security_resend') throw new Error('Security templates are Resend-only');
  if (message.audience === 'adult')
    throw new Error('GHL fragments must name an approved adult campaign audience');
  return {
    id: message.id,
    workflowId: message.workflowId,
    sender: message.sender,
    subject: message.subject,
    ...(message.preheader ? { preheader: message.preheader } : {}),
    body: message.body,
    ...(message.ctaLabel ? { ctaLabel: message.ctaLabel } : {}),
    ...(message.ctaDestination ? { ctaDestination: message.ctaDestination } : {}),
    audience: message.audience,
    requiresExactAdminApproval: message.requiresApproval,
    requiresCurrentConsent: message.requiresCurrentConsent,
    launchTiming: message.launchTiming,
    ...(message.daysAfterApprovalLaunch === undefined
      ? {}
      : { daysAfterApprovalLaunch: message.daysAfterApprovalLaunch }),
    requiredVariables: message.requiredVariables,
    contentDigest: canonicalContentDigest(message),
    adultOnly: true,
    tokenBearing: false,
  };
}

export const GHL_COPY_FRAGMENTS: readonly GhlCopyFragment[] = CANONICAL_COPY_CATALOG.filter(
  (message) => message.provider === 'ghl',
).map(asGhlFragment);

export function findGhlCopyFragment(id: string): GhlCopyFragment | undefined {
  return GHL_COPY_FRAGMENTS.find((fragment) => fragment.id === id);
}
