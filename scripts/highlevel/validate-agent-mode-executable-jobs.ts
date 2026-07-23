import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  EXECUTABLE_WORKFLOW_JOB_IDS,
  buildExecutableWorkflowReport,
  executableWorkflowSpecs,
  otE01RepairSubjob,
} from './agent-mode-executable-specs.ts';

type QueueEntry = {
  job_id: string;
  job_file: string;
  workflow_key?: string;
  workflow_id?: string;
  execution_mode?: string;
  reviewed_subjob_ids?: string[];
};

type Queue = {
  schema_version: string;
  location_id: string;
  ordered_jobs: QueueEntry[];
};

type ExportJob = {
  job_id: string;
  canonical_source_files?: string[];
  execution_contract?: unknown;
  reviewed_subjobs?: Array<{ subjob_id?: string }>;
};

type AgentExport = {
  schema_version: string;
  jobs: ExportJob[];
};

type Pr115Result = {
  scope: {
    customerOrBroadMessagesSent: number;
    contactMutations: number;
    enrollmentMutations: number;
    studentContactsCreated: number;
  };
  preservedAssets: {
    'OT-E01': {
      id: string;
      observedStatus: string;
      publishedSwitchObserved: boolean;
      immediateConfirmationAction: string;
    };
    'OT-C01': {
      canonicalCampaign: {
        lastKnownStatus: string;
        selectedRecipients: number;
        sends: number;
      };
      sameNameWorkflowWrapper: {
        id: string;
        observedAfter: string;
        status: string;
      };
    };
  };
};

const repoRoot = process.cwd();
const queuePath = 'integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json';
const exportPath = 'integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json';
const reportPath = 'integrations/highlevel/agent-mode/GHL-EXECUTABLE-WORKFLOW-REPORT.md';
const pr115ResultPath =
  'integrations/highlevel/agent-mode/results/GHL-UI-14-18-20260723.result.json';

await main();

async function main() {
  const queue = await readJson<Queue>(queuePath);
  const agentExport = await readJson<AgentExport>(exportPath);
  const pr115 = await readJson<Pr115Result>(pr115ResultPath);
  const errors: string[] = [];

  requireValue(queue.schema_version === '1.2.0', 'queue_schema_version', errors);
  requireValue(agentExport.schema_version === '1.2.0', 'export_schema_version', errors);
  requireValue(queue.location_id === 'pBSnOK2nkdxp6gf9Rg3o', 'canonical_location', errors);

  const queueIds = queue.ordered_jobs.map((entry) => entry.job_id);
  requireValue(new Set(queueIds).size === queueIds.length, 'queue_job_ids_unique', errors);
  requireValue(
    EXECUTABLE_WORKFLOW_JOB_IDS.every((jobId) => queueIds.includes(jobId)),
    'executable_jobs_queued',
    errors,
  );

  for (const spec of executableWorkflowSpecs) {
    const queueEntry = queue.ordered_jobs.find((entry) => entry.job_id === spec.job_id);
    const exported = agentExport.jobs.find((job) => job.job_id === spec.job_id);
    requireValue(
      queueEntry?.workflow_key === spec.workflow.canonical_key,
      `${spec.job_id}_key`,
      errors,
    );
    requireValue(queueEntry?.workflow_id === spec.workflow.ghl_id, `${spec.job_id}_id`, errors);
    requireValue(
      queueEntry?.execution_mode === 'reviewed_bounded_activation',
      `${spec.job_id}_execution_mode`,
      errors,
    );
    requireValue(Boolean(exported?.execution_contract), `${spec.job_id}_export_contract`, errors);
    if (!queueEntry) continue;
    const fileJob = await readJson<ExportJob>(queueEntry.job_file);
    requireValue(
      stableJson(fileJob) === stableJson(exported),
      `${spec.job_id}_job_export_parity`,
      errors,
    );
    for (const source of fileJob.canonical_source_files ?? []) {
      requireValue(await fileExists(source), `${spec.job_id}_source_missing:${source}`, errors);
    }
    validateSpec(spec, errors);
  }

  const queue04 = queue.ordered_jobs.find((entry) => entry.job_id === 'GHL-UI-04');
  const export04 = agentExport.jobs.find((entry) => entry.job_id === 'GHL-UI-04');
  requireValue(
    queue04?.reviewed_subjob_ids?.includes(otE01RepairSubjob.subjob_id) === true,
    'ot_e01_subjob_queued_under_04',
    errors,
  );
  requireValue(
    export04?.reviewed_subjobs?.filter((subjob) => subjob.subjob_id === otE01RepairSubjob.subjob_id)
      .length === 1,
    'ot_e01_subjob_exactly_once',
    errors,
  );

  validatePr115State(pr115, errors);
  const report = await readText(reportPath);
  requireValue(
    compactReport(report) === compactReport(buildExecutableWorkflowReport()),
    'deterministic_report',
    errors,
  );

  if (errors.length) {
    process.stderr.write(`${JSON.stringify({ status: 'failed', errors }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        status: 'passed',
        location_id: queue.location_id,
        executable_jobs: [...EXECUTABLE_WORKFLOW_JOB_IDS],
        reused_subjob: otE01RepairSubjob.subjob_id,
        external_mutations: 0,
      },
      null,
      2,
    )}\n`,
  );
}

function validateSpec(spec: (typeof executableWorkflowSpecs)[number], errors: string[]) {
  requireValue(spec.application_contract.version === '1.0.0', `${spec.job_id}_version`, errors);
  requireValue(spec.application_contract.adult_only, `${spec.job_id}_adult_only`, errors);
  requireValue(spec.message.subject.length > 0, `${spec.job_id}_subject`, errors);
  requireValue(spec.message.body.length > 0, `${spec.job_id}_body`, errors);
  requireValue(spec.message.cta.label.length > 0, `${spec.job_id}_cta`, errors);
  requireValue(spec.sender.sender_key === 'brand', `${spec.job_id}_sender`, errors);
  requireValue(
    spec.sender.reply_to.key === 'one_time_default_reply_to',
    `${spec.job_id}_reply_to`,
    errors,
  );
  requireValue(
    spec.suppression_precedence.some((gate) => /unsubscribe/i.test(gate)) &&
      spec.suppression_precedence.some((gate) => /complaint/i.test(gate)) &&
      spec.suppression_precedence.some((gate) => /hard bounce/i.test(gate)) &&
      spec.suppression_precedence.some((gate) => /DND/i.test(gate)),
    `${spec.job_id}_suppression_precedence`,
    errors,
  );
  requireValue(spec.configuration_run.messages_sent === 0, `${spec.job_id}_config_no_send`, errors);
  requireValue(spec.controlled_test.messages_max === 1, `${spec.job_id}_bounded_test`, errors);
  requireValue(spec.controlled_test.broad_sends === 0, `${spec.job_id}_zero_broad`, errors);
  requireValue(
    spec.workflow.desired_transition.join('|') === 'DRAFT_SHELL|SAVED_REOPENED|ACTIVE_TESTED',
    `${spec.job_id}_transition`,
    errors,
  );
  const serialized = stableJson(spec);
  requireValue(
    !/https?:\/\/(?:[^/]+\.)?(?:zoom\.us|vimeo\.com)\b/i.test(serialized),
    `${spec.job_id}_no_provider_url`,
    errors,
  );
  requireValue(
    !/one_time_recording_portal_url/.test(serialized),
    `${spec.job_id}_no_unresolved_recording_value`,
    errors,
  );
  if (spec.workflow.canonical_key === 'OT-07') {
    requireValue(
      /does not contain an activation/i.test(spec.message.body),
      'OT07_non_token_copy',
      errors,
    );
  }
  if (spec.workflow.canonical_key === 'OT-09') {
    requireValue(
      spec.ordered_steps.some(
        (step) =>
          step.kind === 'wait' && /exactly 30 minutes before/i.test(step.exact_configuration),
      ),
      'OT09_exact_t30',
      errors,
    );
  }
  if (spec.workflow.canonical_key === 'OT-10') {
    requireValue(
      spec.message.cta.protected_reference_path === '/app/parent' &&
        spec.message.cta.custom_value.key === 'one_time_parent_portal_url',
      'OT10_first_party_parent_portal',
      errors,
    );
  }
}

function validatePr115State(pr115: Pr115Result, errors: string[]) {
  const e01 = pr115.preservedAssets['OT-E01'];
  const c01 = pr115.preservedAssets['OT-C01'];
  requireValue(e01.id === otE01RepairSubjob.workflow.ghl_id, 'OT_E01_exact_id', errors);
  requireValue(e01.observedStatus === 'DRIFTED', 'OT_E01_remains_drifted', errors);
  requireValue(e01.publishedSwitchObserved, 'OT_E01_remains_published', errors);
  requireValue(e01.immediateConfirmationAction === 'disabled', 'OT_E01_email_a_disabled', errors);
  requireValue(
    c01.canonicalCampaign.lastKnownStatus === 'DRAFT_NOT_SENT',
    'OT_C01_campaign_draft',
    errors,
  );
  requireValue(c01.canonicalCampaign.selectedRecipients === 0, 'OT_C01_zero_recipients', errors);
  requireValue(c01.canonicalCampaign.sends === 0, 'OT_C01_zero_sends', errors);
  requireValue(
    c01.sameNameWorkflowWrapper.observedAfter === 'Draft',
    'OT_C01_wrapper_paused',
    errors,
  );
  requireValue(c01.sameNameWorkflowWrapper.status === 'DRIFTED', 'OT_C01_wrapper_drifted', errors);
  requireValue(
    pr115.scope.customerOrBroadMessagesSent === 0 &&
      pr115.scope.contactMutations === 0 &&
      pr115.scope.enrollmentMutations === 0 &&
      pr115.scope.studentContactsCreated === 0,
    'PR115_zero_effects',
    errors,
  );
}

function requireValue(condition: boolean, name: string, errors: string[]) {
  if (!condition) errors.push(name);
}

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function compactReport(value: string) {
  return value
    .split(/\r?\n/)
    .filter((line) => !/^\|\s*-+\s*\|/.test(line))
    .join('')
    .replace(/\s/g, '');
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readText(filePath)) as T;
}

async function readText(filePath: string) {
  return readFile(path.join(repoRoot, filePath), 'utf8');
}

async function fileExists(filePath: string) {
  try {
    await readText(filePath);
    return true;
  } catch {
    return false;
  }
}
