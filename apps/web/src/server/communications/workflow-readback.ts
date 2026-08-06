import { existsSync } from 'node:fs';
import path from 'node:path';
import type {
  WorkflowReadbackListResponse,
  WorkflowReadbackResponse,
} from '../../../../../packages/contracts/src/communications/index.ts';
import {
  canonicalAutomationAssets,
  deprecatedWorkflowRecords,
  workflowRegistryPath,
  type WorkflowRegistryRecord,
} from '../../../../../scripts/highlevel/workflow-registry-source.ts';

export const GHL_UI_COMPLETE_LAUNCH_RESULT_PATH =
  'integrations/highlevel/agent-mode/results/GHL-UI-COMPLETE-LAUNCH-20260805.result.json';

const workflowRecords = [...canonicalAutomationAssets, ...deprecatedWorkflowRecords];

export type WorkflowReadbackReader = {
  list(): WorkflowReadbackListResponse;
  find(workflowId: string): WorkflowReadbackResponse | null;
};

export function createWorkflowReadbackReader(input?: {
  resultArtifactPresent?: (() => boolean) | undefined;
}): WorkflowReadbackReader {
  const resultArtifactPresent =
    input?.resultArtifactPresent ??
    (() => existsSync(path.resolve(process.cwd(), GHL_UI_COMPLETE_LAUNCH_RESULT_PATH)));

  return {
    list() {
      return {
        success: true,
        source_scope: 'repository_workflow_registry',
        workflows: canonicalAutomationAssets
          .toSorted((left, right) => left.displayOrder - right.displayOrder)
          .map((record) => ({
            workflow_key: record.key,
            canonical_name: record.canonicalName,
            purpose: record.purpose,
            asset_kind: record.asset_kind,
            provider_workflow_id: cleanOptional(record.ghlId),
            desired_status: record.desiredStatus,
            observed_status: record.observedStatus,
          })),
        external_readback: {
          expected_result_path: GHL_UI_COMPLETE_LAUNCH_RESULT_PATH,
          result_artifact_present: resultArtifactPresent(),
        },
      };
    },
    find(workflowId) {
      const normalized = workflowId.trim().toLowerCase();
      if (!normalized || normalized.length > 160) return null;
      const record = workflowRecords.find((candidate) => workflowMatches(candidate, normalized));
      return record ? projectWorkflowReadback(record, resultArtifactPresent()) : null;
    },
  };
}

export function projectWorkflowReadback(
  record: WorkflowRegistryRecord,
  resultArtifactPresent: boolean,
): WorkflowReadbackResponse {
  const registryReconciledFromResult =
    resultArtifactPresent &&
    [record.lastReadback.reference, ...record.evidence].includes(
      GHL_UI_COMPLETE_LAUNCH_RESULT_PATH,
    );
  return {
    success: true,
    source_scope: 'repository_workflow_registry',
    workflow: {
      workflow_key: record.key,
      canonical_name: record.canonicalName,
      asset_kind: record.asset_kind,
      asset_lifecycle: record.assetLifecycle,
      purpose: record.purpose,
      folder: record.folder,
      transport: record.transport,
      sender_key: record.senderKey,
      provider_workflow_id: cleanOptional(record.ghlId),
      desired_status: record.desiredStatus,
      observed_status: record.observedStatus,
      exact_trigger: record.exactTrigger,
      exact_ordered_triggers: [...record.exactOrderedTriggers],
      exact_ordered_actions: [...record.exactOrderedActions],
      observed_triggers: [...record.observedTriggers],
      observed_actions: [...record.observedActions],
      provider_contract: record.providerContract
        ? {
            exact_trigger_filter: record.providerContract.exactTriggerFilter,
            ordered_critical_actions: [...record.providerContract.orderedCriticalActions],
            delivery_category: record.providerContract.deliveryCategory,
            sender_key: record.providerContract.senderKey,
          }
        : null,
      last_readback: { ...record.lastReadback },
      canary: { ...record.canary },
      blocker: record.blocker,
      source_material: {
        registry_path: workflowRegistryPath,
        prompt_path: record.promptPath,
        checklist_path: record.checklistPath,
        evidence_paths: [...record.evidence],
      },
    },
    external_readback: {
      status: registryReconciledFromResult
        ? 'reconciled_registry_readback'
        : resultArtifactPresent
          ? 'artifact_received_registry_readback_required'
          : 'pending_external_readback',
      expected_result_path: GHL_UI_COMPLETE_LAUNCH_RESULT_PATH,
      result_artifact_present: resultArtifactPresent,
      registry_reconciled_from_result: registryReconciledFromResult,
    },
    boundaries: {
      read_only: true,
      provider_actions_available: false,
      student_contacts_allowed: false,
      live_charges_allowed: false,
    },
  };
}

function workflowMatches(record: WorkflowRegistryRecord, normalized: string) {
  return [record.key, record.ghlId, record.ghlKey, record.normalizedName, ...record.aliases]
    .filter(Boolean)
    .some((candidate) => candidate.toLowerCase() === normalized);
}

function cleanOptional(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}
