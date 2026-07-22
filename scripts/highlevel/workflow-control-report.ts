import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import {
  botActionWorkflows,
  businessWorkflows,
  workflowFolderTree,
  type RegistryWorkflow,
} from './canonical-registry-data.ts';
import { workflowControlPolicy, type WorkflowControlState } from './workflow-control-registry.ts';

type FinalWorkflow = {
  key: string;
  name: string;
  id: string;
  folderPath: string;
  status: 'draft' | 'published';
  reopenedVerified: string;
  testStatus: 'draft_blocked' | 'active_tested';
};

type FinalResult = {
  generatedAt: string;
  folderTree: { children: Array<{ name: string }> };
  workflows: FinalWorkflow[];
};

type PhaseTwoResult = {
  workflowResults: Array<{ key: string; observedCriticalActions: string[] }>;
};

type Comparison = {
  key: string;
  registry: RegistryWorkflow;
  observed: FinalWorkflow | null;
  derivedObservedStatus: WorkflowControlState;
  disagreements: string[];
};

const repoRoot = process.cwd();
const reportPath = 'integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md';
const finalPath =
  'integrations/highlevel/agent-mode/results/GHL-FINAL-ORGANIZATION-20260722.result.json';
const phaseTwoPath = 'integrations/highlevel/agent-mode/results/GHL-PHASE-2-20260722.result.json';
const canonical = [...businessWorkflows, ...botActionWorkflows].sort(
  (left, right) => left.displayOrder - right.displayOrder,
);

const finalResult = await readJson<FinalResult>(finalPath);
const phaseTwoResult = await readJson<PhaseTwoResult>(phaseTwoPath);
const shellKeys = new Set(phaseTwoResult.workflowResults.map((result) => result.key));
const observedByKey = new Map(finalResult.workflows.map((workflow) => [workflow.key, workflow]));
const comparisons = canonical.map(compareWorkflow);
const canonicalKeys = new Set(canonical.map((workflow) => workflow.key));
const unknown = finalResult.workflows.filter((workflow) => !canonicalKeys.has(workflow.key));
const expectedRoots = workflowFolderTree.map((folder) => folder.name);
const observedRoots = finalResult.folderTree.children.map((folder) => folder.name);
const rootFolderDisagreements = compareOrderedList(expectedRoots, observedRoots);
const report = await format(buildReport(comparisons, unknown, rootFolderDisagreements), {
  filepath: reportPath,
});
const write = process.argv.includes('--write');

if (write) {
  await writeFile(path.join(repoRoot, reportPath), report, 'utf8');
}

const currentReport = await readFile(path.join(repoRoot, reportPath), 'utf8').catch(() => '');
const drifted = comparisons.filter((comparison) => comparison.disagreements.length > 0);
const reportMatches = currentReport === report;
const passed = drifted.length === 0 && unknown.length === 0 && rootFolderDisagreements.length === 0;

process.stdout.write(
  `${JSON.stringify(
    {
      status: passed && reportMatches ? 'passed' : 'failed',
      canonicalWorkflows: canonical.length,
      drifted: drifted.map((comparison) => ({
        key: comparison.key,
        disagreements: comparison.disagreements,
      })),
      unknownWorkflows: unknown.map((workflow) => ({
        key: workflow.key,
        id: workflow.id,
        folderPath: workflow.folderPath,
        disposition: 'DEPENDENCY_CHECK_REQUIRED_BEFORE_SAFE_AUTHORIZED_QUARANTINE',
      })),
      rootFolderDisagreements,
      reportMatches,
      reportPath,
    },
    null,
    2,
  )}\n`,
);

if (!passed || !reportMatches) process.exitCode = 1;

function compareWorkflow(registry: RegistryWorkflow): Comparison {
  const observed = observedByKey.get(registry.key) ?? null;
  const derivedObservedStatus = observed ? deriveObservedStatus(observed) : 'MISSING';
  const disagreements: string[] = [];
  if (!observed) {
    disagreements.push('workflow missing from sanitized GHL readback');
  } else {
    if (observed.name !== registry.canonicalName) {
      disagreements.push(`name registry=${registry.canonicalName} observed=${observed.name}`);
    }
    if (observed.id !== registry.ghlId) {
      disagreements.push(`id registry=${registry.ghlId} observed=${observed.id}`);
    }
    const expectedPath = `One Time / ${registry.folder}`;
    if (observed.folderPath !== expectedPath) {
      disagreements.push(`folder registry=${expectedPath} observed=${observed.folderPath}`);
    }
  }
  if (derivedObservedStatus !== registry.observedStatus) {
    disagreements.push(
      `status registry=${registry.observedStatus} observed=${derivedObservedStatus}`,
    );
  }
  return { key: registry.key, registry, observed, derivedObservedStatus, disagreements };
}

function deriveObservedStatus(observed: FinalWorkflow): WorkflowControlState {
  if (observed.status === 'published' && observed.testStatus === 'active_tested') {
    return 'ACTIVE_TESTED';
  }
  if (observed.status === 'draft' && shellKeys.has(observed.key)) return 'DRAFT_SHELL';
  if (observed.status === 'draft' && observed.reopenedVerified) return 'SAVED_REOPENED';
  return 'DRIFTED';
}

function buildReport(
  records: Comparison[],
  unknownWorkflows: FinalWorkflow[],
  folderDisagreements: string[],
) {
  const counts = records.reduce<Record<string, number>>((result, record) => {
    result[record.derivedObservedStatus] = (result[record.derivedObservedStatus] ?? 0) + 1;
    return result;
  }, {});
  const driftCount = records.filter((record) => record.disagreements.length > 0).length;
  return [
    '# HighLevel Workflow Control Report',
    '',
    '> Generated from the canonical Git registry plus committed sanitized GHL readbacks. Do not edit this report by hand.',
    '',
    `GitHub desired state: **canonical**. Observed GHL readback: ${finalResult.generatedAt}.`,
    '',
    `Summary: ${records.length} canonical workflows; ${counts.ACTIVE_TESTED ?? 0} ACTIVE_TESTED; ${counts.DRAFT_SHELL ?? 0} DRAFT_SHELL; ${counts.SAVED_REOPENED ?? 0} SAVED_REOPENED; ${driftCount} DRIFTED; ${unknownWorkflows.length} unknown.`,
    '',
    'Organized folders prove location only. They do not prove triggers, actions, activation, enrollment, delivery, or canary success.',
    '',
    '## Canonical folder order',
    '',
    ...workflowFolderTree.map(
      (folder) =>
        `- ${String(folder.order).padStart(2, '0')} — ${folder.name}${folder.children.length ? ` (${folder.children.join(', ')})` : ''}`,
    ),
    '',
    ...(folderDisagreements.length
      ? ['Folder drift:', ...folderDisagreements.map((item) => `- **DRIFTED:** ${item}`), '']
      : ['Folder readback: **MATCHED**.', '']),
    '## Workflow control',
    '',
    '| # | Key | Folder | Desired | Observed | GHL ID | Configuration proof | Canary | Blocker / drift |',
    '| ---: | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...records.map((record) => {
      const workflow = record.registry;
      const configuration =
        record.derivedObservedStatus === 'DRAFT_SHELL'
          ? 'No trigger/actions read back'
          : record.derivedObservedStatus === 'ACTIVE_TESTED'
            ? 'Configured and controlled-tested'
            : 'Saved/reopened Draft; operation not claimed';
      const drift = record.disagreements.length
        ? `DRIFTED: ${record.disagreements.join('; ')}`
        : workflow.blocker || 'None';
      return `| ${workflow.displayOrder} | ${workflow.key} | ${escapeCell(workflow.folder)} | ${workflow.desiredStatus} | ${record.derivedObservedStatus} | ${workflow.ghlId} | ${configuration} | ${workflow.canary.result}: ${escapeCell(workflow.canary.detail)} | ${escapeCell(drift)} |`;
    }),
    '',
    'Read-only browser evidence additionally records OT-07 and OT-08 as Draft with 0 total enrolled and 0 active. OT-C01 remains Draft/not sent. OT-E01 is the sole ACTIVE_TESTED workflow.',
    '',
    '## Exact desired trigger/action source',
    '',
    'The exact ordered trigger and action arrays, last readback, canary result, blocker, and evidence for every workflow are stored in `workflow-registry.yaml`; this report intentionally stays concise.',
    '',
    '## Unknown workflows',
    '',
    ...(unknownWorkflows.length
      ? unknownWorkflows.map(
          (workflow) =>
            `- **UNKNOWN / DRIFTED:** ${workflow.name} (${workflow.id}) at ${workflow.folderPath}. Dependency-check first; quarantine to 99 - Deprecated only through an authorized job when safe. Never silently delete.`,
        )
      : ['- None in the committed readback.']),
    '',
    '## Closed loop and approvals',
    '',
    `Required loop: ${workflowControlPolicy.closedLoop.join(' → ')}.`,
    '',
    `Approval-gated: ${workflowControlPolicy.approvalGates.join(', ')}. Agent jobs default to no activation, no broad send, no payment, and no destructive action.`,
    '',
    'Drift repair in this registry revision replaced stale folder names, blank IDs for live Draft assets, and the ambiguous workflow `deprecationState` field with separate asset lifecycle and observed control status. Future mismatches are emitted as DRIFTED and fail the validator.',
    '',
  ].join('\n');
}

function compareOrderedList(expected: string[], observed: string[]) {
  const disagreements: string[] = [];
  if (expected.length !== observed.length) {
    disagreements.push(`root folder count registry=${expected.length} observed=${observed.length}`);
  }
  const length = Math.max(expected.length, observed.length);
  for (let index = 0; index < length; index += 1) {
    if (expected[index] !== observed[index]) {
      disagreements.push(
        `root folder ${index + 1} registry=${expected[index] ?? 'MISSING'} observed=${observed[index] ?? 'MISSING'}`,
      );
    }
  }
  return disagreements;
}

function escapeCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(repoRoot, filePath), 'utf8')) as T;
}
