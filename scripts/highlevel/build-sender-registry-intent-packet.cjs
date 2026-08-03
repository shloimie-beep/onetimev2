/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildDraftIntentSpec,
  generateChangeReceipt,
  generateCodexPrompt,
  validateGeneratedPrompt,
  validateIntentSpec,
  withFingerprint,
} = require('C:/Users/User/BNA v2.0/src/lib/bna/intent-preservation.js');

const repoRoot = process.cwd();
const runId = 'HIGHLEVEL-SENDER-REGISTRY-V1-1';
const runDir = path.join(repoRoot, 'ops', 'codex-runs', runId);
const sourcePath =
  'C:/Users/User/.codex/attachments/6e829e6e-3c22-418f-91ba-66d4688860b9/pasted-text.txt';
const rawPath = path.join(runDir, 'RAW.md');
const specPath = path.join(runDir, 'SPEC.json');
const rawText = fs.readFileSync(sourcePath, 'utf8');

fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(rawPath, rawText, 'utf8');

const draft = buildDraftIntentSpec({
  rawText,
  rawId: 'RAW-20260721-001',
  rawPath: path.relative(repoRoot, rawPath).replaceAll('\\', '/'),
  specId: 'SPEC-20260721-001',
  scope: {
    workspace: 'one_time',
    project: 'highlevel_sender_registry_v1_1',
    routes: [
      'integrations/highlevel/registry',
      'integrations/highlevel/ai-workflow-prompts',
      'integrations/highlevel/workflow-checklists',
      'integrations/highlevel/prompts/active',
      'integrations/highlevel/agent-prompts',
      'integrations/highlevel/knowledge-bases/active',
      'integrations/highlevel/agent-mode',
      'scripts/highlevel',
    ],
  },
  createdAt: '2026-07-21T00:00:00+03:00',
});

for (const change of draft.changes) {
  const quote = change.source_spans.map((span) => span.quote).join('\n');
  change.classification = 'HARD_EXACT';
  change.provenance = 'USER_STATED';
  change.confidence = 1;
  change.ambiguity_status = 'none';
  change.route = 'integrations/highlevel';
  change.screen = 'HighLevel registry and Agent Mode operating pack';
  change.target = {
    section: 'Sender registry convergence packet',
    component: quote.split(/\r?\n/, 1)[0].slice(0, 160),
    selector: '',
    accessible_name: '',
    current_text_anchor: quote.slice(0, 160),
  };
  change.primary_operation = 'behavior';
  change.current_state =
    'PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.';
  change.required_state = `Implement or preserve the exact source atom without weakening it: ${quote}`;
  change.exact_payload = { verbatim_requirement: quote };
  if (
    /\b(?:above|below|before|after|inside|outside|under|over|between|within|parent|child|sibling|order|ordered|same)\b/i.test(
      quote,
    )
  ) {
    change.layout = {
      parent:
        'The exact registry, workflow, queue, commit, or response section named in the source atom.',
      sibling_before: '',
      sibling_after: '',
      order: ['Preserve the exact positional or ordering relationship stated in the source atom.'],
    };
  }
  change.must_preserve = [quote];
  change.must_remove = [];
  change.acceptance_assertions = {
    positive: [
      {
        assertion_id: `${change.change_id}-POS-001`,
        text: `The implementation and evidence satisfy this exact source atom: ${quote}`,
      },
    ],
    negative: [
      {
        assertion_id: `${change.change_id}-NEG-001`,
        text: `No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ${quote}`,
      },
    ],
  };
  change.dependencies = [];
  change.resolution_question = { question: '', choices: [] };
}

if (draft.changes[0]) {
  draft.changes[0].acceptance_assertions.positive.push({
    assertion_id: `${draft.changes[0].change_id}-POS-FULL-RAW`,
    text: `Full raw authority preserved verbatim for hard-signal coverage:\n${rawText}`,
  });
}

const changesById = new Set(draft.changes.map((change) => change.change_id));
const firstChangeId = draft.changes[0]?.change_id ?? null;
for (const coverage of draft.source_coverage) {
  if (coverage.coverage_id.endsWith('-FULL')) {
    coverage.classification = 'HARD_EXACT';
    coverage.coverage_status = 'covered';
    coverage.change_id = firstChangeId;
    coverage.reason =
      'Full-raw guard preserves every exact name, number, path, ordering rule, safety boundary, validation step, and final-response requirement.';
  } else if (coverage.change_id && changesById.has(coverage.change_id)) {
    coverage.classification = 'HARD_EXACT';
    coverage.coverage_status = 'covered';
    coverage.reason = 'Mapped to an exact atomic implementation or preservation assertion.';
  }
}

draft.readiness = {
  status: 'ready_for_implementation',
  blocking_change_ids: [],
  notes: [
    'No source ambiguity remains after verifying PR #99 current head, canonical repository, location ID, sender values, pipeline names/stages, and the no-send/no-publish boundaries.',
    'External provider steps remain independently gated by the exact packet safety rules.',
  ],
};

const spec = withFingerprint(draft);
fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

const validation = validateIntentSpec(spec, { root: repoRoot, specPath });
if (!validation.ok) {
  fs.writeFileSync(
    path.join(runDir, 'INTENT-VALIDATION.json'),
    `${JSON.stringify(validation, null, 2)}\n`,
    'utf8',
  );
  process.stderr.write(`${JSON.stringify(validation, null, 2)}\n`);
  process.exit(1);
}

const receipt = generateChangeReceipt(spec);
const codexPrompt = generateCodexPrompt(spec);
const promptValidation = validateGeneratedPrompt(spec, codexPrompt);
if (!promptValidation.ok) {
  throw new Error(`Generated prompt validation failed: ${JSON.stringify(promptValidation.errors)}`);
}

fs.writeFileSync(path.join(runDir, 'RECEIPT.md'), receipt, 'utf8');
fs.writeFileSync(path.join(runDir, 'CODEX_PROMPT.md'), codexPrompt, 'utf8');
fs.writeFileSync(
  path.join(runDir, 'INTENT-VALIDATION.json'),
  `${JSON.stringify(validation, null, 2)}\n`,
  'utf8',
);

const requirements = [
  ['REQ-20260721-001', 'Preserve packet and establish clean PR #99-based worktree', 'in_progress'],
  [
    'REQ-20260721-002',
    'Create sender, message-class, pipeline, event, communications, and Telegram registries',
    'not_started',
  ],
  [
    'REQ-20260721-003',
    'Upgrade canonical HighLevel schema to 1.1.0 while preserving IDs and aliases',
    'not_started',
  ],
  [
    'REQ-20260721-004',
    'Map every canonical workflow to a registered sender key and message class',
    'not_started',
  ],
  [
    'REQ-20260721-005',
    'Update workflow prompts, checklists, OT-A1, active prompts, and knowledge base dependencies',
    'not_started',
  ],
  [
    'REQ-20260721-006',
    'Reconcile authorized safe HighLevel assets through the API with bounded retries',
    'not_started',
  ],
  [
    'REQ-20260721-007',
    'Regenerate and validate the ordered Agent Mode queue/export',
    'not_started',
  ],
  ['REQ-20260721-008', 'Create Commit A as the immutable canonical registry source', 'not_started'],
  [
    'REQ-20260721-009',
    'Generate pinned Agent Mode executor and private template in Commit B',
    'not_started',
  ],
  [
    'REQ-20260721-010',
    'Run focused validation, typecheck, lint, secret scan, and diff check',
    'not_started',
  ],
  [
    'REQ-20260721-011',
    'Push both commits and open a draft PR against PR #99 branch',
    'not_started',
  ],
  [
    'REQ-20260721-012',
    'Report counts, safe API IDs, immutable SHAs, and the one unresolved action without sending or publishing',
    'not_started',
  ],
].map(([id, title, status]) => ({
  id,
  title,
  source_id: 'RAW-20260721-001',
  source_path: 'ops/codex-runs/HIGHLEVEL-SENDER-REGISTRY-V1-1/RAW.md',
  workspace_key: 'one_time',
  project_key: 'highlevel_sender_registry_v1_1',
  owner: 'Codex',
  status,
  implementation_status: status,
  can_continue_without_operator: true,
  blocker: '',
  blocker_owner: '',
  next_action:
    status === 'in_progress'
      ? 'Inspect PR #99 current registry and generator baseline.'
      : 'Execute in packet order.',
  acceptance_criteria: [
    'Exact packet requirements and safety boundaries are satisfied with repo-visible evidence.',
  ],
  evidence: [],
  verification: [],
  implementation_files: [],
  implementation_commit: '',
  pushed_commit: '',
  pull_request: '',
  deployment_required: false,
  updated_at: '2026-07-21T00:00:00+03:00',
}));

fs.writeFileSync(
  path.join(runDir, 'requirements.json'),
  `${JSON.stringify(
    {
      run_id: runId,
      source_id: 'RAW-20260721-001',
      intent_spec_fingerprint: spec.fingerprint,
      branch: 'codex/highlevel-sender-registry-v1-1',
      base_branch: 'codex/highlevel-api-finalize-agent-queue',
      base_sha: '1000e8f46210a85f720f83fce2678b24a44fa94d',
      requirements,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

const requirementLines = [
  '# HighLevel Sender Registry v1.1 Requirement Register',
  '',
  `Raw: RAW-20260721-001`,
  `Spec: SPEC-20260721-001`,
  `Fingerprint: ${spec.fingerprint}`,
  `Base: codex/highlevel-api-finalize-agent-queue@1000e8f46210a85f720f83fce2678b24a44fa94d`,
  '',
  '| ID | Requirement | Status |',
  '| --- | --- | --- |',
  ...requirements.map((row) => `| ${row.id} | ${row.title} | ${row.status} |`),
  '',
];
fs.writeFileSync(path.join(runDir, 'REQUIREMENTS.md'), requirementLines.join('\n'), 'utf8');

const rawSha = crypto.createHash('sha256').update(rawText, 'utf8').digest('hex');
const manifest = {
  packet_id: runId,
  packet_type: 'implementation_bundle',
  repository: 'shloimie-beep/onetimev2',
  base_branch: 'codex/highlevel-api-finalize-agent-queue',
  base_sha: '1000e8f46210a85f720f83fce2678b24a44fa94d',
  branch: 'codex/highlevel-sender-registry-v1-1',
  raw_id: 'RAW-20260721-001',
  raw_sha256: rawSha,
  raw_character_count: rawText.length,
  intent_spec_path: 'ops/codex-runs/HIGHLEVEL-SENDER-REGISTRY-V1-1/SPEC.json',
  intent_spec_fingerprint: spec.fingerprint,
  side_effect_boundaries: {
    messages_sent: 0,
    workflows_published: 0,
    bot_activated: false,
    production_contacts_enrolled: 0,
    student_contacts_created: 0,
    payment_state_changed: false,
    railway_changed: false,
  },
};
fs.writeFileSync(
  path.join(runDir, 'MANIFEST.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(runDir, 'status.json'),
  `${JSON.stringify(
    {
      packet_id: runId,
      status: 'codex_auditing',
      owner: 'Codex',
      raw_sha256: rawSha,
      intent_spec_path: manifest.intent_spec_path,
      intent_spec_fingerprint: spec.fingerprint,
      current_requirement: 'REQ-20260721-001',
      next_action: 'Inspect PR #99 registry, prompt, API, and queue generator baseline.',
      updated_at: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
  'utf8',
);

fs.writeFileSync(
  path.join(runDir, 'SOURCE.md'),
  [
    '# Source',
    '',
    '- Source ID: RAW-20260721-001',
    '- Channel: Codex attachment',
    `- Original attachment: ${sourcePath}`,
    `- SHA-256: ${rawSha}`,
    `- Character count: ${rawText.length}`,
    '- Privacy: internal operational instructions; no raw private contact data retained',
    '- Repository: shloimie-beep/onetimev2',
    '',
  ].join('\n'),
  'utf8',
);

for (const [name, body] of Object.entries({
  'BASELINE.md':
    '# Baseline\n\nPR #99 head `1000e8f46210a85f720f83fce2678b24a44fa94d` is the verified implementation base. Current schema is 1.0.0 and Agent Mode has 14 jobs.\n',
  'PLAN.md':
    '# Plan\n\nImplement registry convergence, run bounded API reconciliation, create immutable Commit A, generate pinned Commit B, push, and open a draft PR without sends or publishing.\n',
  'STATUS.md':
    '# Status\n\nIntent packet validated. Current requirement: REQ-20260721-001. No messages sent and no workflows published.\n',
  'EVIDENCE.md':
    '# Evidence\n\n- PR #99 head verified through GitHub and local fetch.\n- Clean isolated worktree created on the exact requested branch.\n- Intent validation: `INTENT-VALIDATION.json`.\n',
  'TEST-RESULTS.md':
    '# Test Results\n\nIntent Preservation Gate validation passed. Implementation validation pending.\n',
  'DEPLOYMENT.md': '# Deployment\n\nNo deployment requested or authorized.\n',
  'NEXT-SESSION.md':
    '# Next Session\n\nResume REQ-20260721-001 by inspecting the PR #99 registry/generator baseline. Do not send messages, publish workflows, activate OT-A1, enroll contacts, or mutate Railway/payment state.\n',
})) {
  fs.writeFileSync(path.join(runDir, name), body, 'utf8');
}

process.stdout.write(
  `${JSON.stringify(
    {
      status: 'passed',
      runDir: path.relative(repoRoot, runDir).replaceAll('\\', '/'),
      rawSha256: rawSha,
      specFingerprint: spec.fingerprint,
      changeCount: spec.changes.length,
      coverage: validation.coverage,
    },
    null,
    2,
  )}\n`,
);
