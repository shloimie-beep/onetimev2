import type {
  CommunicationSenderProfile,
  CommunicationWorkflowFragment,
} from '../../../../packages/contracts/src/communications/foundation/index.ts';
import { COMMUNICATION_SENDER_PROFILES } from '../../../../packages/contracts/src/communications/foundation/index.ts';
import { validateWorkflowFragment } from '../../../../packages/domain/src/communications/foundation/index.ts';

export const FOUNDATION_WORKFLOW_REGISTRY = {
  'OT-11': {
    canonical_name: 'OT-11 Retired / Reserved',
    purpose: 'permanently_retired_reserved',
    executable: false,
  },
  'OT-12': {
    canonical_name: 'OT-12 Adult Support Intake',
    purpose: 'adult_support_intake',
    executable: true,
  },
  'OT-14': {
    canonical_name: 'OT-14 Parent Newsletter',
    purpose: 'parent_newsletter',
    executable: true,
  },
  'OT-15': {
    canonical_name: 'OT-15 Former Member Reactivation',
    purpose: 'former_member_reactivation',
    executable: true,
  },
  'OT-B01': {
    canonical_name: 'OT-B01 Website Lead-Capture Bot',
    purpose: 'public_website_lead_capture',
    executable: true,
  },
} as const;

export interface CommunicationFoundationDesiredState {
  contract_version: '1.0.0';
  registry_source: 'integrations/highlevel/registry/workflow-registry.yaml';
  registry: typeof FOUNDATION_WORKFLOW_REGISTRY;
  senders: Readonly<Record<string, CommunicationSenderProfile>>;
  workflow_fragments: readonly CommunicationWorkflowFragment[];
  generation_rules: {
    identifiers_may_be_reused: false;
    provider_identity_must_match_registry: true;
    student_contacts_allowed: false;
    whatsapp_state: 'dormant';
    email_steps_blocked_by_whatsapp: false;
    suppressed_at_send_time: true;
  };
}

export function buildCommunicationFoundationDesiredState(
  fragments: readonly CommunicationWorkflowFragment[] = [],
): CommunicationFoundationDesiredState {
  const validated = fragments.map((fragment) => validateWorkflowFragment(fragment));
  const keys = validated.flatMap((fragment) =>
    fragment.workflows.map((workflow) => workflow.workflow_key),
  );
  if (new Set(keys).size !== keys.length) {
    throw new Error('workflow_fragment_registry_key_conflict');
  }
  return {
    contract_version: '1.0.0',
    registry_source: 'integrations/highlevel/registry/workflow-registry.yaml',
    registry: FOUNDATION_WORKFLOW_REGISTRY,
    senders: COMMUNICATION_SENDER_PROFILES,
    workflow_fragments: validated,
    generation_rules: {
      identifiers_may_be_reused: false,
      provider_identity_must_match_registry: true,
      student_contacts_allowed: false,
      whatsapp_state: 'dormant',
      email_steps_blocked_by_whatsapp: false,
      suppressed_at_send_time: true,
    },
  };
}
