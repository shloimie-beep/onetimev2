import {
  canonicalAutomationAssets,
  deprecatedWorkflowRecords,
  workflowControlPolicy,
  workflowControlStates,
  workflowFolderTree,
  type WorkflowControlState,
  type WorkflowRegistryRecord,
} from './workflow-registry-source.ts';

export {
  workflowControlPolicy,
  workflowControlStates,
  workflowFolderTree,
  type WorkflowControlState,
};

export type WorkflowControlBinding = Pick<
  WorkflowRegistryRecord,
  | 'folder'
  | 'displayOrder'
  | 'ghlId'
  | 'desiredStatus'
  | 'observedStatus'
  | 'exactOrderedTriggers'
  | 'exactOrderedActions'
  | 'observedTriggers'
  | 'observedActions'
  | 'lastReadback'
  | 'canary'
  | 'blocker'
  | 'evidence'
  | 'providerContract'
  | 'enrollmentReadback'
>;

export const workflowControlByKey = Object.fromEntries(
  [...canonicalAutomationAssets, ...deprecatedWorkflowRecords].map((workflow) => [
    workflow.key,
    {
      folder: workflow.folder,
      displayOrder: workflow.displayOrder,
      ghlId: workflow.ghlId,
      desiredStatus: workflow.desiredStatus,
      observedStatus: workflow.observedStatus,
      exactOrderedTriggers: workflow.exactOrderedTriggers,
      exactOrderedActions: workflow.exactOrderedActions,
      observedTriggers: workflow.observedTriggers,
      observedActions: workflow.observedActions,
      lastReadback: workflow.lastReadback,
      canary: workflow.canary,
      blocker: workflow.blocker,
      evidence: workflow.evidence,
      ...(workflow.providerContract ? { providerContract: workflow.providerContract } : {}),
      ...(workflow.enrollmentReadback ? { enrollmentReadback: workflow.enrollmentReadback } : {}),
    },
  ]),
) satisfies Record<string, WorkflowControlBinding>;
