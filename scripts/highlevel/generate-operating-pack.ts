import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type ActivationEntry = {
  name?: string;
  id?: string | null;
  fieldKey?: string | null;
  dataType?: string | null;
  status?: string | null;
};

type ActivationReport = {
  location?: { status?: string; safeRef?: string | null };
  customFields?: ActivationEntry[];
  tags?: ActivationEntry[];
  pipeline?: {
    name?: string;
    id?: string | null;
    stages?: Array<{ name?: string | null; id?: string | null; position?: number | null }>;
  };
  workflows?: {
    present?: Array<{ name: string; id: string | null; status: string | null }>;
    missing?: string[];
  };
};

type WorkflowDefinition = {
  key: string;
  name: string;
  folder: string;
  trigger: string;
  triggerFilters: string[];
  reEntry: string;
  stopOnResponse: string;
  businessWindow: string;
  tags: string[];
  customFields: string[];
  branches: string[];
  waits: string[];
  messageTemplates: string[];
  handoffs: string[];
  opportunityStage: string;
  tasks: string[];
  webhooks: string[];
  stopConditions: string[];
  testProcedure: string[];
  rollback: string;
};

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const privateDir = args.privateDir ?? 'C:/Users/User/.onetime-highlevel-private';
const activationReportPath =
  args.activationReport ?? path.join(privateDir, 'activation-report-idempotent.json');
const generatedAt = new Date().toISOString();
const locationId = 'pBSnOK2nkdxp6gf9Rg3o';

const workflowFolders = [
  '00 - Intake & Data',
  '10 - Nurture & Sales',
  '20 - Billing & Access',
  '30 - Portal Lifecycle',
  '40 - Classes & Content',
  '50 - Support',
  '90 - Internal Operations',
];

const customFields = [
  'One Time Parent ID',
  'One Time Household ID',
  'One Time Customer Status',
  'One Time Portal Status',
  'One Time Access Status',
  'One Time Grace Until',
  'One Time Complimentary Until',
  'One Time Last Sync',
  'One Time Signup Source',
  'One Time CRM Contact ID',
  'One Time Import Batch',
  'One Time Source Classification',
  'One Time Email Consent',
  'One Time WhatsApp Consent',
  'One Time Suppression State',
  'One Time Suppression Reason',
  'One Time Current Period End',
  'One Time Subscription ID',
  'One Time Next Class At',
  'One Time Class Time Zone',
  'One Time Support Status',
];

const tags = [
  'OT | Lead',
  'OT | Prelaunch',
  'OT | Checkout Started',
  'OT | Active',
  'OT | Grace',
  'OT | Canceled',
  'OT | Former',
  'OT | Complimentary',
  'OT | Portal Invited',
  'OT | Portal Active',
  'OT | Email Opt-In',
  'OT | WhatsApp Opt-In',
  'OT | Marketing Suppressed',
  'OT | Signup Website',
  'OT | Signup WhatsApp',
  'OT | Consent Unknown',
  'OT | Payment Failed',
  'OT | Refunded',
  'OT | Chargeback',
  'OT | Support Requested',
  'OT | Source | Rabbi Followers',
  'OT | Source | Subscribed Audience',
  'OT | Source | Cleaned Audience',
  'OT | Source | Legacy Subscriber',
  'OT | Source | Existing One Time CRM',
  'OT | Duplicate Merged',
  'OT | Identity Conflict',
  'OT | Class Reminder Pending',
  'OT | Recording Available',
];

const campaignSeedCopy = [
  'Subject: Join One Time Mishnayos with Rabbi Eli Scheller',
  'Preheader: Live daily Mishnayos at 7:00 p.m. Israel time - free until Rosh Hashanah.',
  '',
  'Hello,',
  '',
  'One Time Mishnayos with Rabbi Eli Scheller is open for signup.',
  '',
  'Give your son a love for learning Torah with a live daily Mishnayos class at 7:00 p.m. Israel time, live from Eretz Yisrael.',
  '',
  'Join now - free until Rosh Hashanah.',
  '',
  'Sign up: https://join.onetimeonetime.com/signup',
  '',
  '- One Time Mishnayos',
];

const workflows: WorkflowDefinition[] = [
  {
    key: 'OT-01',
    name: 'OT-01 New Lead Intake',
    folder: '00 - Intake & Data',
    trigger:
      'Contact is manually or API-enrolled after One Time public signup, WhatsApp lead capture, or approved import review.',
    triggerFilters: [
      'Contact has OT | Lead.',
      'Contact has OT | Signup Website or OT | Signup WhatsApp.',
      'Contact does not have OT | Marketing Suppressed.',
      'Contact is a parent or lead contact, never a Student contact.',
    ],
    reEntry:
      'Allow re-entry only after the contact exits and a new signup source or import batch value is present.',
    stopOnResponse:
      'Stop marketing messages when the contact replies and create a human follow-up task.',
    businessWindow:
      'Use Asia/Jerusalem. Send human-facing messages Sunday-Thursday 9:00-20:30 unless the message is a transactional acknowledgement.',
    tags: ['OT | Lead', 'OT | Prelaunch', 'OT | Signup Website', 'OT | Signup WhatsApp'],
    customFields: [
      'One Time CRM Contact ID',
      'One Time Signup Source',
      'One Time Customer Status',
      'One Time Email Consent',
      'One Time WhatsApp Consent',
      'One Time Suppression State',
    ],
    branches: [
      'If suppressed, remove from this workflow and do not send.',
      'If explicit email opt-in, use email-safe acknowledgement.',
      'If explicit WhatsApp opt-in, use WhatsApp-safe acknowledgement.',
      'If consent unknown, create internal task only.',
    ],
    waits: ['Wait 5 minutes after entry before any non-transactional follow-up.'],
    messageTemplates: [
      'OT New Lead Acknowledgement - DRAFT, parent-facing, no class link.',
      'OT Internal New Lead Review Task - no outbound message.',
    ],
    handoffs: ['If launch audience and not suppressed, hand off to OT-02 Prelaunch Nurture.'],
    opportunityStage: 'Create or move opportunity to One Time Business / Lead.',
    tasks: [
      'Create internal task when consent is unknown or the source classification needs review.',
    ],
    webhooks: ['No outbound webhook required for initial lead capture.'],
    stopConditions: [
      'OT | Marketing Suppressed is present.',
      'OT | Active is present.',
      'Contact replies STOP, unsubscribe, or asks not to be contacted.',
    ],
    testProcedure: [
      'Use one operator-owned test contact.',
      'Add OT | Lead and OT | Signup Website.',
      'Confirm Lead opportunity stage, consent gate, and no Student fields.',
    ],
    rollback: 'Disable workflow and remove only test contact enrollment.',
  },
  {
    key: 'OT-02',
    name: 'OT-02 Prelaunch Nurture',
    folder: '10 - Nurture & Sales',
    trigger: 'Tag OT | Prelaunch is added or OT-01 hands off after consent checks.',
    triggerFilters: [
      'Contact is not suppressed.',
      'Contact has explicit email opt-in or explicit WhatsApp opt-in.',
      'Contact is not active, canceled, refunded, or chargeback.',
    ],
    reEntry: 'Allow re-entry once per import batch or new signup source.',
    stopOnResponse: 'Stop sequence on any reply and create human task.',
    businessWindow: 'Asia/Jerusalem; Sunday-Thursday 9:00-20:30.',
    tags: ['OT | Prelaunch', 'OT | Email Opt-In', 'OT | WhatsApp Opt-In'],
    customFields: [
      'One Time Import Batch',
      'One Time Source Classification',
      'One Time Email Consent',
      'One Time WhatsApp Consent',
      'One Time Suppression State',
    ],
    branches: [
      'Email branch only when OT | Email Opt-In is present.',
      'WhatsApp branch only when OT | WhatsApp Opt-In is present.',
      'Consent unknown branch creates task and stops without sending.',
    ],
    waits: ['Wait 1 day after intake.', 'Wait 3 days between nurture touches.'],
    messageTemplates: [
      'OT Prelaunch Seed Email - use approved seed copy below only for seed/testing until broad-send approval.',
      ...campaignSeedCopy,
      'OT Prelaunch WhatsApp Draft - DRAFT ONLY, no promise, price, or deadline beyond approved copy.',
    ],
    handoffs: ['Stop when checkout starts and hand off to OT-03.'],
    opportunityStage: 'Keep opportunity in Lead unless checkout begins.',
    tasks: ['Create task for high-intent replies or consent ambiguity.'],
    webhooks: ['None.'],
    stopConditions: [
      'Suppression, reply, payment active, checkout started, cancellation, refund, chargeback.',
    ],
    testProcedure: [
      'Run one email-opt-in test contact.',
      'Run one consent-unknown test contact and confirm no outbound message.',
    ],
    rollback: 'Disable workflow and remove test contact enrollment.',
  },
  {
    key: 'OT-03',
    name: 'OT-03 Checkout Started / Abandoned',
    folder: '20 - Billing & Access',
    trigger: 'GHL checkout started event, GHL Stripe state, or manual move to Checkout Started.',
    triggerFilters: [
      'Parent/lead contact only.',
      'Not suppressed.',
      'No active payment already processed.',
    ],
    reEntry: 'Allow once per checkout attempt or subscription ID.',
    stopOnResponse: 'Stop reminder sequence on reply and create task.',
    businessWindow: 'Asia/Jerusalem; Sunday-Thursday 9:00-20:30.',
    tags: ['OT | Checkout Started', 'OT | Lead', 'OT | Prelaunch'],
    customFields: ['One Time Customer Status', 'One Time Subscription ID', 'One Time Last Sync'],
    branches: [
      'If payment succeeds, stop and hand off to OT-04.',
      'If suppressed, stop.',
      'If no consent, create task only.',
    ],
    waits: [
      'Wait 30 minutes before first abandoned-checkout reminder.',
      'Wait 24 hours before final internal task.',
    ],
    messageTemplates: [
      'OT Checkout Reminder - DRAFT; no pricing promise unless configured in GHL checkout.',
    ],
    handoffs: ['Payment active to OT-04.', 'Payment failure to OT-05.'],
    opportunityStage: 'Move opportunity to One Time Business / Checkout Started.',
    tasks: ['Create abandoned checkout follow-up task after final wait.'],
    webhooks: ['Optional checkout.started webhook only after One Time endpoint is registered.'],
    stopConditions: ['Payment active, cancellation, suppression, reply, manual review.'],
    testProcedure: [
      'Move test opportunity to Checkout Started.',
      'Confirm no class link or portal credentials are sent.',
    ],
    rollback: 'Disable workflow; move only test opportunity back to Lead if needed.',
  },
  {
    key: 'OT-04',
    name: 'OT-04 Payment Active',
    folder: '20 - Billing & Access',
    trigger: 'GHL Stripe subscription active or payment succeeded.',
    triggerFilters: [
      'Known One Time parent contact or deterministic GHL contact link.',
      'Not refunded or chargeback.',
    ],
    reEntry: 'Allow per subscription ID and payment event ID.',
    stopOnResponse:
      'Do not stop transactional webhook; stop optional marketing follow-up on reply.',
    businessWindow:
      'Transactional actions may run anytime; human-facing messages follow business window.',
    tags: ['OT | Active'],
    customFields: [
      'One Time Customer Status',
      'One Time Access Status',
      'One Time Current Period End',
      'One Time Subscription ID',
    ],
    branches: [
      'If active subscription, add OT | Active and remove Grace/Canceled/Former when appropriate.',
      'If webhook fails, retry and create task.',
    ],
    waits: ['No wait for webhook.', 'Optional welcome follow-up waits 10 minutes.'],
    messageTemplates: [
      'OT Payment Confirmation - DRAFT; activation credentials are sent only by One Time/Resend.',
    ],
    handoffs: [
      'Hand off to OT-07 Parent Portal Invitation after One Time entitlement projection confirms access.',
    ],
    opportunityStage: 'Move opportunity to One Time Business / Active Customer.',
    tasks: ['Create task if current period end is missing or webhook retry fails.'],
    webhooks: ['subscription.active or payment.succeeded minimized webhook to One Time.'],
    stopConditions: ['Refund, chargeback, cancellation, suppression for optional messages.'],
    testProcedure: [
      'Use GHL test subscription/contact only.',
      'Confirm minimized webhook payload and no portal unlock from tag alone.',
    ],
    rollback: 'Disable workflow; remove only test tags/stage changes.',
  },
  {
    key: 'OT-05',
    name: 'OT-05 Payment Failed / Seven-Day Grace',
    folder: '20 - Billing & Access',
    trigger: 'GHL Stripe payment failed.',
    triggerFilters: [
      'Known One Time parent contact.',
      'Not refund or chargeback.',
      'Not suppressed for reminder sends.',
    ],
    reEntry: 'Allow once per failed payment event ID.',
    stopOnResponse: 'Stop reminder sequence on reply and create billing task.',
    businessWindow: 'Asia/Jerusalem; Sunday-Thursday 9:00-20:30 for reminders.',
    tags: ['OT | Grace', 'OT | Payment Failed'],
    customFields: ['One Time Grace Until', 'One Time Access Status', 'One Time Subscription ID'],
    branches: [
      'If payment recovered, stop and hand off to OT-04.',
      'If canceled, stop and hand off to OT-06.',
      'If chargeback/refund, stop and hand off to OT-13.',
    ],
    waits: ['Day 0 notice.', 'Day 3 reminder.', 'Day 6 final reminder.'],
    messageTemplates: ['OT Payment Retry Reminder - DRAFT; no pressure copy.'],
    handoffs: ['Recovered to OT-04.', 'Canceled to OT-06.', 'Refund/chargeback to OT-13.'],
    opportunityStage: 'Move opportunity to One Time Business / Grace.',
    tasks: ['Create billing task on final failed reminder or webhook failure.'],
    webhooks: ['payment.failed minimized webhook to One Time.'],
    stopConditions: [
      'Payment recovered, cancellation, refund, chargeback, suppression, reply, manual review.',
    ],
    testProcedure: [
      'Trigger failed payment on test contact.',
      'Confirm seven-day grace fields and no immediate portal revocation.',
    ],
    rollback: 'Disable workflow; clear test-only failed-payment tags.',
  },
  {
    key: 'OT-06',
    name: 'OT-06 Subscription Canceled',
    folder: '20 - Billing & Access',
    trigger: 'GHL Stripe subscription canceled.',
    triggerFilters: ['Known One Time parent contact.'],
    reEntry: 'Allow once per subscription cancellation event ID.',
    stopOnResponse: 'Create task on reply; transactional webhook still runs.',
    businessWindow:
      'Transactional actions may run anytime; optional messages follow business window.',
    tags: ['OT | Canceled', 'OT | Former'],
    customFields: [
      'One Time Customer Status',
      'One Time Access Status',
      'One Time Current Period End',
      'One Time Last Sync',
    ],
    branches: [
      'If current_period_end exists, keep access active through that date.',
      'If missing current_period_end, create manual review task.',
    ],
    waits: ['No wait for webhook.', 'Optional end-of-period task waits until current_period_end.'],
    messageTemplates: [
      'OT Cancellation Confirmation - DRAFT; no immediate access revocation promise.',
    ],
    handoffs: ['Refund or chargeback to OT-13.'],
    opportunityStage:
      'Move opportunity to Canceled, then Former after current period end when applicable.',
    tasks: ['Create task for missing current_period_end or webhook failure.'],
    webhooks: ['subscription.canceled minimized webhook to One Time.'],
    stopConditions: ['Refund, chargeback, suppression for optional messages.'],
    testProcedure: [
      'Cancel test subscription.',
      'Confirm current period handling and minimized webhook.',
    ],
    rollback: 'Disable workflow; restore only test opportunity stage if needed.',
  },
  {
    key: 'OT-07',
    name: 'OT-07 Parent Portal Invitation',
    folder: '30 - Portal Lifecycle',
    trigger:
      'One Time emits portal invitation business event after entitlement projection confirms access.',
    triggerFilters: ['Parent contact only.', 'Local access is active, grace, or complimentary.'],
    reEntry: 'Allow when One Time Portal Status changes back to invitation_pending.',
    stopOnResponse: 'Create support task on reply.',
    businessWindow: 'Asia/Jerusalem; Sunday-Thursday 9:00-20:30.',
    tags: ['OT | Portal Invited'],
    customFields: ['One Time Portal Status', 'One Time Access Status', 'One Time Last Sync'],
    branches: [
      'If no channel consent, create internal task only.',
      'If suppressed, do not send marketing follow-up.',
    ],
    waits: ['Wait 10 minutes after One Time transactional activation email.'],
    messageTemplates: [
      'OT Portal Invitation Follow-Up - DRAFT; never include passwords or reset links.',
    ],
    handoffs: ['Portal activation event to OT-08.'],
    opportunityStage: 'No billing stage change.',
    tasks: ['Task if invite is not activated after 48 hours.'],
    webhooks: ['None. One Time remains source of auth truth.'],
    stopConditions: ['Portal active, suppression, reply, access inactive.'],
    testProcedure: [
      'Use test parent contact with active entitlement.',
      'Confirm no credentials are sent through HighLevel.',
    ],
    rollback: 'Disable workflow and clear only test task/enrollment.',
  },
  {
    key: 'OT-08',
    name: 'OT-08 Parent Portal Activated',
    folder: '30 - Portal Lifecycle',
    trigger: 'One Time emits portal activated business event.',
    triggerFilters: ['Parent contact only.'],
    reEntry: 'Do not re-enter unless Portal Status changes from inactive to active again.',
    stopOnResponse: 'Create task on reply.',
    businessWindow: 'Asia/Jerusalem; Sunday-Thursday 9:00-20:30.',
    tags: ['OT | Portal Active'],
    customFields: ['One Time Portal Status', 'One Time Last Sync'],
    branches: [
      'If active customer, optional welcome branch.',
      'If complimentary, optional internal review branch.',
    ],
    waits: ['Optional welcome wait 1 hour after activation.'],
    messageTemplates: ['OT Portal Activated Welcome - DRAFT.'],
    handoffs: ['None.'],
    opportunityStage: 'No billing stage change.',
    tasks: ['Create task only when activation conflicts with access status.'],
    webhooks: ['None.'],
    stopConditions: ['Suppression for optional messages, reply, access inactive.'],
    testProcedure: ['Emit test portal activated event.', 'Confirm tag only; no auth mutation.'],
    rollback: 'Disable workflow and remove only test enrollment.',
  },
  {
    key: 'OT-09',
    name: 'OT-09 Class Reminder',
    folder: '40 - Classes & Content',
    trigger:
      'One Time emits next class reminder event or GHL scheduled parent reminder after local access check.',
    triggerFilters: [
      'Parent contact only.',
      'Explicit channel opt-in.',
      'Not suppressed.',
      'Access active, grace, or complimentary.',
    ],
    reEntry: 'Allow per class occurrence when One Time Next Class At changes.',
    stopOnResponse: 'Stop reminder and create task on reply.',
    businessWindow: 'Asia/Jerusalem; class reminders may send near 19:00 Israel time.',
    tags: ['OT | Class Reminder Pending', 'OT | Email Opt-In', 'OT | WhatsApp Opt-In'],
    customFields: ['One Time Next Class At', 'One Time Class Time Zone', 'One Time Access Status'],
    branches: [
      'Email reminder branch.',
      'WhatsApp reminder branch.',
      'No-consent internal task branch.',
    ],
    waits: ['Wait until configured reminder time.'],
    messageTemplates: ['OT Class Reminder - DRAFT; parent-facing only, no student contact.'],
    handoffs: ['None.'],
    opportunityStage: 'No billing stage change.',
    tasks: ['Task if class time is missing or timezone is invalid.'],
    webhooks: ['None.'],
    stopConditions: ['Suppression, no access, no consent, reply, class canceled.'],
    testProcedure: ['Set test Next Class At.', 'Confirm parent-facing message only.'],
    rollback: 'Disable workflow and clear test reminder tag.',
  },
  {
    key: 'OT-10',
    name: 'OT-10 New Recording Available',
    folder: '40 - Classes & Content',
    trigger: 'One Time emits recording available business event.',
    triggerFilters: [
      'Parent contact only.',
      'Access active, grace, or complimentary.',
      'Not suppressed.',
      'Explicit channel opt-in for any message.',
    ],
    reEntry: 'Allow once per recording/content event ID.',
    stopOnResponse: 'Stop optional messages and create task.',
    businessWindow: 'Asia/Jerusalem; Sunday-Thursday 9:00-20:30.',
    tags: ['OT | Recording Available'],
    customFields: ['One Time Access Status', 'One Time Last Sync'],
    branches: [
      'Email notice branch.',
      'WhatsApp notice branch.',
      'No-consent internal task branch.',
    ],
    waits: ['Wait 15 minutes after content publish confirmation.'],
    messageTemplates: [
      'OT Recording Available - DRAFT; reference parent portal only, never raw Vimeo credentials.',
    ],
    handoffs: ['None.'],
    opportunityStage: 'No billing stage change.',
    tasks: ['Task if access or recording state conflicts.'],
    webhooks: ['None.'],
    stopConditions: ['Suppression, no access, no consent, reply, recording unpublished.'],
    testProcedure: ['Use test content event.', 'Confirm no Vimeo credentials or private URLs.'],
    rollback: 'Disable workflow and clear test tag.',
  },
  {
    key: 'OT-11',
    name: 'OT-11 WhatsApp Lead Qualification',
    folder: '00 - Intake & Data',
    trigger:
      'Agent Studio / Conversation AI creates or updates a WhatsApp lead and applies OT | Signup WhatsApp.',
    triggerFilters: [
      'WhatsApp opt-in captured explicitly.',
      'Not suppressed.',
      'No Student data collected.',
    ],
    reEntry: 'Allow after new inbound WhatsApp conversation starts or consent changes.',
    stopOnResponse:
      'Conversation AI handles active replies; human handoff stops automation when uncertain.',
    businessWindow:
      'Inbound response anytime; outbound follow-up Sunday-Thursday 9:00-20:30 Asia/Jerusalem.',
    tags: ['OT | Lead', 'OT | Signup WhatsApp', 'OT | WhatsApp Opt-In'],
    customFields: [
      'One Time WhatsApp Consent',
      'One Time Signup Source',
      'One Time Source Classification',
    ],
    branches: [
      'Qualified family lead to OT-01.',
      'Existing-customer support issue to OT-12.',
      'Uncertain or sensitive question to human.',
    ],
    waits: [
      'No automated wait before AI response.',
      'Wait 10 minutes before internal task if handoff required.',
    ],
    messageTemplates: ['Conversation AI uses OT-A1 One Time Enrollment Concierge prompt.'],
    handoffs: ['Qualified lead to OT-01 or OT-02.', 'Support issue to OT-12.'],
    opportunityStage: 'Create or move opportunity to Lead when qualified.',
    tasks: ['Create task for human handoff, identity conflict, or STOP handling.'],
    webhooks: ['No webhook unless One Time lead intake endpoint is registered.'],
    stopConditions: ['STOP/opt-out, suppression, existing technical support, human handoff.'],
    testProcedure: [
      'Use test WhatsApp contact.',
      'Confirm separate consent capture and no Student fields.',
    ],
    rollback: 'Disable workflow and Agent Studio assignment for test channel only.',
  },
  {
    key: 'OT-12',
    name: 'OT-12 Support Intake / Technical Escalation',
    folder: '50 - Support',
    trigger:
      'Support requested tag, Conversation AI handoff, inbound reply needing technical help, or One Time support event.',
    triggerFilters: [
      'Known parent/contact or qualified lead.',
      'No passwords, student data, or raw private notes in workflow fields.',
    ],
    reEntry: 'Allow per new support event or unresolved task reopen.',
    stopOnResponse: 'Replies update the support task and keep human review active.',
    businessWindow: 'Support tasks anytime; outbound replies by human/operator policy.',
    tags: ['OT | Support Requested'],
    customFields: ['One Time Support Status', 'One Time CRM Contact ID', 'One Time Last Sync'],
    branches: [
      'Existing customer technical issue.',
      'Prospect enrollment question.',
      'Billing/support issue.',
      'Sensitive or uncertain -> human.',
    ],
    waits: ['Wait 30 minutes before escalation reminder if task remains unassigned.'],
    messageTemplates: [
      'OT Support Intake Acknowledgement - DRAFT; no credentials, no Torah rulings.',
    ],
    handoffs: ['Billing issue can hand off to OT-05/OT-06/OT-13 only after state is confirmed.'],
    opportunityStage: 'No automatic sales stage change.',
    tasks: ['Create support task assigned to owner/admin queue.'],
    webhooks: ['Optional minimized support status webhook only after endpoint is registered.'],
    stopConditions: [
      'Support resolved, suppression for optional messages, sensitive-data request.',
    ],
    testProcedure: [
      'Apply support tag to test contact.',
      'Confirm task and no raw sensitive fields.',
    ],
    rollback: 'Disable workflow and close test task.',
  },
  {
    key: 'OT-13',
    name: 'OT-13 Refund / Chargeback',
    folder: '20 - Billing & Access',
    trigger: 'GHL Stripe refund, full refund, partial refund, or chargeback event.',
    triggerFilters: ['Known parent/contact or subscription ID.', 'Payment event ID present.'],
    reEntry: 'Allow once per provider event ID.',
    stopOnResponse: 'Create billing task on reply; transactional webhook still runs.',
    businessWindow: 'Transactional webhook anytime; human-facing messages by policy.',
    tags: ['OT | Refunded', 'OT | Chargeback'],
    customFields: [
      'One Time Customer Status',
      'One Time Access Status',
      'One Time Current Period End',
      'One Time Subscription ID',
    ],
    branches: [
      'Full refund -> immediate inactive entitlement webhook.',
      'Chargeback -> immediate inactive entitlement webhook and owner task.',
      'Partial refund -> manual review, no automatic revoke.',
    ],
    waits: ['No wait for entitlement webhook.', 'Wait 0 minutes for owner alert task.'],
    messageTemplates: ['No automatic customer message unless operator approves exact copy.'],
    handoffs: ['Can close OT-05 failed-payment reminders and OT-06 cancellation follow-up.'],
    opportunityStage: 'Move to Former or manual review based on event type.',
    tasks: ['Create urgent owner billing task for chargeback or ambiguous refund.'],
    webhooks: ['refund.full or chargeback minimized webhook to One Time.'],
    stopConditions: ['Manual review complete, event duplicate, missing provider event ID.'],
    testProcedure: [
      'Use test payment event only.',
      'Confirm no live Stripe mutation and no customer message.',
    ],
    rollback: 'Disable workflow and revert only test opportunity stage/tag.',
  },
];

await main();

async function main() {
  const activationReport = await readActivationReport(activationReportPath);
  await mkdir(path.join(repoRoot, 'integrations/highlevel/ai-workflow-prompts'), {
    recursive: true,
  });
  await mkdir(path.join(repoRoot, 'integrations/highlevel/agent-prompts'), { recursive: true });
  await mkdir(path.join(repoRoot, 'integrations/highlevel/workflow-checklists'), {
    recursive: true,
  });

  await Promise.all([
    ...workflows.map((workflow) => writeWorkflowPrompt(workflow)),
    ...workflows.map((workflow) => writeWorkflowChecklist(workflow)),
    writeAgentPrompt(),
    writeBuildOrder(),
    writeTestMatrix(),
    writeIdCapture(activationReport),
    writeLaunchChecklist(),
    writeWorkflowYaml(activationReport),
  ]);
}

async function readActivationReport(filePath: string): Promise<ActivationReport> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as ActivationReport;
    return parsed;
  } catch {
    return {};
  }
}

async function writeWorkflowPrompt(workflow: WorkflowDefinition) {
  const body = [
    `# ${workflow.name} AI Builder Prompt`,
    '',
    'Copy the text below into HighLevel AI Builder. Build in Draft state only.',
    '',
    '```text',
    `Create a HighLevel workflow named "${workflow.name}".`,
    `Place it in folder "${workflow.folder}".`,
    '',
    `Trigger: ${workflow.trigger}`,
    `Trigger filters: ${sentenceList(workflow.triggerFilters)}`,
    `Re-entry: ${workflow.reEntry}`,
    `Stop on response: ${workflow.stopOnResponse}`,
    `Timezone/business window: ${workflow.businessWindow}`,
    `Tags to use: ${workflow.tags.join(', ')}`,
    `Custom fields to use: ${workflow.customFields.join(', ')}`,
    '',
    'Build these If/Else branches:',
    ...workflow.branches.map((entry) => `- ${entry}`),
    '',
    'Add these waits:',
    ...workflow.waits.map((entry) => `- ${entry}`),
    '',
    'Messages/templates by exact safe name:',
    ...workflow.messageTemplates.map((entry) => `- ${entry}`),
    '',
    `Workflow-to-workflow handoffs: ${sentenceList(workflow.handoffs)}`,
    `Opportunity stage changes: ${workflow.opportunityStage}`,
    `Tasks/internal notifications: ${sentenceList(workflow.tasks)}`,
    `Custom webhook actions to One Time: ${sentenceList(workflow.webhooks)}`,
    `Stop conditions: ${sentenceList(workflow.stopConditions)}`,
    '',
    'Consent and suppression gates:',
    '- Check OT | Marketing Suppressed before any outbound message.',
    '- Check One Time Email Consent and OT | Email Opt-In before email.',
    '- Check One Time WhatsApp Consent and OT | WhatsApp Opt-In before WhatsApp.',
    '- Unknown consent may create an internal task, but must not send a campaign message.',
    '- STOP, unsubscribe, complaint, hard bounce, and manual suppression win over every other branch.',
    '',
    'Safety boundaries:',
    '- Never create or message Student contacts.',
    '- Never include Student names, ages, passwords, private notes, progress, attendance, Vimeo credentials, Zoom links, reset links, or raw internal IDs.',
    '- Never unlock One Time portal access from a HighLevel tag alone.',
    '- Never send a campaign, publish the workflow, or enroll production contacts from this prompt.',
    '',
    'Test procedure:',
    ...workflow.testProcedure.map((entry) => `- ${entry}`),
    '',
    'Publish checklist:',
    '- Leave workflow in Draft.',
    '- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.',
    '- Test with the protected operator-owned test contact only.',
    '- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.',
    '- Publish only after separate operator approval.',
    '```',
    '',
  ].join('\n');
  await writeFile(promptPath(workflow), body, 'utf8');
}

async function writeWorkflowChecklist(workflow: WorkflowDefinition) {
  const body = [
    `# ${workflow.name} UI Checklist`,
    '',
    `Folder: ${workflow.folder}`,
    `Prompt file: ${relativePath(promptPath(workflow))}`,
    '',
    '## Manual Fields AI Builder Cannot Safely Infer',
    `- Exact trigger: ${workflow.trigger}`,
    `- Trigger filters: ${sentenceList(workflow.triggerFilters)}`,
    `- Opportunity stage: ${workflow.opportunityStage}`,
    `- Webhook actions: ${sentenceList(workflow.webhooks)}`,
    `- Publish toggle: leave Draft until explicitly approved.`,
    '',
    '## Exact Trigger Test',
    ...workflow.testProcedure.map((entry) => `- ${entry}`),
    '',
    '## Expected Result',
    `- Tags/fields: ${workflow.tags.join(', ')}; ${workflow.customFields.join(', ')}`,
    `- Outbound webhook: ${sentenceList(workflow.webhooks)}`,
    `- Messages: ${workflow.messageTemplates[0] ?? 'None'}`,
    `- Stop conditions: ${sentenceList(workflow.stopConditions)}`,
    '',
    '## Workflow ID Location',
    '- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.',
    '- Copy the same ID into integrations/highlevel/workflows.yaml.',
    '',
    '## Rollback / Disable',
    `- ${workflow.rollback}`,
    '',
  ].join('\n');
  await writeFile(checklistPath(workflow), body, 'utf8');
}

async function writeAgentPrompt() {
  const body = [
    '# OT-A1 One Time Enrollment Concierge',
    '',
    'Copy the prompt below into HighLevel Agent Studio / Conversation AI. Use Draft/test assignment only until the operator approves production channel routing.',
    '',
    '```text',
    'You are OT-A1 One Time Enrollment Concierge for One Time Mishnayos with Rabbi Eli Scheller.',
    '',
    'Purpose:',
    '- Answer basic class and enrollment questions using only approved One Time facts.',
    '- Help a parent or guardian decide whether the live daily Mishnayos class is relevant.',
    '- Collect the minimum lead details needed for follow-up.',
    '',
    'Allowed collection:',
    '- Parent/guardian first name and last name.',
    '- Parent/guardian email.',
    '- Parent/guardian WhatsApp or phone only if they choose WhatsApp follow-up.',
    '- Separate explicit email consent and WhatsApp consent.',
    '- Signup source = WhatsApp lead intake.',
    '',
    'Forbidden collection:',
    '- Do not ask for Student names, ages, passwords, medical details, private learner notes, payment-card details, portal credentials, or sensitive family details.',
    '- Do not expose internal IDs, tokens, workflow details, field IDs, tag IDs, or webhook URLs.',
    '- Do not provide Torah rulings or fabricate class information.',
    '',
    'Behavior:',
    '- Be concise, warm, and parent-facing.',
    '- If the user asks for details not in approved One Time facts, say you will have a human follow up.',
    '- If the user says STOP, unsubscribe, no WhatsApp, no email, or do not contact me, immediately mark suppression/opt-out and stop outreach.',
    '- If the user is an existing customer with a technical or portal issue, route to OT-12 Support Intake / Technical Escalation.',
    '- If uncertain, sensitive, angry, or legally/payment-risky, hand off to a human.',
    '',
    'HighLevel actions:',
    '- Create or update one parent/lead contact only.',
    '- Apply OT | Lead and OT | Signup WhatsApp when appropriate.',
    '- Apply OT | WhatsApp Opt-In only after explicit WhatsApp consent.',
    '- Apply OT | Email Opt-In only after explicit email consent.',
    '- Apply OT | Consent Unknown if consent is unclear.',
    '- Apply OT | Marketing Suppressed for STOP, unsubscribe, complaint, hard bounce, or manual suppression.',
    '- Set One Time Signup Source, One Time Source Classification, One Time Email Consent, One Time WhatsApp Consent, One Time Suppression State, and One Time Last Sync.',
    '- Create or update an opportunity in One Time Business / Lead when qualified.',
    '- Enroll qualified contacts into OT-01 New Lead Intake or OT-02 Prelaunch Nurture only after the workflow IDs are recorded and production enrollment is separately approved.',
    '',
    'Never send class links, portal links, reset links, payment links, Vimeo links, Zoom links, or broad campaign copy from this agent unless a specific approved template is attached by an operator.',
    '```',
    '',
  ].join('\n');
  await writeFile(
    path.join(
      repoRoot,
      'integrations/highlevel/agent-prompts/OT-A1-one-time-enrollment-concierge.md',
    ),
    body,
    'utf8',
  );
}

async function writeBuildOrder() {
  const order = [
    'OT-01',
    'OT-02',
    'OT-11',
    'OT-03',
    'OT-04',
    'OT-05',
    'OT-06',
    'OT-13',
    'OT-07',
    'OT-08',
    'OT-09',
    'OT-10',
    'OT-12',
  ];
  const body = [
    '# HighLevel Workflow Build Order',
    '',
    'Build every workflow in Draft state. Do not publish or enroll production contacts.',
    '',
    ...order.map((key, index) => {
      const workflow = workflows.find((entry) => entry.key === key);
      return `${index + 1}. ${workflow?.name ?? key} - ${workflow?.folder ?? ''} - ${relativePath(promptPath(workflow as WorkflowDefinition))}`;
    }),
    '',
    'Folder system:',
    ...workflowFolders.map((folder) => `- ${folder}`),
    '',
  ].join('\n');
  await writeFile(
    path.join(repoRoot, 'integrations/highlevel/WORKFLOW-BUILD-ORDER.md'),
    body,
    'utf8',
  );
}

async function writeTestMatrix() {
  const lines = [
    '# HighLevel Workflow Test Matrix',
    '',
    '| Workflow | Folder | Test contact | Expected tags/fields | Expected webhook | Expected messages | Stop conditions | Publish toggle |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...workflows
      .map((workflow) =>
        [
          workflow.name,
          workflow.folder,
          'Protected operator-owned test contact only',
          `${workflow.tags.join(', ')} / ${workflow.customFields.join(', ')}`,
          sentenceList(workflow.webhooks),
          workflow.messageTemplates[0] ?? 'None',
          sentenceList(workflow.stopConditions),
          'Draft until approved',
        ]
          .map(markdownCell)
          .join(' | '),
      )
      .map((row) => `| ${row} |`),
    '',
  ];
  await writeFile(
    path.join(repoRoot, 'integrations/highlevel/WORKFLOW-TEST-MATRIX.md'),
    lines.join('\n'),
    'utf8',
  );
}

async function writeIdCapture(report: ActivationReport) {
  const present = new Map(
    (report.workflows?.present ?? []).map((workflow) => [workflow.name, workflow.id ?? '']),
  );
  const body = [
    '# HighLevel Workflow ID Capture',
    '',
    'Record IDs only after the workflow exists in the verified One Time location. Leave publish state Draft unless separately approved.',
    '',
    '| Key | Workflow | Folder | Workflow ID | UI Status | Prompt | Checklist |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...workflows.map(
      (workflow) =>
        `| ${workflow.key} | ${workflow.name} | ${workflow.folder} | ${present.get(workflow.name) ?? ''} | draft_ui_setup_required | ${relativePath(promptPath(workflow))} | ${relativePath(checklistPath(workflow))} |`,
    ),
    '',
    'Workflow IDs captured: 0/13 unless nonblank IDs are filled above from HighLevel UI.',
    '',
  ].join('\n');
  await writeFile(
    path.join(repoRoot, 'integrations/highlevel/WORKFLOW-ID-CAPTURE.md'),
    body,
    'utf8',
  );
}

async function writeLaunchChecklist() {
  const body = [
    '# HighLevel Launch Checklist',
    '',
    '## Hard Stops',
    '- Do not publish workflows without explicit operator approval.',
    '- Do not enroll production contacts during initial import.',
    '- Do not send campaigns, WhatsApp broadcasts, SMS, or billing/payment changes in this lane.',
    '- Do not create Student contacts or Student fields in HighLevel.',
    '',
    '## Asset Readiness',
    '- Confirm location ID `pBSnOK2nkdxp6gf9Rg3o`.',
    '- Confirm all custom fields and tags in workflows.yaml have IDs.',
    '- Confirm the One Time Business pipeline exists.',
    '- Confirm AI workflow prompt files and Agent Studio prompt exist.',
    '',
    '## Contact Import',
    '- Run protected dry run: `tsx scripts/highlevel/contact-import-package.ts --dry-run`.',
    '- Review counts only.',
    '- Apply only after dry-run counts are acceptable: `tsx scripts/highlevel/contact-import-package.ts --apply`.',
    '- Confirm messages sent = 0 and workflow enrollments = 0.',
    '',
    '## Workflow UI',
    '- Create folders in HighLevel.',
    '- Build workflows in WORKFLOW-BUILD-ORDER.md order.',
    '- Use prompt files under ai-workflow-prompts.',
    '- Test with protected operator-owned test contact only.',
    '- Record workflow IDs in WORKFLOW-ID-CAPTURE.md and workflows.yaml.',
    '- Keep publish toggles off until separate approval.',
    '',
    '## Final Evidence',
    '- Safe repo evidence may include counts, IDs, fingerprints, timestamps, statuses, and sanitized errors.',
    '- Protected local evidence path: `C:/Users/User/.onetime-highlevel-private/imports/`.',
    '',
  ].join('\n');
  await writeFile(
    path.join(repoRoot, 'integrations/highlevel/GHL-LAUNCH-CHECKLIST.md'),
    body,
    'utf8',
  );
}

async function writeWorkflowYaml(report: ActivationReport) {
  const fieldByName = new Map(
    (report.customFields ?? []).map((entry) => [entry.name ?? '', entry]),
  );
  const tagByName = new Map((report.tags ?? []).map((entry) => [entry.name ?? '', entry]));
  const workflowByName = new Map(
    (report.workflows?.present ?? []).map((entry) => [entry.name, entry]),
  );
  const pipeline = report.pipeline ?? {};
  const lines = [
    'version: 3',
    "status: 'operating_pack_ready_workflows_ui_required'",
    `location_id: ${yamlString(locationId)}`,
    `last_reconciled_at: ${yamlString(generatedAt)}`,
    'messages_sent_authorized: false',
    'workflow_publish_authorized: false',
    'production_workflow_enrollment_authorized: false',
    'setup_evidence:',
    "  - '2026-07-20: PIT connectivity verified for the configured sub-account/location.'",
    "  - '2026-07-20: Required One Time custom fields and tags created, then idempotency-verified.'",
    "  - '2026-07-20: Minimal One Time Business pipeline created, then idempotency-verified.'",
    `  - ${yamlString(`${generatedAt}: Launch operating prompt pack generated; workflows still require Draft UI build and ID capture.`)}`,
    "  - 'Private raw activation and import reports are stored outside Git under C:/Users/User/.onetime-highlevel-private/.'",
    'workflow_folders:',
    ...workflowFolders.map((folder) => `  - name: ${yamlString(folder)}`),
    'custom_fields:',
    ...customFields.flatMap((label) => {
      const entry = fieldByName.get(label);
      return [
        `  ${slug(label)}:`,
        `    label: ${yamlString(label)}`,
        `    field_id: ${yamlString(entry?.id ?? '')}`,
        `    field_key: ${yamlString(entry?.fieldKey ?? fieldKeyFor(label))}`,
        `    data_type: ${yamlString(entry?.dataType ?? 'TEXT')}`,
      ];
    }),
    'tags:',
    ...tags.flatMap((name) => {
      const entry = tagByName.get(name);
      return [`  - name: ${yamlString(name)}`, `    tag_id: ${yamlString(entry?.id ?? '')}`];
    }),
    'pipeline:',
    `  name: ${yamlString(pipeline.name ?? 'One Time Business')}`,
    `  id: ${yamlString(pipeline.id ?? '')}`,
    '  stages:',
    ...(pipeline.stages ?? []).flatMap((stage) => [
      `    ${slug(stage.name ?? 'stage')}: ${yamlString(stage.id ?? '')}`,
    ]),
    'webhook_event_contract:',
    '  endpoint_not_registered_in_this_lane: true',
    "  content_type: 'application/json'",
    '  allowed_events:',
    "    - 'subscription.active'",
    "    - 'payment.succeeded'",
    "    - 'payment.failed'",
    "    - 'payment.recovered'",
    "    - 'subscription.canceled'",
    "    - 'refund.full'",
    "    - 'chargeback'",
    'agent_prompts:',
    '  - key: OT-A1',
    "    name: 'OT-A1 One Time Enrollment Concierge'",
    "    prompt_file: 'integrations/highlevel/agent-prompts/OT-A1-one-time-enrollment-concierge.md'",
    'workflow_prompt_files:',
    ...workflows.map(
      (workflow) => `  ${workflow.key}: ${yamlString(relativePath(promptPath(workflow)))}`,
    ),
    'workflows:',
    ...workflows.flatMap((workflow) => {
      const present = workflowByName.get(workflow.name);
      return [
        `  - key: ${workflow.key}`,
        `    name: ${yamlString(workflow.name)}`,
        `    folder: ${yamlString(workflow.folder)}`,
        `    workflow_id: ${yamlString(present?.id ?? '')}`,
        `    status: ${yamlString(present?.id ? 'draft_id_recorded_needs_review' : 'planned_ui_setup')}`,
        `    prompt_file: ${yamlString(relativePath(promptPath(workflow)))}`,
        `    checklist_file: ${yamlString(relativePath(checklistPath(workflow)))}`,
        `    api_enrollment_allowed_after_id_exists: ${workflow.key === 'OT-01' || workflow.key === 'OT-02' ? 'true' : 'false'}`,
      ];
    }),
    'contact_import:',
    "  protected_output_dir: 'C:/Users/User/.onetime-highlevel-private/imports'",
    "  csv: 'C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-contacts.csv'",
    "  manifest: 'C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-import-manifest.private.json'",
    "  contact_map: 'C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-contact-map.private.json'",
    "  errors: 'C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-import-errors.private.json'",
    "  script: 'scripts/highlevel/contact-import-package.ts'",
    '  sends_authorized: false',
    '  workflow_enrollment_authorized: false',
    '',
  ];
  await writeFile(
    path.join(repoRoot, 'integrations/highlevel/workflows.yaml'),
    lines.join('\n'),
    'utf8',
  );
}

function promptPath(workflow: WorkflowDefinition) {
  return path.join(
    repoRoot,
    'integrations/highlevel/ai-workflow-prompts',
    `${workflow.key}-${fileSlug(workflow.name.replace(`${workflow.key} `, ''))}.md`,
  );
}

function checklistPath(workflow: WorkflowDefinition) {
  return path.join(
    repoRoot,
    'integrations/highlevel/workflow-checklists',
    `${workflow.key}-${fileSlug(workflow.name.replace(`${workflow.key} `, ''))}.md`,
  );
}

function sentenceList(values: string[]) {
  if (values.length === 0) return 'None.';
  return values.join(' ');
}

function markdownCell(value: string) {
  return value.replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function relativePath(value: string) {
  return path.relative(repoRoot, value).replaceAll('\\', '/');
}

function yamlString(value: string | null | undefined) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function slug(value: string) {
  return fileSlug(value).replaceAll('-', '_');
}

function fileSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function fieldKeyFor(label: string) {
  return `contact.${slug(label)}`;
}

function parseArgs(argv: string[]) {
  const parsed: { privateDir?: string; activationReport?: string } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value) continue;
    if (value === '--private-dir') {
      const next = argv[(index += 1)];
      if (next) parsed.privateDir = next;
    } else if (value === '--activation-report') {
      const next = argv[(index += 1)];
      if (next) parsed.activationReport = next;
    } else if (value.startsWith('--private-dir=')) parsed.privateDir = value.slice(14);
    else if (value.startsWith('--activation-report=')) {
      parsed.activationReport = value.slice('--activation-report='.length);
    }
  }
  return parsed;
}
