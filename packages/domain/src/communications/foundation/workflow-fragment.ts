import type {
  CommunicationWorkflowFragment,
  WorkflowApprovalGate,
} from '../../../../contracts/src/communications/foundation/index.ts';
import { COMMUNICATION_FOUNDATION_CONTRACT_VERSION } from '../../../../contracts/src/communications/foundation/index.ts';
import { CommunicationFoundationError } from './errors.ts';

const requiredApprovalGates: readonly WorkflowApprovalGate[] = [
  'registry_identity',
  'sender',
  'audience',
  'consent',
  'copy',
  'suppression',
];

export function validateWorkflowFragment(fragment: CommunicationWorkflowFragment) {
  const keys = new Set<string>();
  const valid =
    fragment.contract_version === COMMUNICATION_FOUNDATION_CONTRACT_VERSION &&
    fragment.fragment_id.trim().length > 0 &&
    fragment.workflows.length > 0 &&
    fragment.workflows.every((workflow) => {
      const hasAllGates = requiredApprovalGates.every((gate) =>
        workflow.approval_gates.includes(gate),
      );
      const unique = !keys.has(workflow.workflow_key);
      keys.add(workflow.workflow_key);
      return (
        unique &&
        /^OT-(?:0[1-9]|1[0-6])$/.test(workflow.workflow_key) &&
        workflow.subject === 'adult_only' &&
        workflow.email_required &&
        workflow.whatsapp_state === 'dormant' &&
        workflow.student_contact_prohibited &&
        workflow.requires_send_time_suppression_recheck &&
        workflow.ordered_steps.length > 0 &&
        workflow.idempotency_scope.trim().length > 0 &&
        hasAllGates
      );
    });
  if (!valid) throw new CommunicationFoundationError('invalid_workflow_fragment');
  return fragment;
}
