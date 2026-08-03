import { CommunicationFoundationError } from './errors.ts';

export const CANONICAL_FOUNDATION_WORKFLOW_IDENTITIES = {
  'OT-11': { purpose: 'permanently_retired_reserved', executable: false },
  'OT-12': { purpose: 'adult_support_intake', executable: true },
  'OT-14': { purpose: 'parent_newsletter', executable: true },
  'OT-15': { purpose: 'former_member_reactivation', executable: true },
  'OT-B01': { purpose: 'public_website_lead_capture', executable: true },
} as const;

export type CanonicalFoundationWorkflowKey = keyof typeof CANONICAL_FOUNDATION_WORKFLOW_IDENTITIES;

export function assertCanonicalWorkflowIdentity(input: {
  key: CanonicalFoundationWorkflowKey;
  purpose: string;
  executable: boolean;
}) {
  const canonical = CANONICAL_FOUNDATION_WORKFLOW_IDENTITIES[input.key];
  if (canonical.purpose !== input.purpose || canonical.executable !== input.executable) {
    throw new CommunicationFoundationError('registry_identity_conflict');
  }
  return input;
}
