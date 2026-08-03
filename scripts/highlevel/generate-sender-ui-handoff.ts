import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type QueueJob = {
  job_id: string;
  order: number;
  title: string;
  job_file: string;
  result_path: string;
};

type Queue = {
  schema_version: string;
  repository: string;
  registry_schema: string;
  location_id: string;
  ordered_jobs: QueueJob[];
};

const expectedBranch = 'codex/highlevel-sender-registry-v1-1';
const expectedRepository = 'shloimie-beep/onetimev2';
const queuePath = 'integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json';
const executorPath = 'integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md';
const templatePath = 'integrations/highlevel/agent-mode/GHL-SENDER-UI-JOB.private.template.json';
const registryPaths = [
  'integrations/highlevel/registry/AGENT-HANDOFF.md',
  'integrations/highlevel/registry/current.json',
  'integrations/highlevel/registry/sender-registry.yaml',
  'integrations/highlevel/registry/message-class-registry.yaml',
  'integrations/highlevel/registry/pipeline-registry.yaml',
  'integrations/highlevel/registry/event-registry.yaml',
  'integrations/highlevel/registry/communications-contract.json',
  'integrations/highlevel/registry/rabbi-telegram-contract.yaml',
  'integrations/highlevel/registry/custom-values.yaml',
  'integrations/highlevel/registry/workflow-registry.yaml',
  'integrations/highlevel/registry/prompt-registry.yaml',
  'integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json',
];

async function main() {
  const pullRequest = requiredArg('--pr');
  const repoRoot = process.cwd();
  const branch = git(['branch', '--show-current']);
  const commitA = git(['rev-parse', 'HEAD']);
  const dirty = git(['status', '--porcelain']);

  if (branch !== expectedBranch) {
    throw new Error(`branch_mismatch:expected=${expectedBranch}:actual=${branch}`);
  }
  if (dirty) {
    throw new Error('worktree_must_be_clean_before_generating_commit_b');
  }
  if (!/^[0-9a-f]{40}$/.test(commitA)) {
    throw new Error('commit_a_sha_is_not_full_length');
  }

  const queue = JSON.parse(await readFile(path.join(repoRoot, queuePath), 'utf8')) as Queue;
  if (
    queue.schema_version !== '1.1.0' ||
    queue.repository !== expectedRepository ||
    queue.registry_schema !== 'one-time-highlevel@1.1.0'
  ) {
    throw new Error('queue_does_not_match_canonical_registry_1_1_0');
  }
  const orderedJobs = [...queue.ordered_jobs].sort((a, b) => a.order - b.order);
  if (orderedJobs.length !== 13 || orderedJobs.some((job, index) => job.order !== index + 1)) {
    throw new Error('queue_must_contain_exactly_13_contiguous_jobs');
  }

  const executor = buildExecutor({
    pullRequest,
    commitA,
    queue,
    orderedJobs,
  });
  const template = {
    schema_id: 'one-time-highlevel-agent-mode-pinned-job',
    schema_version: '1.1.0',
    repository: expectedRepository,
    pull_request: pullRequest,
    branch: expectedBranch,
    immutable_registry_commit_a_sha: commitA,
    immutable_source_rule:
      'Read every registry, queue, and job file from Commit A. Do not substitute the branch head or ask the operator to paste a SHA.',
    ghl_location_id: queue.location_id,
    executor_path: executorPath,
    queue_path: queuePath,
    canonical_registry_paths: registryPaths,
    ordered_job_ids: orderedJobs.map((job) => job.job_id),
    defaults: {
      no_send: true,
      no_publish: true,
      no_production_workflow_enrollment: true,
      no_live_payment_mutation: true,
      no_student_contacts: true,
      save_required: true,
      reopen_and_verify_required: true,
      safe_id_capture_required: true,
      dropoff_save_required: true,
      dropoff_readback_required: true,
      chat_only_completion_forbidden: true,
    },
    operator_edits_required: [],
  };

  await writeFile(path.join(repoRoot, executorPath), executor, 'utf8');
  await writeFile(
    path.join(repoRoot, templatePath),
    `${JSON.stringify(template, null, 2)}\n`,
    'utf8',
  );
  process.stdout.write(
    `${JSON.stringify({ commitA, pullRequest, files: [executorPath, templatePath] }, null, 2)}\n`,
  );
}

function buildExecutor(input: {
  pullRequest: string;
  commitA: string;
  queue: Queue;
  orderedJobs: QueueJob[];
}) {
  const jobRows = input.orderedJobs.map(
    (job) =>
      `${job.order}. **${job.job_id} — ${job.title}**\n   - Job: \`${job.job_file}\`\n   - Result: \`${job.result_path}\``,
  );
  const sourceRows = registryPaths.map((file) => `- \`${file}\``);

  return `# One Time HighLevel sender UI executor — pinned

Paste this entire document once into Agent Mode. It is the complete execution instruction; do not ask the operator to edit or supply a commit SHA.

## Immutable execution identity

- Repository: \`${expectedRepository}\`
- Pull request: ${input.pullRequest}
- Branch: \`${expectedBranch}\`
- Immutable registry source (Commit A): \`${input.commitA}\`
- HighLevel location ID: \`${input.queue.location_id}\`
- Registry schema: \`${input.queue.registry_schema}\`

Treat Commit A as the only source of truth for every registry, queue, and job read. Pin all reads to the full Commit A SHA above. The later Commit B contains only this executor and its private-job template; do not use Commit B as the registry source. Stop with \`BLOCKED(registry identity mismatch)\` if the repository, schema, location, or immutable SHA cannot be verified exactly. Never substitute a branch head and never ask the operator to paste a SHA.

## Canonical source paths

Read all of these from Commit A before opening or changing HighLevel:

${sourceRows.join('\n')}

## Non-negotiable safety

- Send no email, WhatsApp, SMS, Telegram, seed, test, or production message. \`MESSAGES_SENT\` must remain \`0\`.
- Do not click Send. For seed jobs, prepare and verify an unsent draft/configuration only.
- Do not publish or activate workflows or the bot.
- Do not enroll production contacts and do not create Student contacts or Student credential fields.
- Do not mutate Stripe, payments, Railway, DNS, mailbox routing, or production application state.
- Do not create unregistered assets, duplicates, guessed sender text, guessed pipeline stages, or guessed message classes.
- Do not delete or migrate existing opportunities. Preserve the \`One Time Business\` compatibility pipeline unless a later approved migration explicitly replaces it.
- Never expose PITs, API keys, passwords, contact data, or other secrets in results.
- Phase-2 \`rabbi@\` remains blocked until its registered mailbox, From-address, protected seed delivery, reply-to-Conversations, and result-recording prerequisites all pass in a separately authorized lane.

## Exact ordered jobs

Run these jobs serially and in this exact order. A blocked job blocks only itself and dependent later work; record the blocker and continue with independent safe verification where the job contract permits.

${jobRows.join('\n')}

## Per-job execution protocol

For every job:

1. Load the exact job JSON from Commit A, verify its job ID, idempotency key, prerequisites, allowed assets, forbidden actions, and exact HighLevel UI path.
2. Verify the visible HighLevel location is exactly \`${input.queue.location_id}\` before any action.
3. Perform only actions registered in the canonical source files. If an asset already matches, record \`already_satisfied\`; do not duplicate it.
4. Click Save for every permitted edit. Never click Send, Publish, Activate, Enroll, or any equivalent live-action control.
5. Reopen the saved screen and verify the visible persisted state against Commit A.
6. Capture only safe HighLevel asset IDs and visible statuses required by the job result schema. Do not capture message bodies, contact details, credentials, or secrets.
7. Return to the BNA Agent Action drop-off page at \`/ops/agent-actions/highlevel/drop-off\`.
8. Save the result JSON to the exact result path declared by the job, then reopen/read it and record the returned drop-off result ID with \`readback_verified: true\`.
9. Never finish with a chat-only completion claim. A job is not complete without saved HighLevel state when an edit was allowed, saved result JSON, and verified readback.

## Completion output

After all 13 jobs have terminal results, return one compact aggregate with:

- each job ID and terminal status;
- every safe HighLevel asset ID captured;
- exact blockers and their dependent jobs;
- \`MESSAGES_SENT: 0\`;
- \`WORKFLOWS_PUBLISHED: 0\`;
- \`PRODUCTION_CONTACTS_ENROLLED: 0\`;
- \`STRIPE_MUTATIONS: 0\`;
- \`STUDENT_CONTACTS_CREATED: 0\`;
- every drop-off result ID and readback-verification status.

Do not claim the executor is complete if any result exists only in chat or if any saved state was not reopened and verified.
`;
}

function requiredArg(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : '';
  if (!value || value.startsWith('--')) throw new Error(`missing_required_argument:${name}`);
  return value;
}

function git(args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
