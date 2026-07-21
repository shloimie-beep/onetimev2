import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  botActionWorkflows,
  businessWorkflows,
  contactFields,
  customValues,
  protectedImportPaths,
  registryMetadata,
  tags,
  workflows,
  type RegistryCustomValue,
  type RegistryField,
  type RegistryTag,
  type RegistryWorkflow,
} from './canonical-registry-data.ts';

type CurrentRegistry = {
  schema_id: string;
  schema_version: string;
  status: string;
  location_id: string;
  counts: Record<string, number>;
  contact_fields: RegistryField[];
  tags: RegistryTag[];
  custom_values: RegistryCustomValue[];
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
};

type Check = { name: string; status: 'passed' | 'failed'; detail: string };

const repoRoot = process.cwd();
const checks: Check[] = [];

await main();

async function main() {
  const current = await readJson<CurrentRegistry>('integrations/highlevel/registry/current.json');

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
    'student field/tag exclusion',
    !current.contact_fields.some((field) => /student/i.test(field.canonicalName)) &&
      !current.tags.some((tag) => /student/i.test(tag.canonicalName)),
    'no Student custom fields or tags are active in HighLevel registry',
  );
  record(
    'workflow semantic-overlap check',
    current.business_workflows.every((workflow) => !['OT-11', 'OT-12'].includes(workflow.key)) &&
      current.bot_action_workflows.length === botActionWorkflows.length &&
      current.business_workflows.length === businessWorkflows.length,
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
  return [...current.prompts, ...current.knowledge_bases].every(
    (record) =>
      record.required_fields.every((name) => fields.has(name)) &&
      record.required_tags.every((name) => tagNames.has(name)) &&
      record.required_custom_values.every((name) => customValueNames.has(name)) &&
      record.required_workflows.every((key) => workflowKeys.has(key)),
  );
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
  return (
    normalized.startsWith('PENDING_') ||
    normalized === 'TODO' ||
    normalized === 'CHANGEME'
  );
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
  return createHash('sha256').update(canonicalHashText(value)).digest('hex');
}

function canonicalHashText(value: string) {
  return value.replace(/\r\n/g, '\n');
}
