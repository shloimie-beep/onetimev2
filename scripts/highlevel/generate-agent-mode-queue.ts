import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  botActionWorkflows,
  businessWorkflows,
  customValues,
  pipelineDefinitions,
  registryMetadata,
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
  await removeStaleJobFiles(jobs);
  for (const job of jobs) {
    await writeRepoFile(jobFilePath(job), `${JSON.stringify(job, null, 2)}\n`);
  }
  await writeRepoFile(
    queuePath,
    `${JSON.stringify(buildQueue(locationId, jobs, current), null, 2)}\n`,
  );
  await writeRepoFile(
    exportPath,
    `${JSON.stringify(buildExport(locationId, jobs, current), null, 2)}\n`,
  );
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
        readback_verification:
          'After saving the result, reopen/read it and record the returned result ID.',
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
  const senderRegistrySources = [
    'integrations/highlevel/registry/current.json',
    'integrations/highlevel/registry/sender-registry.yaml',
    'integrations/highlevel/registry/message-class-registry.yaml',
    'integrations/highlevel/registry/communications-contract.json',
  ];
  return [
    {
      jobId: 'GHL-UI-01',
      order: 1,
      title: 'create sender custom-value folder',
      targetUiPath: 'HighLevel > Settings > Custom Values',
      canonicalSourceFiles: [
        ...senderRegistrySources,
        'integrations/highlevel/registry/custom-values.yaml',
      ],
      allowedAssets: ['One Time - Senders custom-value folder'],
      forbiddenAssets: commonForbiddenAssets([
        'duplicate sender folders',
        'renaming existing unrelated folders',
      ]),
      prerequisites: commonPrerequisites(),
      expectedGhlIdsToCapture: ['one_time_senders_folder_id_if_visible'],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Create or verify exactly one folder named One Time - Senders.',
        'Do not move or rewrite existing values in this job.',
      ],
    },
    {
      jobId: 'GHL-UI-02',
      order: 2,
      title: 'reconcile sender values',
      targetUiPath: 'HighLevel > Settings > Custom Values > One Time - Senders',
      canonicalSourceFiles: [
        ...senderRegistrySources,
        'integrations/highlevel/registry/custom-values.yaml',
      ],
      allowedAssets: customValues
        .filter((value) => value.folder === 'One Time - Senders')
        .map((value) => value.canonicalName),
      forbiddenAssets: commonForbiddenAssets([
        'activating rabbi@',
        'deleting generic sender compatibility aliases',
      ]),
      prerequisites: [...commonPrerequisites(), 'GHL-UI-01 saved and readback verified.'],
      expectedGhlIdsToCapture: ['registered_sender_custom_value_ids', 'compatibility_alias_ids'],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Reconcile exact registered sender values and preserve the existing generic sender values as compatibility aliases.',
        'Keep rabbi@ values recorded but inactive pending acceptance.',
      ],
    },
    {
      jobId: 'GHL-UI-03',
      order: 3,
      title: 'create or reconcile pipelines',
      targetUiPath: 'HighLevel > Opportunities > Pipelines',
      canonicalSourceFiles: [
        'integrations/highlevel/registry/pipeline-registry.yaml',
        'integrations/highlevel/registry/communications-contract.json',
      ],
      allowedAssets: pipelineDefinitions.map((pipeline) => pipeline.canonicalName),
      forbiddenAssets: commonForbiddenAssets([
        'deleting One Time Business',
        'migrating existing opportunities',
        'duplicate pipelines or stages',
      ]),
      prerequisites: commonPrerequisites(),
      expectedGhlIdsToCapture: [
        'canonical_pipeline_ids',
        'canonical_stage_ids',
        'one_time_business_compatibility_alias_id',
      ],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Create or reconcile the three canonical pipelines and exact ordered stages.',
        'Preserve One Time Business as a compatibility alias and do not move existing opportunities.',
      ],
    },
    {
      jobId: 'GHL-UI-04',
      order: 4,
      title: 'update workflow sender identities',
      targetUiPath: 'HighLevel > Automation > Workflows > canonical One Time workflow folders',
      canonicalSourceFiles: [
        ...senderRegistrySources,
        'integrations/highlevel/registry/workflow-registry.yaml',
        ...activeWorkflowSources,
      ],
      allowedAssets: activeWorkflowNames(),
      forbiddenAssets: commonForbiddenAssets([
        'unregistered sender text',
        'guessing a From address',
        'activation/reset tokens in GHL',
      ]),
      prerequisites: [
        ...commonPrerequisites(),
        'GHL-UI-02 and GHL-UI-03 saved and readback verified.',
      ],
      expectedGhlIdsToCapture: [
        'workflow_ids',
        'sender_value_ids_selected',
        'workflow_message_class_readback',
      ],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Update every canonical workflow sender identity from its registered sender_key and exact custom-value picker entries.',
        'Keep every workflow Draft/unpublished and do not enroll contacts.',
        'Verify OT-07 GHL companion/welcome and separate One Time/Resend activation-token boundary.',
      ],
    },
    {
      jobId: 'GHL-UI-05',
      order: 5,
      title: 'update OT-A1',
      targetUiPath:
        'HighLevel > AI Agent Studio > Conversation AI > Bots > OT-A1 One Time Enrollment Assistant',
      canonicalSourceFiles: [
        'integrations/highlevel/prompts/active/OT-A1-v1.0.0.md',
        'integrations/highlevel/knowledge-bases/active/one-time-public-kb-v1.0.0.md',
        'integrations/highlevel/registry/bot-action-registry.yaml',
        'integrations/highlevel/registry/rabbi-telegram-contract.yaml',
        'integrations/highlevel/registry/pipeline-registry.yaml',
      ],
      allowedAssets: [
        'OT-A1 One Time Enrollment Assistant',
        'Website Live Chat',
        'WhatsApp',
        'One Time Torah Questions routing for explicit substantive Torah questions',
      ],
      forbiddenAssets: commonForbiddenAssets([
        'Voice AI',
        'Human Handoff',
        'human tasks',
        'separate WhatsApp qualification bot',
        'automatic promise that a person will reply',
        'generic support routed to Rabbi',
      ]),
      prerequisites: [...commonPrerequisites(), 'GHL-UI-04 saved and readback verified.'],
      expectedGhlIdsToCapture: [
        'bot_id',
        'knowledge_base_id',
        'channel_statuses',
        'torah_routing_status',
      ],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Update only the canonical OT-A1 bot and public knowledge base dependencies.',
        'Keep the bot inactive/unpublished. Route only explicit substantive Torah questions to One Time Torah Questions.',
      ],
    },
    {
      jobId: 'GHL-UI-06',
      order: 6,
      title: 'verify sending domain',
      targetUiPath: 'HighLevel > Settings > Email Services > Domains',
      canonicalSourceFiles: [
        'integrations/highlevel/registry/sender-registry.yaml',
        'integrations/highlevel/LC-EMAIL-DNS-CHECKLIST.md',
      ],
      allowedAssets: [
        'onetimeonetime.com domain readback',
        'registered info@ sender readback',
        'registered rabbi@ pending-state readback',
      ],
      forbiddenAssets: commonForbiddenAssets([
        'DNS mutation',
        'claiming account@ or rabbi@ is live without acceptance evidence',
      ]),
      prerequisites: commonPrerequisites(),
      expectedGhlIdsToCapture: [
        'sending_domain_id_if_visible',
        'sending_domain_status',
        'accepted_from_addresses',
      ],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Read back the sending-domain and accepted From-address state only.',
        'Do not change DNS, activate rabbi@, or claim account@ is live.',
      ],
    },
    seedPreparationJob('GHL-UI-07', 7, 'phase-1 seed', 'rabbi_campaign', 'info@onetimeonetime.com'),
    seedPreparationJob('GHL-UI-08', 8, 'office seed', 'office', 'info@onetimeonetime.com'),
    seedPreparationJob('GHL-UI-09', 9, 'brand seed', 'brand', 'info@onetimeonetime.com'),
    {
      jobId: 'GHL-UI-10',
      order: 10,
      title: 'capture workflow IDs',
      targetUiPath: 'HighLevel > Automation > Workflows',
      canonicalSourceFiles: [
        'integrations/highlevel/WORKFLOW-ID-CAPTURE.md',
        'integrations/highlevel/registry/workflow-registry.yaml',
      ],
      allowedAssets: activeWorkflowNames(),
      forbiddenAssets: commonForbiddenAssets([
        'chat-only completion claims',
        'editing workflow logic while capturing IDs',
      ]),
      prerequisites: [
        ...commonPrerequisites(),
        'GHL-UI-04 and GHL-UI-05 saved and readback verified.',
      ],
      expectedGhlIdsToCapture: ['all_canonical_workflow_ids', 'visible_workflow_statuses'],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Open every canonical workflow, capture its safe ID/status, and do not edit workflow logic.',
      ],
    },
    {
      jobId: 'GHL-UI-11',
      order: 11,
      title: 'capture pipeline IDs',
      targetUiPath: 'HighLevel > Opportunities > Pipelines',
      canonicalSourceFiles: ['integrations/highlevel/registry/pipeline-registry.yaml'],
      allowedAssets: pipelineDefinitions.map((pipeline) => pipeline.canonicalName),
      forbiddenAssets: commonForbiddenAssets([
        'moving opportunities',
        'deleting stages',
        'chat-only completion claims',
      ]),
      prerequisites: [...commonPrerequisites(), 'GHL-UI-03 saved and readback verified.'],
      expectedGhlIdsToCapture: ['all_canonical_pipeline_ids', 'all_canonical_stage_ids'],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Capture safe pipeline and stage IDs plus visible status without moving opportunities.',
      ],
    },
    {
      jobId: 'GHL-UI-12',
      order: 12,
      title: 'save and readback verification',
      targetUiPath: 'HighLevel changed asset screens and BNA Agent Action drop-off',
      canonicalSourceFiles: [queuePath, 'integrations/highlevel/registry/AGENT-HANDOFF.md'],
      allowedAssets: ['Saved/readback verification for GHL-UI-01 through GHL-UI-11 results'],
      forbiddenAssets: commonForbiddenAssets([
        'unsaved chat-only completion claim',
        'new asset creation',
      ]),
      prerequisites: [...commonPrerequisites(), 'GHL-UI-01 through GHL-UI-11 have result records.'],
      expectedGhlIdsToCapture: ['dropoff_result_ids', 'readback_statuses'],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Reopen every changed asset and saved result, verify readback, and record discrepancies without creating new assets.',
      ],
    },
    {
      jobId: 'GHL-UI-13',
      order: 13,
      title: 'phase-2 rabbi acceptance',
      targetUiPath: 'HighLevel email sender settings and Conversations',
      canonicalSourceFiles: ['integrations/highlevel/registry/sender-registry.yaml'],
      allowedAssets: [
        'rabbi_campaign phase-2 acceptance evidence',
        'rabbi_personal acceptance evidence',
      ],
      forbiddenAssets: commonForbiddenAssets([
        'activating rabbi@ before every prerequisite passes',
        'broad campaign send',
      ]),
      prerequisites: [
        ...commonPrerequisites(),
        'BLOCKED until rabbi@ mailbox or routing exists.',
        'BLOCKED until HighLevel accepts the From address.',
        'BLOCKED until a separately authorized seed delivers.',
        'BLOCKED until a reply reaches GHL Conversations.',
      ],
      expectedGhlIdsToCapture: [
        'rabbi_sender_acceptance_status',
        'seed_delivery_safe_id',
        'reply_conversation_safe_id',
      ],
      testContactRules: noTestContactRules(),
      taskInstructions: [
        'Do not activate phase 2 in this no-send queue.',
        'Record the exact unmet prerequisite or, after a separately authorized acceptance run, record all safe acceptance IDs and statuses.',
      ],
    },
  ];
}

async function removeStaleJobFiles(jobs: AgentModeJob[]) {
  const expected = new Set(jobs.map((job) => path.basename(jobFilePath(job))));
  const directory = path.join(repoRoot, jobsDir);
  for (const name of await readdir(directory)) {
    if (name.endsWith('.json') && !expected.has(name)) {
      await unlink(path.join(directory, name));
    }
  }
}

function seedPreparationJob(
  jobId: string,
  order: number,
  title: string,
  senderKey: string,
  expectedFrom: string,
): JobInput {
  return {
    jobId,
    order,
    title,
    targetUiPath: 'HighLevel > Marketing > Emails > seed preparation',
    canonicalSourceFiles: [
      'integrations/highlevel/registry/sender-registry.yaml',
      'integrations/highlevel/registry/message-class-registry.yaml',
    ],
    allowedAssets: [`${senderKey} seed draft using expected From ${expectedFrom}`],
    forbiddenAssets: commonForbiddenAssets([
      'clicking Send',
      'adding a production audience',
      'publishing a campaign',
    ]),
    prerequisites: [...commonPrerequisites(), 'GHL-UI-06 sending-domain readback completed.'],
    expectedGhlIdsToCapture: [
      'seed_draft_id_if_visible',
      'selected_sender_value_ids',
      'blocked_send_status',
    ],
    testContactRules: noTestContactRules(),
    taskInstructions: [
      `Prepare and save a no-audience, unsent ${title} draft using sender_key ${senderKey}.`,
      'Do not click Send. Record that delivery remains blocked pending separate explicit authorization.',
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
    'Use only the immutable Commit A registry SHA embedded in integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md. Block if the executor is missing, the SHA is not immutable, or the checked-out registry differs.',
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
    schema_version: '1.1.0',
    generated_at: generatedAt,
    repository: 'shloimie-beep/onetimev2',
    registry_schema: `${registryMetadata.schemaId}@${registryMetadata.schemaVersion}`,
    pinned_registry_commit_source:
      'integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md',
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
    schema_version: '1.1.0',
    export_type: 'highlevel_agent_mode_queue',
    generated_at: generatedAt,
    source: {
      repository: 'shloimie-beep/onetimev2',
      registry_root: 'integrations/highlevel/registry/',
      queue_path: queuePath,
      location_id: locationId,
      location_fingerprint: sha256(locationId).slice(0, 16),
      registry_counts: current.counts ?? {},
      pinned_registry_commit_source:
        'integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md',
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
    'Read integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md and verify its immutable Commit A SHA before any action.',
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
  return `one-time-ghl:${jobId}:${sha256(`${locationId}:${jobId}:${title}:1.1.0`).slice(0, 16)}`;
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
