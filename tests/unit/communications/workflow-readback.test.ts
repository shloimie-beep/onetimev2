import { describe, expect, it } from 'vitest';
import {
  GHL_UI_COMPLETE_LAUNCH_RESULT_PATH,
  createWorkflowReadbackReader,
} from '../../../apps/web/src/server/communications/workflow-readback.ts';

describe('workflow readback projection', () => {
  it('projects a canonical workflow without secret-bearing registry values or provider controls', () => {
    const result = createWorkflowReadbackReader({
      resultArtifactPresent: () => false,
    }).find('OT-01');

    expect(result).toMatchObject({
      success: true,
      source_scope: 'repository_workflow_registry',
      workflow: {
        workflow_key: 'OT-01',
        canonical_name: 'OT-01 New Lead Intake',
        provider_workflow_id: '95a6f461-1a04-4260-b379-246fdcc45af7',
        desired_status: 'DRAFT_WAITING_EXTERNAL',
        observed_status: 'DRAFT_SHELL',
      },
      external_readback: {
        status: 'pending_external_readback',
        expected_result_path: GHL_UI_COMPLETE_LAUNCH_RESULT_PATH,
        result_artifact_present: false,
        registry_reconciled_from_result: false,
      },
      boundaries: {
        read_only: true,
        provider_actions_available: false,
        student_contacts_allowed: false,
        live_charges_allowed: false,
      },
    });
    expect(result?.workflow).not.toHaveProperty('essentialValues');
    expect(result?.workflow).not.toHaveProperty('allowedValues');
    expect(result?.workflow).not.toHaveProperty('workflowsAllowedToWrite');
    expect(JSON.stringify(result)).not.toMatch(
      /publication_authorized|enrollment_authorized|https?:\/\//u,
    );
  });

  it('accepts a registered provider ID but fails closed for unknown and oversized identifiers', () => {
    const reader = createWorkflowReadbackReader({ resultArtifactPresent: () => true });
    expect(reader.find('95a6f461-1a04-4260-b379-246fdcc45af7')).toMatchObject({
      workflow: { workflow_key: 'OT-01' },
      external_readback: {
        status: 'artifact_received_registry_readback_required',
        registry_reconciled_from_result: false,
      },
    });
    expect(reader.find('unknown-workflow')).toBeNull();
    expect(reader.find('x'.repeat(161))).toBeNull();
  });
});
