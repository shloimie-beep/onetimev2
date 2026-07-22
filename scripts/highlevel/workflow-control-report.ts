import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import {
  canonicalAutomationAssets,
  canonicalCampaignAssets,
  canonicalWorkflowAssets,
  nonWorkflowAssets,
  workflowControlPolicy,
  workflowFolderTree,
  type WorkflowControlState,
  type WorkflowFolderNode,
  type WorkflowRegistryRecord,
} from './workflow-registry-source.ts';

type ObservedFolder = { name: string; children?: ObservedFolder[] };
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
  folderTree: ObservedFolder;
  workflows: FinalWorkflow[];
  tishaBavControlledTest: {
    workflowId: string;
    eventTagVerified: boolean;
    sourceTagVerified: boolean;
    newsletterTagPresent: boolean;
    immediateConfirmationAcceptedDelivered: boolean;
    duplicateRegistrationCreatedSecondActiveRun: boolean;
    oneHourReminderScheduled: string;
    tenMinuteReminderScheduled: string;
    lateRegistrantPastOutboundActionsSkipped: boolean;
    rawZoomUrlPresent: boolean;
    protectedEventPage: string;
    protectedLivePage: string;
    messagesSentDuringThisFinalOrganizationRun: number;
  };
};
type PhaseWorkflow = {
  key: string;
  id: string;
  folderPath: string;
  exactTriggerFilter: string;
  expectedCriticalActions: string[];
  observedCriticalActions: string[];
  senderKey: string;
  deliveryCategory: string;
  terminalState: string;
};
type PhaseTwoResult = { workflowResults: PhaseWorkflow[] };
type AssetKindReadback = {
  assets: Array<{
    key: string;
    assetKind: string;
    id: string;
    fullPath: string;
    observedStatus: string;
    audienceConfigured?: boolean;
    scheduled?: boolean;
    sends?: number;
  }>;
};
type Comparison = {
  key: string;
  registry: WorkflowRegistryRecord;
  observed: FinalWorkflow | null;
  derivedObservedStatus: WorkflowControlState;
  disagreements: string[];
};

const repoRoot = process.cwd();
const reportPath = 'integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md';
const finalPath =
  'integrations/highlevel/agent-mode/results/GHL-FINAL-ORGANIZATION-20260722.result.json';
const phaseTwoPath = 'integrations/highlevel/agent-mode/results/GHL-PHASE-2-20260722.result.json';
const assetKindPath =
  'integrations/highlevel/agent-mode/results/GHL-ASSET-KIND-READBACK-20260722.result.json';
const canonical = [...canonicalAutomationAssets].sort(
  (left, right) => left.displayOrder - right.displayOrder,
);

const finalResult = await readJson<FinalResult>(finalPath);
const phaseTwoResult = await readJson<PhaseTwoResult>(phaseTwoPath);
const assetKindResult = await readJson<AssetKindReadback>(assetKindPath);
const phaseByKey = new Map(phaseTwoResult.workflowResults.map((record) => [record.key, record]));
const observedByKey = new Map(finalResult.workflows.map((workflow) => [workflow.key, workflow]));
const assetKindByKey = new Map(assetKindResult.assets.map((asset) => [asset.key, asset]));
const comparisons = canonical.map(compareAsset);
const canonicalKeys = new Set(canonical.map((workflow) => workflow.key));
const unknown = finalResult.workflows.filter((workflow) => !canonicalKeys.has(workflow.key));
const folderDisagreements = compareOrderedList(
  flattenExpectedFolders(workflowFolderTree),
  flattenObservedFolders(finalResult.folderTree.children ?? []),
  'folder path',
);
const nonWorkflowDisagreements = compareNonWorkflowAssets();
const report = await format(
  buildReport(comparisons, unknown, folderDisagreements, nonWorkflowDisagreements),
  { filepath: reportPath },
);
const write = process.argv.includes('--write');

if (write) await writeFile(path.join(repoRoot, reportPath), report, 'utf8');

const currentReport = await readFile(path.join(repoRoot, reportPath), 'utf8').catch(() => '');
const drifted = comparisons.filter((comparison) => comparison.disagreements.length > 0);
const reportMatches = normalizeText(currentReport) === normalizeText(report);
const passed =
  drifted.length === 0 &&
  unknown.length === 0 &&
  folderDisagreements.length === 0 &&
  nonWorkflowDisagreements.length === 0;

process.stdout.write(
  `${JSON.stringify(
    {
      status: passed && reportMatches ? 'passed' : 'failed',
      canonicalAutomationAssets: canonical.length,
      canonicalWorkflowAssets: canonicalWorkflowAssets.length,
      canonicalCampaignAssets: canonicalCampaignAssets.length,
      nonWorkflowAssets: nonWorkflowAssets.length,
      drifted: drifted.map(({ key, disagreements }) => ({ key, disagreements })),
      unknownAssets: unknown.map((workflow) => ({
        key: workflow.key,
        id: workflow.id,
        folderPath: workflow.folderPath,
        disposition: 'DEPENDENCY_CHECK_REQUIRED_BEFORE_SAFE_AUTHORIZED_QUARANTINE',
      })),
      folderDisagreements,
      nonWorkflowDisagreements,
      reportMatches,
      reportPath,
    },
    null,
    2,
  )}\n`,
);

if (!passed || !reportMatches) process.exitCode = 1;

function compareAsset(registry: WorkflowRegistryRecord): Comparison {
  const observed = observedByKey.get(registry.key) ?? null;
  const phase = phaseByKey.get(registry.key);
  const derivedObservedStatus = observed ? deriveObservedStatus(observed, phase) : 'MISSING';
  const disagreements: string[] = [];
  if (!observed) {
    disagreements.push('asset missing from sanitized GHL readback');
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
  if (phase) compareProviderContract(registry, phase, disagreements);
  if (registry.key === 'OT-E01') compareE01Canary(registry, disagreements);
  if (registry.asset_kind === 'email_marketing_campaign') {
    compareCampaignReadback(registry, disagreements);
  }
  return { key: registry.key, registry, observed, derivedObservedStatus, disagreements };
}

function compareProviderContract(
  registry: WorkflowRegistryRecord,
  phase: PhaseWorkflow,
  disagreements: string[],
) {
  const contract = registry.providerContract;
  if (!contract) {
    disagreements.push('provider contract missing from canonical YAML');
    return;
  }
  compareExact(
    'provider trigger',
    contract.exactTriggerFilter,
    phase.exactTriggerFilter,
    disagreements,
  );
  disagreements.push(
    ...compareOrderedList(
      contract.orderedCriticalActions,
      phase.expectedCriticalActions,
      'provider ordered action',
    ),
  );
  disagreements.push(
    ...compareOrderedList(
      registry.observedActions,
      phase.observedCriticalActions,
      'observed action',
    ),
  );
  compareExact('provider sender', contract.senderKey, phase.senderKey, disagreements);
  compareExact(
    'provider delivery category',
    contract.deliveryCategory,
    phase.deliveryCategory,
    disagreements,
  );
  compareExact('provider ID', registry.ghlId, phase.id, disagreements);
  compareExact(
    'provider full path',
    `One Time / ${registry.folder}`,
    phase.folderPath,
    disagreements,
  );
  if (!phase.terminalState.startsWith('DRAFT_WAITING_EXTERNAL(')) {
    disagreements.push(
      `terminal state expected=DRAFT_WAITING_EXTERNAL observed=${phase.terminalState}`,
    );
  }
}

function compareE01Canary(registry: WorkflowRegistryRecord, disagreements: string[]) {
  const canary = finalResult.tishaBavControlledTest;
  const passed =
    canary.workflowId === registry.ghlId &&
    canary.eventTagVerified &&
    canary.sourceTagVerified &&
    !canary.newsletterTagPresent &&
    canary.immediateConfirmationAcceptedDelivered &&
    !canary.duplicateRegistrationCreatedSecondActiveRun &&
    Boolean(canary.oneHourReminderScheduled) &&
    Boolean(canary.tenMinuteReminderScheduled) &&
    canary.lateRegistrantPastOutboundActionsSkipped &&
    !canary.rawZoomUrlPresent &&
    canary.protectedEventPage === 'https://join.onetimeonetime.com/tisha-bav' &&
    canary.protectedLivePage === 'https://join.onetimeonetime.com/tisha-bav/live' &&
    canary.messagesSentDuringThisFinalOrganizationRun === 0;
  if (!passed || registry.canary.result !== 'passed') {
    disagreements.push('OT-E01 controlled trigger/action/value canary readback mismatch');
  }
}

function compareCampaignReadback(registry: WorkflowRegistryRecord, disagreements: string[]) {
  const observed = assetKindByKey.get(registry.key);
  if (!observed) {
    disagreements.push('campaign asset-kind readback missing');
    return;
  }
  compareExact('asset kind', registry.asset_kind, observed.assetKind, disagreements);
  compareExact('campaign ID', registry.ghlId, observed.id, disagreements);
  compareExact(
    'campaign full path',
    `One Time / ${registry.folder}`,
    observed.fullPath,
    disagreements,
  );
  const expected = registry.audienceReadback;
  if (
    !expected ||
    observed.observedStatus !== expected.status ||
    observed.audienceConfigured !== expected.audienceConfigured ||
    observed.scheduled !== expected.scheduled ||
    observed.sends !== expected.sends
  ) {
    disagreements.push('campaign Draft/audience/schedule/send readback mismatch');
  }
}

function compareNonWorkflowAssets() {
  const disagreements: string[] = [];
  for (const expected of nonWorkflowAssets) {
    const observed = assetKindByKey.get(expected.key);
    if (!observed) {
      disagreements.push(`${expected.key}: observed asset missing`);
      continue;
    }
    if (
      observed.assetKind !== expected.asset_kind ||
      observed.id !== expected.ghlId ||
      observed.fullPath !== expected.folder ||
      observed.observedStatus !== expected.observedStatus
    ) {
      disagreements.push(`${expected.key}: kind/id/path/status disagreement`);
    }
  }
  return disagreements;
}

function deriveObservedStatus(
  observed: FinalWorkflow,
  phase: PhaseWorkflow | undefined,
): WorkflowControlState {
  if (observed.status === 'published' && observed.testStatus === 'active_tested') {
    return 'ACTIVE_TESTED';
  }
  if (phase?.terminalState.startsWith('DRAFT_WAITING_EXTERNAL(')) {
    return 'DRAFT_WAITING_EXTERNAL';
  }
  if (observed.status === 'draft' && observed.reopenedVerified) return 'SAVED_REOPENED';
  return 'DRIFTED';
}

function buildReport(
  records: Comparison[],
  unknownAssets: FinalWorkflow[],
  folderDrift: string[],
  nonWorkflowDrift: string[],
) {
  const counts = records.reduce<Record<string, number>>((result, record) => {
    result[record.derivedObservedStatus] = (result[record.derivedObservedStatus] ?? 0) + 1;
    return result;
  }, {});
  const driftCount = records.filter((record) => record.disagreements.length > 0).length;
  return [
    '# HighLevel Workflow Control Report',
    '',
    '> Generated from `workflow-registry.yaml` plus committed sanitized GHL readbacks. Do not edit this report by hand.',
    '',
    `GitHub desired state: **canonical**. Observed GHL readback: ${finalResult.generatedAt}.`,
    '',
    `Summary: ${canonicalWorkflowAssets.length} workflow assets; ${canonicalCampaignAssets.length} Email Marketing campaign; ${nonWorkflowAssets.length} separately tracked bot/KB assets; ${counts.ACTIVE_TESTED ?? 0} ACTIVE_TESTED; ${counts.DRAFT_WAITING_EXTERNAL ?? 0} DRAFT_WAITING_EXTERNAL; ${counts.SAVED_REOPENED ?? 0} SAVED_REOPENED; ${driftCount} DRIFTED; ${unknownAssets.length} unknown.`,
    '',
    'Organized folders prove location only. They do not prove triggers, actions, activation, enrollment, delivery, or canary success.',
    '',
    '## Canonical folder topology',
    '',
    ...flattenExpectedFolders(workflowFolderTree).map((folder) => `- ${folder}`),
    '',
    ...(folderDrift.length
      ? ['Folder drift:', ...folderDrift.map((item) => `- **DRIFTED:** ${item}`), '']
      : ['Full nested folder readback: **MATCHED**.', '']),
    '## Automation control',
    '',
    '| # | Key | Asset kind | Folder | Desired | Observed | GHL ID | Exact config/readback | Canary | Blocker / drift |',
    '| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...records.map((record) => {
      const asset = record.registry;
      const configuration = asset.providerContract
        ? 'Exact trigger, ordered critical actions, sender, delivery category and full path checked'
        : record.derivedObservedStatus === 'ACTIVE_TESTED'
          ? 'Controlled trigger/action/value canary checked'
          : 'Saved/reopened; detailed trigger/action readback unavailable';
      const drift = record.disagreements.length
        ? `DRIFTED: ${record.disagreements.join('; ')}`
        : asset.blocker || 'None';
      return `| ${asset.displayOrder} | ${asset.key} | ${asset.asset_kind} | ${escapeCell(asset.folder)} | ${asset.desiredStatus} | ${record.derivedObservedStatus} | ${asset.ghlId} | ${configuration} | ${asset.canary.result}: ${escapeCell(asset.canary.detail)} | ${escapeCell(drift)} |`;
    }),
    '',
    'OT-07 and OT-08 are verified Draft assets, but no committed timestamped sanitized enrollment-count readback exists. Their enrollment counts are therefore **Unavailable**, not hardcoded zero.',
    '',
    'OT-C01 is an Email Marketing campaign, remains DRAFT_NOT_SENT, has no configured audience or schedule, and has zero sends. OT-A1 is Off and its KB is tracked outside workflow counts.',
    '',
    '## Unknown assets',
    '',
    ...(unknownAssets.length
      ? unknownAssets.map(
          (workflow) =>
            `- **UNKNOWN / DRIFTED:** ${workflow.name} (${workflow.id}) at ${workflow.folderPath}. Dependency-check first; quarantine to 99 - Deprecated only through an authorized job when safe. Never silently delete.`,
        )
      : ['- None in the committed readback.']),
    '',
    ...(nonWorkflowDrift.length
      ? ['Non-workflow drift:', ...nonWorkflowDrift.map((item) => `- **DRIFTED:** ${item}`), '']
      : ['Non-workflow bot/KB readback: **MATCHED**.', '']),
    '## Closed loop and approvals',
    '',
    `Required loop: ${workflowControlPolicy.closedLoop.join(' -> ')}.`,
    '',
    `Approval-gated: ${workflowControlPolicy.approvalGates.join(', ')}. Agent jobs default to no enrollment, no publication/activation, no broad send, no payment, no production change, no quarantine/deprecation, and no destructive action.`,
    '',
  ].join('\n');
}

function flattenExpectedFolders(folders: WorkflowFolderNode[], parent = 'One Time'): string[] {
  return folders.flatMap((folder) => {
    const current = `${parent} / ${folder.name}`;
    return [current, ...flattenExpectedFolders(folder.children, current)];
  });
}

function flattenObservedFolders(folders: ObservedFolder[], parent = 'One Time'): string[] {
  return folders.flatMap((folder) => {
    const current = `${parent} / ${folder.name}`;
    return [current, ...flattenObservedFolders(folder.children ?? [], current)];
  });
}

function compareOrderedList(expected: string[], observed: string[], label: string) {
  const disagreements: string[] = [];
  if (expected.length !== observed.length) {
    disagreements.push(`${label} count registry=${expected.length} observed=${observed.length}`);
  }
  const length = Math.max(expected.length, observed.length);
  for (let index = 0; index < length; index += 1) {
    if (expected[index] !== observed[index]) {
      disagreements.push(
        `${label} ${index + 1} registry=${expected[index] ?? 'MISSING'} observed=${observed[index] ?? 'MISSING'}`,
      );
    }
  }
  return disagreements;
}

function compareExact(label: string, expected: string, observed: string, drift: string[]) {
  if (expected !== observed) drift.push(`${label} registry=${expected} observed=${observed}`);
}

function normalizeText(value: string) {
  return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trimEnd();
}

function escapeCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(repoRoot, filePath), 'utf8')) as T;
}
