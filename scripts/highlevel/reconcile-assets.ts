import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  botActionWorkflows,
  businessWorkflows,
  contactFields,
  customValues,
  deprecatedWorkflows,
  lowercaseTagDeprecations,
  protectedImportPaths,
  registryMetadata,
  standardContactFields,
  tags,
  type RegistryWorkflow,
} from './canonical-registry-data.ts';

type Args = { incomingPath: string | null };
type PromptStatus = 'incoming' | 'candidate' | 'approved' | 'active' | 'superseded';
type PromptRecord = {
  prompt_id: string;
  semantic_version: string;
  status: PromptStatus;
  title: string;
  file_path: string;
  sha256: string;
  source: string;
  created_date: string;
  approved_date: string;
  ghl_asset_id: string;
  required_fields: string[];
  required_tags: string[];
  required_custom_values: string[];
  required_workflows: string[];
  test_contact_reference: string;
  last_tested_date: string;
  supersedes: string[];
  superseded_by: string;
};

const repoRoot = process.cwd();
const generatedAt = new Date().toISOString();
const args = parseArgs(process.argv.slice(2));
const incomingTarget =
  'integrations/highlevel/prompts/incoming/ghl-one-time-rabbi-scheller-bot-paste-pack-2026-07-20.md';
const candidatePrompt = 'integrations/highlevel/prompts/candidates/OT-A1-v1.0.0.md';
const activePrompt = 'integrations/highlevel/prompts/active/OT-A1-v1.0.0.md';
const activeKb = 'integrations/highlevel/knowledge-bases/active/one-time-public-kb-v1.0.0.md';
const productDecisionDir = 'ops/product-decisions/2026-07-20-ghl-public-bot';
const missingNamedPackNote =
  'The separate file named ghl-one-time-rabbi-scheller-bot-paste-pack(1).md was not present in repo-visible attachments during this run. The current pasted direction was preserved as incoming raw source and corrected into the active OT-A1 prompt.';

await main();

async function main() {
  await ensureDirectories([
    'integrations/highlevel/registry',
    'integrations/highlevel/prompts/incoming',
    'integrations/highlevel/prompts/candidates',
    'integrations/highlevel/prompts/active',
    'integrations/highlevel/prompts/superseded',
    'integrations/highlevel/knowledge-bases/incoming',
    'integrations/highlevel/knowledge-bases/active',
    'integrations/highlevel/knowledge-bases/superseded',
    'integrations/highlevel/agent-mode',
    'integrations/highlevel/imports',
    productDecisionDir,
  ]);

  const incomingRaw = await readIncoming(args.incomingPath);
  await writeRepoFile(incomingTarget, incomingRaw);
  await writeRepoFile(`${productDecisionDir}/ORIGINAL-DIRECTION.md`, incomingRaw);

  await writeRepoFile(candidatePrompt, buildActiveBotPrompt());
  await writeRepoFile(activePrompt, buildActiveBotPrompt());
  await writeRepoFile(activeKb, buildPublicKnowledgeBase());
  await writeWorkflowPromptFiles();
  await writeDeprecatedPromptStubs();
  await writeOperationalDocs();
  await writeProductDecisionFiles();

  const promptRecords = await promptRegistry();
  const knowledgeBaseRecords = await knowledgeBaseRegistry();
  const current = buildCurrentRegistry(promptRecords, knowledgeBaseRecords);
  await writeRegistryFiles(current);
  await writeRepoFile('integrations/highlevel/workflows.yaml', buildWorkflowsYaml());

  writeStdoutJson({
    generatedAt,
    schema: `${registryMetadata.schemaId}@${registryMetadata.schemaVersion}`,
    fieldCount: contactFields.length,
    activeFieldIdsRecorded: contactFields.filter((field) => field.ghlId).length,
    pendingFieldCount: contactFields.filter(
      (field) => field.deprecationState === 'pending_creation',
    ).length,
    tagCount: tags.length,
    activeTagIdsRecorded: tags.filter((tag) => tag.ghlId).length,
    pendingTagCount: tags.filter((tag) => tag.deprecationState === 'pending_creation').length,
    businessWorkflows: businessWorkflows.length,
    botActionWorkflows: botActionWorkflows.length,
    deprecatedWorkflows: deprecatedWorkflows.length,
    incomingRawSha256: sha256(incomingRaw),
    activePrompt,
    activeKnowledgeBase: activeKb,
    messagesSent: 0,
    workflowEnrollments: 0,
    stripeMutations: 0,
  });
}

function buildCurrentRegistry(prompts: PromptRecord[], knowledgeBases: PromptRecord[]) {
  return {
    schema_id: registryMetadata.schemaId,
    schema_version: registryMetadata.schemaVersion,
    status: registryMetadata.status,
    location_id: registryMetadata.locationId,
    generated_at: generatedAt,
    counts: {
      standard_contact_fields: standardContactFields.length,
      contact_custom_fields: contactFields.length,
      active_contact_custom_fields: contactFields.filter(
        (field) => field.deprecationState === 'active',
      ).length,
      pending_contact_custom_fields: contactFields.filter(
        (field) => field.deprecationState === 'pending_creation',
      ).length,
      deprecated_contact_custom_fields: contactFields.filter(
        (field) => field.deprecationState === 'deprecated_existing',
      ).length,
      tags: tags.length,
      active_tags: tags.filter((tag) => tag.deprecationState === 'active').length,
      pending_tags: tags.filter((tag) => tag.deprecationState === 'pending_creation').length,
      deprecated_tags: tags.filter((tag) => tag.deprecationState === 'deprecated_existing').length,
      custom_values: customValues.length,
      business_workflows: businessWorkflows.length,
      bot_action_workflows: botActionWorkflows.length,
      deprecated_workflows: deprecatedWorkflows.length,
    },
    standard_contact_fields: standardContactFields,
    contact_fields: contactFields,
    tags,
    custom_values: customValues,
    business_workflows: businessWorkflows,
    bot_action_workflows: botActionWorkflows,
    deprecated_workflows: deprecatedWorkflows,
    prompts,
    knowledge_bases: knowledgeBases,
    deprecations: lowercaseTagDeprecations,
    protected_import_paths: protectedImportPaths,
    safety: {
      messages_sent: 0,
      workflows_published: 0,
      production_workflow_enrollments: 0,
      stripe_mutations: 0,
      student_contacts_allowed_in_highlevel: false,
      voice_ai_launch_active: false,
      human_handoff_workflow_active: false,
      human_task_creation_active: false,
    },
  };
}

async function writeRegistryFiles(current: ReturnType<typeof buildCurrentRegistry>) {
  await writeRepoFile(
    'integrations/highlevel/registry/schema.yaml',
    yaml({
      schema_id: registryMetadata.schemaId,
      schema_version: registryMetadata.schemaVersion,
      status: registryMetadata.status,
      location_id: registryMetadata.locationId,
      created_date: registryMetadata.date,
      last_verified_date: registryMetadata.date,
      standard_contact_fields: standardContactFields.map((field) => field.canonicalName),
      safety_boundaries: [
        'HighLevel owns parent/lead CRM, marketing, WhatsApp conversations, business workflows and payment state.',
        'One Time owns Parent/Student authentication, households, learners, portals, learning access, Vimeo, Zoom, progress and gamification.',
        'Never create a Student contact or Student custom field in HighLevel.',
        'A GHL field or tag is not authorization for One Time portal access.',
      ],
    }),
  );
  await writeRepoFile('integrations/highlevel/registry/custom-fields.yaml', yaml(contactFields));
  await writeRepoFile('integrations/highlevel/registry/custom-values.yaml', yaml(customValues));
  await writeRepoFile('integrations/highlevel/registry/tag-taxonomy.yaml', yaml(tags));
  await writeRepoFile('integrations/highlevel/registry/form-field-map.yaml', yaml(formFieldMap()));
  await writeRepoFile(
    'integrations/highlevel/registry/workflow-registry.yaml',
    yaml({
      business_workflows: businessWorkflows,
      bot_action_workflows: botActionWorkflows,
      deprecated_workflows: deprecatedWorkflows,
      publishing_authorized: false,
      production_enrollment_authorized: false,
      duplicate_workflows_disabled_in_this_run: 0,
      human_task_workflows_active: 0,
    }),
  );
  await writeRepoFile(
    'integrations/highlevel/registry/bot-action-registry.yaml',
    yaml(botActionContracts()),
  );
  await writeRepoFile(
    'integrations/highlevel/registry/prompt-registry.yaml',
    yaml(current.prompts),
  );
  await writeRepoFile(
    'integrations/highlevel/registry/knowledge-base-registry.yaml',
    yaml(current.knowledge_bases),
  );
  await writeRepoFile(
    'integrations/highlevel/registry/deprecations.yaml',
    yaml({
      lowercase_tags: lowercaseTagDeprecations,
      workflows: deprecatedWorkflows,
      existing_assets_preserved_not_deleted: ['OT | Support Requested', 'One Time Support Status'],
      do_not_delete_historical_tags_until_contact_migration_reconciled: true,
    }),
  );
  await writeRepoFile('integrations/highlevel/registry/AGENT-HANDOFF.md', buildAgentHandoff());
  await writeRepoFile(
    'integrations/highlevel/registry/bot-pack-corrections.yaml',
    yaml(botPackCorrections()),
  );
  await writeRepoFile(
    'integrations/highlevel/registry/current.json',
    `${JSON.stringify(current, null, 2)}\n`,
  );
}

async function writeWorkflowPromptFiles() {
  for (const workflow of [...businessWorkflows, ...botActionWorkflows]) {
    await writeRepoFile(workflow.promptPath, workflowPrompt(workflow));
    await writeRepoFile(workflow.checklistPath, workflowChecklist(workflow));
  }
}

async function writeDeprecatedPromptStubs() {
  const deprecatedFiles = [
    [
      'integrations/highlevel/ai-workflow-prompts/OT-02-prelaunch-nurture.md',
      'Superseded by OT-02A Existing Subscriber Migration 2026 v1 and OT-02B New Lead Nurture v1.',
    ],
    [
      'integrations/highlevel/ai-workflow-prompts/OT-05-payment-failed-seven-day-grace.md',
      'Superseded by OT-05 Payment Failed / Grace.',
    ],
    [
      'integrations/highlevel/ai-workflow-prompts/OT-09-class-reminder.md',
      'Superseded by OT-09 Parent Class Reminder.',
    ],
    [
      'integrations/highlevel/ai-workflow-prompts/OT-11-whatsapp-lead-qualification.md',
      'Deprecated. OT-A1 owns public Website Live Chat and WhatsApp qualification.',
    ],
    [
      'integrations/highlevel/ai-workflow-prompts/OT-12-support-intake-technical-escalation.md',
      'Deprecated when it creates human tasks. OT-A1 handles common support routing without task creation.',
    ],
    [
      'integrations/highlevel/workflow-checklists/OT-02-prelaunch-nurture.md',
      'Superseded by OT-02A and OT-02B checklists.',
    ],
    [
      'integrations/highlevel/workflow-checklists/OT-05-payment-failed-seven-day-grace.md',
      'Superseded by OT-05 Payment Failed / Grace checklist.',
    ],
    [
      'integrations/highlevel/workflow-checklists/OT-09-class-reminder.md',
      'Superseded by OT-09 Parent Class Reminder checklist.',
    ],
    [
      'integrations/highlevel/workflow-checklists/OT-11-whatsapp-lead-qualification.md',
      'Deprecated. Do not build.',
    ],
    [
      'integrations/highlevel/workflow-checklists/OT-12-support-intake-technical-escalation.md',
      'Deprecated when it creates human tasks. Do not build.',
    ],
  ] as const;
  for (const [filePath, reason] of deprecatedFiles) {
    await writeRepoFile(
      filePath,
      [
        '# DEPRECATED - Do Not Build',
        '',
        reason,
        '',
        'Read `integrations/highlevel/registry/workflow-registry.yaml` before creating or changing One Time HighLevel workflows.',
        'Do not publish, enroll contacts, send messages, create human tasks, or create a separate WhatsApp lead-qualification workflow from this file.',
        '',
      ].join('\n'),
    );
  }
  await writeRepoFile(
    'integrations/highlevel/agent-prompts/OT-A1-one-time-enrollment-concierge.md',
    [
      '# DEPRECATED - Superseded Agent Prompt',
      '',
      'Use `integrations/highlevel/prompts/active/OT-A1-v1.0.0.md` for the canonical public One Time bot.',
      '',
      'The active bot is named OT-A1 One Time Enrollment Assistant and is limited to Website Live Chat and WhatsApp. It has no Human Handover action, no task-creation action, and no separate WhatsApp qualification bot.',
      '',
    ].join('\n'),
  );
}

async function writeOperationalDocs() {
  await writeRepoFile('integrations/highlevel/README.md', buildReadme());
  await writeRepoFile('integrations/highlevel/CHANGELOG.md', buildChangelog());
  await writeRepoFile('integrations/highlevel/imports/README.md', buildImportsReadme());
  await writeRepoFile(
    'integrations/highlevel/agent-mode/HIGHLEVEL-BOT-UI-SETUP.md',
    buildBotUiSetup(),
  );
  await writeRepoFile('integrations/highlevel/WORKFLOW-BUILD-ORDER.md', buildWorkflowBuildOrder());
  await writeRepoFile('integrations/highlevel/WORKFLOW-ID-CAPTURE.md', buildWorkflowIdCapture());
  await writeRepoFile('integrations/highlevel/WORKFLOW-TEST-MATRIX.md', buildWorkflowTestMatrix());
  await writeRepoFile('integrations/highlevel/GHL-LAUNCH-CHECKLIST.md', buildLaunchChecklist());
}

async function writeProductDecisionFiles() {
  await writeRepoFile(
    `${productDecisionDir}/DECISIONS.json`,
    `${JSON.stringify(
      {
        decision_date: '2026-07-20',
        source: 'Codex pasted direction',
        decisions: {
          one_public_bot: 'OT-A1 One Time Enrollment Assistant',
          channels: ['Website Live Chat', 'WhatsApp'],
          voice_launch: 'deferred',
          human_handoff_workflow: false,
          human_tasks: false,
          duplicate_lead_qualification_workflow: false,
          price_proactively_stated: false,
          canonical_schema_required_before_workflow_creation: true,
          imported_contacts_must_not_be_reimported: true,
          student_data_excluded_from_highlevel: true,
          future_agent_prompts_versioned_and_diffed: true,
        },
        safety: { messages_sent: 0, workflows_published: 0, stripe_mutations: 0 },
      },
      null,
      2,
    )}\n`,
  );
  await writeRepoFile(
    `${productDecisionDir}/SUMMARY.md`,
    [
      '# 2026-07-20 HighLevel Public Bot Decision',
      '',
      'One Time has one public enrollment/support bot: OT-A1 One Time Enrollment Assistant.',
      '',
      '- Initial channels: Website Live Chat and WhatsApp.',
      '- Voice AI is deferred.',
      '- No Human Handoff workflow and no human task creation.',
      '- No separate WhatsApp lead-qualification bot or workflow.',
      '- Price is not proactively stated; it is shown only when canonical pricing custom values say it is published.',
      '- Canonical registry files under `integrations/highlevel/registry/` gate future fields, tags, custom values, workflows, bot prompts, knowledge bases and imports.',
      '- Imported contacts must be reconciled from the protected manifest and map before any apply run.',
      '- Student data, Student contacts and Student custom fields remain excluded from HighLevel.',
      '',
    ].join('\n'),
  );
}

function workflowPrompt(workflow: RegistryWorkflow) {
  return [
    `# ${workflow.canonicalName} Prompt`,
    '',
    'Build in HighLevel Draft state only. Do not publish, send messages, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.',
    '',
    `Canonical registry: ${registryMetadata.schemaId}@${registryMetadata.schemaVersion}`,
    `Folder: ${workflow.folder}`,
    `Purpose: ${workflow.purpose}`,
    '',
    'Required boundaries:',
    '- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.',
    '- Preserve unrelated existing tags on contacts.',
    '- Check suppression and consent before any non-transactional communication.',
    '- Do not create human tasks or Human Handoff actions.',
    '- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames or passwords.',
    '- A GHL tag or field is not authorization for One Time portal access.',
    '',
    ...workflowSpecificLines(workflow.key),
    '',
    'Test state:',
    '- Use only a protected operator-owned test contact.',
    '- Record the workflow ID only after it exists in the verified location.',
    '- Keep publish toggle off until explicit separate approval.',
    '',
  ].join('\n');
}

function workflowSpecificLines(key: string) {
  const linesByKey: Record<string, string[]> = {
    'OT-01': [
      'Trigger after OT-B01 or public signup creates or updates the adult parent/lead contact.',
      'Apply OT | Lead and canonical source tag only when source and consent are known.',
    ],
    'OT-02A': [
      'Run only for existing subscribers in the 2026 migration segment.',
      'Use the three-email migration sequence only; do not mix it with the public lead-capture bot.',
      'Do not hardcode price or dates. Read offer and price custom values.',
    ],
    'OT-02B': [
      'Run only for new leads after consent is explicit and suppression is clear.',
      'Stop when checkout starts, suppression is applied, or customer status becomes Active.',
      'Do not ask the same lead questions already handled by OT-A1.',
    ],
    'OT-03': [
      'Handle checkout-started and abandoned-checkout state after verified checkout events exist.',
      'Do not state a price unless One Time Pricing Display Status is published and One Time Published Price Label is populated.',
    ],
    'OT-04': [
      'Handle payment active events from verified HighLevel payment state.',
      'Call One Time only through the protected billing/access adapter when registered.',
      'Do not unlock portal access from GHL alone.',
    ],
    'OT-05': [
      'Handle payment failure and grace state.',
      'Set grace fields and tags without charging or mutating Stripe.',
      'Do not send payment pressure copy.',
    ],
    'OT-06': [
      'Handle subscription cancellation state.',
      'Respect current period end when present.',
      'Do not revoke One Time access directly from a GHL tag.',
    ],
    'OT-07': [
      'Send or record parent portal invitation only after One Time confirms access eligibility.',
      'Never send usernames, passwords, activation tokens or reset tokens through HighLevel.',
    ],
    'OT-08': [
      'Record parent portal activation after One Time emits the event.',
      'Do not expose Student data or learning progress in HighLevel.',
    ],
    'OT-09': [
      'Send parent class reminders only when One Time supplies the next confirmed class state.',
      'Do not store or send permanent raw Zoom links.',
    ],
    'OT-10': [
      'Announce recording availability only through the protected One Time portal route.',
      'Never expose raw Vimeo URLs.',
    ],
    'OT-13': [
      'Record refund or chargeback state from verified payment events.',
      'Do not mutate Stripe or send customer messages from this workflow.',
    ],
    'OT-B01': [
      'Triggered only by OT-A1 after adult details are complete.',
      'Required adult fields: contact_name, family_or_school, audience_type, location, timezone, browser_timezone, email, phone when WhatsApp or Both, reminder_preference, reminder_consent, consent_context, idempotency_key, attribution.',
      'Use the protected HighLevel-to-One-Time adapter. If it is missing, block instead of putting complex consent logic into the bot prompt.',
      'Never collect Student details.',
    ],
    'OT-B02': [
      'Return or send only safe current class information from One Time.',
      'Preferred output: next confirmed class time, timezone, portal URL and whether Join Class is available.',
      'Fallback: I do not have a confirmed class update available right now. Please check the One Time portal or email info@onetimeonetime.com.',
    ],
    'OT-B03': [
      'Send only the canonical member login URL: https://join.onetimeonetime.com/login.',
      'Do not claim the account is active.',
    ],
    'OT-B04': [
      'Send only the canonical password-help URL: https://join.onetimeonetime.com/forgot-password.',
      'Use this privacy-safe message: If that email is registered for One Time, the password-help page can send a secure reset link.',
      'Do not call /api/one-time/parent-password/request.',
    ],
    'OT-B05': [
      'When the contact says STOP, unsubscribe, remove me, do not contact me, wrong number, or equivalent, set relevant channel DND, update consent and suppression fields, remove related opt-in tag, add OT | Marketing Suppressed when appropriate, remove from marketing/nurture workflows, and stop bot auto-follow-up.',
      'Send one confirmation only.',
    ],
  };
  return linesByKey[key] ?? ['Follow the canonical workflow registry.'];
}

function workflowChecklist(workflow: RegistryWorkflow) {
  return [
    `# ${workflow.canonicalName} UI Checklist`,
    '',
    `Folder: ${workflow.folder}`,
    `Registry: integrations/highlevel/registry/workflow-registry.yaml`,
    '',
    '- Build only in Draft.',
    '- Confirm every field, tag and custom value exists in `registry/current.json` before use.',
    '- No Human Handoff action.',
    '- No human task creation.',
    '- No production contact enrollment.',
    '- No outbound message send in this lane.',
    '- No Student contact, Student field or Student tag.',
    '- Record the workflow ID in `WORKFLOW-ID-CAPTURE.md` after creation.',
    '',
  ].join('\n');
}

function buildActiveBotPrompt() {
  return [
    '# OT-A1 One Time Enrollment Assistant v1.0.0',
    '',
    'You are OT-A1 One Time Enrollment Assistant for One Time Mishnayos with Rabbi Eli Scheller.',
    '',
    'Channels: Website Live Chat and WhatsApp. Voice AI is deferred.',
    '',
    'Primary job:',
    '- Help an adult parent, guardian, family or school contact understand One Time.',
    '- Help them join early access, complete signup, choose email or WhatsApp reminders, find Member Login, find Password Help, see safe next confirmed class information, find the protected portal for recordings, find the current checkout link only when published, and opt out.',
    '',
    'Allowed collection:',
    '- Adult contact name.',
    '- Family or school name.',
    '- Audience type: Family or School.',
    '- Location and timezone.',
    '- Email.',
    '- Phone only when WhatsApp or Both is selected.',
    '- Reminder preference and explicit channel consent.',
    '',
    'Never collect or expose:',
    '- Student passwords, usernames, private Student data or detailed child information.',
    '- Raw Zoom links, raw Vimeo links, activation or reset tokens.',
    '- Payment-card data, internal IDs or secrets.',
    '',
    'Boundaries:',
    '- Do not pretend to be Rabbi Scheller.',
    '- Do not provide Torah rulings or halachic advice.',
    '- Do not invent class information, schedule notices, promotions or price.',
    '- Do not proactively state a price.',
    '- Price may be shown only when One Time Pricing Display Status equals published and One Time Published Price Label contains the current approved value.',
    '- Do not promise that a person will follow up automatically.',
    '- Do not create a Human Handover action.',
    '- Do not create human tasks.',
    '- Do not create a separate WhatsApp lead-qualification bot or workflow.',
    '- Keep One Time and BNA Academy records separate.',
    '',
    'Fallback:',
    'If you cannot answer from approved knowledge, say exactly: I do not have that information confirmed. Please email info@onetimeonetime.com.',
    '',
    'Actions:',
    '- Complete Signup: use OT-B01 only after adult details and consent are complete.',
    '- Next Confirmed Class Info: use OT-B02; never return host URLs, raw permanent Zoom links, ZAK, Meeting SDK secrets or reusable passcodes.',
    '- Member Login: use OT-B03 and send https://join.onetimeonetime.com/login.',
    '- Password Help: use OT-B04 and send https://join.onetimeonetime.com/forgot-password. Say: If that email is registered for One Time, the password-help page can send a secure reset link.',
    '- Opt-Out: use OT-B05 when the contact says STOP, unsubscribe, remove me, do not contact me, wrong number or equivalent. Send one confirmation only.',
    '',
    'Signup success handling:',
    '- One Time Signup Status = Confirmed.',
    '- Apply OT | Lead.',
    '- Apply the canonical source tag.',
    '- Apply consent tags only when consent is explicit.',
    '- Trigger OT-01 at most once when the workflow ID exists and production enrollment is separately approved.',
    '- Do not send a duplicate confirmation if One Time already queues one.',
    '',
  ].join('\n');
}

function buildPublicKnowledgeBase() {
  return [
    '# One Time Mishnayos - Public Program and Support v1.0.0',
    '',
    'One Time Mishnayos is taught live by Rabbi Eli Scheller from Eretz Yisrael.',
    '',
    'The experience is designed to build consistency, accountability, understanding and excitement in Torah learning. Students can interact live with Rabbi Scheller through the One Time experience.',
    '',
    'One Time has separate Parent and Student experiences. The public signup is for an adult parent, guardian, family or school contact. The bot never collects a Student password, Student username or detailed child information.',
    '',
    'Class recordings, progress, rewards and review may be available through the One Time portal. Recording access is through the protected portal, never through raw Vimeo links.',
    '',
    'Normal class time is read from the One Time Class Time Israel custom value. The next confirmed class state comes from One Time, not static bot knowledge.',
    '',
    'Member Login uses https://join.onetimeonetime.com/login.',
    '',
    'Password Help uses https://join.onetimeonetime.com/forgot-password. The safe message is: If that email is registered for One Time, the password-help page can send a secure reset link.',
    '',
    'Current price is not proactively stated. Price may be shown only when One Time Pricing Display Status is published and One Time Published Price Label contains the current approved value. Billing information comes from the verified checkout/payment system.',
    '',
    'For unconfirmed information, use: I do not have that information confirmed. Please email info@onetimeonetime.com.',
    '',
    'One Time and BNA Academy records remain separate.',
    '',
  ].join('\n');
}

function buildAgentHandoff() {
  return [
    'Before creating or changing a One Time HighLevel field, tag, custom value, workflow, form mapping, bot prompt, knowledge base or contact import, read the canonical registry under integrations/highlevel/registry/. Do not create an unregistered asset.',
    '',
    '# One Time HighLevel Agent Handoff',
    '',
    `Canonical schema: ${registryMetadata.schemaId}@${registryMetadata.schemaVersion}`,
    '',
    'Canonical bot:',
    '- OT-A1 One Time Enrollment Assistant.',
    '- Channels: Website Live Chat and WhatsApp.',
    '- Voice AI deferred.',
    '- No Human Handover action.',
    '- No task-creation action.',
    '- No separate WhatsApp lead-qualification bot or workflow.',
    '',
    'Workflow boundary:',
    '- Business workflows: OT-01, OT-02A, OT-02B, OT-03, OT-04, OT-05, OT-06, OT-07, OT-08, OT-09, OT-10, OT-13.',
    '- Bot-action workflows: OT-B01, OT-B02, OT-B03, OT-B04, OT-B05.',
    '- Deprecated: OT-11, OT-12 when it creates tasks, OT - Human Handoff and duplicate lead-capture workflows.',
    '',
    'Safety:',
    '- Do not create Student contacts, Student fields or Student tags in HighLevel.',
    '- Do not send messages, publish workflows, enroll production contacts, mutate Stripe or expose private One Time links unless a later task explicitly authorizes the exact action.',
    '- Reconcile protected import manifest and contact map before any contact import write.',
    '',
  ].join('\n');
}

function buildReadme() {
  return [
    '# One Time HighLevel Integration',
    '',
    `Canonical registry: ${registryMetadata.schemaId}@${registryMetadata.schemaVersion}`,
    '',
    'Start here before changing any HighLevel asset:',
    '- `integrations/highlevel/registry/AGENT-HANDOFF.md`',
    '- `integrations/highlevel/registry/current.json`',
    '- `integrations/highlevel/registry/schema.yaml`',
    '',
    'Active bot prompt:',
    '- `integrations/highlevel/prompts/active/OT-A1-v1.0.0.md`',
    '',
    'Active public knowledge base:',
    '- `integrations/highlevel/knowledge-bases/active/one-time-public-kb-v1.0.0.md`',
    '',
    'Safety line: no messages, workflow publishing, production enrollment, Stripe mutation, Student contact creation or raw private link exposure is authorized by this registry package.',
    '',
  ].join('\n');
}

function buildChangelog() {
  return [
    '# HighLevel Changelog',
    '',
    '## 2026-07-20 - Schema 1.0.0',
    '',
    '- Created canonical One Time HighLevel registry.',
    '- Corrected OT-A1 into one public Website Live Chat and WhatsApp bot.',
    '- Deferred Voice AI.',
    '- Removed Human Handoff and human-task creation from active bot/workflow contracts.',
    '- Split existing-subscriber migration from new-lead nurture.',
    '- Deprecated OT-11, OT-12 task-based support escalation and lowercase tag family.',
    '- Registered protected contact-import reconciliation paths without committing raw contact data.',
    '',
  ].join('\n');
}

function buildImportsReadme() {
  return [
    '# HighLevel Contact Imports',
    '',
    'Protected import files live outside Git:',
    `- CSV: ${protectedImportPaths.csv}`,
    `- Manifest: ${protectedImportPaths.manifest}`,
    `- Contact map: ${protectedImportPaths.contactMap}`,
    `- Errors: ${protectedImportPaths.errors}`,
    `- Reconciliation: ${protectedImportPaths.reconciliation}`,
    '',
    'Before any write, run `npm run highlevel:contacts:reconcile` and confirm counts-only status.',
    '',
    'Dedupe order:',
    '1. Existing recorded GHL contact ID.',
    '2. Normalized email.',
    '3. Normalized phone.',
    '4. Never name alone.',
    '',
    'Do not enroll imported contacts into workflows and do not send messages from import tooling.',
    '',
  ].join('\n');
}

function buildBotUiSetup() {
  return [
    '# HighLevel Bot UI Setup',
    '',
    'Bot: OT-A1 One Time Enrollment Assistant',
    '',
    '- Type: Prompt-Based Conversation AI.',
    '- Channels: Website Live Chat and WhatsApp.',
    '- Voice: deferred.',
    '- Human Handover action: disabled / not configured.',
    '- Task creation: disabled / not configured.',
    '- Knowledge base: One Time Mishnayos - Public Program and Support v1.0.0.',
    '- Prompt: `integrations/highlevel/prompts/active/OT-A1-v1.0.0.md`.',
    '',
    'Configure bot actions only through the registered OT-B01..OT-B05 workflows and adapters. Keep everything in Draft/test until explicit production channel approval.',
    '',
  ].join('\n');
}

function buildWorkflowBuildOrder() {
  return [
    '# HighLevel Workflow Build Order',
    '',
    'Build in Draft state only. Do not publish or enroll production contacts.',
    '',
    ...[...businessWorkflows, ...botActionWorkflows].map(
      (workflow, index) =>
        `${index + 1}. ${workflow.canonicalName} - ${workflow.folder} - ${workflow.promptPath}`,
    ),
    '',
    'Deprecated / do not build:',
    ...deprecatedWorkflows.map((workflow) => `- ${workflow.canonicalName}`),
    '',
  ].join('\n');
}

function buildWorkflowIdCapture() {
  return [
    '# HighLevel Workflow ID Capture',
    '',
    'Record IDs only after the workflow exists in the verified One Time location. Leave publish state Draft unless separately approved.',
    '',
    '| Key | Workflow | Type | Folder | Workflow ID | UI Status |',
    '| --- | --- | --- | --- | --- | --- |',
    ...[...businessWorkflows, ...botActionWorkflows].map(
      (workflow) =>
        `| ${workflow.key} | ${workflow.canonicalName} | ${workflow.objectType} | ${workflow.folder} |  | draft_ui_setup_required |`,
    ),
    '',
    'Duplicate/deprecated workflows disabled in this run: 0.',
    'Human task workflows active: 0.',
    '',
  ].join('\n');
}

function buildWorkflowTestMatrix() {
  return [
    '# HighLevel Workflow Test Matrix',
    '',
    '| Workflow | Test contact | Expected mutation | Message send | Publish toggle |',
    '| --- | --- | --- | --- | --- |',
    ...[...businessWorkflows, ...botActionWorkflows].map(
      (workflow) =>
        `| ${workflow.canonicalName} | Protected operator-owned test contact only | Registered fields/tags only | 0 in this lane | Draft until approved |`,
    ),
    '',
  ].join('\n');
}

function buildLaunchChecklist() {
  return [
    '# HighLevel Launch Checklist',
    '',
    '- Validate registry: `npm run highlevel:registry:check`.',
    '- Export current registry: `npm run highlevel:registry:export`.',
    '- Reconcile assets before UI changes: `npm run highlevel:assets:reconcile`.',
    '- Reconcile contact import before any write: `npm run highlevel:contacts:reconcile`.',
    '- Keep workflows Draft until explicit approval.',
    '- Keep OT-A1 in test routing until explicit production channel approval.',
    '- Do not hardcode price. Use pricing custom values.',
    '- Do not create Student contacts, Student fields or Student tags.',
    '- Do not send messages, publish workflows, enroll production contacts or mutate Stripe in this lane.',
    '',
  ].join('\n');
}

function formFieldMap() {
  return [
    { form_field: 'adult_name', maps_to: 'Full Name', object_type: 'standard_contact_field' },
    { form_field: 'email', maps_to: 'Email', object_type: 'standard_contact_field' },
    { form_field: 'phone', maps_to: 'Phone', object_type: 'standard_contact_field' },
    {
      form_field: 'family_or_school',
      maps_to: 'One Time Family or School Name',
      object_type: 'contact_custom_field',
    },
    {
      form_field: 'audience_type',
      maps_to: 'One Time Audience Type',
      object_type: 'contact_custom_field',
    },
    {
      form_field: 'reminder_preference',
      maps_to: 'One Time Reminder Preference',
      object_type: 'contact_custom_field',
    },
    {
      form_field: 'source_channel',
      maps_to: 'One Time Source Channel',
      object_type: 'contact_custom_field',
    },
    {
      form_field: 'signup_status',
      maps_to: 'One Time Signup Status',
      object_type: 'contact_custom_field',
    },
  ];
}

function botActionContracts() {
  return {
    bot_id: 'OT-A1',
    bot_name: 'OT-A1 One Time Enrollment Assistant',
    actions: [
      {
        key: 'OT-B01',
        name: 'Complete Signup',
        adapter_required: true,
        student_data_allowed: false,
      },
      { key: 'OT-B02', name: 'Send Next Confirmed Class Info', raw_zoom_link_allowed: false },
      { key: 'OT-B03', name: 'Send Member Login', url: 'https://join.onetimeonetime.com/login' },
      {
        key: 'OT-B04',
        name: 'Send Password Help',
        url: 'https://join.onetimeonetime.com/forgot-password',
        obsolete_route_forbidden: '/api/one-time/parent-password/request',
      },
      {
        key: 'OT-B05',
        name: 'Apply Opt-Out',
        updates_dnd: true,
        sends_one_confirmation_only: true,
      },
    ],
  };
}

function botPackCorrections() {
  return {
    incoming_file: incomingTarget,
    missing_named_pack_note: missingNamedPackNote,
    retained_sections: [
      'One Time public program description',
      'Rabbi Eli Scheller from Eretz Yisrael',
      'Parent and Student experiences',
      'Member Login',
      'Password Help',
      'Opt-out behavior',
    ],
    modified_sections: [
      'Bot name changed to OT-A1 One Time Enrollment Assistant',
      'Channels limited to Website Live Chat and WhatsApp',
      'Support routing changed to confirmed fallback email without promised follow-up',
      'Price moved behind pricing custom values',
      'Class info moved behind One Time adapter/current state',
    ],
    removed_sections: [
      'Voice AI launch requirement',
      'Human Handoff',
      'Human task creation',
      'Separate WhatsApp lead-qualification bot/workflow',
      'Student data collection',
      'Raw Zoom or Vimeo link exposure',
      'Old password reset API',
      'Hardcoded price',
    ],
    route_corrections: [
      {
        from: '/api/one-time/parent-password/request',
        to: 'https://join.onetimeonetime.com/forgot-password',
      },
      { from: 'BNA workspace routing', to: 'standalone One Time URLs' },
    ],
    tag_field_mappings: lowercaseTagDeprecations,
    workflow_deprecations: deprecatedWorkflows.map((workflow) => workflow.canonicalName),
    pricing_corrections: [
      'Do not proactively state price',
      'Use One Time Pricing Display Status and One Time Published Price Label',
    ],
    password_help_correction:
      'Use canonical forgot-password URL and the privacy-safe registered-email wording.',
    human_task_removal: true,
  };
}

async function promptRegistry(): Promise<PromptRecord[]> {
  const activeWorkflows = [...businessWorkflows, ...botActionWorkflows];
  return [
    await promptRecord({
      promptId: 'incoming-ghl-one-time-rabbi-scheller-bot-paste-pack',
      status: 'incoming',
      title: 'Incoming GHL One Time Rabbi Scheller Bot Paste Pack',
      filePath: incomingTarget,
      source: 'Codex pasted direction preserved as raw incoming source',
      supersededBy: 'OT-A1-v1.0.0',
    }),
    await promptRecord({
      promptId: 'OT-A1',
      status: 'candidate',
      title: 'OT-A1 One Time Enrollment Assistant',
      filePath: candidatePrompt,
      source: 'Corrected candidate from incoming bot pack direction',
      supersedes: ['incoming-ghl-one-time-rabbi-scheller-bot-paste-pack'],
    }),
    await promptRecord({
      promptId: 'OT-A1',
      status: 'active',
      title: 'OT-A1 One Time Enrollment Assistant',
      filePath: activePrompt,
      source: 'Approved active canonical bot prompt',
      approvedDate: registryMetadata.date,
      supersedes: ['incoming-ghl-one-time-rabbi-scheller-bot-paste-pack'],
    }),
    ...(await Promise.all(
      activeWorkflows.map((workflow) =>
        promptRecord({
          promptId: workflow.key,
          status: 'active',
          title: workflow.canonicalName,
          filePath: workflow.promptPath,
          source: 'Canonical workflow prompt generated from registry',
          requiredWorkflows: [workflow.key],
        }),
      ),
    )),
  ];
}

async function knowledgeBaseRegistry(): Promise<PromptRecord[]> {
  return [
    await promptRecord({
      promptId: 'OT-KB-PUBLIC-1',
      status: 'active',
      title: 'One Time Mishnayos - Public Program and Support',
      filePath: activeKb,
      source: 'Corrected public knowledge base from incoming bot pack direction',
      approvedDate: registryMetadata.date,
      requiredCustomValues: [
        'One Time Class Time Israel',
        'One Time Pricing Display Status',
        'One Time Published Price Label',
        'One Time Support Email',
      ],
    }),
  ];
}

async function promptRecord(input: {
  promptId: string;
  status: PromptStatus;
  title: string;
  filePath: string;
  source: string;
  approvedDate?: string;
  supersedes?: string[];
  supersededBy?: string;
  requiredWorkflows?: string[];
  requiredCustomValues?: string[];
}): Promise<PromptRecord> {
  const body = await readRepoFile(input.filePath);
  return {
    prompt_id: input.promptId,
    semantic_version: '1.0.0',
    status: input.status,
    title: input.title,
    file_path: input.filePath,
    sha256: sha256(body),
    source: input.source,
    created_date: registryMetadata.date,
    approved_date: input.approvedDate ?? '',
    ghl_asset_id: '',
    required_fields: [
      'One Time Email Consent',
      'One Time WhatsApp Consent',
      'One Time Suppression State',
      'One Time Signup Status',
    ],
    required_tags: ['OT | Lead', 'OT | Marketing Suppressed'],
    required_custom_values: input.requiredCustomValues ?? [
      'One Time Support Email',
      'One Time Member Login URL',
      'One Time Password Help URL',
      'One Time Pricing Display Status',
      'One Time Published Price Label',
    ],
    required_workflows: input.requiredWorkflows ?? [
      'OT-B01',
      'OT-B02',
      'OT-B03',
      'OT-B04',
      'OT-B05',
    ],
    test_contact_reference: 'protected_operator_owned_test_contact',
    last_tested_date: '',
    supersedes: input.supersedes ?? [],
    superseded_by: input.supersededBy ?? '',
  };
}

function buildWorkflowsYaml() {
  const activeWorkflows = [...businessWorkflows, ...botActionWorkflows];
  return yaml({
    version: 4,
    schema_id: registryMetadata.schemaId,
    schema_version: registryMetadata.schemaVersion,
    status: 'canonical_registry_ready_ui_required',
    location_id: registryMetadata.locationId,
    last_reconciled_at: generatedAt,
    messages_sent_authorized: false,
    workflow_publish_authorized: false,
    production_workflow_enrollment_authorized: false,
    workflow_folders: unique(activeWorkflows.map((workflow) => workflow.folder)).map((name) => ({
      name,
    })),
    custom_fields: contactFields,
    tags,
    custom_values: customValues,
    pipeline: {
      name: 'One Time Business',
      id: 'T8xEp9woujGVqvNJlqoz',
      stages: {
        lead: 'a59ea712-d1e0-44e6-ac57-419fb3c71367',
        checkout_started: '00cf536c-25ce-46a5-a292-1a72822d565f',
        active_customer: '3177add5-e536-4a5f-a969-fc4f2cb00f83',
        grace: '3e567591-4cc9-403c-a4b8-b843712ddd86',
        canceled: '3cebc246-f63f-4cb1-87f3-72e139efd455',
        former: '68680d55-15d4-42c3-b5be-dbb26a27c9cc',
      },
    },
    canonical_bot: {
      id: 'OT-A1',
      name: 'OT-A1 One Time Enrollment Assistant',
      prompt_file: activePrompt,
      knowledge_base_file: activeKb,
      channels: ['Website Live Chat', 'WhatsApp'],
      voice_ai: 'deferred',
      human_handoff_action: false,
      task_creation_action: false,
    },
    workflows: activeWorkflows,
    deprecated_workflows: deprecatedWorkflows,
    contact_import: protectedImportPaths,
  });
}

function parseArgs(argv: string[]): Args {
  let incomingPath: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--incoming') incomingPath = argv[(index += 1)] ?? null;
    else if (value?.startsWith('--incoming=')) incomingPath = value.slice('--incoming='.length);
  }
  return { incomingPath };
}

async function readIncoming(filePath: string | null) {
  if (!filePath) return `# Missing incoming source\n\n${missingNamedPackNote}\n`;
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return `# Missing incoming source\n\nRequested source path was unavailable: ${filePath}\n\n${missingNamedPackNote}\n`;
  }
}

async function ensureDirectories(paths: string[]) {
  await Promise.all(paths.map((entry) => mkdir(path.join(repoRoot, entry), { recursive: true })));
}

async function writeRepoFile(filePath: string, body: string) {
  const absolute = path.join(repoRoot, filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, body, 'utf8');
}

async function readRepoFile(filePath: string) {
  return readFile(path.join(repoRoot, filePath), 'utf8');
}

function yaml(value: unknown) {
  return `${yamlNode(value, 0)}\n`;
}

function yamlNode(value: unknown, indent: number): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return `${spaces(indent)}[]`;
    return value
      .map((entry) => {
        if (isScalar(entry)) return `${spaces(indent)}- ${yamlScalar(entry)}`;
        return `${spaces(indent)}-\n${yamlNode(entry, indent + 2)}`;
      })
      .join('\n');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return `${spaces(indent)}{}`;
    return entries
      .map(([key, entry]) => {
        if (isScalar(entry)) return `${spaces(indent)}${key}: ${yamlScalar(entry)}`;
        return `${spaces(indent)}${key}:\n${yamlNode(entry, indent + 2)}`;
      })
      .join('\n');
  }
  return `${spaces(indent)}${yamlScalar(value)}`;
}

function yamlScalar(value: unknown) {
  if (value === null || value === undefined) return "''";
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function isScalar(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function spaces(count: number) {
  return ' '.repeat(count);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
