import type {
  CommunicationSenderProfile,
  CommunicationWorkflowFragment,
} from '../../../../packages/contracts/src/communications/foundation/index.ts';
import {
  COMMUNICATION_FOUNDATION_CONTRACT_VERSION,
  COMMUNICATION_SENDER_PROFILES,
} from '../../../../packages/contracts/src/communications/foundation/index.ts';
import { validateWorkflowFragment } from '../../../../packages/domain/src/communications/foundation/index.ts';
import { findCanonicalCopy } from '../../../../packages/domain/src/communications/copy/catalog.ts';
import { CORE_WORKFLOW_DEFINITIONS } from '../../../../packages/domain/src/communications/workflows/core/index.ts';
import {
  FORMER_MEMBER_REACTIVATION_STEPS,
  OT16_CHECKPOINT_DAYS,
  OT16_STANDARD_FAMILY_PRICE,
  P30_CAMPAIGN_WORKFLOW_FRAGMENT,
  PARENT_NEWSLETTER_COPY,
} from '../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import { businessWorkflowRecords } from '../../../../scripts/highlevel/workflow-registry-source.ts';

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

const canonicalBusinessWorkflowByKey = new Map(
  businessWorkflowRecords.map((workflow) => [workflow.key, workflow]),
);

const P29_CORE_LIFECYCLE_WORKFLOW_FRAGMENT = registerP29CoreLifecycleFragment();
const P30_CAMPAIGN_REGISTRY_PREREQUISITE = registerP30CampaignFragment();
const registeredWorkflowFragments = [
  P29_CORE_LIFECYCLE_WORKFLOW_FRAGMENT,
  P30_CAMPAIGN_REGISTRY_PREREQUISITE,
] as const;

export function buildCommunicationFoundationDesiredState(
  additionalFragments: readonly CommunicationWorkflowFragment[] = [],
): CommunicationFoundationDesiredState {
  const fragments = [...registeredWorkflowFragments, ...additionalFragments];
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

function registerP29CoreLifecycleFragment(): CommunicationWorkflowFragment {
  if (CORE_WORKFLOW_DEFINITIONS.length !== 12) {
    throw new Error('p29_core_lifecycle_requires_exactly_twelve_workflows');
  }
  for (const definition of CORE_WORKFLOW_DEFINITIONS) {
    const canonical = canonicalBusinessWorkflowByKey.get(definition.workflow_key);
    if (
      canonical?.canonicalName !== definition.canonical_name ||
      canonical.senderKey !== definition.sender_key ||
      canonical.messageClass !== definition.message_class ||
      canonical.exactTrigger !== definition.trigger ||
      canonical.desiredStatus !== definition.desired_initial_state
    ) {
      throw new Error(`p29_core_lifecycle_registry_drift:${definition.workflow_key}`);
    }
  }
  return validateWorkflowFragment({
    contract_version: COMMUNICATION_FOUNDATION_CONTRACT_VERSION,
    owner_task: 'P29',
    fragment_id: 'p29-core-lifecycle-v1',
    workflows: CORE_WORKFLOW_DEFINITIONS,
  } satisfies CommunicationWorkflowFragment);
}

function registerP30CampaignFragment(): CommunicationWorkflowFragment {
  const expectedMessageClasses = {
    'OT-14': 'torah_newsletter',
    'OT-15': 'warm_enrollment_campaign',
    'OT-16': 'billing_help',
  } as const;
  const fragment = validateWorkflowFragment(P30_CAMPAIGN_WORKFLOW_FRAGMENT);
  for (const workflow of fragment.workflows) {
    const canonical = canonicalBusinessWorkflowByKey.get(workflow.workflow_key);
    if (
      canonical?.canonicalName !== workflow.canonical_name ||
      canonical.senderKey !== workflow.sender_key ||
      canonical.messageClass !==
        expectedMessageClasses[workflow.workflow_key as keyof typeof expectedMessageClasses] ||
      canonical.ghlId !== '' ||
      canonical.desiredStatus !== 'DRAFT_WAITING_EXTERNAL' ||
      canonical.observedStatus !== 'MISSING'
    ) {
      throw new Error(`p30_campaign_registry_drift:${workflow.workflow_key}`);
    }
  }
  const expectedReactivationCopyIds = FORMER_MEMBER_REACTIVATION_STEPS.map((step) => step.copy_id);
  const registeredReactivationCopies = FORMER_MEMBER_REACTIVATION_STEPS.map((step) =>
    findCanonicalCopy(step.copy_id),
  );
  if (
    fragment.workflows.map((workflow) => workflow.workflow_key).join('|') !== 'OT-14|OT-15|OT-16' ||
    PARENT_NEWSLETTER_COPY.workflowId !== 'OT-14' ||
    PARENT_NEWSLETTER_COPY.sender !== 'rabbi_campaign' ||
    PARENT_NEWSLETTER_COPY.requiresApproval !== true ||
    expectedReactivationCopyIds.join('|') !==
      'ghl.former_member_reactivation.step_1.v1|ghl.former_member_reactivation.step_2.v1|ghl.former_member_reactivation.step_3.v1' ||
    registeredReactivationCopies.some(
      (copy, index) =>
        copy?.workflowId !== 'OT-15' ||
        copy.sender !== 'rabbi_campaign' ||
        copy.subject !== FORMER_MEMBER_REACTIVATION_STEPS[index]?.subject ||
        copy.requiresApproval !== true,
    ) ||
    OT16_CHECKPOINT_DAYS.join('|') !== '14|7|3|1|0' ||
    OT16_STANDARD_FAMILY_PRICE.amount !== 67 ||
    OT16_STANDARD_FAMILY_PRICE.currency !== 'USD' ||
    OT16_STANDARD_FAMILY_PRICE.cadence !== 'month'
  ) {
    throw new Error('p30_campaign_copy_sender_or_checkpoint_drift');
  }
  return fragment;
}
