import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  botActionWorkflows,
  businessWorkflows,
  customValues,
  registryMetadata,
  type RegistryWorkflow,
} from './canonical-registry-data.ts';

type CurrentRegistry = {
  location_id: string;
  counts?: Record<string, number>;
};

type JobInput = {
  jobId: string;
  order: number;
  title: string;
  targetUiPath: string;
  canonicalSourceFiles: string[];
  allowedAssets: string[];
  forbiddenAssets: string[];
  prerequisites: string[];
  expectedGhlIdsToCapture: string[];
  testContactRules: string[];
  taskInstructions: string[];
};

type AgentModeJob = {
  job_id: string;
  order: number;
  title: string;
  ghl_location: {
    location_id: string;
    location_fingerprint: string;
    verification_required: true;
  };
  exact_target_ui_path: string;
  canonical_source_files: string[];
  exact_copy_paste_prompt: string;
  allowed_assets: string[];
  forbidden_assets: string[];
  prerequisites: string[];
  expected_ghl_ids_to_capture: string[];
  test_contact_rules: string[];
  defaults: {
    no_send: true;
    no_publish: true;
    no_production_workflow_enrollment: true;
    no_live_payment_mutation: true;
    no_student_contacts: true;
    save_required: true;
    readback_required: true;
  };
  completion_checklist: string[];
  result_json_schema: ResultJsonSchema;
  idempotency_key: string;
  bna_agent_action_dropoff: {
    lane: string;
    return_surface: string;
    return_route: string;
    result_path: string;
    readback_verification: string;
    metadata: {
      repository: string;
      registry_root: string;
      queue_file: string;
      job_file: string;
      result_file: string;
    };
  };
};

type ResultJsonSchema = {
  $schema: string;
  type: 'object';
  additionalProperties: false;
  required: string[];
  properties: Record<string, unknown>;
};

const repoRoot = process.cwd();
const generatedAt = new Date().toISOString();
const queueDir = 'integrations/highlevel/agent-mode';
const jobsDir = `${queueDir}/jobs`;
const resultsDir = `${queueDir}/results`;
const queuePath = `${queueDir}/GHL-AGENT-MODE-QUEUE.json`;
const exportPath = `${queueDir}/GHL-AGENT-MODE-EXPORT.json`;
const readmePath = `${queueDir}/README.md`;

await main();

async function main() {
  const current = await readCurrent();
  const locationId = current.location_id || registryMetadata.locationId;
  const jobs = buildJobs(locationId);
  await mkdir(path.join(repoRoot, jobsDir), { recursive: true });
  await mkdir(path.join(repoRoot, resultsDir), { recursive: true });
  for (const job of jobs) {
    await writeRepoFile(jobFilePath(job), `${JSON.stringify(job, null, 2)}\n`);
  }
  await writeRepoFile(queuePath, `${JSON.stringify(buildQueue(locationId, jobs, current), null, 2)}\n`);
  await writeRepoFile(exportPath, `${JSON.stringify(buildExport(locationId, jobs, current), null, 2)}\n`);
  await writeRepoFile(readmePath, buildReadme(jobs));
  await writeRepoFile(`${resultsDir}/.gitkeep`, '');
  writeStdoutJson({
    generatedAt,
    locationId,
    jobs: jobs.length,
    queuePath,
    exportPath,
    resultsDir,
    messagesSent: 0,
    workflowsPublished: 0,
  });
}

function buildJobs(locationId: string): AgentModeJob[] {
  return jobInputs().map((input) => {
    const jobFile = jobFilePathFromId(input.jobId, input.title);
    const resultFile = `${resultsDir}/${input.jobId}.result.json`;
    const idempotencyKey = stableKey(locationId, input.jobId, input.title);
    return {
      job_id: input.jobId,
      order: input.order,
      title: input.title,
      ghl_location: {
        location_id: locationId,
        location_fingerprint: sha256(locationId).slice(0, 16),
        verification_required: true,
      },
      exact_target_ui_path: input.targetUiPath,
      canonical_source_files: input.canonicalSourceFiles,
      exact_copy_paste_prompt: buildPrompt(input, locationId, resultFile, idempotencyKey),
      allowed_assets: input.allowedAssets,
      forbidden_assets: input.forbiddenAssets,
      prerequisites: input.prerequisites,
      expected_ghl_ids_to_capture: input.expectedGhlIdsToCapture,
      test_contact_rules: input.testContactRules,
      defaults: {
        no_send: true,
        no_publish: true,
        no_production_workflow_enrollment: true,
        no_live_payment_mutation: true,
        no_student_contacts: true,
        save_required: true,
        readback_required: true,
      },
      completion_checklist: completionChecklist(input),
      result_json_schema: resultJsonSchema(input.jobId),
      idempotency_key: idempotencyKey,
      bna_agent_action_dropoff: {
        lane: 'highlevel_agent_mode',
        return_surface: 'BNA Agent Action drop-off page',
        return_route: '/ops/agent-actions/highlevel/drop-off',
        result_path: resultFile,
        readback_verification: 'After saving the result, reopen/read it and record the returned result ID.',
        metadata: {
          repository: 'shloimie-beep/onetimev2',
          registry_root: 'integrations/highlevel/registry/',
          queue_file: queuePath,
          job_file: jobFile,
          result_file: resultFile,
        },
      },
    };
  });
}

function jobInputs(): JobInput[] {
  const activeWorkflowSources = [...businessWorkflows, ...botActionWorkflows].flatMap(
    (workflow) => [workflow.promptPath, workflow.checklistPath],
  );
  return [
    {
      jobId: 'GHL-UI-01',
      order: 1,
      title: 'custom-value folders and unresolved value review',
      targetUiPath: 'HighLevel > Settings > Custom Values',
      canonicalSourceFiles: [
        'integrations/highlevel/registry/current.json',
        'integrations/highlevel/registry/custom-values.yaml',
      ],
      allowedAssets: [
        'Custom-value folders matching the registry folder names.',
        ...customValues.map((value) => value.canonicalName),
      ],
      forbiddenAssets: commonForbiddenAssets([
        'PENDING_ACCEPTED_ROUTE',
        'PENDING_VERIFIED_GHL_CHECKOUT_URL',
        'PENDING_PROTECTED_PORTAL_ROUTE',
        'PENDING_VERIFIED_QR_LINKED_WHATSAPP_ENTRY_URL',
        'TODO',
        'CHANGEME',
      ]),
      prerequisites: commonPrerequisites(),
      expectedGhlIdsToCapture: [
        'custom_value_folder_ids_if_visible',
        'custom_value_ids_for_resolved_existing_values',
        'blocked_ui_or_business_value_names',
      ],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Create or verify the Custom Values folders named in the registry.',
        'Review unresolved values marked blocked_ui_or_business_value; do not create any placeholder value.',
        'If a real approved value already exists in GHL, capture its safe custom value ID and status.',
      ],
    },
    {
      jobId: 'GHL-UI-02',
      order: 2,
      title: 'workflow folders',
      targetUiPath: 'HighLevel > Automation > Workflows > Folders',
      canonicalSourceFiles: [
        'integrations/highlevel/registry/workflow-registry.yaml',
        'integrations/highlevel/workflows.yaml',
      ],
      allowedAssets: unique([...businessWorkflows, ...botActionWorkflows].map((workflow) => workflow.folder)),
      forbiddenAssets: commonForbiddenAssets(['duplicate One Time workflow folders']),
      prerequisites: commonPrerequisites(),
      expectedGhlIdsToCapture: ['workflow_folder_ids_if_visible'],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Create or verify only the workflow folders required by the canonical workflows.',
        'Do not create workflow content in this job.',
      ],
    },
    workflowJob({
      jobId: 'GHL-UI-03',
      order: 3,
      title: 'OT-01 lead intake',
      workflowKeys: ['OT-01'],
      targetUiPath: 'HighLevel > Automation > Workflows > 00 - Intake & Data > OT-01 New Lead Intake',
    }),
    workflowJob({
      jobId: 'GHL-UI-04',
      order: 4,
      title: 'OT-02A existing subscriber migration',
      workflowKeys: ['OT-02A'],
      targetUiPath:
        'HighLevel > Automation > Workflows > 10 - Nurture & Sales > OT-02A Existing Subscriber Migration 2026 v1',
    }),
    workflowJob({
      jobId: 'GHL-UI-05',
      order: 5,
      title: 'OT-02B new lead nurture',
      workflowKeys: ['OT-02B'],
      targetUiPath:
        'HighLevel > Automation > Workflows > 10 - Nurture & Sales > OT-02B New Lead Nurture v1',
    }),
    workflowJob({
      jobId: 'GHL-UI-06',
      order: 6,
      title: 'billing workflows OT-03/04/05/06/13',
      workflowKeys: ['OT-03', 'OT-04', 'OT-05', 'OT-06', 'OT-13'],
      targetUiPath:
        'HighLevel > Automation > Workflows > 20 - Billing & Access > OT-03, OT-04, OT-05, OT-06, OT-13',
    }),
    workflowJob({
      jobId: 'GHL-UI-07',
      order: 7,
      title: 'portal workflows OT-07/08',
      workflowKeys: ['OT-07', 'OT-08'],
      targetUiPath: 'HighLevel > Automation > Workflows > 30 - Portal Lifecycle > OT-07, OT-08',
    }),
    workflowJob({
      jobId: 'GHL-UI-08',
      order: 8,
      title: 'class/content workflows OT-09/10',
      workflowKeys: ['OT-09', 'OT-10'],
      targetUiPath: 'HighLevel > Automation > Workflows > 40 - Classes & Content > OT-09, OT-10',
    }),
    workflowJob({
      jobId: 'GHL-UI-09',
      order: 9,
      title: 'bot-action workflows OT-B01 through OT-B05',
      workflowKeys: ['OT-B01', 'OT-B02', 'OT-B03', 'OT-B04', 'OT-B05'],
      targetUiPath:
        'HighLevel > Automation > Workflows > Bot Action Workflows > OT-B01 through OT-B05',
    }),
    {
      jobId: 'GHL-UI-10',
      order: 10,
      title: 'knowledge base',
      targetUiPath: 'HighLevel > AI Agent Studio > Knowledge Base',
      canonicalSourceFiles: [
        'integrations/highlevel/knowledge-bases/active/one-time-public-kb-v1.0.0.md',
        'integrations/highlevel/registry/knowledge-base-registry.yaml',
      ],
      allowedAssets: ['One Time Mishnayos - Public Program and Support v1.0.0'],
      forbiddenAssets: commonForbiddenAssets([
        'raw Vimeo URLs',
        'raw Zoom links',
        'student usernames',
        'student passwords',
      ]),
      prerequisites: commonPrerequisites(),
      expectedGhlIdsToCapture: ['knowledge_base_id', 'knowledge_base_status'],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Create or update the canonical public knowledge base from the active markdown source.',
        'Keep it scoped to public and support-safe program facts.',
      ],
    },
    {
      jobId: 'GHL-UI-11',
      order: 11,
      title: 'OT-A1 bot',
      targetUiPath: 'HighLevel > AI Agent Studio > Conversation AI > Bots > OT-A1 One Time Enrollment Assistant',
      canonicalSourceFiles: [
        'integrations/highlevel/prompts/active/OT-A1-v1.0.0.md',
        'integrations/highlevel/registry/prompt-registry.yaml',
        'integrations/highlevel/registry/bot-action-registry.yaml',
        'integrations/highlevel/agent-mode/HIGHLEVEL-BOT-UI-SETUP.md',
      ],
      allowedAssets: [
        'OT-A1 One Time Enrollment Assistant',
        'Website Live Chat channel in draft/test routing',
        'WhatsApp channel in draft/test routing',
        'OT-B01',
        'OT-B02',
        'OT-B03',
        'OT-B04',
        'OT-B05',
      ],
      forbiddenAssets: commonForbiddenAssets([
        'Voice AI',
        'Human Handover',
        'human task creation',
        'duplicate public bots',
      ]),
      prerequisites: [
        ...commonPrerequisites(),
        'GHL-UI-09 complete with OT-B01 through OT-B05 workflow IDs captured.',
        'GHL-UI-10 complete with knowledge base ID captured.',
      ],
      expectedGhlIdsToCapture: ['bot_id', 'bot_status', 'attached_knowledge_base_id', 'channel_statuses'],
      testContactRules: controlledTestContactRules(),
      taskInstructions: [
        'Create or update only OT-A1 One Time Enrollment Assistant.',
        'Attach the canonical public knowledge base.',
        'Configure Website Live Chat and WhatsApp as initial channels, but keep production launch disabled.',
        'Disable Voice, Human Handover, and task creation.',
      ],
    },
    {
      jobId: 'GHL-UI-12',
      order: 12,
      title: 'duplicate workflow/bot deprecation',
      targetUiPath: 'HighLevel > Automation > Workflows and HighLevel > AI Agent Studio > Conversation AI > Bots',
      canonicalSourceFiles: [
        'integrations/highlevel/registry/deprecations.yaml',
        'integrations/highlevel/registry/workflow-registry.yaml',
      ],
      allowedAssets: [
        'Deprecated labeling or disabled status for duplicate lead-capture workflows.',
        'Deprecated labeling or disabled status for duplicate signup workflows.',
        'Deprecated labeling or disabled status for duplicate One Time bots.',
      ],
      forbiddenAssets: commonForbiddenAssets([
        'deleting historical assets',
        'publishing replacement workflows',
        'enrolling contacts',
      ]),
      prerequisites: [
        ...commonPrerequisites(),
        'GHL-UI-03 through GHL-UI-11 complete enough to identify canonical replacements.',
      ],
      expectedGhlIdsToCapture: ['deprecated_workflow_ids', 'deprecated_bot_ids', 'old_lowercase_family_asset_ids'],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Deprecate duplicates and old lowercase one-time-* workflow/tag family assets without deleting historical records.',
        'Capture safe IDs and statuses for anything disabled or marked deprecated.',
      ],
    },
    {
      jobId: 'GHL-UI-13',
      order: 13,
      title: 'workflow ID capture and registry reconciliation',
      targetUiPath: 'HighLevel > Automation > Workflows',
      canonicalSourceFiles: [
        'integrations/highlevel/WORKFLOW-ID-CAPTURE.md',
        'integrations/highlevel/registry/workflow-registry.yaml',
        ...activeWorkflowSources,
      ],
      allowedAssets: activeWorkflowNames(),
      forbiddenAssets: commonForbiddenAssets(['chat-only workflow ID claims']),
      prerequisites: [
        ...commonPrerequisites(),
        'GHL-UI-03 through GHL-UI-12 complete and saved.',
      ],
      expectedGhlIdsToCapture: [
        'all_active_business_workflow_ids',
        'all_bot_action_workflow_ids',
        'deprecated_workflow_ids_if_present',
      ],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Open each canonical workflow and capture the saved GHL ID and visible status.',
        'Do not edit workflow logic except to save an already-open draft when needed for ID visibility.',
      ],
    },
    {
      jobId: 'GHL-UI-14',
      order: 14,
      title: 'controlled test-contact pass',
      targetUiPath: 'HighLevel > Contacts > protected operator-owned test contact and related draft workflows/bot',
      canonicalSourceFiles: [
        'integrations/highlevel/WORKFLOW-TEST-MATRIX.md',
        'integrations/highlevel/registry/current.json',
        queuePath,
      ],
      allowedAssets: [
        'Protected operator-owned test contact only.',
        'Draft workflow test mode.',
        'Draft bot preview/test mode.',
      ],
      forbiddenAssets: commonForbiddenAssets([
        'production contacts',
        'message sends',
        'workflow publishing',
        'Stripe or GHL Payments mutation',
      ]),
      prerequisites: [
        ...commonPrerequisites(),
        'Protected operator-owned test contact email and phone are configured outside Git.',
        'GHL-UI-01 through GHL-UI-13 results are saved and readback verified.',
      ],
      expectedGhlIdsToCapture: [
        'test_contact_id',
        'workflow_test_run_ids_if_visible',
        'bot_preview_session_id_if_visible',
      ],
      testContactRules: controlledTestContactRules(),
      taskInstructions: [
        'Run only no-send, no-publish draft checks against the protected operator-owned test contact.',
        'Verify field/tag mutations are limited to registered One Time assets.',
        'Capture status and evidence IDs without sending messages.',
      ],
    },
  ];
}

function workflowJob(input: {
  jobId: string;
  order: number;
  title: string;
  workflowKeys: string[];
  targetUiPath: string;
}): JobInput {
  const workflows = workflowsByKey(input.workflowKeys);
  return {
    jobId: input.jobId,
    order: input.order,
    title: input.title,
    targetUiPath: input.targetUiPath,
    canonicalSourceFiles: [
      'integrations/highlevel/registry/current.json',
      'integrations/highlevel/registry/workflow-registry.yaml',
      'integrations/highlevel/workflows.yaml',
      ...workflows.flatMap((workflow) => [workflow.promptPath, workflow.checklistPath]),
    ],
    allowedAssets: workflows.map((workflow) => workflow.canonicalName),
    forbiddenAssets: commonForbiddenAssets([
      'workflow publishing',
      'production contact enrollment',
      'message send actions enabled for production',
    ]),
    prerequisites: [
      ...commonPrerequisites(),
      'GHL-UI-01 custom values reviewed.',
      'GHL-UI-02 workflow folders complete.',
    ],
    expectedGhlIdsToCapture: workflows.map((workflow) => `${workflow.key}_workflow_id`),
    testContactRules: controlledTestContactRules(),
    taskInstructions: [
      'Build or update the listed workflow drafts exactly from the canonical prompt and checklist files.',
      'Keep every workflow unpublished.',
      'Use only canonical fields, tags, custom values, folders, and adapters.',
      'Save each workflow and verify the saved draft before returning a result.',
    ],
  };
}

function buildPrompt(
  input: JobInput,
  locationId: string,
  resultFile: string,
  idempotencyKey: string,
) {
  return [
    `Job ${input.jobId}: ${input.title}`,
    '',
    `Use HighLevel location ${locationId}. Verify the visible location before doing any work.`,
    `Target UI path: ${input.targetUiPath}`,
    '',
    'Read these canonical source files first:',
    ...input.canonicalSourceFiles.map((file) => `- ${file}`),
    '',
    'Allowed assets:',
    ...input.allowedAssets.map((asset) => `- ${asset}`),
    '',
    'Forbidden assets and actions:',
    ...input.forbiddenAssets.map((asset) => `- ${asset}`),
    '',
    'Perform the UI work. Click Save for every edited workflow, bot, knowledge base, folder, or custom value screen. Verify the saved workflow, bot, knowledge base, folder, or custom value by reopening or reading the saved state. Capture the safe GHL asset ID and visible status. Return to the BNA Agent Action drop-off page. Save the result JSON to the drop-off lane and result path. Verify the readback result ID. Never finish with an unsaved chat-only claim.',
    '',
    'Task instructions:',
    ...input.taskInstructions.map((instruction) => `- ${instruction}`),
    '',
    'Default safety is no-send and no-publish. Do not send messages, publish workflows, publish the bot, enroll production contacts, mutate live payment state, create Student contacts, or create Student credential fields.',
    '',
    `Result path: ${resultFile}`,
    `Idempotency key: ${idempotencyKey}`,
  ].join('\n');
}

function completionChecklist(input: JobInput) {
  return [
    `Visible HighLevel location matched ${registryMetadata.locationId}.`,
    `Canonical source files for ${input.jobId} were read before edits.`,
    'Only allowed assets were created, edited, or verified.',
    'Forbidden assets and actions were not used.',
    'Every changed asset was saved in the HighLevel UI.',
    'Saved asset state was verified after save.',
    'Safe GHL IDs and visible statuses were captured.',
    'Messages sent = 0.',
    'Workflow publish actions = 0.',
    'Production contacts enrolled = 0.',
    'Stripe or live payment mutations = 0.',
    'Result JSON was saved to the BNA Agent Action drop-off lane.',
    'Readback result ID was verified.',
  ];
}

function resultJsonSchema(jobId: string): ResultJsonSchema {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: [
      'job_id',
      'status',
      'ghl_location_id',
      'saved',
      'verified',
      'captured_ids',
      'messages_sent',
      'workflows_published',
      'production_contacts_enrolled',
      'stripe_mutations',
      'student_contacts_created',
      'dropoff_result_id',
      'readback_verified',
      'idempotency_key',
      'notes',
    ],
    properties: {
      job_id: { const: jobId },
      status: { enum: ['done', 'already_satisfied', 'blocked', 'partial', 'failed'] },
      ghl_location_id: { const: registryMetadata.locationId },
      saved: { type: 'boolean' },
      verified: { type: 'boolean' },
      captured_ids: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['asset_type', 'name', 'id', 'status'],
          properties: {
            asset_type: { type: 'string' },
            name: { type: 'string' },
            id: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
      messages_sent: { const: 0 },
      workflows_published: { const: 0 },
      production_contacts_enrolled: { const: 0 },
      stripe_mutations: { const: 0 },
      student_contacts_created: { const: 0 },
      dropoff_result_id: { type: 'string', minLength: 1 },
      readback_verified: { type: 'boolean' },
      idempotency_key: { type: 'string', minLength: 1 },
      blockers: { type: 'array', items: { type: 'string' } },
      notes: { type: 'string' },
    },
  };
}

function buildQueue(locationId: string, jobs: AgentModeJob[], current: CurrentRegistry) {
  return {
    schema_id: 'one-time-highlevel-agent-mode-queue',
    schema_version: '1.0.0',
    generated_at: generatedAt,
    repository: 'shloimie-beep/onetimev2',
    registry_schema: `${registryMetadata.schemaId}@${registryMetadata.schemaVersion}`,
    location_id: locationId,
    location_fingerprint: sha256(locationId).slice(0, 16),
    registry_counts: current.counts ?? {},
    safety_defaults: {
      messages_sent: 0,
      workflows_created_by_api: 0,
      workflows_published: 0,
      production_workflow_enrollments: 0,
      stripe_mutations: 0,
      student_contacts_created: 0,
      no_send: true,
      no_publish: true,
    },
    ordered_jobs: jobs.map((job) => ({
      job_id: job.job_id,
      order: job.order,
      title: job.title,
      job_file: jobFilePath(job),
      result_path: job.bna_agent_action_dropoff.result_path,
      idempotency_key: job.idempotency_key,
    })),
  };
}

function buildExport(locationId: string, jobs: AgentModeJob[], current: CurrentRegistry) {
  return {
    schema_id: 'bna-agent-action-export',
    schema_version: '1.0.0',
    export_type: 'highlevel_agent_mode_queue',
    generated_at: generatedAt,
    source: {
      repository: 'shloimie-beep/onetimev2',
      registry_root: 'integrations/highlevel/registry/',
      queue_path: queuePath,
      location_id: locationId,
      location_fingerprint: sha256(locationId).slice(0, 16),
      registry_counts: current.counts ?? {},
    },
    ingestion: {
      lane: 'highlevel_agent_mode',
      result_directory: resultsDir,
      required_readback: true,
      idempotency_key_field: 'idempotency_key',
    },
    safety: {
      no_send_default: true,
      no_publish_default: true,
      no_production_workflow_enrollment_default: true,
      no_live_payment_mutation_default: true,
      no_student_contacts_default: true,
    },
    jobs,
  };
}

function buildReadme(jobs: AgentModeJob[]) {
  return [
    '# HighLevel Agent Mode Queue',
    '',
    `Generated: ${generatedAt}`,
    `Location: ${registryMetadata.locationId}`,
    '',
    'Run these jobs in order. Every job defaults to no-send, no-publish, no production workflow enrollment, no live payment mutation, and no Student contacts.',
    '',
    'Agent Mode must save UI work, verify the saved state, return to the BNA Agent Action drop-off page, save the result JSON, verify the readback result ID, and avoid unsaved chat-only completion claims.',
    '',
    '| Order | Job | File | Result |',
    '| --- | --- | --- | --- |',
    ...jobs.map(
      (job) =>
        `| ${job.order} | ${job.job_id} ${job.title} | ${jobFilePath(job)} | ${job.bna_agent_action_dropoff.result_path} |`,
    ),
    '',
  ].join('\n');
}

function commonPrerequisites() {
  return [
    'Read integrations/highlevel/registry/AGENT-HANDOFF.md.',
    'Read integrations/highlevel/registry/current.json.',
    `Verify HighLevel location ID is ${registryMetadata.locationId}.`,
    'Use only one canonical registry and do not create duplicate assets.',
  ];
}

function commonForbiddenAssets(extra: string[]) {
  return [
    'Student contacts',
    'Student username fields',
    'Student password fields',
    'workflow publish actions',
    'production workflow enrollment',
    'message sends',
    'Stripe or live payment mutations',
    'duplicate tags, fields, values, workflows, bots, or knowledge bases',
    ...extra,
  ];
}

function noTestContactRules() {
  return [
    'No contact mutation is allowed for this job.',
    'Do not use production contacts for verification.',
  ];
}

function controlledTestContactRules() {
  return [
    'Use only the protected operator-owned test contact configured outside Git.',
    'Never use a production parent/adult contact for testing.',
    'Do not send a message to the test contact.',
    'Do not enroll the test contact into a published workflow.',
  ];
}

function workflowsByKey(keys: string[]): RegistryWorkflow[] {
  const workflows = [...businessWorkflows, ...botActionWorkflows];
  return keys.map((key) => {
    const workflow = workflows.find((candidate) => candidate.key === key);
    if (!workflow) throw new Error(`workflow_missing:${key}`);
    return workflow;
  });
}

function activeWorkflowNames() {
  return [...businessWorkflows, ...botActionWorkflows].map((workflow) => workflow.canonicalName);
}

function jobFilePath(job: Pick<AgentModeJob, 'job_id' | 'title'>) {
  return jobFilePathFromId(job.job_id, job.title);
}

function jobFilePathFromId(jobId: string, title: string) {
  return `${jobsDir}/${jobId}-${slug(title)}.json`;
}

function stableKey(locationId: string, jobId: string, title: string) {
  return `one-time-ghl:${jobId}:${sha256(`${locationId}:${jobId}:${title}:1.0.0`).slice(0, 16)}`;
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

async function readCurrent(): Promise<CurrentRegistry> {
  return JSON.parse(
    await readFile(path.join(repoRoot, 'integrations/highlevel/registry/current.json'), 'utf8'),
  ) as CurrentRegistry;
}

async function writeRepoFile(filePath: string, body: string) {
  const absolute = path.join(repoRoot, filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, body, 'utf8');
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
