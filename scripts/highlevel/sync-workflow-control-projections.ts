import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import { canonicalTextForHash } from '../ops/canonical-text.ts';
import { promptFingerprint } from './prompt-fingerprint.ts';
import {
  businessWorkflowRecords,
  botActionWorkflowRecords,
  canonicalCampaignAssets,
  canonicalWorkflowAssets,
  deprecatedWorkflowRecords,
  nonWorkflowAssets,
  workflowControlPolicy,
  workflowFolderTree,
  workflowRoot,
  workflowRegistryPath,
} from './workflow-registry-source.ts';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml') as {
  dump(value: unknown, options?: Record<string, unknown>): string;
  load(value: string): unknown;
};

const repoRoot = process.cwd();
const currentPath = 'integrations/highlevel/registry/current.json';
const manifestPath = 'integrations/highlevel/workflows.yaml';
const customValuesPath = 'integrations/highlevel/registry/custom-values.yaml';
const senderProfilesPath = 'integrations/highlevel/registry/sender-registry.yaml';
const messageClassesPath = 'integrations/highlevel/registry/message-class-registry.yaml';
const write = process.argv.includes('--write');
const [customValues, senderProfiles, messageClasses] = await Promise.all([
  readYamlArray(customValuesPath),
  readYamlArray(senderProfilesPath),
  readYamlArray(messageClassesPath),
]);
const registryText = await readFile(path.join(repoRoot, workflowRegistryPath), 'utf8');
const sourceSha256 = createHash('sha256').update(canonicalTextForHash(registryText)).digest('hex');
const projectionMetadata = {
  generated_from: workflowRegistryPath,
  source_sha256: sourceSha256,
  editable: false,
};

const currentOriginal = await readFile(path.join(repoRoot, currentPath), 'utf8');
const currentPrettierConfig = (await resolveConfig(path.join(repoRoot, currentPath))) ?? {};
const currentExpected = await format(await buildCurrentProjection(currentOriginal), {
  ...currentPrettierConfig,
  filepath: currentPath,
});
const manifestOriginal = await readFile(path.join(repoRoot, manifestPath), 'utf8');
const manifestPrettierConfig = (await resolveConfig(path.join(repoRoot, manifestPath))) ?? {};
const manifestExpected = await format(buildManifestProjection(manifestOriginal), {
  ...manifestPrettierConfig,
  filepath: manifestPath,
});

if (write) {
  await writeFile(path.join(repoRoot, currentPath), currentExpected, 'utf8');
  await writeFile(path.join(repoRoot, manifestPath), manifestExpected, 'utf8');
}

const currentMatches = normalizeText(currentOriginal) === normalizeText(currentExpected);
const manifestMatches = normalizeText(manifestOriginal) === normalizeText(manifestExpected);
const passed = write || (currentMatches && manifestMatches);

process.stdout.write(
  `${JSON.stringify(
    {
      status: passed ? 'passed' : 'failed',
      generated_from: workflowRegistryPath,
      source_sha256: sourceSha256,
      canonical_workflows: canonicalWorkflowAssets.length,
      canonical_campaigns: canonicalCampaignAssets.length,
      non_workflow_assets: nonWorkflowAssets.length,
      current_matches: write ? true : currentMatches,
      manifest_matches: write ? true : manifestMatches,
      current_first_difference_line: currentMatches
        ? null
        : firstDifferenceLine(currentOriginal, currentExpected),
      manifest_first_difference_line: manifestMatches
        ? null
        : firstDifferenceLine(manifestOriginal, manifestExpected),
    },
    null,
    2,
  )}\n`,
);

if (!passed) process.exitCode = 1;

async function buildCurrentProjection(source: string) {
  const parsed = JSON.parse(source) as {
    counts: Record<string, number>;
    prompts: PromptProjectionRecord[];
  };
  let output = source;
  output = replaceJsonProperty(output, 'counts', 'standard_contact_fields', {
    ...parsed.counts,
    custom_values: customValues.length,
    active_custom_values: customValues.filter((value) => value.deprecationState === 'active')
      .length,
    blocked_custom_values: customValues.filter(
      (value) => value.deprecationState === 'blocked_ui_or_business_value',
    ).length,
    business_workflows: businessWorkflowRecords.length,
    bot_action_workflows: botActionWorkflowRecords.length,
    deprecated_workflows: deprecatedWorkflowRecords.length,
    workflow_assets: canonicalWorkflowAssets.length,
    campaign_assets: canonicalCampaignAssets.length,
    non_workflow_assets: nonWorkflowAssets.length,
  });
  output = replaceJsonProperty(output, 'custom_values', 'sender_profiles', customValues);
  output = replaceJsonProperty(output, 'sender_profiles', 'message_classes', senderProfiles);
  output = replaceJsonProperty(output, 'message_classes', 'pipelines', messageClasses);
  output = replaceJsonProperty(
    output,
    'business_workflows',
    'bot_action_workflows',
    businessWorkflowRecords,
  );
  output = replaceJsonProperty(
    output,
    'bot_action_workflows',
    'deprecated_workflows',
    botActionWorkflowRecords,
  );
  output = replaceJsonProperty(
    output,
    'deprecated_workflows',
    'prompts',
    deprecatedWorkflowRecords,
  );
  output = upsertJsonProperty(
    output,
    'workflow_projection',
    'workflow_control',
    projectionMetadata,
  );
  output = replaceJsonProperty(output, 'workflow_control', null, {
    canonicalDesiredState: workflowControlPolicy.canonicalDesiredState,
    browserMutationAuthority: workflowControlPolicy.browserMutationAuthority,
    closedLoop: workflowControlPolicy.closedLoop,
    approvalGates: workflowControlPolicy.approvalGates,
    unknownWorkflowPolicy: workflowControlPolicy.unknownWorkflowPolicy,
    allowedStates: workflowControlPolicy.allowed_states,
    controlReport: workflowControlPolicy.generated_report,
  });
  output = replaceJsonProperty(
    output,
    'prompts',
    'knowledge_bases',
    await refreshPromptFingerprints(parsed.prompts),
  );
  return ensureTrailingNewline(output);
}

type PromptProjectionRecord = {
  file_path: string;
  sha256: string;
  [key: string]: unknown;
};

async function refreshPromptFingerprints(records: PromptProjectionRecord[]) {
  return Promise.all(
    records.map(async (record) => ({
      ...record,
      sha256: promptFingerprint(await readFile(path.join(repoRoot, record.file_path), 'utf8')),
    })),
  );
}

function buildManifestProjection(source: string) {
  const customValuesBlock = dumpYaml({ custom_values: customValues });
  const senderProfilesBlock = dumpYaml({ sender_profiles: senderProfiles });
  const messageClassesBlock = dumpYaml({ message_classes: messageClasses });
  const controlBlock = dumpYaml({
    workflow_root: workflowRoot,
    workflow_projection: projectionMetadata,
    workflow_folders: workflowFolderTree,
    workflow_control: workflowControlPolicy,
  });
  const automationBlock = dumpYaml({
    automation_assets: {
      ...projectionMetadata,
      workflows: canonicalWorkflowAssets,
      email_marketing_campaigns: canonicalCampaignAssets,
      non_workflow_assets: nonWorkflowAssets,
    },
  });
  const deprecatedBlock = dumpYaml({ deprecated_workflows: deprecatedWorkflowRecords });
  const controlStart = source.includes('\nworkflow_root:')
    ? 'workflow_root'
    : source.includes('\nworkflow_projection:')
      ? 'workflow_projection'
      : 'workflow_folders';
  const automationStart = source.includes('\nautomation_assets:')
    ? 'automation_assets'
    : 'workflows';
  let output = replaceYamlSection(source, controlStart, 'custom_fields', controlBlock);
  output = replaceYamlSection(output, 'custom_values', 'sender_profiles', customValuesBlock);
  output = replaceYamlSection(output, 'sender_profiles', 'message_classes', senderProfilesBlock);
  output = replaceYamlSection(output, 'message_classes', 'pipelines', messageClassesBlock);
  output = replaceYamlSection(output, automationStart, 'workflow_readback', automationBlock);
  output = replaceYamlSection(output, 'deprecated_workflows', 'contact_import', deprecatedBlock);
  return ensureTrailingNewline(output);
}

async function readYamlArray(filePath: string): Promise<Record<string, unknown>[]> {
  const parsed = yaml.load(await readFile(path.join(repoRoot, filePath), 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`projection_source_not_array:${filePath}`);
  return parsed as Record<string, unknown>[];
}

function replaceJsonProperty(
  source: string,
  property: string,
  nextProperty: string | null,
  value: unknown,
) {
  const startToken = `\n  ${JSON.stringify(property)}:`;
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`current_projection_missing_property:${property}`);
  const end = nextProperty
    ? source.indexOf(`\n  ${JSON.stringify(nextProperty)}:`, start + startToken.length)
    : source.lastIndexOf('\n}');
  if (end < 0) throw new Error(`current_projection_missing_boundary:${property}`);
  const rendered = indentJsonProperty(property, value);
  return `${source.slice(0, start)}\n${rendered}${nextProperty ? ',' : ''}${source.slice(end)}`;
}

function upsertJsonProperty(
  source: string,
  property: string,
  beforeProperty: string,
  value: unknown,
) {
  if (source.includes(`\n  ${JSON.stringify(property)}:`)) {
    return replaceJsonProperty(source, property, beforeProperty, value);
  }
  const boundary = source.indexOf(`\n  ${JSON.stringify(beforeProperty)}:`);
  if (boundary < 0) throw new Error(`current_projection_missing_insert_boundary:${beforeProperty}`);
  return `${source.slice(0, boundary)}\n${indentJsonProperty(property, value)},${source.slice(boundary)}`;
}

function indentJsonProperty(property: string, value: unknown) {
  const rendered = JSON.stringify(value, null, 2).split('\n');
  return `  ${JSON.stringify(property)}: ${rendered[0]}${rendered
    .slice(1)
    .map((line) => `\n  ${line}`)
    .join('')}`;
}

function replaceYamlSection(source: string, key: string, nextKey: string, replacement: string) {
  const start = source.indexOf(`${key}:`);
  const end = source.indexOf(`${nextKey}:`, start);
  if (start < 0 || end < 0) throw new Error(`manifest_projection_missing_section:${key}`);
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function dumpYaml(value: unknown) {
  return yaml.dump(value, {
    noRefs: true,
    lineWidth: -1,
    sortKeys: false,
    quotingType: "'",
    forceQuotes: false,
  });
}

function normalizeText(value: string) {
  return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trimEnd();
}

function firstDifferenceLine(left: string, right: string) {
  const leftLines = normalizeText(left).split('\n');
  const rightLines = normalizeText(right).split('\n');
  const length = Math.max(leftLines.length, rightLines.length);
  for (let index = 0; index < length; index += 1) {
    if (leftLines[index] !== rightLines[index]) return index + 1;
  }
  return null;
}

function ensureTrailingNewline(value: string) {
  return `${value.replace(/[\r\n]+$/u, '')}\n`;
}
