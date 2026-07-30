import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalTextForHash } from '../ops/canonical-text.ts';
import {
  botActionWorkflows,
  businessWorkflows,
  campaignAssets,
  communicationsContract,
  contactFields,
  customValues,
  eventDefinitions,
  messageClasses,
  protectedImportPaths,
  registryMetadata,
  senderProfiles,
  tags,
  workflowFolderTree,
  workflows,
  type RegistryCustomValue,
  type RegistryField,
  type RegistryMessageClass,
  type RegistryPipeline,
  type RegistrySender,
  type RegistryTag,
  type RegistryWorkflow,
} from './canonical-registry-data.ts';
import { workflowControlPolicy, workflowControlStates } from './workflow-control-registry.ts';

type CurrentRegistry = {
  schema_id: string;
  schema_version: string;
  status: string;
  location_id: string;
  counts: Record<string, number>;
  contact_fields: RegistryField[];
  tags: RegistryTag[];
  custom_values: RegistryCustomValue[];
  sender_profiles: RegistrySender[];
  message_classes: RegistryMessageClass[];
  pipelines: RegistryPipeline[];
  events: typeof eventDefinitions;
  communications_contract: typeof communicationsContract;
  workflow_control: {
    allowedStates: readonly string[];
    canonicalDesiredState: string;
    closedLoop: readonly string[];
    approvalGates: readonly string[];
    unknownWorkflowPolicy: {
      report: boolean;
      dependencyCheckRequired: boolean;
      quarantineFolder: string;
      quarantineOnlyWhenSafeAndAuthorized: boolean;
      silentlyDelete: boolean;
    };
  };
  business_workflows: RegistryWorkflow[];
  bot_action_workflows: RegistryWorkflow[];
  deprecated_workflows: RegistryWorkflow[];
  prompts: PromptRecord[];
  knowledge_bases: PromptRecord[];
  protected_import_paths: typeof protectedImportPaths;
  safety: Record<string, boolean | number>;
};

type PromptRecord = {
  prompt_id: string;
  status: string;
  file_path: string;
  sha256: string;
  required_fields: string[];
  required_tags: string[];
  required_custom_values: string[];
  required_workflows: string[];
  required_sender_keys: string[];
  required_message_classes: string[];
};

type AgentModeQueue = {
  schema_version: string;
  repository: string;
  registry_schema: string;
  location_id: string;
  pinned_registry_commit_source: string;
  safety_defaults: {
    messages_sent: number;
    workflows_published: number;
    no_send: boolean;
    no_publish: boolean;
  };
  ordered_jobs: Array<{
    job_id: string;
    order: number;
    title: string;
    job_file: string;
  }>;
};

type Check = { name: string; status: 'passed' | 'failed'; detail: string };

const repoRoot = process.cwd();
const checks: Check[] = [];

await main();

async function main() {
  const current = await readJson<CurrentRegistry>('integrations/highlevel/registry/current.json');
  const queue = await readJson<AgentModeQueue>(
    'integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json',
  );

  record(
    'registry schema validation',
    current.schema_id === registryMetadata.schemaId &&
      current.schema_version === registryMetadata.schemaVersion &&
      current.status === registryMetadata.status &&
      current.location_id === registryMetadata.locationId,
    `${current.schema_id}@${current.schema_version}/${current.status}`,
  );
  record(
    'duplicate normalized field-name check',
    duplicates(current.contact_fields.map((field) => field.normalizedName)).length === 0,
    duplicateDetail(current.contact_fields.map((field) => field.normalizedName)),
  );
  record(
    'duplicate tag check',
    duplicates(current.tags.map((tag) => tag.normalizedName)).length === 0,
    duplicateDetail(current.tags.map((tag) => tag.normalizedName)),
  );
  record(
    'duplicate custom-value check',
    duplicates(current.custom_values.map((value) => value.normalizedName)).length === 0,
    duplicateDetail(current.custom_values.map((value) => value.normalizedName)),
  );
  record(
    'duplicate sender detection',
    duplicates(current.sender_profiles.map((sender) => sender.key)).length === 0,
    duplicateDetail(current.sender_profiles.map((sender) => sender.key)),
  );
  record(
    'duplicate message-class detection',
    duplicates(current.message_classes.map((messageClass) => messageClass.key)).length === 0,
    duplicateDetail(current.message_classes.map((messageClass) => messageClass.key)),
  );
  record(
    'duplicate pipeline detection',
    duplicates(current.pipelines.map((pipeline) => pipeline.canonicalName)).length === 0 &&
      current.pipelines.every(
        (pipeline) => duplicates(pipeline.stages.map((stage) => stage.name)).length === 0,
      ),
    duplicatePipelineDetail(current.pipelines),
  );
  record(
    'message-class coverage validation',
    messageClassCoverageExists(current),
    `senders=${current.sender_profiles.length}, message_classes=${current.message_classes.length}`,
  );
  record(
    'workflow sender dependency validation',
    workflowSenderDependenciesExist(current),
    `canonical_automation_assets=${current.business_workflows.length + current.bot_action_workflows.length}`,
  );
  record(
    'GitHub workflow control contract',
    workflowControlIsValid(current),
    `canonical=${current.business_workflows.length + current.bot_action_workflows.length}, root_folders=${workflowFolderTree.length}`,
  );
  record(
    'sender custom-value coverage',
    senderCustomValuesExist(current),
    'all registered GHL sender profiles resolve exact picker values; compatibility aliases are preserved',
  );
  record(
    'student field/tag exclusion',
    !current.contact_fields.some((field) => /student/i.test(field.canonicalName)) &&
      !current.tags.some((tag) => /student/i.test(tag.canonicalName)),
    'no Student custom fields or tags are active in HighLevel registry',
  );
  record(
    'workflow semantic-overlap check',
    workflowClassificationsMatchCanonicalSource(current),
    `business=${current.business_workflows.length}, bot_actions=${current.bot_action_workflows.length}`,
  );
  record(
    'stale bot reference check',
    current.prompts.filter((prompt) => prompt.prompt_id === 'OT-A1' && prompt.status === 'active')
      .length === 1,
    'exactly one active OT-A1 prompt',
  );
  record(
    'prompt dependency check',
    promptDependenciesExist(current),
    'prompt required fields/tags/custom values/workflows resolve in registry',
  );
  record(
    'workflow prompt sender dependency check',
    await workflowPromptSenderDependenciesExist(current),
    'every workflow prompt/checklist declares exact workflow, folder, trigger, message_class, sender_key, no-send/no-publish default, registry dependency, and exact picker values',
  );
  record(
    'Agent Mode queue validation',
    await agentModeQueueIsValid(queue),
    `schema=${queue.schema_version}, jobs=${queue.ordered_jobs.length}`,
  );
  record(
    'communications contract validation',
    JSON.stringify(current.communications_contract) === JSON.stringify(communicationsContract) &&
      current.events.length === eventDefinitions.length,
    'source-of-truth, ownership, Resend, Telegram, event, and no-send boundaries are canonical',
  );
  record(
    'prompt sha check',
    await promptHashesMatch(current),
    'prompt and knowledge-base SHA-256 records match formatted files',
  );

  const activeText = await readActiveText(current);
  record(
    'public URL check',
    publicUrlsAreCanonical(current) && activeText.includes('https://join.onetimeonetime.com/login'),
    'active URLs use join.onetimeonetime.com or blocked unresolved empty values',
  );
  record(
    'forbidden placeholder custom values',
    !current.custom_values.some((value) => hasForbiddenPlaceholder(value.value)),
    'no PENDING_, TODO or CHANGEME custom values are exported',
  );
  record(
    'old route/reference scan',
    !hasUncorrectedOldReferences(activeText),
    'old password route, raw Vimeo/Zoom and hardcoded price are absent as active instructions',
  );
  record(
    'old lowercase tag scan',
    !lowercaseTagsInActiveText(activeText),
    'lowercase tag family appears only in deprecations/correction reports',
  );
  record(
    'human task boundary',
    current.safety.human_task_creation_active === false &&
      Number(current.safety.messages_sent) === 0,
    'human task workflows active = 0, messages sent = 0',
  );
  record(
    'canonical asset count convergence',
    current.contact_fields.length === contactFields.length &&
      current.tags.length === tags.length &&
      current.custom_values.length === customValues.length &&
      workflows.length ===
        current.business_workflows.length +
          current.bot_action_workflows.length +
          current.deprecated_workflows.length,
    `fields=${current.contact_fields.length}, tags=${current.tags.length}, custom_values=${current.custom_values.length}`,
  );
  record(
    'import reconciliation paths recorded',
    current.protected_import_paths.manifest === protectedImportPaths.manifest &&
      current.protected_import_paths.contactMap === protectedImportPaths.contactMap,
    'protected import manifest and map paths are registered without contents',
  );

  const failed = checks.filter((check) => check.status === 'failed');
  writeStdoutJson({ status: failed.length === 0 ? 'passed' : 'failed', checks });
  if (failed.length > 0) process.exitCode = 1;
}

async function readActiveText(current: CurrentRegistry) {
  const activePromptRecords = current.prompts.filter((prompt) => prompt.status === 'active');
  const knowledgeBaseRecords = current.knowledge_bases.filter(
    (prompt) => prompt.status === 'active',
  );
  const files = [
    'integrations/highlevel/prompts/active/OT-A1-v1.0.0.md',
    'integrations/highlevel/knowledge-bases/active/one-time-public-kb-v1.0.0.md',
    ...[...businessWorkflows, ...botActionWorkflows].map((workflow) => workflow.promptPath),
  ];
  record(
    'active prompt registry coverage',
    activePromptRecords.length >= 1 && knowledgeBaseRecords.length === 1,
    `active_prompts=${activePromptRecords.length}, active_knowledge_bases=${knowledgeBaseRecords.length}`,
  );
  return (await Promise.all(files.map((filePath) => readText(filePath)))).join('\n---\n');
}

function promptDependenciesExist(current: CurrentRegistry) {
  const fields = new Set(current.contact_fields.map((field) => field.canonicalName));
  const tagNames = new Set(current.tags.map((tag) => tag.canonicalName));
  const customValueNames = new Set(current.custom_values.map((value) => value.canonicalName));
  const workflowKeys = new Set(
    [...current.business_workflows, ...current.bot_action_workflows].map(
      (workflow) => workflow.key,
    ),
  );
  const senderKeys = new Set<string>(current.sender_profiles.map((sender) => sender.key));
  const messageClassKeys = new Set(current.message_classes.map((messageClass) => messageClass.key));
  return [...current.prompts, ...current.knowledge_bases].every(
    (record) =>
      record.required_fields.every((name) => fields.has(name)) &&
      record.required_tags.every((name) => tagNames.has(name)) &&
      record.required_custom_values.every((name) => customValueNames.has(name)) &&
      record.required_workflows.every((key) => workflowKeys.has(key)) &&
      record.required_sender_keys.every((key) => senderKeys.has(key)) &&
      record.required_message_classes.every((key) => messageClassKeys.has(key)),
  );
}

function messageClassCoverageExists(current: CurrentRegistry) {
  const senderByKey = new Map(current.sender_profiles.map((sender) => [sender.key, sender]));
  const workflowByKey = new Map(
    [
      ...current.business_workflows,
      ...current.bot_action_workflows,
      ...current.deprecated_workflows,
    ].map((workflow) => [workflow.key, workflow]),
  );
  return (
    current.sender_profiles.length === senderProfiles.length &&
    current.message_classes.length === messageClasses.length &&
    current.message_classes.every((messageClass) => {
      const sender = senderByKey.get(messageClass.senderKey);
      return (
        sender?.messageClasses.includes(messageClass.key) === true &&
        messageClass.allowedWorkflows.every((key) => {
          const workflow = workflowByKey.get(key);
          return (
            workflow?.messageClass === messageClass.key &&
            workflow.senderKey === messageClass.senderKey &&
            workflow.transport === messageClass.transport
          );
        }) &&
        (messageClass.securityTokensAllowed
          ? messageClass.senderKey === 'account_security' && messageClass.transport === 'Resend'
          : messageClass.senderKey !== 'account_security')
      );
    })
  );
}

function workflowSenderDependenciesExist(current: CurrentRegistry) {
  const senderKeys = new Set(current.sender_profiles.map((sender) => sender.key));
  const messageClassByKey = new Map(
    current.message_classes.map((messageClass) => [messageClass.key, messageClass]),
  );
  return [...current.business_workflows, ...current.bot_action_workflows].every((workflow) => {
    const messageClass = messageClassByKey.get(workflow.messageClass);
    return (
      senderKeys.has(workflow.senderKey) &&
      messageClass?.senderKey === workflow.senderKey &&
      messageClass.transport === workflow.transport &&
      messageClass.allowedWorkflows.includes(workflow.key) &&
      Boolean(workflow.exactTrigger)
    );
  });
}

function workflowControlIsValid(current: CurrentRegistry) {
  const canonical = [...current.business_workflows, ...current.bot_action_workflows];
  const expectedCanonical = [...businessWorkflows, ...botActionWorkflows];
  const allowedStates = new Set<string>(workflowControlStates);
  const ids = canonical.map((workflow) => workflow.ghlId).filter(Boolean);
  const orders = canonical.map((workflow) => workflow.displayOrder);
  const folders = new Set(flattenFolderPaths(workflowFolderTree));
  return (
    current.workflow_control.canonicalDesiredState ===
      workflowControlPolicy.canonicalDesiredState &&
    JSON.stringify(current.workflow_control.allowedStates) ===
      JSON.stringify(workflowControlStates) &&
    JSON.stringify(current.workflow_control.closedLoop) ===
      JSON.stringify(workflowControlPolicy.closedLoop) &&
    JSON.stringify(current.workflow_control.approvalGates) ===
      JSON.stringify(workflowControlPolicy.approvalGates) &&
    current.workflow_control.unknownWorkflowPolicy.report === true &&
    current.workflow_control.unknownWorkflowPolicy.dependencyCheckRequired === true &&
    current.workflow_control.unknownWorkflowPolicy.quarantineFolder === '99 - Deprecated' &&
    current.workflow_control.unknownWorkflowPolicy.quarantineOnlyWhenSafeAndAuthorized === true &&
    current.workflow_control.unknownWorkflowPolicy.silentlyDelete === false &&
    canonical.length === expectedCanonical.length &&
    canonical.filter((asset) => asset.asset_kind === 'workflow').length ===
      expectedCanonical.filter((asset) => asset.asset_kind === 'workflow').length &&
    canonical.filter((asset) => asset.asset_kind === 'email_marketing_campaign').length ===
      expectedCanonical.filter((asset) => asset.asset_kind === 'email_marketing_campaign').length &&
    campaignAssets.length ===
      expectedCanonical.filter((asset) => asset.asset_kind === 'email_marketing_campaign').length &&
    JSON.stringify(canonical.map((workflow) => workflow.key)) ===
      JSON.stringify(expectedCanonical.map((workflow) => workflow.key)) &&
    JSON.stringify(canonical) === JSON.stringify(expectedCanonical) &&
    canonical.every((workflow) =>
      workflow.observedStatus === 'MISSING' ? !workflow.ghlId : Boolean(workflow.ghlId),
    ) &&
    duplicates(ids).length === 0 &&
    duplicates(orders.map(String)).length === 0 &&
    canonical.every(
      (workflow) =>
        workflow.assetLifecycle === 'canonical' &&
        (workflow.asset_kind === 'email_marketing_campaign'
          ? workflow.folder === 'Marketing / Email Campaigns / Home'
          : folders.has(workflow.folder) ||
            (workflow.folder.startsWith('One Time / ') &&
              folders.has(workflow.folder.slice('One Time / '.length)))) &&
        allowedStates.has(workflow.desiredStatus) &&
        allowedStates.has(workflow.observedStatus) &&
        workflow.exactOrderedTriggers.length > 0 &&
        workflow.exactOrderedActions.length > 0 &&
        (Boolean(workflow.providerContract) || Boolean(workflow.essentialValues)) &&
        Boolean(workflow.lastReadback.at) &&
        Boolean(workflow.lastReadback.reference) &&
        Boolean(workflow.canary.result) &&
        workflow.evidence.length > 0,
    ) &&
    canonical.find((workflow) => workflow.key === 'OT-C01')?.asset_kind ===
      'email_marketing_campaign' &&
    canonical.find((workflow) => workflow.key === 'OT-C01')?.audienceReadback?.sends === 0
  );
}

function workflowClassificationsMatchCanonicalSource(current: CurrentRegistry) {
  const actualBusinessKeys = current.business_workflows.map((workflow) => workflow.key);
  const actualBotActionKeys = current.bot_action_workflows.map((workflow) => workflow.key);
  const actualDeprecatedKeys = current.deprecated_workflows.map((workflow) => workflow.key);
  const allActualKeys = [...actualBusinessKeys, ...actualBotActionKeys, ...actualDeprecatedKeys];
  return (
    JSON.stringify(actualBusinessKeys) ===
      JSON.stringify(businessWorkflows.map((workflow) => workflow.key)) &&
    JSON.stringify(actualBotActionKeys) ===
      JSON.stringify(botActionWorkflows.map((workflow) => workflow.key)) &&
    duplicates(allActualKeys).length === 0
  );
}

function flattenFolderPaths(folders: typeof workflowFolderTree, parent = ''): string[] {
  return folders.flatMap((folder) => {
    const current = parent ? `${parent} / ${folder.name}` : folder.name;
    return [current, ...flattenFolderPaths(folder.children, current)];
  });
}

function senderCustomValuesExist(current: CurrentRegistry) {
  const customValueNames = new Set(current.custom_values.map((value) => value.canonicalName));
  const required = [
    'One Time Rabbi Campaign Sender Name',
    'One Time Rabbi Campaign Phase 1 From',
    'One Time Rabbi Campaign Phase 2 From',
    'One Time Rabbi Personal Sender Name',
    'One Time Rabbi Personal From',
    'One Time Rabbi Reply-To',
    'One Time Office Sender Name',
    'One Time Office From',
    'One Time Brand Sender Name',
    'One Time Brand From',
    'One Time Account Sender Name',
    'One Time Account Preferred From',
    'One Time Default Reply-To',
  ];
  const aliases = ['One Time Sender Name', 'One Time Sender Email', 'One Time Reply-To Email'];
  return (
    required.every((name) => customValueNames.has(name)) &&
    aliases.every((name) => {
      const value = current.custom_values.find((candidate) => candidate.canonicalName === name);
      return (
        value?.deprecationState === 'deprecated_existing' &&
        value.aliases.includes('compatibility_alias')
      );
    })
  );
}

async function workflowPromptSenderDependenciesExist(current: CurrentRegistry) {
  const active = [...current.business_workflows, ...current.bot_action_workflows];
  for (const workflow of active) {
    const prompt = await readText(workflow.promptPath);
    const checklist = await readText(workflow.checklistPath);
    const combined = `${prompt}\n${checklist}`;
    const required = [
      `Exact workflow: ${workflow.canonicalName}`,
      `Folder: ${workflow.folder}`,
      `Exact trigger: ${workflow.exactTrigger}`,
      `message_class: ${workflow.messageClass}`,
      `sender_key: ${workflow.senderKey}`,
      'sender-registry.yaml',
      'message-class-registry.yaml',
      'Do not publish',
      'Do not type or guess sender',
    ];
    if (!required.every((text) => combined.includes(text))) return false;
  }
  return true;
}

async function agentModeQueueIsValid(queue: AgentModeQueue) {
  const expectedTitles = [
    'create sender custom-value folder',
    'reconcile sender values',
    'create or reconcile pipelines',
    'update workflow sender identities',
    'update OT-A1',
    'verify sending domain',
    'phase-1 seed',
    'office seed',
    'brand seed',
    'capture workflow IDs',
    'capture pipeline IDs',
    'save and readback verification',
    'phase-2 rabbi acceptance',
  ];
  if (
    queue.schema_version !== '1.1.0' ||
    queue.repository !== 'shloimie-beep/onetimev2' ||
    queue.registry_schema !== `${registryMetadata.schemaId}@${registryMetadata.schemaVersion}` ||
    queue.location_id !== registryMetadata.locationId ||
    queue.pinned_registry_commit_source !==
      'integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md' ||
    queue.safety_defaults.messages_sent !== 0 ||
    queue.safety_defaults.workflows_published !== 0 ||
    !queue.safety_defaults.no_send ||
    !queue.safety_defaults.no_publish ||
    queue.ordered_jobs.length !== expectedTitles.length
  ) {
    return false;
  }
  for (let index = 0; index < queue.ordered_jobs.length; index += 1) {
    const entry = queue.ordered_jobs[index];
    if (entry?.order !== index + 1 || entry.title !== expectedTitles[index]) return false;
    const job = await readJson<Record<string, unknown>>(entry.job_file);
    const prompt = String(job.exact_copy_paste_prompt ?? '');
    const defaults = job.defaults as Record<string, unknown> | undefined;
    if (
      !prompt.includes('immutable Commit A registry SHA') ||
      !prompt.includes('Click Save') ||
      !prompt.includes('reopening or reading the saved state') ||
      !prompt.includes('Return to the BNA Agent Action drop-off page') ||
      !prompt.includes('Verify the readback result ID') ||
      !prompt.includes('Never finish with an unsaved chat-only claim') ||
      defaults?.no_send !== true ||
      defaults?.no_publish !== true
    ) {
      return false;
    }
  }
  return true;
}

function duplicatePipelineDetail(pipelines: RegistryPipeline[]) {
  const pipelineDuplicates = duplicates(pipelines.map((pipeline) => pipeline.canonicalName));
  const stageDuplicates = pipelines.flatMap((pipeline) =>
    duplicates(pipeline.stages.map((stage) => stage.name)).map(
      (stage) => `${pipeline.canonicalName}:${stage}`,
    ),
  );
  const all = [...pipelineDuplicates, ...stageDuplicates];
  return all.length ? all.join(', ') : 'none';
}

async function promptHashesMatch(current: CurrentRegistry) {
  const records = [...current.prompts, ...current.knowledge_bases];
  for (const record of records) {
    const body = await readText(record.file_path);
    if (sha256(body) !== record.sha256) return false;
  }
  return true;
}

function publicUrlsAreCanonical(current: CurrentRegistry) {
  return current.custom_values
    .filter((value) => value.dataType === 'URL')
    .every(
      (value) =>
        value.value.startsWith('https://join.onetimeonetime.com') ||
        (value.value === '' && value.deprecationState === 'blocked_ui_or_business_value'),
    );
}

function hasForbiddenPlaceholder(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized.startsWith('PENDING_') || normalized === 'TODO' || normalized === 'CHANGEME';
}

function hasUncorrectedOldReferences(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes('$67')) return true;
  if (
    /raw\s+vimeo\s+(url|link)/.test(lower) &&
    !/(never\s+expose\s+raw\s+vimeo|do\s+not\s+expose\s+raw\s+vimeo|never\s+through\s+raw\s+vimeo)/.test(
      lower,
    )
  ) {
    return true;
  }
  if (
    /raw\s+zoom\s+link/.test(lower) &&
    !/(never\s+(return|store|send)\s+.*raw\s+zoom|do\s+not\s+expose\s+raw\s+zoom)/.test(lower)
  ) {
    return true;
  }
  const oldRoute = '/api/one-time/parent-password/request';
  const routeIndex = lower.indexOf(oldRoute);
  if (routeIndex === -1) return false;
  const context = lower.slice(Math.max(0, routeIndex - 120), routeIndex + oldRoute.length + 120);
  return !/(do not call|forbidden|obsolete)/.test(context);
}

function lowercaseTagsInActiveText(text: string) {
  return [
    'one-time-bot',
    'one-time-signup-request',
    'one-time-signup-submitted',
    'one-time-signup-confirmed',
    'one-time-class-link-request',
    'one-time-password-reset',
    'one-time-human-handoff',
    'one-time-opt-out',
  ].some((tag) => text.includes(tag));
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return Array.from(repeated).sort();
}

function duplicateDetail(values: string[]) {
  const dupes = duplicates(values);
  return dupes.length ? dupes.join(', ') : 'none';
}

function record(name: string, passed: boolean, detail: string) {
  checks.push({ name, status: passed ? 'passed' : 'failed', detail });
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readText(filePath)) as T;
}

async function readText(filePath: string) {
  return readFile(path.join(repoRoot, filePath), 'utf8');
}

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value: string) {
  return createHash('sha256').update(canonicalTextForHash(value)).digest('hex');
}
