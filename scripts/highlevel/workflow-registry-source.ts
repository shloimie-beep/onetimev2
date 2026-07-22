import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml') as { load(source: string): unknown };

export const workflowRegistryPath = 'integrations/highlevel/registry/workflow-registry.yaml';

export const workflowControlStates = [
  'MISSING',
  'DRAFT_SHELL',
  'DRAFT_WAITING_EXTERNAL',
  'SAVED_REOPENED',
  'ACTIVE_CONFIGURED',
  'ACTIVE_TESTED',
  'DRIFTED',
  'BLOCKED',
] as const;

export type WorkflowControlState = (typeof workflowControlStates)[number];

export type WorkflowFolderNode = {
  order: number;
  name: string;
  children: WorkflowFolderNode[];
};

export type WorkflowRegistryRecord = {
  key: string;
  canonicalName: string;
  normalizedName: string;
  ghlId: string;
  ghlKey: string;
  asset_kind: 'workflow' | 'email_marketing_campaign';
  objectType:
    | 'business_workflow'
    | 'bot_action_workflow'
    | 'deprecated_workflow'
    | 'email_marketing_campaign';
  dataType: 'workflow' | 'campaign';
  category: string;
  folder: string;
  purpose: string;
  sourceOfTruth: 'HighLevel' | 'One Time' | 'Shared';
  allowedValues: string[];
  workflowsAllowedToWrite: string[];
  oneTimeAllowedToWrite: boolean;
  humansMayEdit: boolean;
  dependencies: string[];
  aliases: string[];
  assetLifecycle: 'canonical' | 'deprecated';
  createdDate: string;
  lastVerifiedDate: string;
  lastTestedDate: string;
  promptPath: string;
  checklistPath: string;
  messageClass: string;
  senderKey: 'rabbi_campaign' | 'rabbi_personal' | 'office' | 'brand' | 'account_security';
  transport: 'GHL' | 'Resend';
  exactTrigger: string;
  companionDelivery: string;
  displayOrder: number;
  desiredStatus: WorkflowControlState;
  observedStatus: WorkflowControlState;
  exactOrderedTriggers: string[];
  exactOrderedActions: string[];
  observedTriggers: string[];
  observedActions: string[];
  providerContract?: {
    exactTriggerFilter: string;
    orderedCriticalActions: string[];
    deliveryCategory: string;
    senderKey: string;
  };
  enrollmentReadback?: {
    status: 'unavailable' | 'available';
    at: string | null;
    total: number | null;
    active: number | null;
    reference: string | null;
    reason: string;
  };
  audienceReadback?: {
    status: 'DRAFT_NOT_SENT';
    audienceConfigured: false;
    scheduled: false;
    sends: 0;
    reference: string;
  };
  lastReadback: { at: string; method: string; reference: string };
  canary: {
    result: 'passed' | 'not_run' | 'not_applicable';
    reference: string;
    detail: string;
  };
  blocker: string;
  evidence: string[];
};

export type NonWorkflowAsset = {
  key: string;
  asset_kind: 'conversation_ai_bot' | 'knowledge_base';
  canonicalName: string;
  ghlId: string;
  folder: string;
  desiredStatus: string;
  observedStatus: string;
  lastReadback: { at: string; reference: string };
  evidence: string[];
};

type WorkflowRegistryDocument = {
  workflow_folders: WorkflowFolderNode[];
  business_workflows: WorkflowRegistryRecord[];
  bot_action_workflows: WorkflowRegistryRecord[];
  deprecated_workflows: WorkflowRegistryRecord[];
  non_workflow_assets: NonWorkflowAsset[];
  workflow_control: {
    canonicalDesiredState: string;
    browserMutationAuthority: string;
    closedLoop: string[];
    approvalGates: string[];
    unknownWorkflowPolicy: {
      report: boolean;
      dependencyCheckRequired: boolean;
      quarantineFolder: string;
      quarantineOnlyWhenSafeAndAuthorized: boolean;
      silentlyDelete: boolean;
    };
    allowed_states: WorkflowControlState[];
    generated_report: string;
    observed_evidence: string[];
  };
};

export const workflowRegistrySource = loadWorkflowRegistry();
export const workflowFolderTree = workflowRegistrySource.workflow_folders;
export const workflowControlPolicy = workflowRegistrySource.workflow_control;
export const businessWorkflowRecords = workflowRegistrySource.business_workflows;
export const botActionWorkflowRecords = workflowRegistrySource.bot_action_workflows;
export const deprecatedWorkflowRecords = workflowRegistrySource.deprecated_workflows;
export const nonWorkflowAssets = workflowRegistrySource.non_workflow_assets;
export const canonicalAutomationAssets = [...businessWorkflowRecords, ...botActionWorkflowRecords];
export const canonicalWorkflowAssets = canonicalAutomationAssets.filter(
  (asset) => asset.asset_kind === 'workflow',
);
export const canonicalCampaignAssets = canonicalAutomationAssets.filter(
  (asset) => asset.asset_kind === 'email_marketing_campaign',
);

function loadWorkflowRegistry(): WorkflowRegistryDocument {
  const absolute = path.join(process.cwd(), workflowRegistryPath);
  const parsed = yaml.load(readFileSync(absolute, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('workflow_registry_yaml_invalid');
  }
  const document = parsed as Partial<WorkflowRegistryDocument>;
  if (
    !Array.isArray(document.workflow_folders) ||
    !Array.isArray(document.business_workflows) ||
    !Array.isArray(document.bot_action_workflows) ||
    !Array.isArray(document.deprecated_workflows) ||
    !Array.isArray(document.non_workflow_assets) ||
    !document.workflow_control
  ) {
    throw new Error('workflow_registry_yaml_missing_required_sections');
  }
  validateFolders(document.workflow_folders);
  const records = [
    ...document.business_workflows,
    ...document.bot_action_workflows,
    ...document.deprecated_workflows,
  ];
  const keys = new Set<string>();
  for (const record of records) {
    if (!record.key || keys.has(record.key))
      throw new Error(`workflow_registry_duplicate:${record.key}`);
    keys.add(record.key);
    if (!workflowControlStates.includes(record.desiredStatus)) {
      throw new Error(`workflow_registry_desired_status_invalid:${record.key}`);
    }
    if (!workflowControlStates.includes(record.observedStatus)) {
      throw new Error(`workflow_registry_observed_status_invalid:${record.key}`);
    }
  }
  if (document.workflow_control.allowed_states.join('|') !== workflowControlStates.join('|')) {
    throw new Error('workflow_registry_control_states_drift');
  }
  return document as WorkflowRegistryDocument;
}

function validateFolders(folders: WorkflowFolderNode[], parent = 'One Time') {
  const seen = new Set<string>();
  for (const folder of folders) {
    if (!Number.isInteger(folder.order) || !folder.name || !Array.isArray(folder.children)) {
      throw new Error(`workflow_registry_folder_invalid:${parent}`);
    }
    if (seen.has(folder.name))
      throw new Error(`workflow_registry_folder_duplicate:${parent}/${folder.name}`);
    seen.add(folder.name);
    validateFolders(folder.children, `${parent}/${folder.name}`);
  }
}
