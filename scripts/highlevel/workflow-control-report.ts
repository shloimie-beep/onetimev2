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
  workflowRoot,
  type WorkflowControlState,
  type WorkflowFolderNode,
  type WorkflowRegistryRecord,
} from './workflow-registry-source.ts';

type ObservedFolder = { name: string; id: string; children?: ObservedFolder[] };
type FinalWorkflow = {
  key: string;
  name: string;
  id: string;
  folderPath: string;
  status: 'draft' | 'published';
  reopenedVerified: string;
  testStatus: 'draft_blocked' | 'active_tested';
  assetKind: 'workflow' | 'email_marketing_campaign';
  configurationEmpty: boolean;
  observedTriggers: string[];
  observedActions: string[];
};
type LiveLocationInventory = {
  schemaVersion: string;
  generatedAt: string;
  mutationPerformed: false;
  locationFingerprint: string;
  root: { name: string; id: string };
  scope: {
    locationRoot: boolean;
    nestedFolders: boolean;
    archived: boolean;
    deprecatedFolder: boolean;
    workflows: boolean;
    campaigns: boolean;
    botsAndKnowledgeBases: boolean;
  };
  assets: Array<{
    key?: string;
    name: string;
    id: string;
    assetKind: string;
    fullPath: string;
    observedStatus: string;
    lifecycleView: 'active' | 'draft' | 'archived' | 'deprecated' | 'off' | 'reference';
  }>;
};
type GovernanceCloseoutResult = {
  generatedAt: string;
  mode: string;
  location: { id: string; fingerprint: string; matchVerified: boolean };
  scopeCoverage: {
    literalLocationRoot: boolean;
    literalOneTimeRoot: boolean;
    allTenDirectOneTimeFolders: boolean;
    allVisibleNestedWorkflowFolders: boolean;
    allVisibleWorkflowRows: boolean;
    deletedWorkflowView: boolean;
    archivedWorkflowView: boolean;
    deprecated99Folder: boolean;
    marketingEmailCampaignsHome: boolean;
    conversationAiVisibleList: boolean;
    conversationAiBackendOrHiddenRows: boolean;
    knowledgeBases: boolean;
    unverifiedScopesAreNotAssertedEmpty: boolean;
  };
  safety: {
    ghlMutations: number;
    contactsImportedOrChanged: number;
    workflowEnrollments: number;
    customerEmailsSent: number;
    whatsAppActionsOrSends: number;
    rawProviderUrlsRecorded: boolean;
  };
  folderTree: ObservedFolder & { path: string; directChildCount: number };
  workflowInventory: Array<{
    key: string;
    id: string;
    kind: 'workflow';
    name: string;
    fullPath: string;
    observedStatus: 'Draft' | 'Published';
    enrollments: { total?: number; historical?: number; active: number };
    configuration: {
      trigger: null | Record<string, unknown>;
      orderedActions: Array<Record<string, unknown>>;
      canvas?: string;
      acknowledgementActionPresent?: boolean;
      legacy24HourActionPresent?: boolean;
      whatsAppActionsPresent?: boolean;
      allowReentry?: boolean;
      idempotentEnrollment?: boolean;
      inFlightEnrollmentRetained?: boolean;
      deliveryEligibility?: Record<string, unknown>;
    };
  }>;
  workflowLifecycleViews: {
    deleted: { verified: boolean; rows: unknown[] };
    archived: { verified: boolean; reason: string };
  };
  marketingEmailCampaigns: Array<{
    key: string;
    id: string;
    kind: 'email_campaign';
    name: string;
    fullPath: string;
    observedStatus: 'Draft';
    senderRegistryKey: string;
    registeredSenderPickerPresent: boolean;
    copyIdentitySha256: string;
    publicCta: string;
    protectedDirectClassLinkPresent: boolean;
    selectedRecipients: number;
    proofSends: number;
    campaignSends: number;
  }>;
  savedAudienceClassification: {
    filterCount: number;
    uniqueEligibleCount: number;
    selectedInCampaign: boolean;
    usedForProofOrSend: boolean;
  };
  conversationAi: {
    visibleListVerified: boolean;
    visibleRows: Array<{ id: string; name: string; observedStatus: string }>;
    priorRegistryCandidate: {
      key: string;
      id: string;
      name: string;
      currentLiveStatus: string;
    };
  };
  knowledgeBases: Array<{
    id: string;
    kind: 'knowledge_base';
    name: string;
    fullPath: string;
    observedStatus: string;
  }>;
};
type TishaActivationResult = {
  generatedAt: string;
  assets: Array<{
    key: string;
    id?: string;
    kind: string;
    folderAncestry?: string;
    triggerOrEnrollment?: string;
    orderedActions?: Array<{
      order: number;
      kind: string;
      name: string;
      senderKey?: string;
      subject?: string;
      preheader?: string;
      linkCustomValueKey?: string;
      liveLinkReadback?: string;
      rawProviderUrlRecorded?: boolean;
      directClassLink?: string | boolean;
      at?: string;
      lateBehavior?: string;
    }>;
    observedStatus?: string;
    saved?: boolean;
    reopenedVerified?: boolean;
    liveCounts?: {
      activeEnrollments?: number;
      historicalEnrollments?: number;
      messagesSentDuringThisRun?: number;
    };
    registrationHandoffReadback?: {
      userReportedFreshProductionSignup?: boolean;
      newEnrollmentObserved?: boolean;
      registeredEventTagObservedByWorkflow?: boolean;
      manualTagOrEnrollmentApplied?: boolean;
      loginCodeEmailIsSeparateFromEventConfirmation?: boolean;
    };
    remainingBlocker?: string | null;
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
const governanceCloseoutPath =
  'integrations/highlevel/agent-mode/results/GHL-GOVERNANCE-CLOSEOUT-20260722.result.json';
const tishaActivationPath =
  'integrations/highlevel/agent-mode/results/GHL-TISHA-BAV-ACTIVATION-20260722.result.json';
const canonical = [...canonicalAutomationAssets].sort(
  (left, right) => left.displayOrder - right.displayOrder,
);

const governanceCloseout = await readJson<GovernanceCloseoutResult>(governanceCloseoutPath);
const tishaActivation = await readJson<TishaActivationResult>(tishaActivationPath);
const liveInventory = liveInventoryFromGovernanceCloseout(governanceCloseout);
const observedByKey = new Map(
  [
    ...governanceCloseout.workflowInventory
      .filter((workflow) => workflow.key !== 'OT-C01')
      .map(toObservedWorkflow),
    ...governanceCloseout.marketingEmailCampaigns.map(toObservedCampaign),
  ].map((asset) => [asset.key, asset]),
);
const comparisons = canonical.map(compareAsset);
const unknown = findUnknownAssets(liveInventory);
const folderDisagreements = compareOrderedList(
  flattenExpectedFolders(workflowFolderTree),
  flattenObservedFolders(governanceCloseout.folderTree.children ?? []),
  'folder path',
);
if (governanceCloseout.folderTree.name !== workflowRoot) {
  folderDisagreements.unshift(
    `literal root registry=${workflowRoot} observed=${governanceCloseout.folderTree.name}`,
  );
}
const inventoryDisagreements = validateLiveInventory(liveInventory);
const nonWorkflowDisagreements = compareNonWorkflowAssets();
const report = await format(
  buildReport(
    comparisons,
    unknown,
    folderDisagreements,
    inventoryDisagreements,
    nonWorkflowDisagreements,
  ),
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
  inventoryDisagreements.length === 0 &&
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
      unknownAssets: unknown.map((asset) => ({
        key: asset.key ?? null,
        name: asset.name,
        id: asset.id,
        assetKind: asset.assetKind,
        folderPath: asset.fullPath,
        lifecycleView: asset.lifecycleView,
        disposition: 'DEPENDENCY_CHECK_REQUIRED_BEFORE_SAFE_AUTHORIZED_QUARANTINE',
      })),
      unknownAssetStatus:
        inventoryDisagreements.length === 0
          ? 'exhaustive_inventory_checked'
          : 'unavailable_incomplete_inventory',
      folderDisagreements,
      inventoryDisagreements,
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
  const derivedObservedStatus = observed ? deriveObservedStatus(observed) : 'MISSING';
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
    const expectedPath = expectedAssetPath(registry);
    if (observed.folderPath !== expectedPath) {
      disagreements.push(`folder registry=${expectedPath} observed=${observed.folderPath}`);
    }
  }
  if (derivedObservedStatus !== registry.observedStatus) {
    disagreements.push(
      `status registry=${registry.observedStatus} observed=${derivedObservedStatus}`,
    );
  }
  if (registry.assetLifecycle === 'canonical') {
    compareObservedConfiguration(registry, observed, disagreements);
  }
  if (registry.key === 'OT-E01') compareTerminalE01(registry, disagreements);
  if (registry.key === 'OT-C01') compareTerminalC01(registry, disagreements);
  if (registry.asset_kind === 'email_marketing_campaign') {
    compareCampaignReadback(registry, disagreements);
  }
  return { key: registry.key, registry, observed, derivedObservedStatus, disagreements };
}

function compareObservedConfiguration(
  registry: WorkflowRegistryRecord,
  observed: FinalWorkflow | null,
  disagreements: string[],
) {
  if (!observed || registry.key === 'OT-E01' || registry.key === 'OT-C01') return;
  disagreements.push(
    ...compareOrderedList(registry.observedTriggers, observed.observedTriggers, 'observed trigger'),
  );
  disagreements.push(
    ...compareOrderedList(registry.observedActions, observed.observedActions, 'observed action'),
  );
  if (registry.observedStatus === 'DRAFT_SHELL' && !observed.configurationEmpty) {
    disagreements.push('DRAFT_SHELL must have zero trigger and zero actions');
  }
}

function compareTerminalE01(registry: WorkflowRegistryRecord, disagreements: string[]) {
  const asset = tishaActivation.assets.find((candidate) => candidate.key === 'OT-E01');
  const expected = registry.essentialValues;
  const expectedActions = [
    ['email', 'Email A - Immediate Confirmation'],
    ['fixed_wait', 'Wait until 1 hour before event'],
    ['email', 'Email C - One Hour'],
    ['fixed_wait', 'Wait until 10 minutes before event'],
    ['email', 'Email D - Join Now'],
  ];
  const passed =
    Boolean(asset) &&
    Boolean(expected) &&
    asset?.id === registry.ghlId &&
    asset?.kind === 'workflow' &&
    asset?.folderAncestry === expectedAssetPath(registry) &&
    asset?.triggerOrEnrollment?.startsWith(`${registry.exactTrigger};`) === true &&
    asset?.observedStatus === 'published' &&
    asset?.saved === true &&
    asset?.reopenedVerified === true &&
    asset?.liveCounts?.historicalEnrollments === expected?.historical_enrollments &&
    asset?.liveCounts?.activeEnrollments === expected?.active_enrollments &&
    asset?.liveCounts?.messagesSentDuringThisRun === expected?.messages_sent_terminal_run &&
    asset?.orderedActions?.length === expectedActions.length &&
    expectedActions.every(
      ([kind, name], index) =>
        asset?.orderedActions?.[index]?.order === index + 1 &&
        asset?.orderedActions?.[index]?.kind === kind &&
        asset?.orderedActions?.[index]?.name === name,
    ) &&
    asset?.orderedActions?.[0]?.senderKey === expected?.immediate_email_sender_key &&
    asset?.orderedActions?.[0]?.subject === expected?.immediate_email_subject &&
    asset?.orderedActions?.[0]?.preheader === expected?.immediate_email_preheader &&
    asset?.orderedActions?.[0]?.linkCustomValueKey ===
      expected?.immediate_email_link_custom_value_key &&
    asset?.orderedActions?.[0]?.liveLinkReadback === expected?.immediate_email_live_link_readback &&
    asset?.orderedActions?.[0]?.rawProviderUrlRecorded === false &&
    asset?.orderedActions?.[0]?.directClassLink === false &&
    asset?.orderedActions?.[1]?.at === expected?.one_hour_reminder_scheduled_at &&
    asset?.orderedActions?.[2]?.directClassLink === 'sanitized_present_valid_operator_authorized' &&
    asset?.orderedActions?.[3]?.at === expected?.ten_minute_reminder_scheduled_at &&
    asset?.orderedActions?.[4]?.directClassLink === 'sanitized_present_valid_operator_authorized' &&
    asset?.orderedActions?.[1]?.lateBehavior ===
      'skip_expired_outbound_until_next_wait_or_event_start' &&
    asset?.orderedActions?.[3]?.lateBehavior ===
      'skip_expired_outbound_until_next_wait_or_event_start' &&
    asset?.registrationHandoffReadback?.userReportedFreshProductionSignup === true &&
    asset?.registrationHandoffReadback?.newEnrollmentObserved === false &&
    asset?.registrationHandoffReadback?.registeredEventTagObservedByWorkflow === false &&
    asset?.registrationHandoffReadback?.manualTagOrEnrollmentApplied === false &&
    asset?.registrationHandoffReadback?.loginCodeEmailIsSeparateFromEventConfirmation === true &&
    Boolean(asset?.remainingBlocker);
  if (!passed || registry.canary.result !== 'passed') {
    disagreements.push('OT-E01 terminal save/readback or upstream-handoff blocker mismatch');
  }
}

function compareTerminalC01(registry: WorkflowRegistryRecord, disagreements: string[]) {
  const asset = governanceCloseout.marketingEmailCampaigns.find(
    (candidate) => candidate.key === 'OT-C01',
  );
  const expected = registry.essentialValues;
  const passed =
    Boolean(asset) &&
    Boolean(expected) &&
    asset?.id === registry.ghlId &&
    asset?.kind === 'email_campaign' &&
    asset?.fullPath === expectedAssetPath(registry) &&
    asset?.senderRegistryKey === registry.senderKey &&
    asset?.registeredSenderPickerPresent === true &&
    asset?.copyIdentitySha256 === expected?.content_identity &&
    asset?.publicCta === expected?.public_cta &&
    asset?.protectedDirectClassLinkPresent === false &&
    asset?.observedStatus === 'Draft' &&
    asset?.selectedRecipients === 0 &&
    asset?.proofSends === 0 &&
    asset?.campaignSends === 0 &&
    governanceCloseout.savedAudienceClassification.filterCount === 9 &&
    governanceCloseout.savedAudienceClassification.uniqueEligibleCount === 0 &&
    !governanceCloseout.savedAudienceClassification.selectedInCampaign &&
    !governanceCloseout.savedAudienceClassification.usedForProofOrSend &&
    governanceCloseout.safety.customerEmailsSent === 0 &&
    governanceCloseout.safety.whatsAppActionsOrSends === 0;
  if (!passed) disagreements.push('OT-C01 exact sender/copy/CTA/audience/safety readback mismatch');
}

function compareCampaignReadback(registry: WorkflowRegistryRecord, disagreements: string[]) {
  const observed = governanceCloseout.marketingEmailCampaigns.find(
    (campaign) => campaign.key === registry.key,
  );
  if (!observed) {
    disagreements.push('campaign asset-kind readback missing');
    return;
  }
  compareExact('asset kind', 'email_campaign', observed.kind, disagreements);
  compareExact('campaign ID', registry.ghlId, observed.id, disagreements);
  compareExact('campaign full path', expectedAssetPath(registry), observed.fullPath, disagreements);
  const expected = registry.audienceReadback;
  if (
    !expected ||
    observed.observedStatus !== 'Draft' ||
    observed.selectedRecipients !== 0 ||
    observed.campaignSends !== expected.sends
  ) {
    disagreements.push('campaign Draft/audience/schedule/send readback mismatch');
  }
}

function compareNonWorkflowAssets() {
  const disagreements: string[] = [];
  for (const expected of nonWorkflowAssets) {
    if (expected.key === 'OT-A1') {
      const observed = governanceCloseout.conversationAi.priorRegistryCandidate;
      if (
        observed.id !== expected.ghlId ||
        observed.currentLiveStatus !== 'unverified_not_visible_in_current_list' ||
        expected.observedStatus !== 'UNVERIFIED_NOT_VISIBLE'
      ) {
        disagreements.push(`${expected.key}: id/current-visible-status disagreement`);
      }
      continue;
    }
    const observed = governanceCloseout.knowledgeBases.find((asset) => asset.id === expected.ghlId);
    if (
      !observed ||
      observed.kind !== expected.asset_kind ||
      observed.name !== expected.canonicalName ||
      observed.fullPath !== expected.folder ||
      observed.observedStatus !== 'visible'
    ) {
      disagreements.push(`${expected.key}: kind/id/path/status disagreement`);
    }
  }
  return disagreements;
}

function deriveObservedStatus(observed: FinalWorkflow): WorkflowControlState {
  if (observed.status === 'published' && observed.testStatus === 'active_tested') {
    return 'ACTIVE_TESTED';
  }
  if (observed.status === 'draft' && observed.configurationEmpty) return 'DRAFT_SHELL';
  if (observed.status === 'draft' && observed.reopenedVerified) return 'SAVED_REOPENED';
  return 'DRIFTED';
}

function buildReport(
  records: Comparison[],
  unknownAssets: LiveLocationInventory['assets'],
  folderDrift: string[],
  inventoryDrift: string[],
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
    `GitHub desired state: **canonical**. Exhaustive observed GHL readback: ${governanceCloseout.generatedAt}; terminal OT-E01 save/handoff readback: ${tishaActivation.generatedAt}; visible location inventory: ${liveInventory.generatedAt}.`,
    '',
    `Summary: ${canonicalWorkflowAssets.length} canonical workflow assets; ${canonicalCampaignAssets.length} canonical Email Marketing campaign; ${nonWorkflowAssets.length} separately tracked bot/KB assets; ${counts.ACTIVE_TESTED ?? 0} ACTIVE_TESTED; ${counts.DRAFT_SHELL ?? 0} DRAFT_SHELL; ${counts.SAVED_REOPENED ?? 0} SAVED_REOPENED; ${driftCount} registry/readback disagreements; ${unknownAssets.length} visible unknown/cross-kind assets; archived and hidden AI scope ${inventoryDrift.length ? 'UNVERIFIED' : 'verified'}.`,
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
    ...(inventoryDrift.length
      ? [
          'Exhaustive inventory drift:',
          ...inventoryDrift.map((item) => `- **DRIFTED:** ${item}`),
          '',
        ]
      : [
          `Exhaustive inventory scope: **VERIFIED** for literal root ${workflowRoot}, nested folders, location root, archived, 99 Deprecated, workflows, campaigns, bots, and knowledge bases.`,
          '',
        ]),
    '## Automation control',
    '',
    '| # | Key | Asset kind | Folder | Desired | Observed | GHL ID | Exact config/readback | Canary | Blocker / drift |',
    '| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...records.map((record) => {
      const asset = record.registry;
      const configuration =
        record.key === 'OT-E01'
          ? 'GHL configuration saved/reopened; historical controlled canary retained; current application registration handoff FAILED'
          : record.derivedObservedStatus === 'DRAFT_SHELL'
            ? 'Exact empty canvas: zero trigger and zero actions'
            : record.derivedObservedStatus === 'ACTIVE_TESTED'
              ? 'Exact trigger, ordered actions, timing, protected-link semantics and canary checked'
              : asset.asset_kind === 'email_marketing_campaign'
                ? 'Exact sender, copy identity, public CTA, zero audience and zero sends checked'
                : 'Observed configuration checked';
      const drift = record.disagreements.length
        ? `DRIFTED: ${record.disagreements.join('; ')}`
        : asset.blocker || 'None';
      return `| ${asset.displayOrder} | ${asset.key} | ${asset.asset_kind} | ${escapeCell(asset.folder)} | ${asset.desiredStatus} | ${record.derivedObservedStatus} | ${asset.ghlId} | ${configuration} | ${asset.canary.result}: ${escapeCell(asset.canary.detail)} | ${escapeCell(drift)} |`;
    }),
    '',
    'OT-07 and OT-08 are verified empty Draft canvases with exact visible enrollment counters of **0 total / 0 active** in the committed timestamped closeout artifact.',
    '',
    'OT-E01 is Published and its approved Email A copy/sender/canonical One Time page were saved and reopened on the same ID. This does **not** prove current registration end to end: the newest production signup added no exact registered-event tag, created no new enrollment, and received no event confirmation. The application handoff is the P0 blocker; no manual tag, enrollment, fallback, duplicate signup, or send was applied.',
    '',
    'OT-C01 is two distinct assets: the canonical Email Marketing campaign remains Draft with zero recipients/sends, while the separate same-name Draft workflow wrapper is reported below as cross-kind drift and must not be activated, quarantined, deleted, or collapsed. OT-A1 is currently unverified/not visible; the canonical KB and one unknown legacy KB are tracked outside workflow counts.',
    '',
    '## Unknown assets',
    '',
    ...(inventoryDrift.length
      ? [
          '- **FAIL CLOSED:** visible unknown/cross-kind assets are listed below, but the result cannot be declared exhaustive while archived workflows and hidden/backend Conversation AI rows remain unverified.',
          ...unknownAssets.map(
            (asset) =>
              `- **UNKNOWN / DRIFTED:** ${asset.name} (${asset.id}) [${asset.assetKind}; ${asset.lifecycleView}] at ${asset.fullPath}. Dependency-check first; quarantine to 99 - Deprecated only through an authorized job when safe. Never silently delete.`,
          ),
        ]
      : unknownAssets.length
        ? unknownAssets.map(
            (workflow) =>
              `- **UNKNOWN / DRIFTED:** ${workflow.name} (${workflow.id}) [${workflow.assetKind}; ${workflow.lifecycleView}] at ${workflow.fullPath}. Dependency-check first; quarantine to 99 - Deprecated only through an authorized job when safe. Never silently delete.`,
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

function validateLiveInventory(inventory: LiveLocationInventory) {
  const disagreements: string[] = [];
  if (inventory.mutationPerformed !== false) {
    disagreements.push('live inventory must be read-only');
  }
  if (!inventory.locationFingerprint) disagreements.push('location fingerprint missing');
  if (inventory.root.name !== workflowRoot) {
    disagreements.push(`literal root registry=${workflowRoot} inventory=${inventory.root.name}`);
  }
  if (inventory.root.id !== governanceCloseout.folderTree.id) {
    disagreements.push(
      `root id closeout=${governanceCloseout.folderTree.id} inventory=${inventory.root.id}`,
    );
  }
  for (const [scope, covered] of Object.entries(inventory.scope)) {
    if (!covered) disagreements.push(`inventory scope not verified: ${scope}`);
  }
  const duplicateIds = inventory.assets
    .map((asset) => asset.id)
    .filter((id, index, all) => id && all.indexOf(id) !== index);
  if (duplicateIds.length) {
    disagreements.push(`inventory duplicate IDs: ${[...new Set(duplicateIds)].join(', ')}`);
  }
  return disagreements;
}

function liveInventoryFromGovernanceCloseout(
  result: GovernanceCloseoutResult,
): LiveLocationInventory {
  const workflowAssets: LiveLocationInventory['assets'] = result.workflowInventory.map((asset) => ({
    key: asset.key,
    name: asset.name,
    id: asset.id,
    assetKind: 'workflow',
    fullPath: asset.fullPath,
    observedStatus: asset.observedStatus,
    lifecycleView: asset.observedStatus === 'Published' ? 'active' : 'draft',
  }));
  const campaignAssets: LiveLocationInventory['assets'] = result.marketingEmailCampaigns.map(
    (asset) => ({
      key: asset.key,
      name: asset.name,
      id: asset.id,
      assetKind: 'email_marketing_campaign',
      fullPath: asset.fullPath,
      observedStatus: asset.observedStatus,
      lifecycleView: 'draft',
    }),
  );
  const knowledgeBaseAssets: LiveLocationInventory['assets'] = result.knowledgeBases.map(
    (asset) => ({
      name: asset.name,
      id: asset.id,
      assetKind: asset.kind,
      fullPath: asset.fullPath,
      observedStatus: asset.observedStatus,
      lifecycleView: 'reference',
    }),
  );
  return {
    schemaVersion: 'one-time-highlevel-governance-closeout@1.0.0',
    generatedAt: result.generatedAt,
    mutationPerformed: false,
    locationFingerprint: result.location.fingerprint,
    root: { name: result.folderTree.name, id: result.folderTree.id },
    scope: {
      locationRoot: result.scopeCoverage.literalLocationRoot,
      nestedFolders:
        result.scopeCoverage.allTenDirectOneTimeFolders &&
        result.scopeCoverage.allVisibleNestedWorkflowFolders,
      archived: result.scopeCoverage.archivedWorkflowView,
      deprecatedFolder: result.scopeCoverage.deprecated99Folder,
      workflows:
        result.scopeCoverage.allVisibleWorkflowRows &&
        result.workflowLifecycleViews.deleted.verified,
      campaigns: result.scopeCoverage.marketingEmailCampaignsHome,
      botsAndKnowledgeBases:
        result.scopeCoverage.conversationAiVisibleList &&
        result.scopeCoverage.conversationAiBackendOrHiddenRows &&
        result.scopeCoverage.knowledgeBases,
    },
    assets: [...workflowAssets, ...campaignAssets, ...knowledgeBaseAssets],
  };
}

function toObservedWorkflow(
  asset: GovernanceCloseoutResult['workflowInventory'][number],
): FinalWorkflow {
  const trigger = asset.configuration.trigger;
  const actions = asset.configuration.orderedActions;
  return {
    key: asset.key,
    name: asset.name,
    id: asset.id,
    folderPath: asset.fullPath,
    status: asset.observedStatus === 'Published' ? 'published' : 'draft',
    reopenedVerified: 'read_back',
    testStatus: asset.key === 'OT-E01' ? 'active_tested' : 'draft_blocked',
    assetKind: 'workflow',
    configurationEmpty: trigger === null && actions.length === 0,
    observedTriggers: trigger === null ? [] : [stableObservedValue(trigger)],
    observedActions: actions.map(stableObservedValue),
  };
}

function toObservedCampaign(
  asset: GovernanceCloseoutResult['marketingEmailCampaigns'][number],
): FinalWorkflow {
  return {
    key: asset.key,
    name: asset.name,
    id: asset.id,
    folderPath: asset.fullPath,
    status: 'draft',
    reopenedVerified: 'read_back',
    testStatus: 'draft_blocked',
    assetKind: 'email_marketing_campaign',
    configurationEmpty: false,
    observedTriggers: [],
    observedActions: [],
  };
}

function stableObservedValue(value: Record<string, unknown>) {
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))),
  );
}

function expectedAssetPath(registry: WorkflowRegistryRecord) {
  return registry.asset_kind === 'email_marketing_campaign'
    ? registry.folder
    : registry.folder.startsWith(`${workflowRoot} / `)
      ? registry.folder
      : `${workflowRoot} / ${registry.folder}`;
}

function findUnknownAssets(inventory: LiveLocationInventory) {
  const canonicalIds = new Set(
    [...canonicalAutomationAssets, ...nonWorkflowAssets]
      .map((asset) => asset.ghlId)
      .filter(Boolean),
  );
  const canonicalKindAndNames = new Set(
    [...canonicalAutomationAssets, ...nonWorkflowAssets].map(
      (asset) => `${asset.asset_kind}\u0000${asset.canonicalName}`,
    ),
  );
  return inventory.assets.filter(
    (asset) =>
      !canonicalIds.has(asset.id) &&
      !canonicalKindAndNames.has(`${asset.assetKind}\u0000${asset.name}`),
  );
}

function flattenExpectedFolders(folders: WorkflowFolderNode[], parent = workflowRoot): string[] {
  return folders.flatMap((folder) => {
    const current = `${parent} / ${folder.name}`;
    return [current, ...flattenExpectedFolders(folder.children, current)];
  });
}

function flattenObservedFolders(folders: ObservedFolder[], parent = workflowRoot): string[] {
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
